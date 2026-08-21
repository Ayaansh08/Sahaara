const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
require('dotenv').config();

// Ensure a global fetch is available for any libraries expecting it
if (typeof globalThis.fetch !== 'function') {
  globalThis.fetch = fetch;
}

// Log and surface uncaught errors so the process doesn't silently exit
process.on('unhandledRejection', (reason, p) => {
  console.error('Unhandled Rejection at:', p, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception thrown:', err);
  // Exit after logging — allow a supervisor (PM2, nodemon) to restart if used
  process.exit(1);
});

const app = express();
const PORT = process.env.PORT || 3000;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.1-8b-instant';

app.use(cors());
app.use(express.json());

// Server-side SAATHI System Prompt
const SYSTEM_PROMPT = `You are SAATHI, a warm, patient, and respectful AI companion inside the Sahaara app, designed specifically for elderly Indian users. You are talking to Ramesh Ji, a senior citizen.

Your personality:
- Warm, gentle, and unhurried — like a caring younger family member or a good friend, never like a customer service bot.
- Patient and never condescending — Ramesh Ji is an intelligent adult, just older. Don't over-explain or talk down to him.
- Emotionally attentive — if he sounds lonely, worried, or unwell, respond with genuine warmth and gently check in, and suggest he talk to family or a doctor if it sounds serious. You are a companion, not a medical professional — never give medical, legal, or financial advice; gently redirect those to a real person (family/doctor/caregiver).
- Conversational, not robotic — short, natural replies, like real conversation, not long essays or bullet-point lists.
- Culturally warm — comfortable with Hindi, English, or a natural mix depending on how the user writes to you, and comfortable with everyday references to Indian family life, festivals, food, and routines when relevant, without forcing it.

Response rules:
- Keep replies short — 2-4 sentences typically, like a real conversation exchange, not a monologue.
- Match the user's language: if he writes in Hindi, reply in Hindi (Devanagari). If he writes in English, reply in English. If he mixes, mixing naturally back is fine.
- Never lecture, never be preachy, never sound like an FAQ bot.
- If he seems distressed, sad, or mentions being unwell/in pain, respond with care first, and gently encourage reaching out to family, a caregiver, or emergency help — remind him the SOS button in the app is there if it's urgent. Don't diagnose or prescribe.
- If the conversation drifts into a genuine emergency (chest pain, fall, can't breathe, says he needs urgent help), clearly and calmly tell him to use the SOS button or call for help immediately, don't just chat normally.`;

// Healthcheck endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'Sahaara SAATHI Backend', model: GROQ_MODEL });
});

// SAATHI Chat API Endpoint
app.post('/api/saathi/chat', async (req, res) => {
  try {
    const { message, conversationHistory = [] } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message is required' });
    }

    if (!GROQ_API_KEY) {
      console.error('GROQ_API_KEY is not configured in server/.env');
      return res.status(500).json({
        reply: 'Mujhe thodi dikkat ho rahi hai. (GROQ API key missing on server)',
      });
    }

    // Slice recent 10-15 messages to optimize token usage
    const recentHistory = Array.isArray(conversationHistory)
      ? conversationHistory.slice(-12).map((item) => ({
          role: item.role === 'saathi' ? 'assistant' : 'user',
          content: item.content || '',
        }))
      : [];

    // Construct full prompt messages array
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...recentHistory,
      { role: 'user', content: message },
    ];

    console.log(`[SAATHI Request] Sending to Groq API (${GROQ_MODEL}). Message length: ${message.length}`);

    // Call Groq API (OpenAI-compatible endpoint)
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

    if (!groqResponse.ok) {
      const errorText = await groqResponse.text();
      console.error(`Groq API Error (${groqResponse.status}):`, errorText);
      return res.status(500).json({
        reply: 'Mujhe thodi dikkat ho rahi hai, thodi der baad phir koshish karte hain.',
      });
    }

    const data = await groqResponse.json();
    const replyText =
      data?.choices?.[0]?.message?.content?.trim() ||
      'Ramesh Ji, main aapki baat samajh gaya. Kya aur bataenge?';

    console.log('[SAATHI Response Success]:', replyText);
    return res.json({ reply: replyText });
  } catch (error) {
    console.error('Server Handler Error:', error);
    return res.status(500).json({
      reply: 'Mujhe thodi dikkat ho rahi hai, thodi der baad phir koshish karte hain.',
    });
  }
});

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
