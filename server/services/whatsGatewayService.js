/**
 * server/services/whatsGatewayService.js
 * 
 * Dedicated, reusable WhatsGateway WhatsApp REST API integration for SAHAARA SOS.
 * 
 * WhatsGateway is a self-hosted WhatsApp gateway engine using @whiskeysockets/baileys
 * and MySQL/PHP, running as an independent service (Docker Compose or local service).
 * 
 * Guarantees & Operational Principles:
 * 1. Independent Service: No cloning or coupling of WhatsGateway PHP/MySQL code.
 * 2. Asynchronous Queue Semantics:
 *    - The Gateway API's "status": "queued" means ACCEPTED_BY_GATEWAY, NEVER delivered.
 *    - Delivery confirmation requires subsequent webhook verification.
 * 3. Strict Phone Normalization:
 *    - Destination numbers normalized to standard international digits (e.g. 919876543210).
 *    - Country codes preserved; invalid numbers rejected.
 * 4. Enterprise Security:
 *    - API keys and webhook secrets stored on backend only; never exposed to mobile.
 *    - No query-string authentication (PII privacy protection).
 *    - Timeouts enforced; zero silent automatic retries for ambiguous submissions.
 * 5. Webhook Integrity:
 *    - Validates X-WA-Hub-Signature using HMAC-SHA256 and constant-time comparison.
 *    - Fails closed if webhook secret is not configured.
 *    - Monotonic status ranking: older/duplicate callbacks cannot overwrite newer states.
 * 6. Isolated Testing:
 *    - Supports dependency injection for fetch and mock clients.
 *    - Zero real WhatsApp messages sent in test mode.
 */

const crypto = require('crypto');

// Standard status enum for WhatsGateway messaging
const GATEWAY_STATUS = {
  PENDING: 'PENDING',
  ACCEPTED_BY_GATEWAY: 'ACCEPTED_BY_GATEWAY',
  SENT: 'SENT',
  FAILED: 'FAILED',
  UNKNOWN: 'UNKNOWN',
};

// Monotonic status ranking to prevent older or duplicate callbacks from regressing status
const GATEWAY_STATUS_RANK = {
  UNKNOWN: 0,
  PENDING: 1,
  ACCEPTED_BY_GATEWAY: 2,
  SENT: 3,
  FAILED: 10,
};

/**
 * Normalizes phone numbers for WhatsGateway.
 * Requirements:
 * - International format without '+' or 'whatsapp:' prefix.
 * - Leading 0s stripped.
 * - Defaults to '91' prefix if exactly 10 digits.
 * - Must be valid numeric string between 10 and 15 digits.
 * - Returns null if invalid.
 */
function normalizeGatewayPhone(raw) {
  if (!raw) return null;
  let cleaned = String(raw).replace(/[\s+\-()]/g, '');
  if (cleaned.toLowerCase().startsWith('whatsapp:')) {
    cleaned = cleaned.substring(9);
  }
  cleaned = cleaned.replace(/^0+/, '');
  if (/^\d{10}$/.test(cleaned)) {
    cleaned = '91' + cleaned;
  }
  if (!/^\d{10,15}$/.test(cleaned)) {
    return null;
  }
  return cleaned;
}

/**
 * Reads WhatsGateway configuration from environment variables with optional overrides.
 * Never logs or exposes credentials.
 */
function getWhatsGatewayConfig(overrides = {}) {
  const url = (
    overrides.url !== undefined
      ? overrides.url
      : (process.env.WHATSAPP_GATEWAY_URL || 'http://127.0.0.1:8080')
  ).replace(/\/+$/, '');

  const apiKey = overrides.apiKey !== undefined
    ? overrides.apiKey
    : (process.env.WHATSAPP_GATEWAY_API_KEY || '');

  const timeoutMs = parseInt(
    overrides.timeoutMs !== undefined
      ? overrides.timeoutMs
      : (process.env.WHATSAPP_GATEWAY_TIMEOUT_MS || '15000'),
    10
  ) || 15000;

  const webhookSecret = overrides.webhookSecret !== undefined
    ? overrides.webhookSecret
    : (process.env.WHATSAPP_GATEWAY_WEBHOOK_SECRET || '');

  const statusCallbackUrl = overrides.statusCallbackUrl !== undefined
    ? overrides.statusCallbackUrl
    : (process.env.WHATSAPP_GATEWAY_STATUS_CALLBACK_URL || '');

  const isConfigured = Boolean(apiKey && url);

  return {
    url,
    apiKey,
    timeoutMs,
    webhookSecret,
    statusCallbackUrl,
    isConfigured,
  };
}

