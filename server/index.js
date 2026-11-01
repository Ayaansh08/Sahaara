const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const multer = require('multer');
const FormData = require('form-data');
const { MsEdgeTTS, OUTPUT_FORMAT } = require('msedge-tts');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

if (typeof globalThis.fetch !== 'function') {
  globalThis.fetch = fetch;
}

process.on('unhandledRejection', (reason, p) => {
  console.error('Unhandled Rejection at:', p, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception thrown:', err);
  process.exit(1);
});

const app = express();
const PORT = process.env.PORT || 3000;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.1-8b-instant';
const WHISPER_MODEL = 'whisper-large-v3';

// Meta WhatsApp Business Cloud API Configuration (Graph API v22.0)
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const WHATSAPP_API_VERSION = process.env.WHATSAPP_API_VERSION || 'v22.0';
const WHATSAPP_TEMPLATE_NAME = process.env.WHATSAPP_TEMPLATE_NAME || 'sahaara_emergency_alert';
const WHATSAPP_TEMPLATE_LANG = process.env.WHATSAPP_TEMPLATE_LANG || 'en_US';

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

const {
  getTwilioConfig,
  sendSosAlertsToGuardians,
  validateTwilioWebhookSignature,
  processStatusCallback,
  isAppointmentReminderContentSid,
  verifyTwilioConnectivity,
  buildSosContentVariables,
  validateContentVariables,
} = require('./services/twilioService');

const {
  getFirestoreDb,
  verifyFirebaseUser,
  getUserEmergencyContacts,
  createInitialSosAlertRecord,
  updateSosAlertRecord,
  recordSosAlert,
} = require('./services/authAndContactsService');

const upload = multer({ storage: multer.memoryStorage() });
const tts = new MsEdgeTTS();

// Helper to decode Firebase JWT practically without admin SDK
function getUserNameFromToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return 'Sahaara Member';
  
  try {
    const token = authHeader.split(' ')[1];
    const payloadBase64 = token.split('.')[1];
    const payloadStr = Buffer.from(payloadBase64, 'base64').toString('utf8');
    const payload = JSON.parse(payloadStr);
    
    // Attempt to extract a friendly name (first name only)
    if (payload.name) return payload.name.trim().split(' ')[0];
    if (payload.email) return payload.email.split('@')[0].split(/[._-]/)[0];
    return 'Sahaara Member';
  } catch (err) {
    return 'Sahaara Member';
  }
}

const TTS_PROVIDER = process.env.TTS_PROVIDER || 'sarvam';
const SARVAM_API_KEY = process.env.SARVAM_API_KEY;
const SARVAM_TTS_SPEAKER = process.env.SARVAM_TTS_SPEAKER || 'priya';

// Helper to generate Edge TTS Base64
async function generateEdgeTTSBase64(text) {
  try {
    await tts.setMetadata('hi-IN-SwaraNeural', OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
    const { audioStream } = tts.toStream(text);
    
    return new Promise((resolve, reject) => {
      const chunks = [];
      audioStream.on('data', chunk => chunks.push(chunk));
      audioStream.on('end', () => resolve('data:audio/mp3;base64,' + Buffer.concat(chunks).toString('base64')));
      audioStream.on('error', reject);
    });
  } catch (err) {
    console.error("Edge-TTS Error:", err);
    return null;
  }
}

// Helper to generate Sarvam AI TTS Base64
async function generateSarvamTTSBase64(text) {
  try {
    const response = await fetch("https://api.sarvam.ai/text-to-speech", {
      method: "POST",
      headers: {
        "api-subscription-key": SARVAM_API_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        inputs: [text],
        language_code: "hi-IN",
        speaker: SARVAM_TTS_SPEAKER,
        pace: parseFloat(process.env.SARVAM_TTS_PACE) || 0.9,
        temperature: parseFloat(process.env.SARVAM_TTS_TEMPERATURE) || 0.7,
        speech_sample_rate: 24000,
        output_audio_codec: "wav",
        enable_preprocessing: true,
        model: "bulbul:v3"
      })
    });
    
    if (!response.ok) {
      console.error(`Sarvam TTS API Error (${response.status}):`, await response.text());
      return null;
    }
    
    const data = await response.json();
    if (data.audios && data.audios.length > 0) {
      return 'data:audio/wav;base64,' + data.audios[0];
    }
    return null;
  } catch (err) {
    console.error("Sarvam TTS Network Error:", err.message);
    return null;
  }
}

