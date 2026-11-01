/**
 * services/vitalsEngine.js
 * Critical Event Detection & Vitals Evaluation Engine for SAHAARA.
 * 
 * Standalone, testable engine with zero React dependencies.
 * Evaluates health metrics against configurable safety rules, validates repeated
 * measurements, filters out stale historical records, and enforces clinical safeguards.
 */

import { vitalsConfig } from '../config/vitalsRules.js';

/**
 * Status Enums
 */
export const VITALS_STATUS = {
  NORMAL: 'NORMAL',
  ATTENTION: 'ATTENTION',
  CRITICAL: 'CRITICAL',
  UNKNOWN: 'UNKNOWN',
  STALE: 'STALE',
};

export const FRESHNESS_STATUS = {
  FRESH: 'FRESH',
  RECENT: 'RECENT',
  STALE: 'STALE',
  NONE: 'NONE',
};

/**
 * Calculates data freshness from measurement timestamp.
 */
export function calculateFreshness(timestamp, now = Date.now(), config = vitalsConfig) {
  if (!timestamp) {
    return {
      status: FRESHNESS_STATUS.NONE,
      label: 'No measurement available',
      labelHi: 'कोई माप उपलब्ध नहीं',
      ageSec: null,
    };
  }

  const timeMs = typeof timestamp === 'string' ? new Date(timestamp).getTime() : Number(timestamp);
  if (isNaN(timeMs) || timeMs <= 0) {
    return {
      status: FRESHNESS_STATUS.NONE,
      label: 'Invalid timestamp',
      labelHi: 'अमान्य समय',
      ageSec: null,
    };
  }

  const ageMs = Math.max(0, now - timeMs);
  const ageSec = Math.round(ageMs / 1000);

  if (ageMs <= config.freshness.freshMs) {
    return {
      status: FRESHNESS_STATUS.FRESH,
      label: 'Recently recorded',
      labelHi: 'हाल ही में मापा गया',
      ageSec,
    };
  }

  if (ageMs <= config.freshness.recentMs) {
    return {
      status: FRESHNESS_STATUS.RECENT,
      label: 'Synchronized recently',
      labelHi: 'कुछ समय पहले सिंक हुआ',
      ageSec,
    };
  }

  return {
    status: FRESHNESS_STATUS.STALE,
    label: 'Stale measurement',
    labelHi: 'पुरानी माप (अपडेट आवश्यक)',
    ageSec,
  };
}

/**
 * Validates whether a reading has physically plausible numeric values.
 */
export function validateMeasurement(metricType, value, config = vitalsConfig) {
  const metricRules = config.metrics[metricType];
  if (!metricRules) {
    return { isValid: false, reason: `Unsupported metric type: ${metricType}` };
  }

  if (value === null || value === undefined) {
    return { isValid: false, reason: 'Measurement value is missing' };
  }

  if (metricType === 'bloodPressure') {
    if (typeof value !== 'object' || value === null) {
      return { isValid: false, reason: 'Blood pressure must be an object with systolic and diastolic' };
    }
    const { systolic, diastolic } = value;
    if (typeof systolic !== 'number' || isNaN(systolic) || typeof diastolic !== 'number' || isNaN(diastolic)) {
      return { isValid: false, reason: 'Blood pressure values must be valid numbers' };
    }
    if (systolic <= 0 || diastolic <= 0) {
      return { isValid: false, reason: 'Blood pressure values cannot be zero or negative' };
    }
    if (systolic < metricRules.systolic.minPlausible || systolic > metricRules.systolic.maxPlausible) {
      return { isValid: false, reason: `Systolic value (${systolic}) outside plausible range` };
    }
    if (diastolic < metricRules.diastolic.minPlausible || diastolic > metricRules.diastolic.maxPlausible) {
      return { isValid: false, reason: `Diastolic value (${diastolic}) outside plausible range` };
    }
    if (systolic <= diastolic) {
      return { isValid: false, reason: `Systolic (${systolic}) must be greater than diastolic (${diastolic})` };
    }
    return { isValid: true };
  }

  const numVal = Number(value);
  if (isNaN(numVal)) {
    return { isValid: false, reason: 'Value is not a valid number' };
  }
  if (numVal <= 0) {
    return { isValid: false, reason: 'Value must be greater than zero' };
  }
  if (numVal < metricRules.minPlausible || numVal > metricRules.maxPlausible) {
    return { isValid: false, reason: `Value (${numVal}) outside plausible human range (${metricRules.minPlausible}-${metricRules.maxPlausible})` };
  }

  return { isValid: true, numericValue: numVal };
}

