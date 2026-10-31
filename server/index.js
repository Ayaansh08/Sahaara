const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const multer = require('multer');
const FormData = require('form-data');
const { MsEdgeTTS, OUTPUT_FORMAT } = require('msedge-tts');
require('dotenv').config();

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

// ─── Emergency WhatsApp SOS Endpoint (Meta WhatsApp Business Cloud API) ────
const sosRateLimits = new Map();

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
 * Sends an emergency alert message via Meta WhatsApp Business Cloud API
 * using an approved WhatsApp UTILITY template.
 * Never silently falls back to ordinary text messages.
 * Distinguishes API acceptance from rejection.
 */
async function sendMetaWhatsAppTemplateMessage({ toPhone, templateName, templateLang, templateParams }) {
  if (!WHATSAPP_ACCESS_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
    return {
      accepted: false,
      status: 'CONFIG_ERROR',
      error: 'WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID is not configured in server environment',
    };
  }

  if (!templateName) {
    return {
      accepted: false,
      status: 'TEMPLATE_MISSING',
      error: 'WhatsApp utility template configuration missing: WHATSAPP_TEMPLATE_NAME is required for emergency alerts',
    };
  }

  const endpoint = `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${WHATSAPP_PHONE_NUMBER_ID}/messages`;

  // Build standard Meta Utility Template payload
  // Expected template parameter order:
  // {{1}} = User Name
  // {{2}} = Emergency Alert Message
  // {{3}} = Location / Address
  // {{4}} = Google Maps Link
  // {{5}} = Timestamp
  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: toPhone,
    type: 'template',
    template: {
      name: templateName,
      language: { code: templateLang || 'en_US' },
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: templateParams.name || 'Sahaara Member' },
            { type: 'text', text: templateParams.emergencyMessage || 'Emergency help requested via Sahaara SOS' },
            { type: 'text', text: templateParams.locationText || 'Location unavailable' },
            { type: 'text', text: templateParams.mapsLink || 'No coordinates available' },
            { type: 'text', text: templateParams.timeString || 'Recently' },
          ],
        },
      ],
    },
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  try {
    const metaRes = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const resJson = await metaRes.json().catch(() => null);

    if (metaRes.ok && resJson?.messages?.[0]?.id) {
      return {
        accepted: true,
        status: 'ACCEPTED',
        messageId: resJson.messages[0].id,
        waId: resJson.contacts?.[0]?.wa_id || toPhone,
        httpStatus: metaRes.status,
      };
    } else {
      const errorMsg =
        resJson?.error?.message ||
        `Meta API returned HTTP status ${metaRes.status}`;
      const errorCode = resJson?.error?.code;
      const errorSubcode = resJson?.error?.error_subcode;
      console.warn(`[SOS Meta API] Template delivery rejected for ${toPhone}: ${errorMsg} (code: ${errorCode}, subcode: ${errorSubcode})`);
      
      return {
        accepted: false,
        status: 'REJECTED',
        error: errorMsg,
        code: errorCode,
        errorSubcode: errorSubcode,
        httpStatus: metaRes.status,
      };
    }
  } catch (err) {
    clearTimeout(timeoutId);
    const isTimeout = err.name === 'AbortError';
    console.error(`[SOS Meta API] Network/Timeout error sending to ${toPhone}:`, err.message);
    return {
      accepted: false,
      status: isTimeout ? 'TIMEOUT' : 'NETWORK_ERROR',
      error: isTimeout ? 'Request timed out after 12s' : err.message,
    };
  }
}

