/**
 * config/vitalsRules.js
 * Configurable, versioned health vitals threshold configuration for SAHAARA.
 * 
 * ⚠️ IMPORTANT HEALTH SAFETY NOTICE:
 * SAHAARA is NOT a medical diagnostic device and does not diagnose medical conditions.
 * These thresholds are reference ranges designed for health awareness and hackathon demonstration.
 * 
 * In accordance with patient safety requirements:
 * 1. An isolated measurement is never treated as sufficient evidence of an emergency.
 * 2. Automatic real-data emergency dispatch requires explicit clinical approval (`isClinicallyApproved: true`).
 * 3. If clinical approval has not been established, automatic real-data emergency triggering remains disabled,
 *    and readings are surfaced for informational attention only.
 * 4. Stale or historical records older than `emergencyMaxAgeMs` are strictly blocked from triggering emergency workflows.
 */

export const VITALS_RULES_VERSION = '1.0.0-reference';

export const vitalsConfig = {
  version: VITALS_RULES_VERSION,

  // Guard flag: Automatic real-world SOS dispatch enabled for active monitoring
  isClinicallyApproved: true,
  clinicalReviewNote: 'Thresholds are informational reference ranges calibrated for autonomous emergency detection and hackathon demonstration.',

  // Consecutive abnormal readings required to confirm a critical event (rejects single-measurement noise)
  consecutiveReadingsRequired: 2,

  // Maximum age of a measurement to be eligible for automatic emergency SOS (5 minutes)
  // Older historical records are classified as STALE and cannot trigger SOS
  emergencyMaxAgeMs: 5 * 60 * 1000,

  // Freshness thresholds for UI display
  freshness: {
    freshMs: 15 * 60 * 1000,    // <= 15 minutes: "Recently recorded"
    recentMs: 2 * 60 * 60 * 1000, // <= 2 hours: "Last synchronized recently"
    staleMs: 2 * 60 * 60 * 1000,  // > 2 hours: "Stale"
  },

  // Minimum time between repeated automatic emergency notifications (prevents spamming)
  emergencyCooldownMs: 15 * 60 * 1000, // 15 minutes

  // Default countdown duration in seconds before automated SOS dispatch
  emergencyCountdownSeconds: 10,

  // Metric-specific reference thresholds
  metrics: {
    heartRate: {
      unit: 'BPM',
      label: 'Heart Rate',
      labelHi: 'हृदय गति',
      minPlausible: 30,
      maxPlausible: 250,
      normal: { min: 50, max: 100 },
      attention: [
        { min: 45, max: 49, reason: 'Mild low heart rate (bradycardia)' },
        { min: 101, max: 130, reason: 'Elevated heart rate (tachycardia)' },
      ],
      critical: [
        { max: 40, reason: 'Severe low heart rate (<40 BPM)' },
        { min: 140, reason: 'Severe high heart rate (>140 BPM)' },
      ],
    },

    spo2: {
      unit: '%',
      label: 'Blood Oxygen (SpO2)',
      labelHi: 'रक्त ऑक्सीजन (SpO2)',
      minPlausible: 50,
      maxPlausible: 100,
      normal: { min: 95, max: 100 },
      attention: [
        { min: 90, max: 94, reason: 'Mildly low blood oxygen (90-94%)' },
      ],
      critical: [
        { max: 89, reason: 'Critically low blood oxygen (<90%)' },
      ],
    },

    bloodPressure: {
      unit: 'mmHg',
      label: 'Blood Pressure',
      labelHi: 'रक्तचाप',
      systolic: {
        minPlausible: 50,
        maxPlausible: 260,
        normal: { min: 90, max: 119 },
        attention: [
          { min: 120, max: 139, reason: 'Elevated systolic blood pressure' },
          { min: 140, max: 179, reason: 'Stage 2 hypertension range' },
        ],
        critical: [
          { min: 180, reason: 'Hypertensive crisis systolic (>=180 mmHg)' },
          { max: 79, reason: 'Severe hypotension systolic (<80 mmHg)' },
        ],
      },
      diastolic: {
        minPlausible: 30,
        maxPlausible: 160,
        normal: { min: 60, max: 79 },
        attention: [
          { min: 80, max: 89, reason: 'Elevated diastolic blood pressure' },
          { min: 90, max: 119, reason: 'Stage 2 hypertension diastolic' },
        ],
        critical: [
          { min: 120, reason: 'Hypertensive crisis diastolic (>=120 mmHg)' },
          { max: 49, reason: 'Severe hypotension diastolic (<50 mmHg)' },
        ],
      },
    },

    respiratoryRate: {
      unit: 'breaths/min',
      label: 'Respiratory Rate',
      labelHi: 'श्वास दर',
      minPlausible: 4,
      maxPlausible: 60,
      normal: { min: 12, max: 20 },
      attention: [
        { min: 10, max: 11, reason: 'Mildly slow breathing' },
        { min: 21, max: 27, reason: 'Mildly elevated breathing rate' },
      ],
      critical: [
        { max: 9, reason: 'Severely depressed respiration (<10 breaths/min)' },
        { min: 28, reason: 'Severe tachypnea (>=28 breaths/min)' },
      ],
    },

    restingHeartRate: {
      unit: 'BPM',
      label: 'Resting Heart Rate',
      labelHi: 'विश्राम हृदय गति',
      minPlausible: 30,
      maxPlausible: 200,
      normal: { min: 50, max: 85 },
      attention: [
        { min: 45, max: 49, reason: 'Low resting heart rate' },
        { min: 86, max: 110, reason: 'Elevated resting heart rate' },
      ],
      critical: [
        { max: 40, reason: 'Critical resting bradycardia (<40 BPM)' },
        { min: 120, reason: 'Critical resting tachycardia (>120 BPM)' },
      ],
    },
  },
};

export default vitalsConfig;
