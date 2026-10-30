/**
 * services/sos.js
 * SOS Alert & Location Service for Sahaara.
 * Communicates with backend /api/sos (WhatsApp via CallMeBot) and handles GPS capture.
 */

import * as Location from 'expo-location';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
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
 * Reads user emergency contacts from Firestore users/{uid}/emergencyContacts
 */
export async function getEmergencyContacts() {
  const user = auth.currentUser;
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
 * Builds the fallback WhatsApp message and wa.me link
 */
export function buildFallbackWaLink(firstContact, name, reason, location) {
  if (!firstContact || !firstContact.phone) return null;

  const phone = normalizePhone(firstContact.phone);

  let header = `🚨 SOS from ${name}. They pressed the SOS button and need help.`;
  if (reason === 'test') {
    header = `✅ Test message from Sahaara for ${name}.`;
  } else if (reason === 'fall') {
    header = `🚨 SOS: A possible fall was detected for ${name}.`;
  } else if (reason === 'fall_ok') {
    header = `✅ Update: ${name} says they are okay.`;
  } else if (reason === 'fall_help') {
    header = `🚨 ${name} says they need help after a fall. Please call them now.`;
  } else if (reason === 'fall_noresponse') {
    header = `🚨 No response from ${name} after a fall alert. Please call them now.`;
  }

  let locationText = '📍 Location not available.';
  if (location && typeof location.lat === 'number') {
    const lat = location.lat.toFixed(6);
    const lng = location.lng.toFixed(6);
    locationText = `📍 Location: ${location.address || 'Known coordinates'}\nCoordinates: ${lat}, ${lng}\nGoogle Maps: https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  }

  const text = `${header}\n\n${locationText}`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
}

/**
 * Sends SOS alert to backend and returns response + fallback wa.me link
 */
export async function sendSOS({ reason = 'manual' }) {
  const user = auth.currentUser;
  const name = user?.displayName || user?.email?.split('@')[0] || 'Sahaara Member';

  // 1. Fetch contacts
  const contacts = await getEmergencyContacts();

  // 2. Fetch location
  const location = await getCurrentLocation();

  // 3. Prepare payload for /api/sos
  const payload = {
    name,
    reason,
    location,
    contacts: contacts.map(c => ({
      phone: c.phone,
      key: c.callmebotKey,
    })),
  };

  const firstContact = contacts[0] || null;
  const fallbackWaLink = buildFallbackWaLink(firstContact, name, reason, location);

  try {
    const baseUrl = getApiBaseUrl();
    const endpoint = `${baseUrl}/api/sos`;

    console.log(`[SOS Service] Sending SOS (${reason}) to ${endpoint}`);

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    return {
      ok: data.ok || false,
      results: data.results || [],
      location,
      contacts,
      fallbackWaLink,
      error: data.error,
    };
  } catch (err) {
    console.log('[SOS Service] Backend call failed:', err.message);
    return {
      ok: false,
      results: [],
      location,
      contacts,
      fallbackWaLink,
      error: err.message,
    };
  }
}