/**
 * Normalizes a raw health reading into SAHAARA's standard evaluation shape.
 */
export function normalizeReading({
  metricType,
  value,
  unit,
  timestamp = Date.now(),
  source = 'Health Connect',
  metadata = {},
  isDemo = false,
}) {
  const timeMs = typeof timestamp === 'string' ? new Date(timestamp).getTime() : Number(timestamp);
  const now = Date.now();
  const freshness = calculateFreshness(timeMs, now);

  return {
    metricType,
    value,
    unit: unit || vitalsConfig.metrics[metricType]?.unit || '',
    timestamp: timeMs,
    isoTime: new Date(timeMs).toISOString(),
    source: String(source || 'Health Connect'),
    metadata: metadata || {},
    isDemo: Boolean(isDemo),
    freshness,
  };
}

/**
 * Evaluates an individual reading against safety rules and history.
 * 
 * @param {Object} reading Normalized reading object
 * @param {Array} history Array of prior normalized readings for the same metric
 * @param {Object} options Configuration overrides & flags
 * @returns {Object} Evaluation outcome
 */
export function evaluateReading(reading, history = [], options = {}) {
  const config = options.config || vitalsConfig;
  const now = options.now || Date.now();
  const userOptedIn = options.userOptedIn !== false; // Default true unless opted out

  // 1. Structure validation
  if (!reading || !reading.metricType) {
    return {
      status: VITALS_STATUS.UNKNOWN,
      reason: 'MALFORMED_READING',
      message: 'Reading object is null or missing metricType.',
      canTriggerSos: false,
    };
  }

  const metricType = reading.metricType;
  const rules = config.metrics[metricType];
  if (!rules) {
    return {
      status: VITALS_STATUS.UNKNOWN,
      reason: 'UNSUPPORTED_METRIC',
      message: `Metric '${metricType}' is not supported by the evaluation engine.`,
      canTriggerSos: false,
    };
  }

  // 2. Value plausibility validation
  const validation = validateMeasurement(metricType, reading.value, config);
  if (!validation.isValid) {
    return {
      status: VITALS_STATUS.UNKNOWN,
      reason: 'INVALID_VALUE',
      message: validation.reason,
      canTriggerSos: false,
    };
  }

  // 3. Freshness / Stale check for emergency eligibility
  const ageMs = Math.max(0, now - reading.timestamp);
  const isStaleForEmergency = ageMs > config.emergencyMaxAgeMs;

  // 4. Threshold check
  const thresholdOutcome = evaluateThresholds(metricType, reading.value, rules);

  if (thresholdOutcome.status === VITALS_STATUS.NORMAL) {
    return {
      status: VITALS_STATUS.NORMAL,
      reason: 'NORMAL_RANGE',
      message: `${rules.label} is within standard reference range.`,
      canTriggerSos: false,
      reading,
    };
  }

  if (thresholdOutcome.status === VITALS_STATUS.ATTENTION) {
    return {
      status: VITALS_STATUS.ATTENTION,
      reason: thresholdOutcome.reasonCode || 'ATTENTION_RANGE',
      message: thresholdOutcome.description,
      canTriggerSos: false,
      reading,
    };
  }

  // 5. Critical candidate handling
  if (thresholdOutcome.status === VITALS_STATUS.CRITICAL) {
    // If the record is historical / stale (> emergencyMaxAgeMs), it CANNOT trigger SOS
    if (isStaleForEmergency && !reading.isDemo) {
      return {
        status: VITALS_STATUS.STALE,
        reason: 'HISTORICAL_CRITICAL_RECORD',
        message: `Historical reading exceeded critical threshold, but reading is ${Math.round(ageMs / 60000)} minutes old. Historical readings are not eligible for automated emergency dispatch.`,
        canTriggerSos: false,
        reading,
      };
    }

    // 6. Repeated measurement validation (consecutive abnormal readings)
    // In Demo mode, a simulated critical event is immediately validated to allow testing
    if (reading.isDemo) {
      return {
        status: VITALS_STATUS.CRITICAL,
        reason: thresholdOutcome.reasonCode || 'CRITICAL_DEMO_EVENT',
        message: `[DEMO DATA] ${thresholdOutcome.description}`,
        canTriggerSos: true,
        isDemo: true,
        reading,
      };
    }

    // For real readings: enforce consecutive readings requirement
    const requiredConsecutive = config.consecutiveReadingsRequired || 2;
    const recentWindowStart = now - config.emergencyMaxAgeMs;

    // Filter recent prior readings for this metric within the emergency window
    const recentHistory = history.filter(
      (h) => h.timestamp >= recentWindowStart && h.timestamp <= reading.timestamp
    );

    // Count how many consecutive recent readings are abnormal (ATTENTION or CRITICAL)
    const abnormalCount = countRecentAbnormalReadings([reading, ...recentHistory], metricType, rules);

    if (abnormalCount < requiredConsecutive) {
      return {
        status: VITALS_STATUS.ATTENTION,
        reason: 'UNCONFIRMED_CRITICAL_EVENT',
        message: `Single isolated critical measurement (${thresholdOutcome.description}). Awaiting a confirming consecutive reading before classifying as an emergency event.`,
        canTriggerSos: false,
        requiresConfirmation: true,
        abnormalCount,
        requiredConsecutive,
        reading,
      };
    }

    // 7. Clinical approval guard
    // Production health safety rule: If thresholds have not been certified by a clinical professional,
    // real-data automated SOS must remain disabled.
    if (!config.isClinicallyApproved) {
      return {
        status: VITALS_STATUS.ATTENTION,
        reason: 'CLINICAL_APPROVAL_REQUIRED',
        message: `Repeated critical reading observed (${thresholdOutcome.description}). Automated SOS dispatch is inactive because production thresholds are pending qualified clinical verification.`,
        canTriggerSos: false,
        reading,
      };
    }

    // 8. User opt-in check
    if (!userOptedIn) {
      return {
        status: VITALS_STATUS.ATTENTION,
        reason: 'USER_OPTED_OUT',
        message: `Critical reading confirmed, but automatic emergency dispatch has been opted out by the user.`,
        canTriggerSos: false,
        reading,
      };
    }

    // All conditions satisfied: Validated real-world Critical Event
    return {
      status: VITALS_STATUS.CRITICAL,
      reason: thresholdOutcome.reasonCode || 'CRITICAL_EVENT_CONFIRMED',
      message: thresholdOutcome.description,
      canTriggerSos: true,
      reading,
    };
  }

  return {
    status: VITALS_STATUS.UNKNOWN,
    reason: 'UNDETERMINED',
    message: 'Could not determine vitals status.',
    canTriggerSos: false,
  };
}

