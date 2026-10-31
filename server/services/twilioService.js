/**
 * server/services/twilioService.js
 * 
 * Reusable Twilio WhatsApp Messaging Service for SAHAARA SOS.
 * 
 * Core Capabilities:
 * 1. Official Twilio Node.js SDK integration using API Key & Secret for outbound calls
 *    and Auth Token for webhook signature validation.
 * 2. Strict Sandbox & Production modes:
 *    - Enforces >= 3-second rate limit between sequential outbound Sandbox requests.
 *    - Detects & handles Twilio Sandbox error 63015 (recipient not joined).
 *    - CRITICAL: Never uses the default Sandbox Appointment Reminder Content SID
 *      (HXfe5ab5f00277942d4d4200328b4d403c) for emergency SOS alerts.
 * 3. Content SID & ContentVariables support:
 *    - Configurable Content SID.
 *    - ContentVariables supplied ONLY when required/declared by the template.
 *    - Never silently falls back from a failed template to free-form text.
 * 4. Status Tracking:
 *    - Tracks QUEUED, SENDING, SENT, DELIVERED, READ, FAILED, UNDELIVERED, UNKNOWN.
 *    - Never treats API acceptance as delivery.
 *    - Validates Twilio webhook signatures (X-Twilio-Signature).
 *    - Safely handles retries, duplicate callbacks, and out-of-order events.
 */

const twilio = require('twilio');

// Standard status enum for SAHAARA SOS messaging
const STATUS = {
  QUEUED: 'QUEUED',
  SENDING: 'SENDING',
  SENT: 'SENT',
  DELIVERED: 'DELIVERED',
  READ: 'READ',
  FAILED: 'FAILED',
  UNDELIVERED: 'UNDELIVERED',
  UNKNOWN: 'UNKNOWN',
};

// Monotonic status ranking to prevent older callbacks from overwriting newer states
const STATUS_RANK = {
  UNKNOWN: 0,
  QUEUED: 1,
  SENDING: 2,
  SENT: 3,
  DELIVERED: 4,
  READ: 5,
  FAILED: 10,
  UNDELIVERED: 10,
};

// Known Appointment Reminder Content SIDs that MUST NOT be used for SOS alerts
const APPOINTMENT_REMINDER_SIDS = [
  'HXfe5ab5f00277942d4d4200328b4d403c', // Twilio Default Sandbox Appointment Reminder
];

/**
 * Normalizes phone numbers (removes spaces, +, -, (), prefixes 91 if 10 digits).
 */