async function generateSpeech(text) {
  if (TTS_PROVIDER === 'sarvam') {
    if (!SARVAM_API_KEY) {
      throw new Error("Configuration Error: TTS_PROVIDER is set to sarvam, but SARVAM_API_KEY is missing in server/.env");
    }
    
    const sarvamAudio = await generateSarvamTTSBase64(text);
    if (sarvamAudio) {
      return sarvamAudio;
    }
    
    console.warn("Sarvam TTS failed — attempting Edge-TTS fallback...");
    const edgeAudio = await generateEdgeTTSBase64(text);
    if (edgeAudio) {
      return edgeAudio;
    }
    throw new Error("Both Sarvam AI and Edge-TTS fallback failed to generate audio.");
  }
  
  // Default to edge
  const edgeAudio = await generateEdgeTTSBase64(text);
  if (!edgeAudio) {
    throw new Error("Edge-TTS failed to generate audio.");
  }
  return edgeAudio;
}

const getSystemPrompt = (userName) => `You are Saathi, a warm and caring companion for an elderly Indian user.
You are talking to ${userName}, a senior citizen.

Respond directly to what the user just said.

Do NOT give generic acknowledgements such as:
"Main aapki baat samajh gayi."

Do not repeat the same response across different user messages.

If the user says something simple like:
"नमसत"

respond naturally, for example:
"नमस्ते जी! आप कैसे हैं आज?"

If the user says:
"आज म सड स गर गय"

recognize that this may mean they fell from a staircase/step and respond with appropriate concern, for example:

"अरे, आप गिर गए? पहले बताइए, कहीं चोट तो नहीं लगी? अगर चोट ज्यादा है या चक्कर आ रहे हैं तो तुरंत किसी करीबी को बुलाइए"

Do NOT hardcode these example responses into application logic.
Generate an appropriate response dynamically.

Keep responses to 1-2 short sentences.

The response must be primarily in Hindi using Devanagari script.

NEVER write ordinary Hindi sentences in Romanized Hindi.

WRONG:
"Main aapki baat samajh gayi."

CORRECT:
"मैं आपकी बात समझ गई"

Do not use the generic acknowledgement as the default response.`;

// 1. Greet Endpoint
app.post('/api/saathi/greet', async (req, res) => {
  try {
    const userName = getUserNameFromToken(req);
    
    const hour = new Date().getHours();
    let greeting = 'Namaste';
    if (hour < 12) greeting = 'Shubh prabhat';
    else if (hour < 17) greeting = 'Shubh dopahar';
    else greeting = 'Shubh sandhya';
    
    const replyText = `${greeting} ${userName} Ji. Main Saathi hoon. Boliye, main aapki kaise madad kar sakti hoon?`;
    
    const audioBase64 = await generateSpeech(replyText);
    
    return res.json({
      reply: replyText,
      audioBase64: audioBase64 || ""
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to generate greeting' });
  }
});

// 2. Voice Chat Endpoint
app.post('/api/saathi/voice', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    if (!GROQ_API_KEY) {
      return res.status(500).json({ error: 'GROQ_API_KEY missing' });
    }

    const userName = getUserNameFromToken(req);
    let recentHistory = [];
    try {
      if (req.body.history) {
        const parsedHistory = JSON.parse(req.body.history);
        recentHistory = Array.isArray(parsedHistory) ? parsedHistory : [];
      }
    } catch (e) {
      console.log('Failed to parse history:', e);
    }

    // A. STT (Whisper)
    const form = new FormData();
    form.append('file', req.file.buffer, { filename: 'audio.m4a', contentType: req.file.mimetype || 'audio/m4a' });
    form.append('model', WHISPER_MODEL);
    form.append('language', 'hi');
    form.append('prompt', "नमस्ते, प्रणाम, साथी, जी, अच्छा, ठीक, नहीं, हाँ, दर्द, सिर, पैर, पेट, डॉक्टर, दवा, आराम, परिवार, बेटा, बेटी, घर, खाना, पानी, उदास, अकेला, खुश, थक, नींद, The user may naturally mix Hindi and English words.");
    
    console.log(`[SAATHI Voice] Sending audio to Groq Whisper...`);
    const sttResponse = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        ...form.getHeaders()
      },
      body: form
    });
    
    if (!sttResponse.ok) {
      console.error("Groq STT Error:", await sttResponse.text());
      return res.status(500).json({ error: 'Failed STT' });
    }
    
    const sttData = await sttResponse.json();
    const transcript = (sttData.text || '').trim();
    
    if (!transcript) {
      const reply = "Maaf kijiye, main theek se sun nahi payi. Kya aap phir se bolenge?";
      const audioBase64 = await generateSpeech(reply);
      return res.json({ transcript: "", reply, audioBase64 });
    }
    
    console.log(`[SAATHI Voice] Transcript: ${transcript}`);

    // B. LLM (LLaMA)
    const messages = [
      { role: 'system', content: getSystemPrompt(userName) },
      ...recentHistory.map(item => ({
        role: item.role === 'saathi' ? 'assistant' : 'user',
        content: item.content || ''
      })),
      { role: 'user', content: transcript }
    ];

    const llmResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: messages,
        temperature: 0.7,
        max_tokens: 150,
      }),
    });

    if (!llmResponse.ok) {
      console.error("Groq LLM Error:", await llmResponse.text());
      return res.status(500).json({ error: 'Failed LLM' });
    }

    const llmData = await llmResponse.json();
    const rawContent = llmData?.choices?.[0]?.message?.content;
    const replyText = rawContent?.trim() || "मैं आपकी बात सुन रही हूँ, थोड़ा और बताइए।";
    
    console.log(`[SAATHI LLM] User: ${transcript}`);
    console.log(`[SAATHI LLM] Raw response: ${rawContent}`);
    console.log(`[SAATHI LLM] Final reply: ${replyText}`);

    // C. TTS
    const audioBase64 = await generateSpeech(replyText);

    return res.json({
      transcript: transcript,
      reply: replyText,
      audioBase64: audioBase64 || ""
    });

  } catch (error) {
    console.error('Voice Endpoint Error:', error);
    return res.status(500).json({ error: 'Server error during voice processing' });
  }
});

