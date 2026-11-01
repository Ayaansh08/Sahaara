/**
 * services/sos.js
 * SOS Alert & Location Service for Sahaara.
 * Communicates with backend /api/sos (official Meta WhatsApp Business Cloud API)
 * and handles foreground GPS capture with 3-tier fallback.
 */

import * as Location from 'expo-location';
import { collection, getDocs, query, orderBy, addDoc, serverTimestamp } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../firebase/config';
import { getApiBaseUrl } from './saathiService';

// Timeout wrapper helper
const withTimeout = (promise, ms) => {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), ms)),
  ]);
};

/**
 * Resolves the currently authenticated Firebase user.
 * If auth.currentUser is already populated, returns it immediately.
 * Otherwise, waits for onAuthStateChanged to restore the session from AsyncStorage.
 */
export function getAuthenticatedUser(timeoutMs = 6000) {
  if (auth.currentUser) {
    console.log(`[SOS Auth] User present: true, UID: ${auth.currentUser.uid}`);
    return Promise.resolve(auth.currentUser);
  }

  console.log('[SOS Auth] auth.currentUser is null. Waiting for onAuthStateChanged session restore...');
  return new Promise((resolve) => {
    let resolved = false;
    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        unsubscribe();
        const user = auth.currentUser || null;
        console.log(`[SOS Auth] Session restore wait timed out. User present: ${Boolean(user)}`);
        resolve(user);
      }
    }, timeoutMs);

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        unsubscribe();
        console.log(`[SOS Auth] onAuthStateChanged resolved. User present: ${Boolean(user)}, UID: ${user?.uid || 'none'}`);
        resolve(user || null);
      }
    });
  });
}

// Alias for backward compatibility
export const waitForAuthUser = getAuthenticatedUser;

/**
 * 1. Asks for foreground permission once
 * 2. Tries High Accuracy (6s timeout)
 * 3. Falls back to Balanced (4s timeout)
 * 4. Falls back to LastKnownPosition
 * 5. If all fails, returns null (total wait <= 10s)
 * 6. Reverse geocodes with 3s timeout
 */
export async function getCurrentLocation() {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      console.log('[SOS Location] Foreground location permission not granted');
      return null;
    }

    let position = null;
    let ageSec = 0;

    // Step 2: Try High Accuracy (6s)
    try {
      position = await withTimeout(
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
        6000
      );
    } catch (_) {
      // Step 3: Fall back to Balanced (4s)
      try {
        position = await withTimeout(
          Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
          4000
        );
      } catch (__) {
        // Step 4: Fall back to last known position
        try {
          const last = await Location.getLastKnownPositionAsync();
          if (last && last.coords) {
            position = last;
            if (last.timestamp) {
              ageSec = Math.round((Date.now() - last.timestamp) / 1000);
            }
          }
        } catch (___) {}
      }
    }

    if (!position || !position.coords) {
      return null;
    }

    const { latitude: lat, longitude: lng, accuracy } = position.coords;

    // Step 6: Reverse geocode (3s timeout)
    let address = null;
    try {
      const places = await withTimeout(
        Location.reverseGeocodeAsync({ latitude: lat, longitude: lng }),
        3000
      );
      if (places && places.length > 0) {
        const p = places[0];
        const parts = [p.name, p.street, p.subregion || p.district, p.city]
          .filter(Boolean)
          .filter((val, idx, arr) => arr.indexOf(val) === idx);
        if (parts.length > 0) {
          address = parts.join(', ');
        }
      }
    } catch (_) {
      // Silently skip address if geocode fails
    }

    return {
      lat,
      lng,
      accuracy: accuracy ? Math.round(accuracy) : null,
      address,
      ageSec,
    };
  } catch (err) {
    console.log('[SOS Location] Error getting location:', err.message);
    return null;
  }
}

/**
 * Normalizes phone numbers (removes spaces, +, -, 0, prefixes 91 if 10 digits)
 */
export function normalizePhone(raw) {
  if (!raw) return '';
  let cleaned = String(raw).replace(/[\s+\-()]/g, '');
  if (cleaned.startsWith('0')) {
    cleaned = cleaned.replace(/^0+/, '');
  }
  if (/^\d{10}$/.test(cleaned)) {
    cleaned = '91' + cleaned;
  }
  return cleaned;
}

