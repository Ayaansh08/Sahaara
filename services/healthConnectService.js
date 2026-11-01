/**
 * services/healthConnectService.js
 * Android Health Connect Integration Layer for SAHAARA.
 * 
 * Safely wraps react-native-health-connect with graceful degradation for:
 * - iOS / unsupported platforms (returns descriptive unsupported state)
 * - Expo Go / missing native module (explains development build requirement without crashing)
 * - Denied, revoked, or partially granted permissions
 * - Stale, unavailable, or hardware-unsupported metrics
 */

import { normalizeReading } from './vitalsEngine.js';

let Platform = { OS: 'android' };
let Constants = { appOwnership: null };

try {
  const RN = require('react-native');
  if (RN && RN.Platform) Platform = RN.Platform;
} catch (_) {}

try {
  const ExpoConstants = require('expo-constants');
  if (ExpoConstants) Constants = ExpoConstants.default || ExpoConstants;
} catch (_) {}

const isExpoGo = Constants?.appOwnership === 'expo';
const isAndroid = Platform?.OS === 'android';

// Map of common Android health apps to user-friendly display labels
const APP_SOURCE_NAMES = {
  'com.sec.android.app.shealth': 'Samsung Health',
  'com.google.android.apps.fitness': 'Google Fit',
  'com.fitbit.FitbitMobile': 'Fitbit (Google Pixel Watch)',
  'com.withings.wiscale2': 'Withings Health Mate',
  'com.garmin.android.apps.connectmobile': 'Garmin Connect',
  'com.huami.watch.hmwatchmanager': 'Zepp Life / Amazfit',
  'com.google.android.apps.wear.healthservices': 'Wear OS Health Services',
};

// Health Connect Permission Definitions & Explanations
export const VITALS_PERMISSIONS = [
  {
    accessType: 'read',
    recordType: 'HeartRate',
    androidPermission: 'android.permission.health.READ_HEART_RATE',
    metricType: 'heartRate',
    label: 'Heart Rate',
    labelHi: 'हृदय गति',
    rationale: 'Required to read pulse measurements from your smartwatch to detect severe drops or spikes in heart rate.',
    rationaleHi: 'स्मार्टवॉच से हृदय गति पढ़ने और अत्यधिक कमी या वृद्धि की चेतावनी देने के लिए आवश्यक है।',
  },
  {
    accessType: 'read',
    recordType: 'OxygenSaturation',
    androidPermission: 'android.permission.health.READ_OXYGEN_SATURATION',
    metricType: 'spo2',
    label: 'Blood Oxygen (SpO2)',
    labelHi: 'रक्त ऑक्सीजन (SpO2)',
    rationale: 'Required to read blood oxygen saturation from your smartwatch to detect potential respiratory distress.',
    rationaleHi: 'रक्त में ऑक्सीजन स्तर (SpO2) की निगरानी करने के लिए आवश्यक है।',
  },
  {
    accessType: 'read',
    recordType: 'BloodPressure',
    androidPermission: 'android.permission.health.READ_BLOOD_PRESSURE',
    metricType: 'bloodPressure',
    label: 'Blood Pressure',
    labelHi: 'रक्तचाप',
    rationale: 'Required to read blood pressure measurements from supported smart cuffs and watches.',
    rationaleHi: 'समर्थित डिवाइसों से रक्तचाप माप पढ़ने के लिए आवश्यक है।',
  },
  {
    accessType: 'read',
    recordType: 'RespiratoryRate',
    androidPermission: 'android.permission.health.READ_RESPIRATORY_RATE',
    metricType: 'respiratoryRate',
    label: 'Respiratory Rate',
    labelHi: 'श्वास दर',
    rationale: 'Required to monitor breathing rate when supported by your smartwatch during sleep and rest.',
    rationaleHi: 'आपकी श्वास दर (सांस लेने की गति) की निगरानी के लिए आवश्यक है।',
  },
  {
    accessType: 'read',
    recordType: 'RestingHeartRate',
    androidPermission: 'android.permission.health.READ_RESTING_HEART_RATE',
    metricType: 'restingHeartRate',
    label: 'Resting Heart Rate',
    labelHi: 'विश्राम हृदय गति',
    rationale: 'Required to understand your calm baseline pulse when seated or resting.',
    rationaleHi: 'विश्राम अवस्था में आपकी सामान्य हृदय गति को समझने के लिए आवश्यक है।',
  },
];