// Existing Text Chat API Endpoint
app.post('/api/saathi/chat', async (req, res) => {
  try {
    const { message, conversationHistory = [] } = req.body;
    if (!message) return res.status(400).json({ error: 'Message is required' });
    if (!GROQ_API_KEY) return res.status(500).json({ reply: 'API key missing' });

    const userName = getUserNameFromToken(req);

    const recentHistory = Array.isArray(conversationHistory)
      ? conversationHistory.slice(-12).map((item) => ({
          role: item.role === 'saathi' ? 'assistant' : 'user',
          content: item.content || '',
        }))
      : [];

    const messages = [
      { role: 'system', content: getSystemPrompt(userName) },
      ...recentHistory,
      { role: 'user', content: message },
    ];

    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: messages,
        temperature: 0.7,
        max_tokens: 300,
      }),
    });

    if (!groqResponse.ok) return res.status(500).json({ reply: 'Error connecting to LLM' });

    const data = await groqResponse.json();
    const replyText = data?.choices?.[0]?.message?.content?.trim() || "मैं आपकी बात सुन रही हूँ, थोड़ा और बताइए।";
    
    return res.json({ reply: replyText });
  } catch (error) {
    return res.status(500).json({ reply: 'Error occurred' });
  }
});

// Existing Transliterate endpoint
app.post('/api/transliterate', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !GROQ_API_KEY) return res.json({ hindiName: name || "" });
    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ_API_KEY}` },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: 'system', content: 'Transliterate English name to Hindi Devanagari script. ONLY return the name.' },
          { role: 'user', content: name },
        ],
        temperature: 0.1,
        max_tokens: 20,
      }),
    });
    if (!groqResponse.ok) return res.json({ hindiName: name });
    const data = await groqResponse.json();
    return res.json({ hindiName: data?.choices?.[0]?.message?.content?.trim() || name });
  } catch (error) {
    return res.json({ hindiName: req.body.name });
  }
});

// --- Emergency WhatsApp SOS Rate Limiting ------------------------------------
const sosRateLimits = new Map();

// --- Twilio WhatsApp Status Callback Webhook ---------------------------------
/**
 * Receives delivery status updates from Twilio for WhatsApp messages.
 * Requirements:
 * - Validates X-Twilio-Signature using official Twilio SDK and Auth Token
 * - Handles retries, duplicates, and out-of-order events
 * - Recognizes WhatsApp READ receipts (via EventType or MessageStatus === 'read')
 * - Never overwrites a later status with an older callback
 */
app.post('/api/twilio/status-callback', async (req, res) => {
  try {
    const config = getTwilioConfig();

    // Check test bypass: strictly allowed ONLY when NODE_ENV === 'test' AND header is present
    const isTestBypassHeader = req.headers['x-test-signature-bypass'] === 'true';
    if (isTestBypassHeader) {
      if (process.env.NODE_ENV !== 'test') {
        console.warn('[Twilio Webhook] Signature bypass attempt rejected outside test environment from:', req.ip);
        return res.status(403).json({ error: 'Forbidden: Signature bypass is only permitted in test environment' });
      }
      // Allowed strictly in test environment
    } else {
      // 1. Fail Closed: if TWILIO_AUTH_TOKEN is not configured on the server, reject callback
      if (!config.authToken) {
        console.error('[Twilio Webhook] TWILIO_AUTH_TOKEN is not configured on the server. Rejecting callback (fail closed).');
        return res.status(500).json({ error: 'Server misconfiguration: TWILIO_AUTH_TOKEN is missing. Cannot verify webhook signature.' });
      }

      // 2. Reject if X-Twilio-Signature header is missing
      const signature = req.headers['x-twilio-signature'];
      if (!signature) {
        console.warn('[Twilio Webhook] Missing X-Twilio-Signature header from:', req.ip);
        return res.status(403).json({ error: 'Forbidden: Missing X-Twilio-Signature header' });
      }

      // 3. Validate signature
      const isValid = validateTwilioWebhookSignature(req, config.statusCallbackUrl, config.authToken);
      if (!isValid) {
        console.warn('[Twilio Webhook] Invalid X-Twilio-Signature from:', req.ip);
        return res.status(403).json({ error: 'Forbidden: Invalid Twilio signature' });
      }
    }

    const {
      MessageSid,
      SmsSid,
      MessageStatus,
      EventType,
      ErrorCode,
      ErrorMessage,
      To,
    } = req.body;

    const messageSid = MessageSid || SmsSid;
    if (!messageSid) {
      return res.status(400).json({ error: 'MessageSid is required' });
    }

    const firestoreDb = getFirestoreDb();
    const result = await processStatusCallback({
      messageSid,
      messageStatus: MessageStatus,
      eventType: EventType,
      errorCode: ErrorCode,
      errorMessage: ErrorMessage,
      to: To,
      firestoreDb,
    });

    console.log(`[Twilio Webhook] Callback processed for ${messageSid}: status=${MessageStatus}, event=${EventType || 'none'} -> ${result.newStatus || result.status}`);
    return res.status(200).json({ status: 'ok', ...result });
  } catch (err) {
    console.error('[Twilio Webhook] Error processing status callback:', err);
    return res.status(500).json({ error: 'Internal server error processing callback' });
  }
});

// --- Dedicated Twilio Connectivity Verification -------------------------------
/**
 * Verifies Twilio API credentials and connectivity without sending any messages,
 * creating SOS records, or falsely confirming delivery.
 */
app.post('/api/twilio/test-connectivity', async (req, res) => {
  try {
    const user = await verifyFirebaseUser(req);
    if (!user) {
      const status = req.authError?.status || 401;
      const error = req.authError?.error || 'Unauthorized: A valid Firebase ID token is required to test connectivity.';
      const errorCode = req.authError?.errorCode || 'UNAUTHORIZED';
      return res.status(status).json({
        ok: false,
        error,
        errorCode,
      });
    }

    const result = await verifyTwilioConnectivity();
    return res.status(result.ok ? 200 : 503).json(result);
  } catch (err) {
    console.error('Error in test-connectivity:', err);
    return res.status(500).json({ ok: false, error: 'Internal server error testing connectivity' });
  }
});

// --- Emergency WhatsApp SOS Endpoint (Twilio WhatsApp) -----------------------
/**
 * Triggers an SOS emergency alert via Twilio WhatsApp.
 * 
 * Strict Guarantees:
 * 1. Authentication: Rejects unauthorized requests; derives user identity strictly
 *    from verified Firebase ID token.
 * 2. Emergency Contacts: Retrieves user's registered contacts from Firestore;
 *    never accepts arbitrary recipient numbers from the client body.
 * 3. Location: Continues even if location capture fails.
 * 4. Sandbox Restrictions:
 *    - Strictly blocks default Appointment Reminder Content SID (HXfe5ab5f00277942d4d4200328b4d403c).
 *    - Sequential sending with >= 3-second delay in Sandbox mode.
 *    - Handles error 63015 for unjoined Sandbox recipients.
 * 5. Status Tracking: Initial status is QUEUED/SENDING/SENT (never DELIVERED on creation).
 * 6. Alert Logging: Records alert in Firestore and associates message SIDs for webhook reconciliation.
 */
app.post('/api/sos', async (req, res) => {
  try {
    const { reason = 'manual', location } = req.body;

    // 'test' is strictly removed; connectivity tests must use POST /api/twilio/test-connectivity
    const allowedReasons = ['manual', 'fall', 'fall_ok', 'fall_help', 'fall_noresponse', 'vitals_critical'];
    if (!reason || !allowedReasons.includes(reason)) {
      return res.status(400).json({ ok: false, error: 'Invalid or missing reason' });
    }

    // 1. Verify authenticated user identity from Firebase ID token
    const user = await verifyFirebaseUser(req);
    if (!user) {
      const status = req.authError?.status || 401;
      const error = req.authError?.error || 'Unauthorized: A valid Firebase ID token is required to trigger SOS alerts.';
      const errorCode = req.authError?.errorCode || 'UNAUTHORIZED';
      return res.status(status).json({
        ok: false,
        error,
        errorCode,
      });
    }

    // 2. Debounce and Rate Limiting by User UID
    const now = Date.now();
    const isUrgent = (reason === 'manual' || reason === 'fall' || reason === 'vitals_critical');
    const cooldownMs = isUrgent ? 15000 : 3000;

    const limitKey = user.uid;
    const limitRecord = sosRateLimits.get(limitKey) || { lastUrgent: 0, lastQuick: 0 };
    const lastTimestamp = isUrgent ? limitRecord.lastUrgent : limitRecord.lastQuick;

    if (now - lastTimestamp < cooldownMs) {
      const waitSec = Math.ceil((cooldownMs - (now - lastTimestamp)) / 1000);
      return res.status(429).json({
        ok: false,
        error: `Rate limit exceeded. Please wait ${waitSec} seconds before sending another alert.`,
      });
    }

    if (isUrgent) {
      limitRecord.lastUrgent = now;
    } else {
      limitRecord.lastQuick = now;
    }
    sosRateLimits.set(limitKey, limitRecord);

    // 3. Check Twilio configuration upfront
    const twilioConfig = getTwilioConfig();
    if (!twilioConfig.isConfigured) {
      console.warn('[SOS] Twilio credentials missing in server/.env');
      return res.status(503).json({
        ok: false,
        configured: false,
        overallStatus: 'FAILED',
        error: 'Twilio WhatsApp is not configured on the server. Please set TWILIO_ACCOUNT_SID, TWILIO_API_KEY, TWILIO_API_SECRET, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM in server/.env',
        results: [],
      });
    }

    // 4. Validate location (lat between -90 and 90, lng between -180 and 180)
    let validLocation = null;
    if (
      location &&
      typeof location.lat === 'number' &&
      !isNaN(location.lat) &&
      location.lat >= -90 &&
      location.lat <= 90 &&
      typeof location.lng === 'number' &&
      !isNaN(location.lng) &&
      location.lng >= -180 &&
      location.lng <= 180
    ) {
      validLocation = {
        lat: location.lat,
        lng: location.lng,
        accuracy: typeof location.accuracy === 'number' ? location.accuracy : null,
        address: location.address ? String(location.address).trim() : null,
        ageSec: typeof location.ageSec === 'number' ? location.ageSec : null,
      };
    }

    // 5. Retrieve user's emergency contacts from Firestore (never accept arbitrary numbers or test overrides from body)
    const contacts = await getUserEmergencyContacts(user.uid, user.token);
    if (!Array.isArray(contacts) || contacts.length === 0) {
      console.log(`[SOS] Alert (${reason}) for ${user.name} (${user.uid}): No emergency contacts found in Firestore.`);
      return res.status(400).json({
        ok: false,
        overallStatus: 'FAILED',
        error: 'No valid emergency contacts configured. Please add emergency contacts in the Sahaara app.',
        results: [],
      });
    }

    // 6. In Sandbox mode: block actual SOS alerts upfront
    // Arbitrary Content SIDs cannot bypass this restriction
    if (twilioConfig.isSandbox) {
      console.warn('[SOS] Refusing live SOS dispatch in Sandbox mode for ' + user.name + ' (' + user.uid + ').');
      
      const firestoreDb = getFirestoreDb();
      const alertId = await recordSosAlert({
        userId: user.uid,
        userEmail: user.email,
        userName: user.name,
        location: validLocation,
        status: 'FAILED',
        overallStatus: 'FAILED',
        results: [],
        contacts,
        reason,
        provider: 'twilio_whatsapp',
        token: user.token,
        firestoreDb,
      });

      return res.status(400).json({
        ok: false,
        overallStatus: 'FAILED',
        code: 'SANDBOX_MODE_RESTRICTION',
        error: 'Twilio WhatsApp is operating in Sandbox mode. The Sandbox does not support custom emergency templates and cannot dispatch SAHAARA SOS alerts. Live SOS dispatch requires a production Twilio WhatsApp sender (TWILIO_WHATSAPP_MODE=production) with an approved Meta emergency template.',
        mode: 'sandbox',
        sosDispatched: false,
        results: [],
        location: validLocation,
        alertId,
        provider: 'twilio_whatsapp',
      });
    }

    // 7. Strict Server Control: Content SID is determined exclusively by server configuration.
    // Client-supplied contentSid or contentVariables in req.body are strictly ignored.
    const serverContentSid = (twilioConfig.contentSid || '').trim();
    if (!serverContentSid) {
      console.warn('[SOS] TWILIO_WHATSAPP_CONTENT_SID is missing in server environment');
      return res.status(503).json({
        ok: false,
        configured: false,
        overallStatus: 'FAILED',
        error: 'TWILIO_WHATSAPP_CONTENT_SID is missing in server configuration. Twilio WhatsApp requires an approved Content SID.',
        results: [],
      });
    }

    // RESTRICTION: Block Appointment Reminder Content SID from SAHAARA SOS
    if (isAppointmentReminderContentSid(serverContentSid)) {
      console.warn(`[SOS] Refusing to send Appointment Reminder template (${serverContentSid}) for SOS alert.`);
      return res.status(400).json({
        ok: false,
        configured: false,
        overallStatus: 'FAILED',
        code: 'APPOINTMENT_REMINDER_BLOCKED',
        error: `Configured Content SID (${serverContentSid}) is an Appointment Reminder template ("Reminder: Appt Tue Oct 29..."). It cannot represent a SAHAARA SOS emergency notification. Twilio Sandbox does not support custom emergency templates; an approved production SOS Content SID is required.`,
        results: [],
      });
    }

    // Current time in IST
    const istTime = new Date().toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

    let mapsUrl = 'No coordinates available';
    let locationSummary = 'Location unavailable (GPS off or weak signal)';

    if (validLocation) {
      const latStr = validLocation.lat.toFixed(6);
      const lngStr = validLocation.lng.toFixed(6);
      mapsUrl = `https://www.google.com/maps/search/?api=1&query=${latStr},${lngStr}`;
      locationSummary = validLocation.address
        ? `${validLocation.address} (${latStr}, ${lngStr})`
        : `Coordinates: ${latStr}, ${lngStr}`;
    }

    // Generate emergency message based on reason
    let emergencyMessage = '';
    switch (reason) {
      case 'manual':
        emergencyMessage = 'Pressed the SOS button and needs immediate emergency assistance!';
        break;
      case 'fall':
        emergencyMessage = 'Possible fall detected! Please call or check on them immediately.';
        break;
      case 'fall_ok':
        emergencyMessage = 'Update: Senior confirmed they are okay after fall check.';
        break;
      case 'fall_help':
        emergencyMessage = 'Senior indicated they need help after a fall! Please call now.';
        break;
      case 'fall_noresponse':
        emergencyMessage = 'No response after a fall alert! Please call or check on them immediately.';
        break;
      case 'vitals_critical':
        emergencyMessage = 'Critical health vitals alert detected from smartwatch! Please call or check on them immediately.';
        break;
    }

    // Construct server-controlled ContentVariables
    const contentVariables = buildSosContentVariables({
      userName: user.name,
      emergencyMessage,
      locationSummary,
      mapsLink: mapsUrl,
      timeString: `${istTime} IST`,
    });

    console.log(`[SOS Twilio] Processing SOS alert (${reason}) for ${user.name} (${user.uid}) to ${contacts.length} guardian(s) [Mode: ${twilioConfig.mode}].`);

    const firestoreDb = getFirestoreDb();

    // 8. Pre-create SOS record in Firestore before sending to get durable alertId
    const alertId = await createInitialSosAlertRecord({
      userId: user.uid,
      userEmail: user.email,
      userName: user.name,
      location: validLocation,
      reason,
      contacts,
      provider: 'twilio_whatsapp',
      token: user.token,
      firestoreDb,
    });

    // 9. Send alerts sequentially to guardians
    const sendResult = await sendSosAlertsToGuardians({
      guardians: contacts,
      userName: user.name,
      emergencyMessage,
      locationSummary,
      mapsLink: mapsUrl,
      timeString: `${istTime} IST`,
      contentSid: serverContentSid,
      contentVariables,
      userId: user.uid,
      alertId,
      firestoreDb,
    });

    // 10. Update alert in Firestore with dispatch results
    await updateSosAlertRecord({
      alertId,
      status: sendResult.overallStatus,
      overallStatus: sendResult.overallStatus,
      results: sendResult.results,
      token: user.token,
      firestoreDb,
    });

    return res.json({
      ok: sendResult.ok,
      overallStatus: sendResult.overallStatus, // 'ACCEPTED_ALL' | 'PARTIALLY_ACCEPTED' | 'FAILED'
      acceptedAll: sendResult.acceptedAll,
      acceptedCount: sendResult.acceptedCount,
      totalContacts: sendResult.totalContacts,
      results: sendResult.results,
      location: validLocation,
      alertId,
      provider: 'twilio_whatsapp',
      mode: twilioConfig.mode,
      deliveryCallbacksEnabled: sendResult.deliveryCallbacksEnabled,
      statusCallbackUrl: sendResult.statusCallbackUrl,
    });
  } catch (error) {
    console.error('[SOS Twilio] Fatal error:', error);
    return res.status(500).json({
      ok: false,
      overallStatus: 'FAILED',
      error: 'Failed to process emergency alert: ' + error.message,
      results: [],
    });
  }
});

