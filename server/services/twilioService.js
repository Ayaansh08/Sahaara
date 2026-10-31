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

/**
 * In-memory registry for tracking outbound Twilio Message SIDs and their delivery status.
 * Maps messageSid -> { alertId, userId, phone, status, history, errorCode, errorMessage, lastUpdated }
 */
const messageTracker = new Map();

function trackMessage({ messageSid, alertId = null, userId = null, phone = null, initialStatus = STATUS.QUEUED }) {
  if (!messageSid) return;
  messageTracker.set(messageSid, {
    alertId,
    userId,
    phone,
    status: initialStatus,
    errorCode: null,
    errorMessage: null,
    history: [{ status: initialStatus, timestamp: new Date().toISOString() }],
    lastUpdated: Date.now(),
  });
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

  // 4. 🚨 SANDBOX RESTRICTION: In Sandbox mode, actual SOS alerts cannot be dispatched
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

    // Track accepted messages for status callback reconciliation
    if (sendRes.accepted && sendRes.messageSid) {
      trackMessage({
        messageSid: sendRes.messageSid,
        alertId,
        userId,
        phone: guardian.phone,
        initialStatus: sendRes.status,
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
 */
function validateTwilioWebhookSignature(req, webhookUrl = null, authToken = null) {
  const token = authToken || process.env.TWILIO_AUTH_TOKEN;
  if (!token) return false;

  const twilioSignature = req.headers['x-twilio-signature'] || '';
  if (!twilioSignature) return false;

  const url = webhookUrl || (req.protocol + '://' + req.get('host') + req.originalUrl);
  return twilio.validateRequest(token, twilioSignature, url, req.body);
}

/**
 * Processes an incoming Twilio status callback event.
 * 
 * Rules:
 * - Safely handles retries and duplicate events.
 * - Handles WhatsApp READ events (via EventType === 'READ' or MessageStatus === 'read').
 * - Monotonic status progression: never overwrites later statuses (DELIVERED, READ)
 *   with older callbacks (SENT, QUEUED).
 * - Updates in-memory tracker and Firestore record if available.
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

  const incomingStatus = (eventType === 'READ' || messageStatus === 'read')
    ? STATUS.READ
    : mapTwilioStatus(messageStatus, eventType);

  const existing = messageTracker.get(messageSid) || {
    status: STATUS.UNKNOWN,
    history: [],
  };

  const currentRank = STATUS_RANK[existing.status] || 0;
  const incomingRank = STATUS_RANK[incomingStatus] || 0;

  // 1. Idempotency check: duplicate event with identical status
  if (existing.status === incomingStatus && existing.status !== STATUS.UNKNOWN) {
    return {
      success: true,
      duplicate: true,
      messageSid,
      status: existing.status,
      message: 'Duplicate status callback acknowledged safely',
    };
  }

  // 2. Monotonic progression rule: do not overwrite a later status with an older callback
  const isTerminalFailure = incomingStatus === STATUS.FAILED || incomingStatus === STATUS.UNDELIVERED;
  if (!isTerminalFailure && incomingRank < currentRank) {
    return {
      success: true,
      ignored: true,
      messageSid,
      currentStatus: existing.status,
      incomingStatus,
      message: `Ignored older status callback (${incomingStatus}) because current status is already ${existing.status}`,
    };
  }

  // 3. Update in-memory tracker
  const updatedRecord = {
    ...existing,
    status: incomingStatus,
    errorCode: errorCode || existing.errorCode || null,
    errorMessage: errorMessage || existing.errorMessage || null,
    history: [
      ...existing.history,
      {
        status: incomingStatus,
        rawStatus: messageStatus,
        eventType: eventType || null,
        errorCode: errorCode || null,
        timestamp: new Date().toISOString(),
      },
    ],
    lastUpdated: Date.now(),
  };
  messageTracker.set(messageSid, updatedRecord);

  // 4. Update Firestore if alertId is known and firestoreDb is supplied
  if (existing.alertId && firestoreDb) {
    try {
      const alertRef = firestoreDb.collection('sos_alerts').doc(existing.alertId);
      const alertDoc = await alertRef.get();
      if (alertDoc.exists) {
        const data = alertDoc.data();
        const guardianResults = (data.guardianResults || []).map((gr) => {
          if (gr.messageSid === messageSid || gr.rawPhone === existing.phone) {
            return {
              ...gr,
              status: incomingStatus,
              delivered: incomingStatus === STATUS.DELIVERED || incomingStatus === STATUS.READ,
              read: incomingStatus === STATUS.READ,
              errorCode: errorCode || gr.errorCode || null,
              errorMessage: errorMessage || gr.errorMessage || null,
            };
          }
          return gr;
        });

        const anyDelivered = guardianResults.some(
          (g) => g.status === STATUS.DELIVERED || g.status === STATUS.READ
        );
        const allDelivered =
          guardianResults.length > 0 &&
          guardianResults.every((g) => g.status === STATUS.DELIVERED || g.status === STATUS.READ);

        let overallDeliveryStatus = data.overallStatus;
        if (allDelivered) overallDeliveryStatus = 'DELIVERED_ALL';
        else if (anyDelivered) overallDeliveryStatus = 'PARTIALLY_DELIVERED';

        await alertRef.update({
          guardianResults,
          deliveryStatus: overallDeliveryStatus,
          lastCallbackAt: new Date(),
        });
      }
    } catch (dbErr) {
      console.warn('[Twilio Callback] Firestore update warning:', dbErr.message);
    }
  }

  return {
    success: true,
    messageSid,
    previousStatus: existing.status,
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
};
