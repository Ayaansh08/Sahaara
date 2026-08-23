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

// 1. New Greet Endpoint
app.post('/api/saathi/greet', async (req, res) => {
  try {
    const userName = getUserNameFromToken(req);
    
    // We could call the LLM here, but for latency, a dynamic scripted greeting is much faster.
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

// 2. New Voice Chat Endpoint
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
      // Empty transcript fallback
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
    
    // Temporarily add safe server-side logging of the LLM result
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

// Healthcheck
app.get('/health', (req, res) => res.json({ status: 'ok', service: 'Sahaara SAATHI Backend', model: GROQ_MODEL }));

const HOST = process.env.HOST || '0.0.0.0';
app.listen(PORT, HOST, (err) => {
  if (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
  console.log('====================================================');
  console.log(`🚀 Sahaara SAATHI Server running on http://${HOST}:${PORT}`);
  console.log(`🤖 Model: ${GROQ_MODEL}`);
  console.log('====================================================');
});
