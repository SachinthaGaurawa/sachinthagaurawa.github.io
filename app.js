// server.js (ESM, Node 18+)
// -------------------------------------------------------
// Providers: Groq (chat), Google Gemini (chat + vision), DeepInfra (chat + LLaVA vision)
// Endpoints:
//   GET  /           -> info
//   GET  /health     -> { ok: true }
//   POST /api/ai     -> { mode: "ask" | "caption", ... }
//   POST /api/ask    -> shim -> /api/ai
//   POST /api/caption-> shim -> /api/ai
// -------------------------------------------------------

import 'dotenv/config';
import express from 'express';
import cors from 'cors';

// Node 18+ has native fetch
const fetcher = (...args) => globalThis.fetch(...args);

const app = express();

/* ---------- CORS ----------
   Set EXACT origins (no trailing slash) in env:
   CORS_ORIGINS=https://sachinthagaurawa.github.io
   If empty, allow all (handy for local dev).
------------------------------------------------------- */
const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map(s => s.trim().replace(/\/+$/, ''))
  .filter(Boolean);

const corsOptions = {
  origin(origin, cb) {
    const o = (origin || '').replace(/\/+$/, '');
    if (!origin || ALLOWED_ORIGINS.length === 0 || ALLOWED_ORIGINS.includes(o)) {
      return cb(null, true);
    }
    return cb(new Error(`Not allowed by CORS: ${origin}`));
  },
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json({ limit: '1mb' }));

/* ---------- Keys / Flags ---------- */
const GROQ_API_KEY      = (process.env.GROQ_API_KEY || '').trim();
const GOOGLE_API_KEY    = (process.env.GOOGLE_API_KEY || '').trim();   // Gemini
const DEEPINFRA_API_KEY = (process.env.DEEPINFRA_API_KEY || '').trim();

const HAS_GROQ      = !!GROQ_API_KEY;
const HAS_GEMINI    = !!GOOGLE_API_KEY;
const HAS_DEEPINFRA = !!DEEPINFRA_API_KEY;

console.log('[boot] CORS_ORIGINS   :', ALLOWED_ORIGINS.length ? ALLOWED_ORIGINS.join(', ') : '(all allowed)');
console.log('[boot] Groq key       :', HAS_GROQ      ? '✅ present' : '— none');
console.log('[boot] Google (Gemini):', HAS_GEMINI    ? '✅ present' : '— none');
console.log('[boot] DeepInfra key  :', HAS_DEEPINFRA ? '✅ present' : '— none');

/* ---------- Helpers ---------- */
function withTimeout(ms = 30000) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms);
  return { signal: ac.signal, done: () => clearTimeout(t) };
}

async function toJSON(r) {
  const txt = await r.text();
  try { return JSON.parse(txt); } catch { return { raw: txt }; }
}

function guessMimeFromUrl(url) {
  const u = url.split('?')[0].toLowerCase();
  if (u.endsWith('.png')) return 'image/png';
  if (u.endsWith('.webp')) return 'image/webp';
  if (u.endsWith('.gif')) return 'image/gif';
  return 'image/jpeg';
}

async function fetchImageAsDataUrl(imageUrl) {
  // Download remote image → base64 data URL for Gemini or fallback payloads
  const { signal, done } = withTimeout(20000);
  try {
    const r = await fetcher(imageUrl, { signal });
    if (!r.ok) throw new Error(`Image HTTP ${r.status}`);
    const buf = await r.arrayBuffer();
    const b64 = Buffer.from(buf).toString('base64');
    const ct = r.headers.get('content-type') || guessMimeFromUrl(imageUrl);
    return `data:${ct};base64,${b64}`;
  } finally { done(); }
}

/* ---------- ASK Providers ---------- */