/**
 * Lazy-loads native Health Connect module to avoid bundler errors in unsupported environments.
 */
function getNativeModule() {
  if (!isAndroid || isExpoGo) {
    return null;
  }
  try {
    return require('react-native-health-connect');
  } catch (err) {
    console.warn('[HealthConnect] Native module import failed:', err.message);
    return null;
  }
}

/**
 * Formats a package name or device identifier into a readable source name.
 */
export function formatDataSource(packageOrOrigin) {
  if (!packageOrOrigin) return 'Health Connect';
  if (APP_SOURCE_NAMES[packageOrOrigin]) {
    return APP_SOURCE_NAMES[packageOrOrigin];
  }
  const parts = String(packageOrOrigin).split('.');
  return parts[parts.length - 1] || packageOrOrigin;
}

/**
 * Inspects Health Connect availability on the current device.
 */
export async function checkHealthConnectAvailability() {
  if (!isAndroid) {
    return {
      isAvailable: false,
      isSupportedPlatform: false,
      status: 'UNSUPPORTED_PLATFORM',
      message: 'Health Connect is an Android system service. iOS health synchronization will support Apple HealthKit in an upcoming release.',
      messageHi: 'हेल्थ कनेक्ट केवल एंड्रॉइड पर उपलब्ध है। आईओएस के लिए समर्थन आगामी अपडेट में आएगा।',
    };
  }

  if (isExpoGo) {
    return {
      isAvailable: false,
      isSupportedPlatform: true,
      isExpoGo: true,
      status: 'EXPO_GO_DEV_BUILD_REQUIRED',
      message: 'Health Connect native APIs require an Expo Development Build (npx expo run:android). You can test all features using Demo Mode.',
      messageHi: 'हेल्थ कनेक्ट के लिए डेवलपमेंट बिल्ड की आवश्यकता है। आप डेमो मोड के माध्यम से परीक्षण कर सकते हैं।',
    };
  }

  const native = getNativeModule();
  if (!native) {
    return {
      isAvailable: false,
      isSupportedPlatform: true,
      status: 'NATIVE_MODULE_MISSING',
      message: 'Health Connect native module is not linked in this build.',
      messageHi: 'हेल्थ कनेक्ट नेटिव मॉड्यूल इस बिल्ड में लिंक नहीं है।',
    };
  }

  try {
    const initialized = await native.initialize();
    if (!initialized) {
      return {
        isAvailable: false,
        isSupportedPlatform: true,
        status: 'INITIALIZE_FAILED',
        message: 'Could not initialize Health Connect on this device.',
        messageHi: 'इस डिवाइस पर हेल्थ कनेक्ट शुरू नहीं हो सका।',
      };
    }

    const sdkStatus = await native.getSdkStatus();
    // 1: SDK_UNAVAILABLE, 2: SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED, 3: SDK_AVAILABLE
    if (sdkStatus === 1) {
      return {
        isAvailable: false,
        isSupportedPlatform: true,
        status: 'SDK_UNAVAILABLE',
        message: 'Health Connect is not installed on this device. Please install Health Connect from Google Play.',
        messageHi: 'हेल्थ कनेक्ट इस फ़ोन पर इंस्टॉल नहीं है। कृपया गूगल प्ले स्टोर से इंस्टॉल करें।',
      };
    }

    if (sdkStatus === 2) {
      return {
        isAvailable: false,
        isSupportedPlatform: true,
        status: 'PROVIDER_UPDATE_REQUIRED',
        message: 'Health Connect requires an update from Google Play Store.',
        messageHi: 'हेल्थ कनेक्ट को प्ले स्टोर से अपडेट करने की आवश्यकता है।',
      };
    }

    return {
      isAvailable: true,
      isSupportedPlatform: true,
      status: 'AVAILABLE',
      message: 'Health Connect is ready.',
      messageHi: 'हेल्थ कनेक्ट तैयार है।',
    };
  } catch (err) {
    console.error('[HealthConnect] Error checking availability:', err);
    return {
      isAvailable: false,
      isSupportedPlatform: true,
      status: 'ERROR',
      message: `Health Connect check error: ${err.message}`,
      messageHi: 'हेल्थ कनेक्ट जांच में त्रुटि आई।',
    };
  }
}