/**
 * Formats a clean, readable backend emergency message for guardians.
 */
function formatGatewayEmergencyMessage({
  userName = 'Sahaara Member',
  emergencyMessage = 'Pressed the SOS button and needs immediate emergency assistance!',
  locationSummary = 'Location unavailable (GPS off or weak signal)',
  mapsLink = 'No coordinates available',
  timeString = '',
}) {
  const timeDisplay = timeString || `${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST`;
  return [
    `🚨 *SAHAARA EMERGENCY ALERT* 🚨`,
    ``,
    `*${userName}* has triggered an SOS alert!`,
    ``,
    `*Emergency:* ${emergencyMessage}`,
    `*Location:* ${locationSummary}`,
    `*Map:* ${mapsLink}`,
    `*Time:* ${timeDisplay}`,
    ``,
    `⚠️ *Please contact them immediately.*`,
  ].join('\n');
}

/**
 * In-memory message tracker for active process session.
 * Reconciled with durable Firestore records.
 */
const gatewayMessageTracker = new Map();
let globalGatewayFetch = null;

function setGlobalGatewayFetch(fn) {
  globalGatewayFetch = fn;
}

function getGatewayTrackedMessage(key) {
  if (!key) return null;
  return gatewayMessageTracker.get(String(key)) || null;
}

function clearGatewayTrackedMessages() {
  gatewayMessageTracker.clear();
}

/**
 * Persists message details durably in-memory and to Firestore.
 */
async function trackGatewayMessageDurable({
  messageId,
  requestId,
  wamid,
  userId,
  alertId,
  guardianName,
  recipientPhone,
  status,
  error = null,
  firestoreDb = null,
}) {
  const record = {
    messageId: messageId ? String(messageId) : null,
    requestId: requestId ? String(requestId) : null,
    wamid: wamid ? String(wamid) : null,
    userId: String(userId || ''),
    alertId: alertId ? String(alertId) : null,
    guardianName: String(guardianName || 'Guardian'),
    recipientPhone: String(recipientPhone || ''),
    status: status || GATEWAY_STATUS.UNKNOWN,
    error: error ? String(error) : null,
    updatedAt: new Date().toISOString(),
  };

  const keys = [messageId, requestId, wamid, `${userId}_${recipientPhone}`].filter(Boolean);
  keys.forEach((k) => gatewayMessageTracker.set(String(k), record));

  if (firestoreDb && alertId) {
    try {
      const alertRef = firestoreDb.collection('sos_alerts').doc(alertId);
      const updateData = {
        updatedAt: new Date().toISOString(),
      };
      if (messageId) {
        updateData[`guardianDispatches.${messageId}`] = record;
      } else if (requestId) {
        updateData[`guardianDispatches.${requestId}`] = record;
      }
      await alertRef.set(updateData, { merge: true });
    } catch (e) {
      console.warn('[WhatsGateway Tracker] Firestore write note:', e.message);
    }
  }

  return record;
}

/**
 * Synchronizes an updated guardian status into the Firestore SOS alert document.
 */