app.post('/api/sos', async (req, res) => {
  try {
    const { name = 'Sahaara Member', reason, location, contacts } = req.body;

    const allowedReasons = ['manual', 'test', 'fall', 'fall_ok', 'fall_help', 'fall_noresponse'];
    if (!reason || !allowedReasons.includes(reason)) {
      return res.status(400).json({ ok: false, error: 'Invalid or missing reason' });
    }

    // IP Rate Limiting
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const isUrgent = (reason === 'manual' || reason === 'fall');
    const cooldownMs = isUrgent ? 15000 : 3000;

    const limitRecord = sosRateLimits.get(clientIp) || { lastUrgent: 0, lastQuick: 0 };
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
    sosRateLimits.set(clientIp, limitRecord);

    // 1. Check Meta WhatsApp credentials configuration upfront
    if (!WHATSAPP_ACCESS_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
      console.warn('[SOS] Meta WhatsApp Cloud API credentials missing in server/.env');
      return res.status(503).json({
        ok: false,
        configured: false,
        overallStatus: 'FAILED',
        error: 'Meta WhatsApp Business Cloud API is not configured on the server. Please set WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID in server/.env',
        results: [],
        requiredConfig: {
          WHATSAPP_ACCESS_TOKEN: 'System User or Graph API Access Token with whatsapp_business_messaging permission',
          WHATSAPP_PHONE_NUMBER_ID: 'Phone Number ID from Meta App Dashboard > WhatsApp > API Setup',
          WHATSAPP_API_VERSION: WHATSAPP_API_VERSION,
          WHATSAPP_TEMPLATE_NAME: WHATSAPP_TEMPLATE_NAME,
        },
      });
    }

    // 2. Check WhatsApp Template configuration — never silently fall back to raw text
    const activeTemplateName = WHATSAPP_TEMPLATE_NAME ? WHATSAPP_TEMPLATE_NAME.trim() : '';
    if (!activeTemplateName) {
      console.warn('[SOS] WHATSAPP_TEMPLATE_NAME is missing or empty in server environment');
      return res.status(400).json({
        ok: false,
        configured: false,
        templateMissing: true,
        overallStatus: 'FAILED',
        error: 'WhatsApp utility template configuration missing: WHATSAPP_TEMPLATE_NAME must be set to an approved Meta utility template (e.g. sahaara_emergency_alert) in server/.env.',
        results: [],
      });
    }

    // 3. Validate location (lat between -90 and 90, lng between -180 and 180)
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

    // Build location summary & Google Maps link
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

    // Template emergency message parameter based on trigger reason
    let emergencyMessage = '';
    switch (reason) {
      case 'manual':
        emergencyMessage = 'Pressed the SOS button and needs immediate emergency assistance!';
        break;
      case 'test':
        emergencyMessage = 'System test message — verifying emergency alert connectivity.';
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
    }

    // Target contacts - extract and normalize
    let targetContacts = [];
    if (Array.isArray(contacts) && contacts.length > 0) {
      targetContacts = contacts
        .map(c => ({
          name: c.name || 'Guardian',
          phone: normalizePhoneNumber(c.phone),
          relation: c.relation || '',
        }))
        .filter(c => c.phone && c.phone.length >= 7);
    }

    if (targetContacts.length === 0) {
      console.log(`[SOS] Alert (${reason}) for ${name}: No valid emergency contacts provided.`);
      return res.status(400).json({
        ok: false,
        overallStatus: 'FAILED',
        error: 'No valid emergency contacts configured. Please add emergency contacts with valid phone numbers.',
        results: [],
      });
    }

    console.log(`[SOS Meta API] Sending utility template "${activeTemplateName}" (${WHATSAPP_TEMPLATE_LANG}) to ${targetContacts.length} contact(s) for "${name}".`);

    // Process all contacts individually — failure on one does not block others
    const results = [];
    for (let i = 0; i < targetContacts.length; i++) {
      const contact = targetContacts[i];
      const maskedPhone = contact.phone.length >= 4 ? `...${contact.phone.slice(-4)}` : '****';

      const sendResult = await sendMetaWhatsAppTemplateMessage({
        toPhone: contact.phone,
        templateName: activeTemplateName,
        templateLang: WHATSAPP_TEMPLATE_LANG,
        templateParams: {
          name,
          emergencyMessage,
          locationText: locationSummary,
          mapsLink: mapsUrl,
          timeString: `${istTime} IST`,
        },
      });

      results.push({
        name: contact.name,
        phone: maskedPhone,
        rawPhone: contact.phone,
        accepted: sendResult.accepted,
        status: sendResult.status, // 'ACCEPTED' | 'REJECTED' | 'CONFIG_ERROR' | 'TIMEOUT'
        messageId: sendResult.messageId || null,
        error: sendResult.error || null,
        code: sendResult.code || null,
      });

      // Brief delay between individual requests to respect rate limits
      if (i < targetContacts.length - 1) {
        await new Promise(r => setTimeout(r, 500));
      }
    }

    // Accurate status tracking:
    // - ACCEPTED_ALL when Meta accepts requests for all guardians
    // - PARTIALLY_ACCEPTED when only some requests are accepted
    // - FAILED when none are accepted
    const acceptedCount = results.filter(r => r.accepted).length;
    let overallStatus = 'FAILED';
    if (acceptedCount === targetContacts.length) {
      overallStatus = 'ACCEPTED_ALL';
    } else if (acceptedCount > 0) {
      overallStatus = 'PARTIALLY_ACCEPTED';
    } else {
      overallStatus = 'FAILED';
    }

    const isOverallOk = acceptedCount > 0;

    console.log(`[SOS Meta API] Overall status for "${name}": ${overallStatus} (${acceptedCount}/${targetContacts.length} accepted).`);

    return res.json({
      ok: isOverallOk,
      overallStatus, // 'ACCEPTED_ALL' | 'PARTIALLY_ACCEPTED' | 'FAILED'
      acceptedAll: acceptedCount === targetContacts.length,
      acceptedCount,
      totalContacts: targetContacts.length,
      templateUsed: activeTemplateName,
      templateLang: WHATSAPP_TEMPLATE_LANG,
      results,
      location: validLocation,
      provider: 'meta_cloud_api',
    });
  } catch (error) {
    console.error('[SOS] Error processing /api/sos:', error);
    return res.status(500).json({ ok: false, overallStatus: 'FAILED', error: 'Internal server error: ' + error.message });
  }
});

// Healthcheck
app.get('/health', (req, res) => res.json({
  status: 'ok',
  service: 'Sahaara SAATHI Backend',
  model: GROQ_MODEL,
  apiVersion: WHATSAPP_API_VERSION,
  whatsappConfigured: !!(WHATSAPP_ACCESS_TOKEN && WHATSAPP_PHONE_NUMBER_ID),
  templateConfigured: !!WHATSAPP_TEMPLATE_NAME,
  templateName: WHATSAPP_TEMPLATE_NAME,
}));

const HOST = process.env.HOST || '0.0.0.0';
app.listen(PORT, HOST, (err) => {
  if (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
  console.log('====================================================');
  console.log(`🚀 Sahaara SAATHI Server running on http://${HOST}:${PORT}`);
  console.log(`🤖 Model: ${GROQ_MODEL}`);
  console.log(`📱 WhatsApp Graph API Version: ${WHATSAPP_API_VERSION}`);
  console.log(`📱 WhatsApp Meta Cloud API: ${WHATSAPP_ACCESS_TOKEN && WHATSAPP_PHONE_NUMBER_ID ? 'Configured ✅' : 'Not configured (set WHATSAPP_ACCESS_TOKEN & WHATSAPP_PHONE_NUMBER_ID)'}`);
  console.log(`📋 WhatsApp Utility Template: ${WHATSAPP_TEMPLATE_NAME ? `"${WHATSAPP_TEMPLATE_NAME}" (${WHATSAPP_TEMPLATE_LANG}) ✅` : 'Not set ❌'}`);
  console.log('====================================================');
});