/**
 * Reads user emergency contacts from Firestore users/{uid}/emergencyContacts.
 * Waits for Firebase Auth to restore its session before querying, to avoid
 * spurious "Missing or insufficient permissions" errors at app start.
 */
export async function getEmergencyContacts() {
  const user = await waitForAuthUser();
  if (!user || !db) return [];

  try {
    const contactsRef = collection(db, 'users', user.uid, 'emergencyContacts');
    const q = query(contactsRef, orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (err) {
    console.log('[SOS Service] Error fetching contacts from Firestore:', err.message);
    return [];
  }
}

/**
 * Formats an official SAHAARA Emergency WhatsApp message:
 * 1. SAHAARA EMERGENCY ALERT heading
 * 2. User's name
 * 3. Emergency reason
 * 4. Foreground-captured location (if available)
 * 5. Google Maps location link (if available)
 * 6. Emergency timestamp
 * 7. Explicit request to contact the user immediately
 */
export function buildEmergencyMessage({
  name = 'Sahaara Member',
  reason = 'manual',
  location = null,
  timestamp = null,
  vitalsDetail = null,
}) {
  const timeStr =
    timestamp ||
    new Date().toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });

  let reasonLabel = '🚨 Emergency SOS button pressed';
  if (reason === 'fall') {
    reasonLabel = '🚨 Possible fall detected';
  } else if (reason === 'fall_help') {
    reasonLabel = '🚨 Fall confirmed — User requested help';
  } else if (reason === 'fall_noresponse') {
    reasonLabel = '🚨 Fall detected — No response from user';
  } else if (reason === 'fall_ok') {
    reasonLabel = '✅ Fall alert update — User reports they are okay';
  } else if (reason === 'vitals_critical') {
    reasonLabel = vitalsDetail
      ? `🚨 Critical Health Vitals Alert (${vitalsDetail})`
      : '🚨 Critical Health Vitals Alert from Smartwatch';
  } else if (reason === 'test') {
    reasonLabel = '🧪 Test alert from Sahaara app';
  }

  let locationText = '📍 Location: Unavailable (GPS signal not found)';
  if (location && typeof location.lat === 'number' && typeof location.lng === 'number') {
    const lat = location.lat.toFixed(6);
    const lng = location.lng.toFixed(6);
    const addr = location.address ? `\n📍 Address: ${location.address}` : '';
    locationText = `📍 Coordinates: ${lat}, ${lng}${addr}\n🗺️ Google Maps: https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  }

  return [
    `🚨 *SAHAARA EMERGENCY ALERT* 🚨`,
    ``,
    `*User:* ${name}`,
    `*Emergency Reason:* ${reasonLabel}`,
    `*Timestamp:* ${timeStr}`,
    ``,
    locationText,
    ``,
    `⚠️ *URGENT: Please call or contact ${name} immediately!*`,
  ].join('\n');
}

/**
 * Builds a direct wa.me deep link for a specific contact with the prefilled emergency message.
 */
export function buildGuardianWaLink(contact, messageText) {
  if (!contact || !contact.phone) return null;
  const phone = normalizePhone(contact.phone);
  if (!phone) return null;
  return `https://wa.me/${phone}?text=${encodeURIComponent(messageText)}`;
}

/**
 * Builds individual manual WhatsApp links for all registered emergency contacts.
 */
export function buildFallbackWaLinks(contacts = [], name, reason, location, timestamp) {
  const message = buildEmergencyMessage({ name, reason, location, timestamp });
  return (contacts || [])
    .map((c) => ({
      id: c.id || c.phone,
      name: c.name || 'Guardian',
      relation: c.relation || '',
      phone: normalizePhone(c.phone),
      rawPhone: c.phone,
      waLink: buildGuardianWaLink(c, message),
      messageText: message,
    }))
    .filter((c) => Boolean(c.phone && c.waLink));
}

/**
 * Backward compatibility helper for primary contact
 */
export function buildFallbackWaLink(firstContact, name, reason, location) {
  if (!firstContact || !firstContact.phone) return null;
  const message = buildEmergencyMessage({ name, reason, location });
  return buildGuardianWaLink(firstContact, message);
}

/**
 * Sends SOS alert to backend and returns response + fallback wa.me link
 */
export async function sendSOS({ reason = 'manual', isDemo = false, demoMetric = null, vitalsDetail = null } = {}) {
  console.log(`[SOS Service] Starting SOS alert flow with reason: ${reason} (isDemo: ${isDemo})`);
  const effectiveVitalsDetail = demoMetric || vitalsDetail || null;

  // 1. Obtain authenticated Firebase user
  const user = await getAuthenticatedUser();
  if (!user) {
    console.warn('[SOS Auth] Authentication required: No active Firebase session found.');
    return {
      ok: false,
      status: 401,
      authError: true,
      errorCode: 'AUTHENTICATION_REQUIRED',
      overallStatus: 'FAILED',
      error: 'AUTHENTICATION_REQUIRED',
      errorMessage: 'Your session could not be verified. Please sign in again before triggering SOS.',
      location: null,
      contacts: [],
      fallbackWaLink: null,
      results: [],
      totalContacts: 0,
      acceptedCount: 0,
      acceptedAll: false,
      provider: 'whatsgateway',
      mode: 'gateway',
      deliveryCallbacksEnabled: false,
      alertId: null,
    };
  }

  const name = user.displayName || user.email?.split('@')[0] || 'Sahaara Member';

  // 2. Fetch contacts
  const contacts = await getEmergencyContacts();

  // 3. Fetch location
  const location = await getCurrentLocation();

  // 4. Build formatted emergency message and guardian fallback links
  const emergencyMessage = buildEmergencyMessage({ name, reason, location, vitalsDetail: effectiveVitalsDetail });
  const fallbackGuardians = buildFallbackWaLinks(contacts, name, reason, location);
  const fallbackWaLink = fallbackGuardians[0]?.waLink || null;

  // 4b. ISOLATED DEMO MODE EXECUTION
  // In demo mode: Exercise full local/location/contact/Firestore orchestration WITHOUT dispatching real WhatsApp messages
  if (isDemo) {
    console.log('[SOS Service] Processing isolated Demo Mode SOS (Zero external messages dispatched)');
    let demoAlertId = 'demo-' + Date.now();
    try {
      if (db) {
        const docRef = await addDoc(collection(db, 'sos_alerts'), {
          userId: user.uid,
          userEmail: user.email || 'demo@sahaara.app',
          userName: name,
          latitude: location?.lat ?? null,
          longitude: location?.lng ?? null,
          accuracy: location?.accuracy ?? null,
          mapsLink: location
            ? `https://www.google.com/maps/search/?api=1&query=${location.lat},${location.lng}`
            : null,
          address: location?.address ?? null,
          status: 'DEMO_SIMULATED_SUCCESS',
          overallStatus: 'DEMO_SIMULATED',
          whatsappStatus: 'SIMULATED_ISOLATED',
          isDemo: true,
          demoEvent: true,
          demoMetric: demoMetric || null,
          message: '[DEMO DATA] Simulated Vitals Emergency Alert triggered from Demo Mode',
          reason,
          timestamp: serverTimestamp(),
          contacts: contacts.map((c) => c.name),
          provider: 'demo_isolated_simulator',
          sosDispatched: false,
        });
        demoAlertId = docRef.id;
      }
    } catch (fbErr) {
      console.log('[SOS Service] Demo alert Firestore record note:', fbErr.message);
    }

    return {
      ok: true,
      isDemo: true,
      status: 200,
      overallStatus: 'DEMO_SIMULATED',
      whatsappStatus: 'SIMULATED_ISOLATED',
      alertId: demoAlertId,
      location,
      contacts,
      emergencyMessage,
      fallbackGuardians,
      fallbackWaLink,
      results: contacts.map((c) => ({
        name: c.name,
        phone: c.phone,
        status: 'SIMULATED_DEMO_RECIPIENT',
        delivered: false,
      })),
      totalContacts: contacts.length,
      acceptedCount: contacts.length,
      acceptedAll: true,
      provider: 'demo_isolated_simulator',
      mode: 'demo',
      deliveryCallbacksEnabled: false,
    };
  }

  // 5. Retrieve ID token using Firebase Authentication SDK
  let idToken = null;
  try {
    idToken = await user.getIdToken();
    console.log(`[SOS Auth] Token acquisition succeeded: true, length: ${idToken ? idToken.length : 0}`);
  } catch (tokenErr) {
    console.warn('[SOS Auth] getIdToken failed, attempting force refresh:', tokenErr.message);
    try {
      idToken = await user.getIdToken(true);
      console.log(`[SOS Auth] Token force refresh succeeded: true, length: ${idToken ? idToken.length : 0}`);
    } catch (refreshErr) {
      console.error('[SOS Auth] Force token refresh failed:', refreshErr.message);
      return {
        ok: false,
        status: 401,
        authError: true,
        errorCode: 'TOKEN_ACQUISITION_FAILED',
        overallStatus: 'FAILED',
        error: 'TOKEN_ACQUISITION_FAILED',
        errorMessage: 'Your session could not be verified. Please sign in again before triggering SOS.',
        location,
        contacts,
        emergencyMessage,
        fallbackGuardians,
        fallbackWaLink,
        results: [],
        totalContacts: contacts.length,
        acceptedCount: 0,
        acceptedAll: false,
        provider: 'whatsgateway',
        mode: 'gateway',
        deliveryCallbacksEnabled: false,
        alertId: null,
      };
    }
  }

  if (!idToken) {
    console.warn('[SOS Auth] Acquired ID token is empty.');
    return {
      ok: false,
      status: 401,
      authError: true,
      errorCode: 'TOKEN_EMPTY',
      overallStatus: 'FAILED',
      error: 'TOKEN_EMPTY',
      errorMessage: 'Your session could not be verified. Please sign in again before triggering SOS.',
      location,
      contacts,
      emergencyMessage,
      fallbackGuardians,
      fallbackWaLink,
      results: [],
      totalContacts: contacts.length,
      acceptedCount: 0,
      acceptedAll: false,
      provider: 'whatsgateway',
      mode: 'gateway',
      deliveryCallbacksEnabled: false,
      alertId: null,
    };
  }

  // 6. Prepare payload for /api/sos
  const payload = {
    name,
    reason,
    location,
    vitalsDetail: effectiveVitalsDetail,
    contacts: contacts.map(c => ({
      name: c.name,
      phone: c.phone,
      relation: c.relation,
      key: c.callmebotKey || '',
    })),
  };

  try {
    const baseUrl = getApiBaseUrl();
    const endpoint = `${baseUrl}/api/sos`;

    console.log(`[SOS Service] Sending SOS (${reason}) to ${endpoint}`);
    console.log('[SOS Auth] Authorization header attached: true');

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${idToken}`,
    };

    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));

    if (res.status === 401) {
      console.warn('[SOS Service] Backend rejected token with 401:', data.error);
      return {
        ok: false,
        status: 401,
        authError: true,
        errorCode: data.errorCode || 'UNAUTHORIZED',
        overallStatus: 'FAILED',
        error: data.error || 'Unauthorized: A valid Firebase ID token is required.',
        errorMessage: 'Your session could not be verified. Please sign in again before triggering SOS.',
        location,
        contacts,
        emergencyMessage,
        fallbackGuardians,
        fallbackWaLink,
        results: [],
        totalContacts: contacts.length,
        acceptedCount: 0,
        acceptedAll: false,
        provider: 'whatsgateway',
        mode: 'gateway',
        deliveryCallbacksEnabled: false,
        alertId: null,
      };
    }

    return {
      ok: data.ok || false,
      status: res.status,
      overallStatus: data.overallStatus || (data.ok ? (data.acceptedAll ? 'ACCEPTED_ALL' : 'PARTIALLY_ACCEPTED') : 'FAILED'),
      acceptedAll: data.acceptedAll || false,
      acceptedCount: data.acceptedCount || 0,
      totalContacts: data.totalContacts || contacts.length,
      results: data.results || [],
      location,
      contacts,
      emergencyMessage,
      fallbackGuardians,
      fallbackWaLink,
      error: data.error,
      errorCode: data.errorCode,
      provider: data.provider || 'whatsgateway',
      mode: data.mode || 'gateway',
      deliveryCallbacksEnabled: data.deliveryCallbacksEnabled || false,
      alertId: data.alertId || null,
    };
  } catch (err) {
    console.log('[SOS Service] Backend call failed:', err.message);
    return {
      ok: false,
      overallStatus: 'FAILED',
      acceptedAll: false,
      acceptedCount: 0,
      totalContacts: contacts.length,
      results: [],
      location,
      contacts,
      emergencyMessage,
      fallbackGuardians,
      fallbackWaLink,
      error: err.message,
      provider: 'whatsgateway',
      mode: 'gateway',
      deliveryCallbacksEnabled: false,
      alertId: null,
    };
  }
}