// Groq (OpenAI-compatible chat)
async function groqAsk({ question, context }) {
  if (!HAS_GROQ) throw new Error('GROQ_API_KEY not configured');
  const { signal, done } = withTimeout(30000);
  try {
    const r = await fetcher('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      signal,
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-70b-versatile',
        temperature: 0.2,
        max_tokens: 400,
        messages: [
          { role: 'system',
            content: 'You are a concise technical assistant for a portfolio site. Answer ONLY using the provided album context. If unknown, say so briefly.' },
          { role: 'user',
            content: `Album context:\n${context}\n\nQuestion: ${question}\nAnswer in 2–6 sentences with concrete details if present.` }
        ],
      }),
    });
    if (!r.ok) throw new Error(`Groq HTTP ${r.status}: ${JSON.stringify(await toJSON(r))}`);
    const j = await r.json();
    return j?.choices?.[0]?.message?.content?.trim() || '';
  } finally { done(); }
}

// Google Gemini (text chat)
async function geminiAsk({ question, context }) {
  if (!HAS_GEMINI) throw new Error('GOOGLE_API_KEY not configured');
  const { signal, done } = withTimeout(30000);
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GOOGLE_API_KEY}`;
    const r = await fetcher(url, {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text:
              'You are a concise technical assistant for a portfolio site. ' +
              'Answer ONLY using the provided album context. If unknown, say so briefly.' },
            { text: `Album context:\n${context}\n\nQuestion: ${question}\nAnswer in 2–6 sentences with concrete details if present.` }
          ]
        }]
      }),
    });
    if (!r.ok) throw new Error(`Gemini HTTP ${r.status}: ${JSON.stringify(await toJSON(r))}`);
    const j = await r.json();
    const text = j?.candidates?.[0]?.content?.parts?.map(p => p.text).join('').trim() || '';
    return text;
  } finally { done(); }
}

// DeepInfra (OpenAI-compatible chat)
async function deepinfraAsk({ question, context }) {
  if (!HAS_DEEPINFRA) throw new Error('DEEPINFRA_API_KEY not configured');
  const { signal, done } = withTimeout(30000);
  try {
    const r = await fetcher('https://api.deepinfra.com/v1/openai/chat/completions', {
      method: 'POST',
      signal,
      headers: {
        Authorization: `Bearer ${DEEPINFRA_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'meta-llama/Meta-Llama-3-70B-Instruct',
        temperature: 0.2,
        max_tokens: 400,
        messages: [
          { role: 'system',
            content: 'You are a concise technical assistant for a portfolio site. Answer ONLY using the provided album context. If unknown, say so briefly.' },
          { role: 'user',
            content: `Album context:\n${context}\n\nQuestion: ${question}\nAnswer in 2–6 sentences with concrete details if present.` }
        ],
      }),
    });
    if (!r.ok) throw new Error(`DeepInfra HTTP ${r.status}: ${JSON.stringify(await toJSON(r))}`);
    const j = await r.json();
    return j?.choices?.[0]?.message?.content?.trim() || '';
  } finally { done(); }
}

/* ---------- CAPTION Providers ---------- */