/**
 * Checks a specific value against the metric rules configuration.
 */
function evaluateThresholds(metricType, value, rules) {
  if (metricType === 'bloodPressure') {
    const { systolic, diastolic } = value;
    // Critical check
    const isSysCrit = rules.systolic.critical.some((c) => (c.min && systolic >= c.min) || (c.max && systolic <= c.max));
    const isDiaCrit = rules.diastolic.critical.some((c) => (c.min && diastolic >= c.min) || (c.max && diastolic <= c.max));
    if (isSysCrit || isDiaCrit) {
      return {
        status: VITALS_STATUS.CRITICAL,
        reasonCode: 'BP_CRITICAL',
        description: `Critical blood pressure (${systolic}/${diastolic} mmHg)`,
      };
    }

    // Attention check
    const isSysAtt = rules.systolic.attention.some((a) => systolic >= a.min && systolic <= a.max);
    const isDiaAtt = rules.diastolic.attention.some((a) => diastolic >= a.min && diastolic <= a.max);
    if (isSysAtt || isDiaAtt) {
      return {
        status: VITALS_STATUS.ATTENTION,
        reasonCode: 'BP_ATTENTION',
        description: `Elevated blood pressure (${systolic}/${diastolic} mmHg)`,
      };
    }

    // Normal check
    if (
      systolic >= rules.systolic.normal.min &&
      systolic <= rules.systolic.normal.max &&
      diastolic >= rules.diastolic.normal.min &&
      diastolic <= rules.diastolic.normal.max
    ) {
      return { status: VITALS_STATUS.NORMAL };
    }

    return { status: VITALS_STATUS.ATTENTION, reasonCode: 'BP_SUBOPTIMAL', description: `Blood pressure reading: ${systolic}/${diastolic} mmHg` };
  }

  const numVal = Number(value);

  // Critical check
  for (const crit of rules.critical || []) {
    if ((crit.min !== undefined && numVal >= crit.min) || (crit.max !== undefined && numVal <= crit.max)) {
      return {
        status: VITALS_STATUS.CRITICAL,
        reasonCode: `${metricType.toUpperCase()}_CRITICAL`,
        description: crit.reason || `Critical ${rules.label} (${numVal} ${rules.unit})`,
      };
    }
  }

  // Attention check
  for (const att of rules.attention || []) {
    if (numVal >= att.min && numVal <= att.max) {
      return {
        status: VITALS_STATUS.ATTENTION,
        reasonCode: `${metricType.toUpperCase()}_ATTENTION`,
        description: att.reason || `Unusual ${rules.label} (${numVal} ${rules.unit})`,
      };
    }
  }

  // Normal check
  if (rules.normal && numVal >= rules.normal.min && numVal <= rules.normal.max) {
    return { status: VITALS_STATUS.NORMAL };
  }

  return {
    status: VITALS_STATUS.ATTENTION,
    reasonCode: `${metricType.toUpperCase()}_OUT_OF_BOUNDS`,
    description: `${rules.label} (${numVal} ${rules.unit}) outside standard normal range`,
  };
}