/**
 * Checks currently granted Health Connect permissions.
 */
export async function getGrantedVitalsPermissions() {
  const native = getNativeModule();
  if (!native) return [];

  try {
    await native.initialize();
    const granted = await native.getGrantedPermissions();
    return Array.isArray(granted) ? granted : [];
  } catch (err) {
    console.warn('[HealthConnect] Error reading granted permissions:', err.message);
    return [];
  }
}

/**
 * Requests specific health permissions from user.
 */
export async function requestVitalsPermissions(selectedRecordTypes = null) {
  const native = getNativeModule();
  if (!native) {
    return { success: false, reason: 'NATIVE_MODULE_UNAVAILABLE', granted: [] };
  }

  try {
    await native.initialize();
    const targets = selectedRecordTypes
      ? VITALS_PERMISSIONS.filter((p) => selectedRecordTypes.includes(p.recordType))
      : VITALS_PERMISSIONS;

    const permissionsToRequest = targets.map((p) => ({
      accessType: 'read',
      recordType: p.recordType,
    }));

    const granted = await native.requestPermission(permissionsToRequest);
    return {
      success: true,
      granted: Array.isArray(granted) ? granted : [],
    };
  } catch (err) {
    console.warn('[HealthConnect] Permission request error:', err.message);
    return {
      success: false,
      reason: err.message,
      granted: [],
    };
  }
}

/**
 * Opens Android Health Connect settings screen.
 */
export async function openHealthConnectSettings() {
  const native = getNativeModule();
  if (!native) return false;
  try {
    await native.openHealthConnectSettings();
    return true;
  } catch (err) {
    console.warn('[HealthConnect] Could not open settings:', err.message);
    return false;
  }
}

/**
 * Fetches the most recent vitals measurements across supported metrics.
 * 
 * @param {Object} options Configuration options
 * @returns {Object} { vitals: { [metricType]: normalizedReading }, sources: string[], lastSyncTime: number }
 */