// --- Healthcheck Endpoint ---------------------------------------------------
app.get('/health', (req, res) => {
  const twilioCfg = getTwilioConfig();
  res.json({
    status: 'ok',
    service: 'Sahaara SAATHI & SOS Backend',
    model: GROQ_MODEL,
    twilio: {
      configured: twilioCfg.isConfigured,
      mode: twilioCfg.mode,
      from: twilioCfg.from,
      contentSidConfigured: Boolean(twilioCfg.contentSid),
      isAppointmentReminder: isAppointmentReminderContentSid(twilioCfg.contentSid),
      callbacksEnabled: Boolean(twilioCfg.statusCallbackUrl && twilioCfg.statusCallbackUrl.startsWith('https://')),
      statusCallbackUrl: twilioCfg.statusCallbackUrl || null,
    },
  });
});

const HOST = process.env.HOST || '0.0.0.0';

if (require.main === module) {
  app.listen(PORT, HOST, (err) => {
    if (err) {
      console.error('Failed to start server:', err);
      process.exit(1);
    }
    const twilioCfg = getTwilioConfig();
    console.log('====================================================');
    console.log(`?? Sahaara Server running on http://${HOST}:${PORT}`);
    console.log(`?? Model: ${GROQ_MODEL}`);
    console.log(`?? Twilio WhatsApp: ${twilioCfg.isConfigured ? 'Configured ?' : 'Incomplete ??'}`);
    console.log(`??? Mode: ${twilioCfg.mode.toUpperCase()}`);
    console.log(`?? From: ${twilioCfg.from}`);
    console.log(`?? Content SID: ${twilioCfg.contentSid || 'None'}`);
    if (isAppointmentReminderContentSid(twilioCfg.contentSid)) {
      console.log(`?? Content SID is Twilio Sandbox Appointment Reminder (Blocked for SOS alerts)`);
    }
    console.log(`?? Callbacks: ${twilioCfg.statusCallbackUrl ? twilioCfg.statusCallbackUrl : 'Disabled (set TWILIO_STATUS_CALLBACK_URL)'}`);
    console.log('====================================================');
  });
}

module.exports = app;
