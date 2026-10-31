import { Platform } from 'react-native';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth } from '../firebase/config';
import { transliterateToHindi } from './transliterate';

/**
 * Returns the SAATHI backend API URL.
 * Priority:
 * 1. process.env.EXPO_PUBLIC_SAATHI_API_URL (explicitly set via .env)
 * 2. Dynamic host detection from Expo's Metro server (auto-detects dev machine LAN IP)
 * 3. Android Emulator fallback (10.0.2.2:3000)
 * 4. Localhost fallback (http://localhost:3000)
 */
export const getApiBaseUrl = () => {
  const envUrl = process.env.EXPO_PUBLIC_SAATHI_API_URL || process.env.EXPO_PUBLIC_BACKEND_URL;
  if (envUrl) {
    return envUrl.replace(/\/+$/, '');
  }

  // Attempt to detect dev machine IP from Expo Constants when running in development
  try {
    const hostUri =
      Constants.expoConfig?.hostUri ||
      Constants.manifest2?.extra?.expoGo?.debuggerHost ||
      Constants.manifest?.debuggerHost;

    if (hostUri) {
      const ip = hostUri.split(':')[0];
      if (ip && ip !== 'localhost' && ip !== '127.0.0.1') {
        return `http://${ip}:3000`;
      }
    }
  } catch (_) {
    // Ignore and fallback below
  }

  // Android Emulator uses 10.0.2.2 to connect to host machine localhost
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:3000';
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