/**
 * Counts how many recent consecutive readings in the sequence are abnormal.
 */
function countRecentAbnormalReadings(readings, metricType, rules) {
  let count = 0;
  for (const r of readings) {
    const outcome = evaluateThresholds(metricType, r.value, rules);
    if (outcome.status === VITALS_STATUS.CRITICAL || outcome.status === VITALS_STATUS.ATTENTION) {
      count++;
    } else {
      break; // Stop at first normal reading in reverse chronological order
    }
  }
  return count;
}

/**
 * Evaluates a complete multi-metric snapshot of vitals readings.
 * 
 * @param {Object} vitalsMap Map of { [metricType]: normalizedReading }
 * @param {Object} historyMap Map of { [metricType]: [readings] }
 * @param {Object} options Evaluation options
 * @returns {Object} Comprehensive evaluation summary
 */
export function evaluateVitalsSnapshot(vitalsMap = {}, historyMap = {}, options = {}) {
  const evaluations = {};
  let overallStatus = VITALS_STATUS.NORMAL;
  let criticalCandidate = null;
  let activeMetricCount = 0;

  const severityOrder = [
    VITALS_STATUS.UNKNOWN,
    VITALS_STATUS.STALE,
    VITALS_STATUS.NORMAL,
    VITALS_STATUS.ATTENTION,
    VITALS_STATUS.CRITICAL,
  ];

  for (const [metricType, reading] of Object.entries(vitalsMap)) {
    if (!reading) continue;
    activeMetricCount++;
    const history = (historyMap && historyMap[metricType]) || [];
    const evaluation = evaluateReading(reading, history, options);
    evaluations[metricType] = evaluation;

    const currentIdx = severityOrder.indexOf(overallStatus);
    const evalIdx = severityOrder.indexOf(evaluation.status);

    if (evalIdx > currentIdx) {
      overallStatus = evaluation.status;
    }

    if (evaluation.status === VITALS_STATUS.CRITICAL && evaluation.canTriggerSos) {
      if (!criticalCandidate) {
        criticalCandidate = evaluation;
      }
    }
  }

  return {
    overallStatus: activeMetricCount === 0 ? VITALS_STATUS.UNKNOWN : overallStatus,
    activeMetricCount,
    evaluations,
    criticalCandidate,
    canTriggerSos: Boolean(criticalCandidate?.canTriggerSos),
    isDemo: Boolean(criticalCandidate?.isDemo),
  };
}