async function syncGuardianStatusToAlertGateway({
  alertId,
  key,
  newStatus,
  error = null,
  firestoreDb = null,
}) {
  if (!firestoreDb || !alertId) return;
  try {
    const alertRef = firestoreDb.collection('sos_alerts').doc(alertId);
    const snap = await alertRef.get();
    if (!snap.exists) return;
    const data = snap.data() || {};
    const results = Array.isArray(data.results) ? [...data.results] : [];
    const idx = results.findIndex(
      (r) =>
        String(r.messageId) === String(key) ||
        String(r.requestId) === String(key) ||
        String(r.wamid) === String(key) ||
        String(r.phone) === String(key)
    );
    if (idx !== -1) {
      const currentRank = GATEWAY_STATUS_RANK[results[idx].status] || 0;
      const newRank = GATEWAY_STATUS_RANK[newStatus] || 0;
      if (newRank >= currentRank) {
        results[idx].status = newStatus;
        if (error) results[idx].error = error;
        results[idx].updatedAt = new Date().toISOString();
      }
    }
    await alertRef.update({
      results,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('[WhatsGateway Sync] Error syncing status to alert:', err.message);
  }
}

/**
 * Sends a single WhatsApp message via WhatsGateway.
 * 
 * Strictly verifies parameters, rejects invalid numbers, applies timeout,
 * and parses JSON response.
 */
async function sendWhatsGatewayMessage({
  to,
  message,
  priority = 'urgent',
  humanize = false,
  config = null,
  injectedFetch = null,
}) {
  const effectiveConfig = config || getWhatsGatewayConfig();
  const fetchFn = injectedFetch || globalGatewayFetch || globalThis.fetch;

  if (typeof fetchFn !== 'function') {
    throw new Error('No HTTP fetch implementation available for WhatsGateway.');
  }

  const normalizedTo = normalizeGatewayPhone(to);
  if (!normalizedTo) {
    return {
      ok: false,
      status: GATEWAY_STATUS.FAILED,
      error: `Invalid recipient phone number: "${to}". Must be a valid international number with country code.`,
      code: 'INVALID_PHONE_NUMBER',
      delivered: false,
      accepted: false,
    };
  }

  if (!effectiveConfig.apiKey) {
    return {
      ok: false,
      status: GATEWAY_STATUS.FAILED,
      error: 'WhatsGateway API Key (WHATSAPP_GATEWAY_API_KEY) is not configured on the server.',
      code: 'GATEWAY_API_KEY_MISSING',
      delivered: false,
      accepted: false,
    };
  }

  const endpoint = `${effectiveConfig.url}/api/send.php`;
  const payload = {
    to: normalizedTo,
    message,
    priority,
    humanize,
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), effectiveConfig.timeoutMs);

  try {
    const res = await fetchFn(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': effectiveConfig.apiKey,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const rawText = await res.text();
    let data = {};
    try {
      data = JSON.parse(rawText);
    } catch (_) {
      return {
        ok: false,
        status: GATEWAY_STATUS.FAILED,
        statusCode: res.status,
        error: `Invalid non-JSON response from WhatsGateway (${res.status}): ${rawText.slice(0, 150)}`,
        code: 'GATEWAY_NON_JSON_RESPONSE',
        delivered: false,
        accepted: false,
      };
    }

    if (!res.ok || data.ok === false) {
      let errorCode = 'GATEWAY_SEND_FAILED';
      if (res.status === 401) errorCode = 'GATEWAY_UNAUTHORIZED';
      else if (res.status === 404) errorCode = 'GATEWAY_RECIPIENT_NOT_ON_WHATSAPP';
      else if (res.status === 409) errorCode = 'GATEWAY_DEVICE_DISCONNECTED';
      else if (res.status === 502) errorCode = 'GATEWAY_WORKER_UNREACHABLE';
      else if (res.status === 503) errorCode = 'GATEWAY_DEGRADED';
      else if (res.status === 429) errorCode = 'GATEWAY_RATE_LIMITED';

      return {
        ok: false,
        status: GATEWAY_STATUS.FAILED,
        statusCode: res.status,
        error: data.error || `WhatsGateway rejected message with HTTP ${res.status}`,
        code: errorCode,
        delivered: false,
        accepted: false,
        raw: data,
      };
    }

    // Success (200 OK): Queue acceptance
    // CRITICAL: Status 'queued' means accepted by queue, NOT delivered!
    const messageId = data.message_id ? String(data.message_id) : null;
    const requestId = data.request_id ? String(data.request_id) : null;
    const wamid = data.messages?.[0]?.id ? String(data.messages[0].id) : null;

    return {
      ok: true,
      status: GATEWAY_STATUS.ACCEPTED_BY_GATEWAY,
      messageId,
      requestId,
      wamid,
      recipient: normalizedTo,
      rawStatus: data.status || 'queued',
      delivered: false, // NOT delivered yet!
      accepted: true,
      raw: data,
    };
  } catch (err) {
    clearTimeout(timeoutId);
    const isTimeout =
      err.name === 'AbortError' ||
      err.message?.includes('aborted') ||
      err.message?.toLowerCase().includes('timeout');

    return {
      ok: false,
      status: GATEWAY_STATUS.FAILED,
      error: isTimeout
        ? `WhatsGateway request timed out after ${effectiveConfig.timeoutMs}ms. Never retrying automatically to prevent duplicate emergency alerts.`
        : `Network error connecting to WhatsGateway: ${err.message}`,
      code: isTimeout ? 'GATEWAY_TIMEOUT' : 'GATEWAY_NETWORK_ERROR',
      delivered: false,
      accepted: false,
    };
  }
}

/**
 * Sends SOS alerts sequentially to registered guardians.
 * Processing continues for remaining guardians even if one fails.
 */
async function sendSosAlertsToGuardiansGateway({
  guardians = [],
  userName = 'Sahaara Member',
  emergencyMessage = 'Pressed the SOS button and needs immediate emergency assistance!',
  locationSummary = 'Location unavailable (GPS off or weak signal)',
  mapsLink = 'No coordinates available',
  timeString = '',
  userId,
  alertId,
  firestoreDb = null,
  config = null,
  injectedFetch = null,
}) {
  const effectiveConfig = config || getWhatsGatewayConfig();
  const formattedMessage = formatGatewayEmergencyMessage({
    userName,
    emergencyMessage,
    locationSummary,
    mapsLink,
    timeString,
  });

  const results = [];
  let acceptedCount = 0;

  for (const guardian of guardians) {
    const guardianName = guardian.name || 'Guardian';
    const rawPhone = guardian.phone;

    const res = await sendWhatsGatewayMessage({
      to: rawPhone,
      message: formattedMessage,
      priority: 'urgent',
      humanize: false,
      config: effectiveConfig,
      injectedFetch,
    });

    const normalizedPhone = normalizeGatewayPhone(rawPhone);
    const resultEntry = {
      name: guardianName,
      phone: normalizedPhone || rawPhone,
      rawPhone,
      relation: guardian.relation || '',
      status: res.status, // 'ACCEPTED_BY_GATEWAY' | 'FAILED'
      accepted: Boolean(res.accepted),
      delivered: false, // NEVER claimed as delivered on submission
      messageId: res.messageId || null,
      requestId: res.requestId || null,
      wamid: res.wamid || null,
      error: res.error || null,
      code: res.code || null,
    };

    results.push(resultEntry);
    if (res.accepted) {
      acceptedCount++;
    }

    // Persist durable tracking
    await trackGatewayMessageDurable({
      messageId: res.messageId,
      requestId: res.requestId,
      wamid: res.wamid,
      userId,
      alertId,
      guardianName,
      recipientPhone: normalizedPhone || rawPhone,
      status: res.status,
      error: res.error,
      firestoreDb,
    });
  }

  const totalContacts = guardians.length;
  const acceptedAll = acceptedCount === totalContacts && totalContacts > 0;
  let overallStatus = 'FAILED';
  if (acceptedAll) overallStatus = 'ACCEPTED_ALL';
  else if (acceptedCount > 0) overallStatus = 'PARTIALLY_ACCEPTED';

  return {
    ok: acceptedCount > 0,
    overallStatus,
    acceptedAll,
    acceptedCount,
    totalContacts,
    results,
    message: formattedMessage,
    provider: 'whatsgateway',
    deliveryCallbacksEnabled: Boolean(effectiveConfig.statusCallbackUrl && effectiveConfig.webhookSecret),
    statusCallbackUrl: effectiveConfig.statusCallbackUrl || null,
  };
}

/**
 * Checks WhatsGateway system health via GET /api/health.php.
 * 
 * Verifies API reachability, MySQL database status, and Node.js Baileys worker status.
 * Never dispatches an SOS message or confirms delivery.
 */
async function checkWhatsGatewayHealth({ config = null, injectedFetch = null } = {}) {
  const effectiveConfig = config || getWhatsGatewayConfig();
  const fetchFn = injectedFetch || globalGatewayFetch || globalThis.fetch;

  if (typeof fetchFn !== 'function') {
    throw new Error('No HTTP fetch implementation available for WhatsGateway.');
  }

  const endpoint = `${effectiveConfig.url}/api/health.php`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000);

  try {
    const res = await fetchFn(endpoint, {
      method: 'GET',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const rawText = await res.text();
    let data = {};
    try {
      data = JSON.parse(rawText);
    } catch (_) {
      return {
        ok: false,
        reachable: res.ok,
        databaseHealthy: false,
        workerHealthy: false,
        provider: 'whatsgateway',
        sosDispatched: false,
        deliveryConfirmed: false,
        error: `Non-JSON response from health probe (${res.status}): ${rawText.slice(0, 100)}`,
      };
    }

    const dbHealthy = Boolean(data.database?.ok && data.database?.connected);
    const workerHealthy = Boolean(data.worker?.ok && data.worker?.status_code === 200);
    const isHealthy = res.ok && data.ok === true && dbHealthy && workerHealthy;

    return {
      ok: isHealthy,
      reachable: true,
      status: data.status || 'unknown',
      databaseHealthy: dbHealthy,
      workerHealthy: workerHealthy,
      provider: 'whatsgateway',
      sosDispatched: false,
      deliveryConfirmed: false,
      service: data.service || 'whatsgateway',
      database: data.database || null,
      worker: data.worker || null,
    };
  } catch (err) {
    clearTimeout(timeoutId);
    return {
      ok: false,
      reachable: false,
      databaseHealthy: false,
      workerHealthy: false,
      provider: 'whatsgateway',
      sosDispatched: false,
      deliveryConfirmed: false,
      error: `WhatsGateway health check unreachable: ${err.message}`,
    };
  }
}

/**
 * Validates HMAC-SHA256 signature against raw request body using constant-time comparison.
 * Fails closed if secret or signature is missing.
 */
function validateGatewayWebhookSignature(rawBody, signature, secret) {
  if (!rawBody || !signature || !secret) {
    return false;
  }
  try {
    const bodyBuffer = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(String(rawBody), 'utf8');
    const expectedHex = crypto.createHmac('sha256', secret).update(bodyBuffer).digest('hex');

    const cleanSig = String(signature).trim().toLowerCase();
    const cleanExpected = expectedHex.toLowerCase();

    // Constant-time comparison
    const sigBuffer = Buffer.from(cleanSig);
    const expBuffer = Buffer.from(cleanExpected);

    if (sigBuffer.length !== expBuffer.length) {
      return false;
    }
    return crypto.timingSafeEqual(sigBuffer, expBuffer);
  } catch (err) {
    return false;
  }
}

/**
 * Processes an inbound delivery or status callback from WhatsGateway.
 * 
 * Recognizes message.sent and message.failed events.
 * Does NOT mark message.sent as delivered (receipt only proves message dispatched by worker).
 * Prevents regressions via monotonic rank comparison.
 */
async function processGatewayCallback({
  event,
  messageId,
  requestId,
  wamid,
  recipient,
  status,
  error = null,
  firestoreDb = null,
}) {
  const lookupKey = String(messageId || requestId || wamid || recipient || '');
  let tracked = getGatewayTrackedMessage(lookupKey);

  // If not found in memory, try to look up in Firestore
  if (!tracked && firestoreDb && lookupKey) {
    try {
      const snap = await firestoreDb.collection('sos_alerts')
        .where(`guardianDispatches.${lookupKey}.status`, '!=', null)
        .limit(1)
        .get();
      if (!snap.empty) {
        const docData = snap.docs[0].data();
        tracked = docData.guardianDispatches?.[lookupKey];
      }
    } catch (_) {}
  }

  // Determine target status
  let newStatus = GATEWAY_STATUS.UNKNOWN;
  const lowerEvent = String(event || '').toLowerCase();
  const lowerStatus = String(status || '').toLowerCase();

  if (lowerEvent === 'message.sent' || lowerStatus === 'sent') {
    newStatus = GATEWAY_STATUS.SENT; // Note: SENT, not DELIVERED
  } else if (lowerEvent === 'message.failed' || lowerStatus === 'failed') {
    newStatus = GATEWAY_STATUS.FAILED;
  } else if (lowerStatus === 'queued' || lowerStatus === 'accepted') {
    newStatus = GATEWAY_STATUS.ACCEPTED_BY_GATEWAY;
  }

  const currentRank = tracked ? (GATEWAY_STATUS_RANK[tracked.status] || 0) : 0;
  const newRank = GATEWAY_STATUS_RANK[newStatus] || 0;

  // Prevent out-of-order or duplicate regressions
  if (newRank < currentRank) {
    return {
      ok: true,
      status: 'ignored_out_of_order',
      previousStatus: tracked.status,
      attemptedStatus: newStatus,
    };
  }

  if (tracked) {
    tracked.status = newStatus;
    if (error) tracked.error = error;
    tracked.updatedAt = new Date().toISOString();

    if (tracked.alertId) {
      await syncGuardianStatusToAlertGateway({
        alertId: tracked.alertId,
        key: lookupKey,
        newStatus,
        error,
        firestoreDb,
      });
    }
  }

  return {
    ok: true,
    status: newStatus,
    messageId,
    requestId,
    wamid,
  };
}

module.exports = {
  GATEWAY_STATUS,
  GATEWAY_STATUS_RANK,
  normalizeGatewayPhone,
  getWhatsGatewayConfig,
  formatGatewayEmergencyMessage,
  sendWhatsGatewayMessage,
  sendSosAlertsToGuardiansGateway,
  checkWhatsGatewayHealth,
  validateGatewayWebhookSignature,
  processGatewayCallback,
  setGlobalGatewayFetch,
  getGatewayTrackedMessage,
  clearGatewayTrackedMessages,
  trackGatewayMessageDurable,
  syncGuardianStatusToAlertGateway,
};