// Gemini Vision (download image → inline_data base64)
async function geminiCaptionAndTags({ imageUrl }) {
  if (!HAS_GEMINI) throw new Error('GOOGLE_API_KEY not configured');

  const dataUrl = await fetchImageAsDataUrl(imageUrl);
  const [meta, b64] = dataUrl.split(',');
  const mime = meta.slice(5, meta.indexOf(';')); // from data:<mime>;base64

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GOOGLE_API_KEY}`;

  // 1) Caption
  const { signal: s1, done: d1 } = withTimeout(30000);
  const capRes = await fetcher(url, {
    method: 'POST',
    signal: s1,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: 'Describe this image in one concise, neutral sentence. Be specific.' },
          { inline_data: { mime_type: mime, data: b64 } }
        ]
      }]
    }),
  });
  d1();
  if (!capRes.ok) throw new Error(`Gemini vision HTTP ${capRes.status}: ${JSON.stringify(await toJSON(capRes))}`);
  const capJson = await capRes.json();
  const caption = capJson?.candidates?.[0]?.content?.parts?.map(p => p.text).join('').trim() || '';

  // 2) Tags
  const { signal: s2, done: d2 } = withTimeout(20000);
  const tagRes = await fetcher(url, {
    method: 'POST',
    signal: s2,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [{ text: `Caption: ${caption}\nReturn 3–6 comma-separated short tags (nouns/adjectives only).` }]
      }]
    }),
  });
  d2();
  if (!tagRes.ok) throw new Error(`Gemini tags HTTP ${tagRes.status}: ${JSON.stringify(await toJSON(tagRes))}`);
  const tagJson = await tagRes.json();
  const tagLine = tagJson?.candidates?.[0]?.content?.parts?.map(p => p.text).join('').trim() || '';
  const tags = tagLine.split(',').map(s => s.trim()).filter(Boolean).slice(0, 8);

  return { caption, tags };
}

// DeepInfra LLaVA fallback (uses image_url; if provider rejects remote URL, we pass data URL)
async function deepinfraCaptionAndTags({ imageUrl }) {
  if (!HAS_DEEPINFRA) throw new Error('DEEPINFRA_API_KEY not configured');

  const model = 'llava-hf/llava-1.5-7b-hf'; // change if your account prefers a different LLaVA model
  let imageRef = imageUrl;

  // Some deployments need data: URL; prepare it but try real URL first
  let dataUrl = null;
  async function ensureDataUrl() {
    if (!dataUrl) dataUrl = await fetchImageAsDataUrl(imageUrl);
    return dataUrl;
  }

  // 1) Caption
  const { signal: s1, done: d1 } = withTimeout(30000);
  let capRes = await fetcher('https://api.deepinfra.com/v1/openai/chat/completions', {
    method: 'POST',
    signal: s1,
    headers: {
      Authorization: `Bearer ${DEEPINFRA_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: 160,
      messages: [
        { role: 'system', content: 'Describe the image in one concise, neutral sentence.' },
        { role: 'user',
          content: [
            { type: 'text', text: 'Describe this image in one sentence.' },
            { type: 'image_url', image_url: { url: imageRef } }
          ]
        }
      ],
    }),
  });

  // Retry with data URL if first attempt failed
  if (!capRes.ok) {
    imageRef = await ensureDataUrl();
    capRes = await fetcher('https://api.deepinfra.com/v1/openai/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${DEEPINFRA_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        max_tokens: 160,
        messages: [
          { role: 'system', content: 'Describe the image in one concise, neutral sentence.' },
          { role: 'user',
            content: [
              { type: 'text', text: 'Describe this image in one sentence.' },
              { type: 'image_url', image_url: { url: imageRef } }
            ]
          }
        ],
      }),
    });
  }
  d1();
  if (!capRes.ok) throw new Error(`DeepInfra LLaVA caption HTTP ${capRes.status}: ${JSON.stringify(await toJSON(capRes))}`);
  const capJson = await capRes.json();
  const caption = (capJson?.choices?.[0]?.message?.content || '').trim();

  // 2) Tags (text only)
  const { signal: s2, done: d2 } = withTimeout(20000);
  const tagRes = await fetcher('https://api.deepinfra.com/v1/openai/chat/completions', {
    method: 'POST',
    signal: s2,
    headers: {
      Authorization: `Bearer ${DEEPINFRA_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      max_tokens: 60,
      messages: [
        { role: 'system', content: 'Return 3–6 comma-separated tags. Use short, concrete nouns/adjectives only.' },
        { role: 'user', content: `Caption: ${caption}\nReturn only tags.` }
      ],
    }),
  });
  d2();
  if (!tagRes.ok) throw new Error(`DeepInfra LLaVA tags HTTP ${tagRes.status}: ${JSON.stringify(await toJSON(tagRes))}`);
  const tagJson = await tagRes.json();
  const tagLine = (tagJson?.choices?.[0]?.message?.content || '').trim();
  const tags = tagLine.split(',').map(s => s.trim()).filter(Boolean).slice(0, 8);

  return { caption, tags };
}

/* ---------- Root / Health ---------- */
app.get('/', (_req, res) => {
  res.type('text/plain').send(`Album AI backend is up.
Allowed origins: ${ALLOWED_ORIGINS.length ? ALLOWED_ORIGINS.join(', ') : '(all)'}
Providers: ${[
  HAS_GROQ ? 'Groq' : null,
  HAS_GEMINI ? 'Gemini' : null,
  HAS_DEEPINFRA ? 'DeepInfra' : null
].filter(Boolean).join(', ') || '(none)'}
Routes:
  GET  /health
  POST /api/ai        { mode: "ask" | "caption", ... }
  POST /api/ask       (shim)
  POST /api/caption   (shim)
`);
});
app.get('/health', (_req, res) => res.json({ ok: true }));

/* ---------- Caption cache ---------- */
const captionCache = new Map(); // imageUrl -> { t, data }
const CAP_TTL_MS = 60 * 60 * 1000; // 1h

/* ---------- Unified AI Endpoint ---------- */
app.post('/api/ai', async (req, res) => {
  try {
    const { mode, question, context, imageUrl } = req.body || {};

    if (mode === 'ask') {
      if (!question || !context) return res.status(400).json({ error: 'Missing question/context' });
      if (String(question).length > 2000) return res.status(413).json({ error: 'Question too long' });

      // Prefer Groq → Gemini → DeepInfra
      if (HAS_GROQ) {
        try {
          const answer = await groqAsk({ question, context });
          return res.json({ answer, provider: 'groq' });
        } catch (e) { console.warn('[ask] Groq failed:', e.message); }
      }
      if (HAS_GEMINI) {
        try {
          const answer = await geminiAsk({ question, context });
          return res.json({ answer, provider: 'gemini' });
        } catch (e) { console.warn('[ask] Gemini failed:', e.message); }
      }
      if (HAS_DEEPINFRA) {
        try {
          const answer = await deepinfraAsk({ question, context });
          return res.json({ answer, provider: 'deepinfra' });
        } catch (e) { console.warn('[ask] DeepInfra failed:', e.message); }
      }

      return res.status(502).json({ error: 'All providers failed or no API keys configured' });
    }

    if (mode === 'caption') {
      if (!imageUrl) return res.status(400).json({ error: 'Missing imageUrl' });

      // cache
      const hit = captionCache.get(imageUrl);
      if (hit && Date.now() - hit.t < CAP_TTL_MS) {
        return res.json(hit.data);
      }

      // Prefer Gemini Vision → DeepInfra LLaVA
      if (HAS_GEMINI) {
        try {
          const data = await geminiCaptionAndTags({ imageUrl });
          captionCache.set(imageUrl, { t: Date.now(), data });
          return res.json(data);
        } catch (e) { console.warn('[caption] Gemini failed:', e.message); }
      }
      if (HAS_DEEPINFRA) {
        try {
          const data = await deepinfraCaptionAndTags({ imageUrl });
          captionCache.set(imageUrl, { t: Date.now(), data });
          return res.json(data);
        } catch (e) { console.warn('[caption] DeepInfra failed:', e.message); }
      }

      return res.status(502).json({ error: 'No vision provider available' });
    }

    return res.status(400).json({ error: 'Invalid mode. Use "ask" or "caption".' });
  } catch (err) {
    const isAbort = err?.name === 'AbortError';
    console.error('[api/ai] error:', err);
    return res.status(isAbort ? 504 : 500).json({ error: isAbort ? 'Upstream timeout' : 'Server error' });
  }
});

/* ---------- Back-compat shims ---------- */
app.post('/api/ask', (req, res) => { req.body = { ...req.body, mode: 'ask' }; app._router.handle(req, res, () => {}); });
app.post('/api/caption', (req, res) => { req.body = { ...req.body, mode: 'caption' }; app._router.handle(req, res, () => {}); });

/* ---------- Start ---------- */
const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || '0.0.0.0';
app.listen(PORT, HOST, () => {
  console.log(`AI API listening on http://${HOST}:${PORT}`);
});