export async function fetchLatestVitals(options = {}) {
  const lookbackHours = options.lookbackHours || 24;
  const native = getNativeModule();

  if (!native) {
    return {
      vitals: {},
      history: {
        heartRate: [],
        spo2: [],
        bloodPressure: [],
        respiratoryRate: [],
        restingHeartRate: [],
      },
      sources: [],
      lastSyncTime: Date.now(),
      error: isExpoGo ? 'EXPO_GO_DEV_BUILD_REQUIRED' : 'UNSUPPORTED_PLATFORM',
    };
  }

  const endTime = new Date();
  const startTime = new Date(endTime.getTime() - lookbackHours * 60 * 60 * 1000);
  const timeRangeFilter = {
    operator: 'between',
    startTime: startTime.toISOString(),
    endTime: endTime.toISOString(),
  };

  const results = {};
  const historyMap = {
    heartRate: [],
    spo2: [],
    bloodPressure: [],
    respiratoryRate: [],
    restingHeartRate: [],
  };
  const sourcesSet = new Set();

  // 1. Heart Rate
  try {
    const hrResult = await native.readRecords('HeartRate', { timeRangeFilter });
    if (hrResult?.records && hrResult.records.length > 0) {
      const allSamples = [];
      for (const rec of hrResult.records) {
        const sourceName = formatDataSource(rec?.metadata?.dataOrigin);
        if (sourceName) sourcesSet.add(sourceName);
        if (rec.samples && rec.samples.length > 0) {
          for (const s of rec.samples) {
            if (s.beatsPerMinute > 0) {
              allSamples.push({
                sample: s,
                record: rec,
                sourceName,
                timeMs: new Date(s.time).getTime(),
              });
            }
          }
        }
      }

      // Sort newest to oldest
      allSamples.sort((a, b) => b.timeMs - a.timeMs);

      if (allSamples.length > 0) {
        const normalized = allSamples.map(item => normalizeReading({
          metricType: 'heartRate',
          value: item.sample.beatsPerMinute,
          unit: 'BPM',
          timestamp: item.sample.time,
          source: item.sourceName,
          metadata: item.record?.metadata || {},
          isDemo: false,
        }));

        results.heartRate = normalized[0];
        historyMap.heartRate = normalized.slice(1);
      }
    }
  } catch (err) {
    console.log('[HealthConnect] Error fetching HeartRate:', err.message);
  }

  // 2. Blood Oxygen (OxygenSaturation)
  try {
    const spo2Result = await native.readRecords('OxygenSaturation', { timeRangeFilter });
    if (spo2Result?.records && spo2Result.records.length > 0) {
      const sorted = [...spo2Result.records].sort(
        (a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()
      );
      const validRecords = [];
      for (const rec of sorted) {
        let val = typeof rec.percentage === 'object' ? rec.percentage.value : rec.percentage;
        if (typeof val === 'number' && val > 0) {
          // Normalize fraction to percent
          if (val <= 1.0) val = Math.round(val * 100);
          const sourceName = formatDataSource(rec.metadata?.dataOrigin);
          sourcesSet.add(sourceName);
          validRecords.push(normalizeReading({
            metricType: 'spo2',
            value: val,
            unit: '%',
            timestamp: rec.time,
            source: sourceName,
            metadata: rec.metadata || {},
            isDemo: false,
          }));
        }
      }
      if (validRecords.length > 0) {
        results.spo2 = validRecords[0];
        historyMap.spo2 = validRecords.slice(1);
      }
    }
  } catch (err) {
    console.log('[HealthConnect] Error fetching OxygenSaturation:', err.message);
  }

  // 3. Blood Pressure
  try {
    const bpResult = await native.readRecords('BloodPressure', { timeRangeFilter });
    if (bpResult?.records && bpResult.records.length > 0) {
      const sorted = [...bpResult.records].sort(
        (a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()
      );
      const validRecords = [];
      for (const rec of sorted) {
        const sys = rec.systolic?.inMillimetersOfMercury ?? rec.systolic;
        const dia = rec.diastolic?.inMillimetersOfMercury ?? rec.diastolic;
        if (typeof sys === 'number' && typeof dia === 'number' && sys > 0 && dia > 0) {
          const sourceName = formatDataSource(rec.metadata?.dataOrigin);
          sourcesSet.add(sourceName);
          validRecords.push(normalizeReading({
            metricType: 'bloodPressure',
            value: { systolic: Math.round(sys), diastolic: Math.round(dia) },
            unit: 'mmHg',
            timestamp: rec.time,
            source: sourceName,
            metadata: rec.metadata || {},
            isDemo: false,
          }));
        }
      }
      if (validRecords.length > 0) {
        results.bloodPressure = validRecords[0];
        historyMap.bloodPressure = validRecords.slice(1);
      }
    }
  } catch (err) {
    console.log('[HealthConnect] Error fetching BloodPressure:', err.message);
  }

  // 4. Respiratory Rate
  try {
    const respResult = await native.readRecords('RespiratoryRate', { timeRangeFilter });
    if (respResult?.records && respResult.records.length > 0) {
      const sorted = [...respResult.records].sort(
        (a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()
      );
      const validRecords = [];
      for (const rec of sorted) {
        if (typeof rec.rate === 'number' && rec.rate > 0) {
          const sourceName = formatDataSource(rec.metadata?.dataOrigin);
          sourcesSet.add(sourceName);
          validRecords.push(normalizeReading({
            metricType: 'respiratoryRate',
            value: Math.round(rec.rate),
            unit: 'breaths/min',
            timestamp: rec.time,
            source: sourceName,
            metadata: rec.metadata || {},
            isDemo: false,
          }));
        }
      }
      if (validRecords.length > 0) {
        results.respiratoryRate = validRecords[0];
        historyMap.respiratoryRate = validRecords.slice(1);
      }
    }
  } catch (err) {
    console.log('[HealthConnect] Error fetching RespiratoryRate:', err.message);
  }

  // 5. Resting Heart Rate
  try {
    const rhrResult = await native.readRecords('RestingHeartRate', { timeRangeFilter });
    if (rhrResult?.records && rhrResult.records.length > 0) {
      const sorted = [...rhrResult.records].sort(
        (a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()
      );
      const validRecords = [];
      for (const rec of sorted) {
        if (typeof rec.beatsPerMinute === 'number' && rec.beatsPerMinute > 0) {
          const sourceName = formatDataSource(rec.metadata?.dataOrigin);
          sourcesSet.add(sourceName);
          validRecords.push(normalizeReading({
            metricType: 'restingHeartRate',
            value: Math.round(rec.beatsPerMinute),
            unit: 'BPM',
            timestamp: rec.time,
            source: sourceName,
            metadata: rec.metadata || {},
            isDemo: false,
          }));
        }
      }
      if (validRecords.length > 0) {
        results.restingHeartRate = validRecords[0];
        historyMap.restingHeartRate = validRecords.slice(1);
      }
    }
  } catch (err) {
    console.log('[HealthConnect] Error fetching RestingHeartRate:', err.message);
  }

  return {
    vitals: results,
    history: historyMap,
    sources: Array.from(sourcesSet),
    lastSyncTime: Date.now(),
  };
}

/**
 * Fetches historical trend records for a metric over a specified filter ('today' | '7days' | '30days').
 */
export async function fetchVitalsTrends(metricType, filter = 'today') {
  const native = getNativeModule();
  if (!native) return [];

  let days = 1;
  if (filter === '7days') days = 7;
  if (filter === '30days') days = 30;

  const endTime = new Date();
  const startTime = new Date(endTime.getTime() - days * 24 * 60 * 60 * 1000);
  const timeRangeFilter = {
    operator: 'between',
    startTime: startTime.toISOString(),
    endTime: endTime.toISOString(),
  };

  try {
    if (metricType === 'heartRate') {
      const res = await native.readRecords('HeartRate', { timeRangeFilter });
      const points = [];
      for (const rec of res.records || []) {
        for (const s of rec.samples || []) {
          points.push({
            value: s.beatsPerMinute,
            time: s.time,
            timestamp: new Date(s.time).getTime(),
          });
        }
      }
      return points.sort((a, b) => a.timestamp - b.timestamp);
    }

    if (metricType === 'spo2') {
      const res = await native.readRecords('OxygenSaturation', { timeRangeFilter });
      return (res.records || [])
        .map((r) => ({
          value: typeof r.percentage === 'object' ? r.percentage.value : r.percentage,
          time: r.time,
          timestamp: new Date(r.time).getTime(),
        }))
        .filter((p) => typeof p.value === 'number')
        .sort((a, b) => a.timestamp - b.timestamp);
    }
  } catch (err) {
    console.warn(`[HealthConnect] Error fetching trends for ${metricType}:`, err.message);
  }

  return [];
}
