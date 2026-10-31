/**
 * server/services/authAndContactsService.js
 * 
 * Handles Firebase Authentication verification and Firestore Emergency Contacts
 * retrieval for the backend.
 * 
 * Guarantees:
 * 1. Derives user identity strictly from verified Firebase ID token.
 * 2. Retrieves only the authenticated user's emergency contacts from Firestore:
 *    users/{uid}/emergencyContacts.
 * 3. Never accepts arbitrary phone numbers / recipients from the client body.
 * 4. Gracefully saves or updates the Firestore SOS alert document.
 */

const admin = require('firebase-admin');
const fetch = require('node-fetch');

let customFirestoreDb = null;

function setCustomFirestoreDb(db) {
  customFirestoreDb = db;
}

// Initialize Firebase Admin once if not already initialized
function getAdminApp() {
  if (admin.apps.length > 0) return admin;
  try {
    admin.initializeApp({
      projectId: process.env.FIREBASE_PROJECT_ID || 'sahaara-93ecc',
    });
  } catch (err) {
    console.warn('[Firebase Admin] Init notice:', err.message);
  }
  return admin;
}

function getFirestoreDb() {
  if (customFirestoreDb) return customFirestoreDb;
  try {
    const adminApp = getAdminApp();
    if (adminApp && typeof adminApp.firestore === 'function') {
      return adminApp.firestore();
    }
  } catch (err) {
    // Admin firestore may not be configured
  }
  return null;
}

/**
 * Extracts and verifies the Firebase ID token from Authorization header.
 * Authorization: Bearer <idToken>
 */
async function verifyFirebaseUser(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.split('Bearer ')[1].trim();
  if (!token) return null;

  // Support mocked tokens strictly during automated tests when NODE_ENV === 'test'
  if (process.env.NODE_ENV === 'test' && req.headers['x-test-auth-mock'] === 'true') {
    if (token.startsWith('mock-token-')) {
      const uid = token.replace('mock-token-', '');
      return {
        uid,
        email: `${uid}@test.sahaara.app`,
        name: req.headers['x-test-user-name'] || 'Test Elder',
        token,
      };
    }
  }

  try {
    const adminApp = getAdminApp();
    const decoded = await adminApp.auth().verifyIdToken(token);
    return {
      uid: decoded.uid,
      email: decoded.email || `${decoded.uid}@sahaara.app`,
      name: decoded.name || decoded.displayName || 'Sahaara Member',
      token,
    };
  } catch (err) {
    console.warn('[Auth] ID token verification failed:', err.message);
    return null;
  }
}

// Dedicated test hook for automated test suites to mock Firestore contacts retrieval.
// NEVER exposed to, readable from, or controllable by HTTP request bodies.
let testMockContactsResolver = null;

function setTestMockContactsResolver(fnOrMap) {
  testMockContactsResolver = fnOrMap;
}

/**
 * Retrieves the emergency contacts strictly belonging to the authenticated user.
 * Path: users/{uid}/emergencyContacts
 * Does NOT accept arbitrary contacts or recipient overrides from the client request body.
 */