function normalizePhoneNumber(raw) {
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
 * Formats a phone number for Twilio WhatsApp (whatsapp:+<e164>).
 */
function formatWhatsAppAddress(phone) {
  const normalized = normalizePhoneNumber(phone);
  if (!normalized || normalized.length < 7) return null;
  return `whatsapp:+${normalized.replace(/^\+/, '')}`;
}

/**
 * Checks whether a Content SID is the default Appointment Reminder template.
 */
function isAppointmentReminderContentSid(contentSid) {
  if (!contentSid) return false;
  return APPOINTMENT_REMINDER_SIDS.includes(contentSid.trim());
}

/**
 * Reads Twilio configuration from environment variables with optional overrides.
 * Never logs or exposes credentials.
 */
function getTwilioConfig(overrides = {}) {
  const accountSid = overrides.accountSid !== undefined ? overrides.accountSid : (process.env.TWILIO_ACCOUNT_SID || '');
  const apiKey = overrides.apiKey !== undefined ? overrides.apiKey : (process.env.TWILIO_API_KEY || '');
  const apiSecret = overrides.apiSecret !== undefined ? overrides.apiSecret : (process.env.TWILIO_API_SECRET || '');
  const authToken = overrides.authToken !== undefined ? overrides.authToken : (process.env.TWILIO_AUTH_TOKEN || '');
  const from = overrides.from !== undefined ? overrides.from : (process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+17372508034');
  const contentSid = overrides.contentSid !== undefined ? overrides.contentSid : (process.env.TWILIO_WHATSAPP_CONTENT_SID || '');
  const mode = ((overrides.mode !== undefined ? overrides.mode : process.env.TWILIO_WHATSAPP_MODE) || 'sandbox').toLowerCase();
  const statusCallbackUrl = overrides.statusCallbackUrl !== undefined ? overrides.statusCallbackUrl : (process.env.TWILIO_STATUS_CALLBACK_URL || '');

  const isConfigured = Boolean(accountSid && apiKey && apiSecret && authToken && from);

  return {
    accountSid,
    apiKey,
    apiSecret,
    authToken,
    from,
    contentSid,
    mode, // 'sandbox' | 'production'
    isSandbox: mode === 'sandbox',
    statusCallbackUrl,
    isConfigured,
  };
}

/**
 * Creates an authorized Twilio client using API Key SID & Secret with Account SID.
 * Accepts an injected client for unit testing.
 */
let globalTwilioClient = null;

function setGlobalTwilioClient(client) {
  globalTwilioClient = client;
}

function createTwilioClient(config, injectedClient = null) {
  if (injectedClient) return injectedClient;
  if (globalTwilioClient) return globalTwilioClient;
  if (!config.isConfigured) return null;
  return twilio(config.apiKey, config.apiSecret, { accountSid: config.accountSid });
}

/**
 * Maps Twilio API or Webhook status string to SAHAARA STATUS enum.
 */
function mapTwilioStatus(twilioStatus, eventType = null) {
  if (eventType === 'READ' || twilioStatus === 'read') return STATUS.READ;
  if (!twilioStatus) return STATUS.UNKNOWN;

  switch (String(twilioStatus).toLowerCase()) {
    case 'queued':
    case 'accepted':
      return STATUS.QUEUED;
    case 'sending':
      return STATUS.SENDING;
    case 'sent':
      return STATUS.SENT;
    case 'delivered':
      return STATUS.DELIVERED;
    case 'read':
      return STATUS.READ;
    case 'failed':
      return STATUS.FAILED;
    case 'undelivered':
      return STATUS.UNDELIVERED;
    default:
      return STATUS.UNKNOWN;
  }
}

let globalFirestoreDb = null;

function setGlobalFirestoreDb(db) {
  globalFirestoreDb = db;
}

function getFirestore() {
  if (globalFirestoreDb) return globalFirestoreDb;
  try {
    const { getFirestoreDb } = require('./authAndContactsService');
    return getFirestoreDb();
  } catch (_) {
    return null;
  }
}

/**
 * Builds server-controlled ContentVariables from verified user information,
 * situation reason, validated location, map URL, and server-generated timestamp.
 */
function buildSosContentVariables({
  userName,
  emergencyMessage,
  locationSummary,
  mapsLink,
  timeString,
}) {
  if (userName !== undefined && String(userName).trim() === '') {
    throw new Error('Required template variables missing (userName cannot be blank)');
  }
  if (emergencyMessage !== undefined && String(emergencyMessage).trim() === '') {
    throw new Error('Required template variables missing (emergencyMessage cannot be blank)');
  }

  const cleanName = String(userName || 'Sahaara Member').trim();
  const cleanMsg = String(emergencyMessage || 'Needs immediate emergency assistance!').trim();
  const cleanLoc = String(locationSummary || 'Location unavailable').trim();
  const cleanMap = String(mapsLink || 'No coordinates available').trim();
  const cleanTime = String(timeString || new Date().toISOString()).trim();

  if (!cleanName || !cleanMsg) {
    throw new Error('Required template variables missing');
  }

  return {
    '1': cleanName,
    '2': cleanMsg,
    '3': cleanLoc,
    '4': cleanMap,
    '5': cleanTime,
    name: cleanName,
    message: cleanMsg,
    location: cleanLoc,
    mapUrl: cleanMap,
    time: cleanTime,
  };
}

/**
 * Validates template ContentVariables to ensure all values are defined non-empty strings.
 */
function validateContentVariables(contentVariables) {
  if (!contentVariables || typeof contentVariables !== 'object') return false;
  for (const [key, val] of Object.entries(contentVariables)) {
    if (val === undefined || val === null || String(val).trim() === '') return false;
  }
  return true;
}

/**
 * In-memory registry for fast cache lookups of outbound Twilio Message SIDs.
 * Maps messageSid -> { alertId, userId, phone, guardianName, status, history, errorCode, errorMessage, lastUpdated }
 */
const messageTracker = new Map();

function trackMessage({ messageSid, alertId = null, userId = null, phone = null, guardianName = null, initialStatus = STATUS.QUEUED }) {
  if (!messageSid) return;
  messageTracker.set(messageSid, {
    messageSid,
    alertId,
    userId,
    phone,
    guardianName,
    status: initialStatus,
    errorCode: null,
    errorMessage: null,
    history: [{ status: initialStatus, timestamp: new Date().toISOString() }],
    lastUpdated: Date.now(),
  });
}

/**
 * Durable Message Tracking: Persists Twilio Message SID, SOS Alert ID, User ID,
 * and guardian phone mapping in Firestore collection 'twilio_dispatches'.
 * Survives server restarts and multi-instance deployments.
 */
async function trackMessageDurable({
  messageSid,
  alertId = null,
  userId = null,
  phone = null,
  guardianName = null,
  initialStatus = STATUS.QUEUED,
  firestoreDb = null,
}) {
  if (!messageSid) return;
  const db = firestoreDb || getFirestore();

  const existingMemory = messageTracker.get(messageSid);
  const currentStatus = existingMemory?.status && STATUS_RANK[existingMemory.status] > STATUS_RANK[initialStatus]
    ? existingMemory.status
    : initialStatus;

  const record = {
    messageSid,
    alertId: alertId || existingMemory?.alertId || null,
    userId: userId || existingMemory?.userId || null,
    phone: phone || existingMemory?.phone || null,
    guardianName: guardianName || existingMemory?.guardianName || null,
    status: currentStatus,
    history: existingMemory?.history || [{ status: initialStatus, timestamp: new Date().toISOString() }],
    errorCode: existingMemory?.errorCode || null,
    errorMessage: existingMemory?.errorMessage || null,
    lastUpdated: Date.now(),
  };
  messageTracker.set(messageSid, record);

  if (db) {
    try {
      const docRef = db.collection('twilio_dispatches').doc(messageSid);
      const docSnap = await docRef.get();
      if (docSnap && docSnap.exists) {
        // Document already exists (e.g. early callback arrived before send workflow finished)
        const data = docSnap.data();
        const finalStatus = (STATUS_RANK[data.status] > STATUS_RANK[initialStatus]) ? data.status : initialStatus;
        await docRef.update({
          alertId: alertId || data.alertId || null,
          userId: userId || data.userId || null,
          phone: phone || data.phone || null,
          guardianName: guardianName || data.guardianName || null,
          status: finalStatus,
          pendingEarlyCallback: false,
          lastUpdated: new Date().toISOString(),
        });

        // If early callback already marked status higher (e.g. DELIVERED), sync to sos_alerts!
        if (alertId && data.status && STATUS_RANK[data.status] > STATUS_RANK[initialStatus]) {
          await syncGuardianStatusToAlert({
            alertId,
            messageSid,
            phone,
            newStatus: data.status,
            errorCode: data.errorCode || null,
            errorMessage: data.errorMessage || null,
            firestoreDb: db,
          });
        }
      } else if (docRef && typeof docRef.set === 'function') {
        await docRef.set({
          messageSid,
          alertId: alertId || null,
          userId: userId || null,
          phone: phone || null,
          guardianName: guardianName || null,
          status: initialStatus,
          history: [{ status: initialStatus, timestamp: new Date().toISOString() }],
          errorCode: null,
          errorMessage: null,
          pendingEarlyCallback: false,
          createdAt: new Date().toISOString(),
          lastUpdated: new Date().toISOString(),
        });
      }
    } catch (dbErr) {
      console.warn('[Twilio Dispatch] Firestore durable tracking notice:', dbErr.message);
    }
  }
}

/**
 * Synchronizes guardian delivery status and updates aggregate delivery status in Firestore sos_alerts.
 */
async function syncGuardianStatusToAlert({
  alertId,
  messageSid,
  phone = null,
  newStatus,
  errorCode = null,
  errorMessage = null,
  firestoreDb = null,
}) {
  const db = firestoreDb || getFirestore();
  if (!alertId || !db) return;
  try {
    const alertRef = db.collection('sos_alerts').doc(alertId);
    const alertDoc = await alertRef.get();
    if (!alertDoc || !alertDoc.exists) return;

    const data = alertDoc.data();
    const cleanPhone = phone ? normalizePhoneNumber(phone) : null;

    const guardianResults = (data.guardianResults || []).map((gr) => {
      const matchSid = gr.messageSid && gr.messageSid === messageSid;
      const matchPhone = cleanPhone && gr.rawPhone && normalizePhoneNumber(gr.rawPhone) === cleanPhone;

      if (matchSid || matchPhone) {
        return {
          ...gr,
          messageSid: gr.messageSid || messageSid,
          status: newStatus,
          delivered: newStatus === STATUS.DELIVERED || newStatus === STATUS.READ,
          read: newStatus === STATUS.READ,
          errorCode: errorCode || gr.errorCode || null,
          errorMessage: errorMessage || gr.errorMessage || null,
        };
      }
      return gr;
    });

    const allDelivered =
      guardianResults.length > 0 &&
      guardianResults.every((g) => g.status === STATUS.DELIVERED || g.status === STATUS.READ);
    const anyDelivered = guardianResults.some(
      (g) => g.status === STATUS.DELIVERED || g.status === STATUS.READ
    );
    const allFailed =
      guardianResults.length > 0 &&
      guardianResults.every((g) => g.status === STATUS.FAILED || g.status === STATUS.UNDELIVERED);

    let overallDeliveryStatus = data.deliveryStatus || data.overallStatus;
    if (allDelivered) {
      overallDeliveryStatus = 'DELIVERED_ALL';
    } else if (anyDelivered) {
      overallDeliveryStatus = 'PARTIALLY_DELIVERED';
    } else if (allFailed) {
      overallDeliveryStatus = 'FAILED_ALL';
    }

    await alertRef.update({
      guardianResults,
      deliveryStatus: overallDeliveryStatus,
      lastCallbackAt: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('[Twilio Callback] Sync to sos_alerts notice:', err.message);
  }
}

function getTrackedMessage(messageSid) {
  return messageTracker.get(messageSid) || null;
}

function clearTrackedMessages() {
  messageTracker.clear();
}

/**
 * Sends a single WhatsApp message via Twilio using the configured Content SID.
 * 
 * Strict Guarantees:
 * - Rejects missing configuration upfront.
 * - Rejects invalid phone numbers.
 * - Enforces: NEVER sends the Appointment Reminder Content SID for SAHAARA SOS alerts.
 * - Never silently falls back from template to free-form text.
 * - Supplies ContentVariables only when provided and non-empty.
 * - Maps initial status accurately (QUEUED / SENDING / SENT - never DELIVERED on create).
 * - Catches Twilio errors, specifically error 63015 (Sandbox recipient not joined).
 */
async function sendTwilioWhatsAppMessage({
  toPhone,
  guardianName = 'Guardian',
  contentSid = null,
  contentVariables = null,
  configOverrides = {},
  client = null,
}) {
  const config = getTwilioConfig(configOverrides);

  // 1. Check configuration
  if (!config.isConfigured) {
    return {
      accepted: false,
      status: STATUS.FAILED,
      error: 'Twilio configuration is incomplete. Check TWILIO_ACCOUNT_SID, TWILIO_API_KEY, TWILIO_API_SECRET, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM in backend .env',
      code: 'CONFIG_MISSING',
      messageSid: null,
    };
  }

  // 2. Validate Content SID
  const activeContentSid = (contentSid || config.contentSid || '').trim();
  if (!activeContentSid) {
    return {
      accepted: false,
      status: STATUS.FAILED,
      error: 'TWILIO_WHATSAPP_CONTENT_SID is missing. Twilio WhatsApp requires a Content SID.',
      code: 'CONTENT_SID_MISSING',
      messageSid: null,
    };
  }

  // 3. 🚨 CRITICAL RESTRICTION: Block Appointment Reminder Content SID from being sent as SOS
  if (isAppointmentReminderContentSid(activeContentSid)) {
    return {
      accepted: false,
      status: STATUS.FAILED,
      error: `Configured Content SID (${activeContentSid}) is an Appointment Reminder template ("Reminder: Appt Tue Oct 29..."). It cannot represent a SAHAARA SOS emergency notification. Twilio Sandbox does not support custom emergency templates; an approved production SOS Content SID is required.`,
      code: 'APPOINTMENT_REMINDER_BLOCKED',
      messageSid: null,
    };
  }

  // 4. Validate contentVariables if provided
  if (contentVariables && !validateContentVariables(contentVariables)) {
    return {
      accepted: false,
      status: STATUS.FAILED,
      error: 'Invalid contentVariables: all template variables must be defined non-empty values.',
      code: 'INVALID_CONTENT_VARIABLES',
      messageSid: null,
    };
  }

  // 5. 🚨 SANDBOX RESTRICTION: In Sandbox mode, actual SOS alerts cannot be dispatched
  // Arbitrary Content SIDs are NOT permitted to bypass this restriction
  if (config.isSandbox) {
    return {
      accepted: false,
      status: STATUS.FAILED,
      error: 'Twilio WhatsApp is operating in Sandbox mode. The Sandbox does not support custom emergency templates and cannot dispatch SAHAARA SOS alerts. Live SOS dispatch requires a production Twilio WhatsApp sender (TWILIO_WHATSAPP_MODE=production) with an approved Meta emergency template.',
      code: 'SANDBOX_MODE_RESTRICTION',
      messageSid: null,
    };
  }

  // 4. Validate phone number
  const formattedTo = formatWhatsAppAddress(toPhone);
  if (!formattedTo) {
    return {
      accepted: false,
      status: STATUS.FAILED,
      error: `Invalid phone number format: "${toPhone}". Phone numbers must contain at least 7 digits.`,
      code: 'INVALID_PHONE_NUMBER',
      messageSid: null,
    };
  }

  // 5. Initialize client
  const twilioClient = createTwilioClient(config, client);
  if (!twilioClient) {
    return {
      accepted: false,
      status: STATUS.FAILED,
      error: 'Failed to initialize Twilio client',
      code: 'CLIENT_INIT_FAILED',
      messageSid: null,
    };
  }

  // 6. Build message payload
  const messageOptions = {
    from: config.from,
    to: formattedTo,
    contentSid: activeContentSid,
  };

  // Only supply ContentVariables when non-empty object is explicitly provided
  if (contentVariables && typeof contentVariables === 'object' && Object.keys(contentVariables).length > 0) {
    messageOptions.contentVariables = JSON.stringify(contentVariables);
  }

  // Supply statusCallback if valid HTTPS URL is configured
  if (config.statusCallbackUrl && config.statusCallbackUrl.startsWith('https://')) {
    messageOptions.statusCallback = config.statusCallbackUrl;
  }

  // 7. Execute outbound call
  try {
    const msg = await twilioClient.messages.create(messageOptions);

    // Initial status: mapped from Twilio response ('queued', 'accepted', 'sending')
    // Important: Do not mark as DELIVERED here!
    const mapped = mapTwilioStatus(msg.status);
    const initialStatus = (mapped === STATUS.DELIVERED || mapped === STATUS.READ)
      ? STATUS.SENT
      : (mapped || STATUS.QUEUED);

    return {
      accepted: true,
      status: initialStatus, // QUEUED | SENDING | SENT
      messageSid: msg.sid,
      to: formattedTo,
      contentSid: activeContentSid,
      error: null,
      code: null,
    };
  } catch (err) {
    let errorCode = err.code || 'TWILIO_API_ERROR';
    let errorMessage = err.message || 'Unknown error creating Twilio message';

    // Sandbox error 63015: Recipient has not joined Sandbox
    if (err.code === 63015 || String(err.message).includes('63015')) {
      errorCode = 63015;
      errorMessage = `Recipient (${formattedTo}) has not joined the Twilio WhatsApp Sandbox. Recipients must send "join <sandbox-code>" to ${config.from} before they can receive Sandbox messages (Twilio Error 63015).`;
    }

    return {
      accepted: false,
      status: STATUS.FAILED,
      error: errorMessage,
      code: errorCode,
      messageSid: null,
    };
  }
}

/**
 * Sends SOS alerts to a list of guardians sequentially.
 * 
 * Sending behavior:
 * - In Sandbox mode: enforces a safe interval of at least 3 seconds between outbound requests.
 * - In Production mode: safe staggered delay (500ms).
 * - Independent failure handling: one guardian's failure does NOT stop attempts to contact others.
 * - Automatically registers message SIDs with the status tracker.
 */
async function sendSosAlertsToGuardians({
  guardians = [],
  userName = 'Sahaara Member',
  emergencyMessage = 'Emergency alert triggered via Sahaara SOS',
  locationSummary = 'Location unavailable',
  mapsLink = 'No coordinates available',
  timeString = 'Recently',
  contentSid = null,
  contentVariables = null,
  alertId = null,
  userId = null,
  configOverrides = {},
  client = null,
  sleepFn = null,
  firestoreDb = null,
}) {
  const config = getTwilioConfig(configOverrides);

  // 🚨 SANDBOX RESTRICTION: Block actual SOS dispatch in Sandbox mode
  if (config.isSandbox) {
    return {
      ok: false,
      overallStatus: 'FAILED',
      acceptedAll: false,
      acceptedCount: 0,
      totalContacts: guardians.length,
      code: 'SANDBOX_MODE_RESTRICTION',
      error: 'Twilio WhatsApp is operating in Sandbox mode. The Sandbox does not support custom emergency templates and cannot dispatch SAHAARA SOS alerts. Live SOS dispatch requires a production Twilio WhatsApp sender (TWILIO_WHATSAPP_MODE=production) with an approved Meta emergency template.',
      results: guardians.map((g) => ({
        name: g.name || 'Guardian',
        phone: g.phone && g.phone.length >= 4 ? '...' + g.phone.slice(-4) : '****',
        rawPhone: g.phone,
        accepted: false,
        status: STATUS.FAILED,
        messageSid: null,
        code: 'SANDBOX_MODE_RESTRICTION',
        error: 'Blocked: Twilio Sandbox cannot dispatch custom emergency templates',
      })),
      deliveryCallbacksEnabled: false,
      statusCallbackUrl: null,
      mode: config.mode,
      provider: 'twilio_whatsapp',
      sosDispatched: false,
    };
  }

  const results = [];
  const sleep = sleepFn || ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));

  for (let i = 0; i < guardians.length; i++) {
    const guardian = guardians[i];
    const maskedPhone = guardian.phone && guardian.phone.length >= 4
      ? `...${guardian.phone.slice(-4)}`
      : '****';

    const sendRes = await sendTwilioWhatsAppMessage({
      toPhone: guardian.phone,
      guardianName: guardian.name,
      contentSid,
      contentVariables,
      configOverrides,
      client,
    });

    // Track accepted messages for status callback reconciliation (durable & memory)
    if (sendRes.accepted && sendRes.messageSid) {
      await trackMessageDurable({
        messageSid: sendRes.messageSid,
        alertId,
        userId,
        phone: guardian.phone,
        guardianName: guardian.name,
        initialStatus: sendRes.status,
        firestoreDb,
      });
    }

    results.push({
      name: guardian.name || 'Guardian',
      phone: maskedPhone,
      rawPhone: guardian.phone,
      accepted: sendRes.accepted,
      status: sendRes.status, // QUEUED | SENDING | SENT | FAILED
      messageSid: sendRes.messageSid,
      error: sendRes.error,
      code: sendRes.code,
    });

    // Enforce rate limit between outbound requests (>= 3s in Sandbox mode)
    if (i < guardians.length - 1) {
      if (config.isSandbox) {
        await sleep(3000);
      } else {
        await sleep(500);
      }
    }
  }

  const acceptedCount = results.filter((r) => r.accepted).length;
  let overallStatus = 'FAILED';
  if (acceptedCount === guardians.length && guardians.length > 0) {
    overallStatus = 'ACCEPTED_ALL';
  } else if (acceptedCount > 0) {
    overallStatus = 'PARTIALLY_ACCEPTED';
  } else {
    overallStatus = 'FAILED';
  }

  const deliveryCallbacksEnabled = Boolean(
    config.statusCallbackUrl && config.statusCallbackUrl.startsWith('https://')
  );

  return {
    ok: acceptedCount > 0,
    overallStatus, // 'ACCEPTED_ALL' | 'PARTIALLY_ACCEPTED' | 'FAILED'
    acceptedAll: acceptedCount === guardians.length && guardians.length > 0,
    acceptedCount,
    totalContacts: guardians.length,
    results,
    deliveryCallbacksEnabled,
    statusCallbackUrl: deliveryCallbacksEnabled ? config.statusCallbackUrl : null,
    mode: config.mode,
    provider: 'twilio_whatsapp',
  };
}

/**
 * Validates Twilio webhook signature using official Twilio SDK and Auth Token.
 * Correctly accounts for reverse proxies (X-Forwarded-Proto, X-Forwarded-Host).
 */
function validateTwilioWebhookSignature(req, webhookUrl = null, authToken = null) {
  const token = authToken || process.env.TWILIO_AUTH_TOKEN;
  if (!token) return false;

  const twilioSignature = req.headers['x-twilio-signature'] || '';
  if (!twilioSignature) return false;

  let url = webhookUrl;
  if (!url || !url.startsWith('http')) {
    const proto = req.headers['x-forwarded-proto'] || req.protocol || 'http';
    const host = req.headers['x-forwarded-host'] || req.get('host');
    url = `${proto}://${host}${req.originalUrl}`;
  }

  try {
    return twilio.validateRequest(token, twilioSignature, url, req.body);
  } catch (err) {
    return false;
  }
}

/**
 * Processes an incoming Twilio status callback event.
 * 
 * Rules:
 * - Durable persistence: reads from and writes to Firestore 'twilio_dispatches' collection.
 * - Survives backend restarts and multi-instance environments.
 * - Handles race condition where callback arrives before send workflow completes.
 * - Idempotent: acknowledges duplicate callbacks safely without duplicating updates.
 * - Monotonic progression: never overwrites later statuses (DELIVERED, READ) with older callbacks (SENT, QUEUED).
 * - Accurately updates guardian status and aggregate SOS delivery status in Firestore sos_alerts.
 * - Never marks queued, sending, or sent as delivered.
 */
async function processStatusCallback({
  messageSid,
  messageStatus,
  eventType = null,
  errorCode = null,
  errorMessage = null,
  to = null,
  firestoreDb = null,
}) {
  if (!messageSid) {
    return { success: false, reason: 'MISSING_MESSAGE_SID' };
  }

  const db = firestoreDb || getFirestore();

  const incomingStatus = (eventType === 'READ' || messageStatus === 'read')
    ? STATUS.READ
    : mapTwilioStatus(messageStatus, eventType);

  // 1. Retrieve dispatch record: check Firestore first (authoritative), fallback to memory
  let dispatchRecord = null;
  let dispatchDocRef = null;

  if (db) {
    try {
      dispatchDocRef = db.collection('twilio_dispatches').doc(messageSid);
      const snap = await dispatchDocRef.get();
      if (snap && snap.exists) {
        dispatchRecord = snap.data();
      }
    } catch (err) {
      console.warn('[Twilio Callback] Firestore read warning:', err.message);
    }
  }

  if (!dispatchRecord) {
    dispatchRecord = messageTracker.get(messageSid) || null;
  }

  // Handle EARLY CALLBACK arriving before send workflow created the dispatch doc
  if (!dispatchRecord) {
    const earlyRecord = {
      messageSid,
      alertId: null,
      userId: null,
      phone: to ? normalizePhoneNumber(to) : null,
      status: incomingStatus,
      pendingEarlyCallback: true,
      history: [
        {
          status: incomingStatus,
          rawStatus: messageStatus,
          eventType: eventType || null,
          errorCode: errorCode || null,
          timestamp: new Date().toISOString(),
        },
      ],
      errorCode: errorCode || null,
      errorMessage: errorMessage || null,
      lastUpdated: new Date().toISOString(),
    };

    messageTracker.set(messageSid, earlyRecord);

    if (db && dispatchDocRef) {
      try {
        await dispatchDocRef.set(earlyRecord);
      } catch (err) {
        console.warn('[Twilio Callback] Early record write warning:', err.message);
      }
    }

    return {
      success: true,
      messageSid,
      newStatus: incomingStatus,
      pendingEarlyCallback: true,
    };
  }

  const currentStatus = dispatchRecord.status || STATUS.UNKNOWN;
  const currentRank = STATUS_RANK[currentStatus] || 0;
  const incomingRank = STATUS_RANK[incomingStatus] || 0;

  // 2. Duplicate event check (idempotency)
  if (currentStatus === incomingStatus && currentStatus !== STATUS.UNKNOWN) {
    return {
      success: true,
      duplicate: true,
      messageSid,
      status: currentStatus,
      message: 'Duplicate status callback acknowledged safely',
    };
  }

  // 3. Monotonic progression rule: do not overwrite a later status with an older callback
  const isTerminalFailure = incomingStatus === STATUS.FAILED || incomingStatus === STATUS.UNDELIVERED;
  if (!isTerminalFailure && incomingRank < currentRank) {
    return {
      success: true,
      ignored: true,
      messageSid,
      currentStatus,
      incomingStatus,
      message: `Ignored older status callback (${incomingStatus}) because current status is already ${currentStatus}`,
    };
  }

  // 4. Update memory cache
  const updatedHistory = [
    ...(dispatchRecord.history || []),
    {
      status: incomingStatus,
      rawStatus: messageStatus,
      eventType: eventType || null,
      errorCode: errorCode || null,
      timestamp: new Date().toISOString(),
    },
  ];

  const updatedRecord = {
    ...dispatchRecord,
    status: incomingStatus,
    history: updatedHistory,
    errorCode: errorCode || dispatchRecord.errorCode || null,
    errorMessage: errorMessage || dispatchRecord.errorMessage || null,
    lastUpdated: Date.now(),
  };
  messageTracker.set(messageSid, updatedRecord);

  // 5. Update Firestore dispatch doc
  if (db && dispatchDocRef) {
    try {
      await dispatchDocRef.update({
        status: incomingStatus,
        history: updatedHistory,
        errorCode: errorCode || dispatchRecord.errorCode || null,
        errorMessage: errorMessage || dispatchRecord.errorMessage || null,
        lastUpdated: new Date().toISOString(),
      });
    } catch (err) {
      console.warn('[Twilio Callback] Firestore dispatch doc update notice:', err.message);
    }
  }

  // 6. Update SOS alert doc in Firestore if alertId is known
  const alertId = dispatchRecord.alertId;
  if (alertId && db) {
    await syncGuardianStatusToAlert({
      alertId,
      messageSid,
      phone: dispatchRecord.phone,
      newStatus: incomingStatus,
      errorCode,
      errorMessage,
      firestoreDb: db,
    });
  }

  return {
    success: true,
    messageSid,
    previousStatus: currentStatus,
    newStatus: incomingStatus,
    errorCode: errorCode || null,
  };
}


/**
 * Verifies Twilio API connectivity without dispatching an emergency alert.
 * Clearly separates connectivity testing from actual SOS dispatch and delivery.
 */
async function verifyTwilioConnectivity({ configOverrides = {}, client = null } = {}) {
  const config = getTwilioConfig(configOverrides);

  if (!config.isConfigured) {
    return {
      ok: false,
      twilioApiConnected: false,
      sosDispatched: false,
      deliveryConfirmed: false,
      mode: config.mode,
      code: 'CONFIG_MISSING',
      error: 'Twilio credentials incomplete in server environment',
    };
  }

  const twilioClient = createTwilioClient(config, client);
  if (!twilioClient) {
    return {
      ok: false,
      twilioApiConnected: false,
      sosDispatched: false,
      deliveryConfirmed: false,
      mode: config.mode,
      code: 'CLIENT_INIT_FAILED',
      error: 'Failed to initialize Twilio client',
    };
  }

  try {
    let accountInfo = null;
    if (twilioClient.api && twilioClient.api.accounts) {
      accountInfo = await twilioClient.api.accounts(config.accountSid).fetch();
    } else if (twilioClient.messages) {
      accountInfo = { status: 'active', friendlyName: 'Mock Account' };
    }

    const isSandbox = config.isSandbox;
    const isApptReminder = isAppointmentReminderContentSid(config.contentSid);

    return {
      ok: true,
      twilioApiConnected: true,
      sosDispatched: false,
      deliveryConfirmed: false,
      accountStatus: accountInfo?.status || 'active',
      mode: config.mode,
      from: config.from,
      contentSidConfigured: Boolean(config.contentSid),
      isAppointmentReminderTemplate: isApptReminder,
      statusCallbackConfigured: Boolean(config.statusCallbackUrl && config.statusCallbackUrl.startsWith('https://')),
      message: isSandbox
        ? 'Twilio API connectivity verified (Sandbox). Note: Sandbox mode cannot dispatch live emergency alerts. A registered production sender with an approved emergency template is required for live SOS delivery.'
        : 'Twilio API connectivity verified in production mode.',
    };
  } catch (err) {
    return {
      ok: false,
      twilioApiConnected: false,
      sosDispatched: false,
      deliveryConfirmed: false,
      mode: config.mode,
      code: err.code || 'TWILIO_AUTH_FAILED',
      error: 'Twilio API authentication failed: ' + err.message,
    };
  }
}

module.exports = {
  STATUS,
  STATUS_RANK,
  APPOINTMENT_REMINDER_SIDS,
  normalizePhoneNumber,
  formatWhatsAppAddress,
  isAppointmentReminderContentSid,
  getTwilioConfig,
  createTwilioClient,
  setGlobalTwilioClient,
  mapTwilioStatus,
  sendTwilioWhatsAppMessage,
  sendSosAlertsToGuardians,
  verifyTwilioConnectivity,
  trackMessage,
  getTrackedMessage,
  clearTrackedMessages,
  validateTwilioWebhookSignature,
  processStatusCallback,
  setGlobalFirestoreDb,
  trackMessageDurable,
  syncGuardianStatusToAlert,
  buildSosContentVariables,
  validateContentVariables,
};
