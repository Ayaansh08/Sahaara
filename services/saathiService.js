import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth } from '../firebase/config';
import { transliterateToHindi } from './transliterate';

const API_URL = 'http://192.168.1.105:3000';
// Configurable API URL (Supports EXPO_PUBLIC_SAATHI_API_URL or default local dev)
export const getApiBaseUrl = () => {
  if (process.env.EXPO_PUBLIC_SAATHI_API_URL) {
    return process.env.EXPO_PUBLIC_SAATHI_API_URL;
  }
  // Android Emulator uses 10.0.2.2 to connect to host machine localhost
  if (Platform.OS === 'android') {
    return API_URL;
  }
  // Web / iOS / Local default
  return 'http://localhost:3000';
};

export const sendSaathiMessage = async (message, conversationHistory = []) => {
  const baseUrl = getApiBaseUrl();
  const endpoint = `${baseUrl}/api/saathi/chat`;

  try {
    const user = auth.currentUser;
    const idToken = user ? await user.getIdToken() : null;

    console.log(`[saathiService] Calling SAATHI Backend: ${endpoint}`);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
      },
      body: JSON.stringify({
        message,
        conversationHistory,
      }),
    });
    if (!response.ok) {
      let text = '';
      try {
        text = await response.text();
      } catch (e) {
        text = '<unreadable response body>';
      }
      console.log(`[saathiService] Server error ${response.status}:`, text);
      return 'Mujhe thodi dikkat ho rahi hai, thodi der baad phir koshish karte hain.';
    }

    const data = await response.json();
    return data.reply || "मैं आपकी बात सुन रही हूँ, थोड़ा और बताइए।";
  } catch (error) {
    console.log('[saathiService] Network / Service Error:', error?.message || error);
    return 'Mujhe thodi dikkat ho rahi hai, thodi der baad phir koshish karte hain.';
  }
};

/**
 * Transliterates an English name to Hindi Devanagari script using local mapping.
 * Result is cached in AsyncStorage so computation happens only once per name.
 */
export const transliterateName = async (name) => {
  if (!name) return name;

  const cacheKey = `@sahaara_hindi_name_v2_${name.toLowerCase()}`;

  // Return cached result if available
  try {
    const cached = await AsyncStorage.getItem(cacheKey);
    if (cached) return cached;
  } catch (_) {}

  // Use local transliteration (no network needed)
  const result = transliterateToHindi(name);

  // Cache the result
  try {
    await AsyncStorage.setItem(cacheKey, result);
  } catch (_) {}

  return result;
};