async function getUserEmergencyContacts(uid, token = null) {
  if (!uid) return [];

  // Automated test mock resolver: active ONLY when NODE_ENV === 'test' via dependency injection
  if (process.env.NODE_ENV === 'test' && testMockContactsResolver) {
    if (typeof testMockContactsResolver === 'function') {
      const mocked = testMockContactsResolver(uid);
      if (mocked) return mocked;
    } else if (Array.isArray(testMockContactsResolver)) {
      return testMockContactsResolver;
    } else if (typeof testMockContactsResolver === 'object' && testMockContactsResolver[uid]) {
      return testMockContactsResolver[uid];
    }
  }

  // Strategy 1: Firebase Admin SDK
  try {
    const db = getFirestoreDb();
    if (db) {
      const snap = await db
        .collection('users')
        .doc(uid)
        .collection('emergencyContacts')
        .orderBy('createdAt', 'desc')
        .get();

      if (!snap.empty) {
        return snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
      }
    }
  } catch (_) {
    // Admin Firestore might not have local service account
  }

  // Strategy 2: Firestore REST API using the user's ID token (evaluates rules as that user)
  if (token) {
    try {
      const projectId = process.env.FIREBASE_PROJECT_ID || 'sahaara-93ecc';
      const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${uid}/emergencyContacts`;
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (res.ok) {
        const data = await res.json();
        if (data.documents && Array.isArray(data.documents)) {
          return data.documents.map((d) => {
            const fields = d.fields || {};
            return {
              id: d.name.split('/').pop(),
              name: fields.name?.stringValue || 'Guardian',
              phone: fields.phone?.stringValue || '',
              relation: fields.relation?.stringValue || '',
            };
          });
        }
      }
    } catch (err) {
      console.warn('[Contacts] REST fetch notice:', err.message);
    }
  }

  return [];
}

/**
 * Creates the initial SOS record in Firestore BEFORE messages are dispatched.
 * Returns the generated alertId so Message SIDs can be linked durably.
 */
async function createInitialSosAlertRecord({
  userId,
  userEmail,
  userName,
  location,
  reason,
  contacts = [],
  provider = 'twilio_whatsapp',
  token = null,
  firestoreDb = null,
}) {
  const alertPayload = {
    userId: userId || 'unknown',
    userEmail: userEmail || 'unknown@sahaara.app',
    userName: userName || 'Sahaara Member',
    latitude: location?.lat ?? null,
    longitude: location?.lng ?? null,
    accuracy: location?.accuracy ?? null,
    mapsLink: location
      ? `https://www.google.com/maps/search/?api=1&query=${location.lat},${location.lng}`
      : null,
    locationAvailable: Boolean(location),
    address: location?.address ?? null,
    status: 'SENDING',
    overallStatus: 'SENDING',
    whatsappStatus: 'SENDING',
    guardianResults: [],
    message: `SOS alert (${reason || 'manual'}) triggered via Sahaara app`,
    contacts: (contacts || []).map((c) => c.name || c.phone),
    provider,
    createdAt: new Date().toISOString(),
  };

  const db = firestoreDb || getFirestoreDb();
  if (db) {
    try {
      const docRef = await db.collection('sos_alerts').add({
        ...alertPayload,
        timestamp: admin.firestore ? admin.firestore.FieldValue.serverTimestamp() : new Date(),
      });
      return docRef.id;
    } catch (adminErr) {
      console.warn('[SOS Alert] Firestore add notice:', adminErr.message);
    }
  }

  // Fallback: If token present, create via Firestore REST API
  if (token) {
    try {
      const projectId = process.env.FIREBASE_PROJECT_ID || 'sahaara-93ecc';
      const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/sos_alerts`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fields: {
            userId: { stringValue: alertPayload.userId },
            userEmail: { stringValue: alertPayload.userEmail },
            userName: { stringValue: alertPayload.userName },
            status: { stringValue: alertPayload.status },
            overallStatus: { stringValue: alertPayload.overallStatus },
            provider: { stringValue: alertPayload.provider },
            message: { stringValue: alertPayload.message },
            createdAt: { stringValue: alertPayload.createdAt },
          },
        }),
      });
      if (res.ok) {
        const docData = await res.json();
        return docData.name ? docData.name.split('/').pop() : null;
      }
    } catch (_) {}
  }

  return `alert-${Date.now()}`;
}

/**
 * Updates the SOS record in Firestore after initial dispatch is complete.
 */
async function updateSosAlertRecord({
  alertId,
  status,
  overallStatus,
  results = [],
  token = null,
  firestoreDb = null,
}) {
  if (!alertId) return;
  const db = firestoreDb || getFirestoreDb();
  if (db) {
    try {
      const docRef = db.collection('sos_alerts').doc(alertId);
      await docRef.update({
        status: status || overallStatus,
        overallStatus: overallStatus || status,
        whatsappStatus: overallStatus || status,
        guardianResults: results,
        lastUpdated: new Date().toISOString(),
      });
      return;
    } catch (err) {
      console.warn('[SOS Alert] Firestore update notice:', err.message);
    }
  }

  // REST fallback
  if (token) {
    try {
      const projectId = process.env.FIREBASE_PROJECT_ID || 'sahaara-93ecc';
      const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/sos_alerts/${alertId}?updateMask.fieldPaths=status&updateMask.fieldPaths=overallStatus`;
      await fetch(url, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fields: {
            status: { stringValue: status || overallStatus },
            overallStatus: { stringValue: overallStatus || status },
          },
        }),
      });
    } catch (_) {}
  }
}

/**
 * Saves or updates a Firestore SOS record under collection 'sos_alerts'.
 */
async function recordSosAlert({
  userId,
  userEmail,
  userName,
  location,
  status,
  overallStatus,
  results,
  contacts,
  reason,
  provider = 'twilio_whatsapp',
  token = null,
  firestoreDb = null,
}) {
  const alertPayload = {
    userId: userId || 'unknown',
    userEmail: userEmail || 'unknown@sahaara.app',
    userName: userName || 'Sahaara Member',
    latitude: location?.lat ?? null,
    longitude: location?.lng ?? null,
    accuracy: location?.accuracy ?? null,
    mapsLink: location
      ? `https://www.google.com/maps/search/?api=1&query=${location.lat},${location.lng}`
      : null,
    locationAvailable: Boolean(location),
    address: location?.address ?? null,
    status: overallStatus || status || 'FAILED',
    overallStatus: overallStatus || status || 'FAILED',
    whatsappStatus: overallStatus || status || 'FAILED',
    guardianResults: results || [],
    message: `SOS alert (${reason || 'manual'}) triggered via Sahaara app`,
    contacts: (contacts || []).map((c) => c.name || c.phone),
    provider,
    createdAt: new Date().toISOString(),
  };

  const db = firestoreDb || getFirestoreDb();
  if (db) {
    try {
      const docRef = await db.collection('sos_alerts').add({
        ...alertPayload,
        timestamp: admin.firestore ? admin.firestore.FieldValue.serverTimestamp() : new Date(),
      });
      return docRef.id;
    } catch (adminErr) {
      console.warn('[SOS Alert] Firestore add notice:', adminErr.message);
    }
  }

  // Fallback: If token present, create via Firestore REST API
  if (token) {
    try {
      const projectId = process.env.FIREBASE_PROJECT_ID || 'sahaara-93ecc';
      const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/sos_alerts`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fields: {
            userId: { stringValue: alertPayload.userId },
            userEmail: { stringValue: alertPayload.userEmail },
            userName: { stringValue: alertPayload.userName },
            status: { stringValue: alertPayload.status },
            overallStatus: { stringValue: alertPayload.overallStatus },
            provider: { stringValue: alertPayload.provider },
            message: { stringValue: alertPayload.message },
            createdAt: { stringValue: alertPayload.createdAt },
          },
        }),
      });
      if (res.ok) {
        const docData = await res.json();
        return docData.name ? docData.name.split('/').pop() : null;
      }
    } catch (_) {}
  }

  return `alert-${Date.now()}`;
}

module.exports = {
  getAdminApp,
  getFirestoreDb,
  setCustomFirestoreDb,
  verifyFirebaseUser,
  getUserEmergencyContacts,
  setTestMockContactsResolver,
  createInitialSosAlertRecord,
  updateSosAlertRecord,
  recordSosAlert,
};
