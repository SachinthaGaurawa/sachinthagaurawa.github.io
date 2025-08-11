import 'dotenv/config';
import express from 'express';
import cors from 'cors';

const fetcher = (...args) => globalThis.fetch(...args);
const app = express();

const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map(s => s.trim().replace(/\/+$/, ''))
  .filter(Boolean);

const corsOptions = {
  origin(origin, cb) {
    const o = (origin || '').replace(/\/+$/, '');
    if (!origin || ALLOWED_ORIGINS.length === 0 || ALLOWED_ORIGINS.includes(o)) return cb(null, true);
    return cb(new Error(`Not allowed by CORS: ${origin}`));
  },
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json({ limit: '1mb' }));

const PPLX_API_KEY   = (process.env.PPLX_API_KEY || '').trim();
const OPENAI_API_KEY = (process.env.OPENAI_API_KEY || '').trim();

function withTimeout(ms = 30000) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms);
  return { signal: ac.signal, done: () => clearTimeout(t) };
}
async function toJSON(r) { const txt = await r.text(); try { return JSON.parse(txt); } catch { return { raw: txt }; } }

async function perplexityAsk({ question, context }) {
  const { signal, done } = withTimeout(30000);
  try {
    const r = await fetcher('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      signal,
      headers: { Authorization: `Bearer ${PPLX_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'sonar',
        temperature: 0.2,
        max_tokens: 400,
        messages: [
          { role: 'system', content: 'You are a concise technical assistant for a portfolio site. Answer ONLY using the provided album context. If unknown, say so briefly.' },
          { role: 'user', content: `Album context:\n${context}\n\nQuestion: ${question}\nAnswer in 2–6 sentences with concrete details if present.` }
        ]
      })
    });
    if (!r.ok) throw new Error(`Perplexity HTTP ${r.status}: ${JSON.stringify(await toJSON(r))}`);
    const j = await r.json();
    return j?.choices?.[0]?.message?.content?.trim() || '';
  } finally { done(); }
}

async function openaiAsk({ question, context }) {
  const { signal, done } = withTimeout(30000);
  try {
    const r = await fetcher('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      signal,
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.2,
        max_tokens: 400,
        messages: [
          { role: 'system', content: 'You are a concise technical assistant for a portfolio site. Use only the provided album context.' },
          { role: 'user', content: `Album context:\n${context}\n\nQuestion: ${question}` }
        ]
      })
    });
    if (!r.ok) throw new Error(`OpenAI HTTP ${r.status}: ${JSON.stringify(await toJSON(r))}`);
    const j = await r.json();
    return j?.choices?.[0]?.message?.content?.trim() || '';
  } finally { done(); }
}

async function openaiCaptionAndTags({ imageUrl }) {
  if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not configured');
  const { signal: s1, done: d1 } = withTimeout(30000);
  const capRes = await fetcher('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    signal: s1,
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      max_tokens: 160,
      messages: [
        { role: 'system', content: 'Describe the image in ONE concise sentence. Be specific and neutral.' },
        { role: 'user', content: [{ type: 'text', text: 'Describe this image in one sentence.' }, { type: 'image_url', image_url: { url: imageUrl } }] }
      ]
    })
  });
  d1();
  if (!capRes.ok) throw new Error(`Vision caption HTTP ${capRes.status}: ${JSON.stringify(await toJSON(capRes))}`);
  const capJson = await capRes.json();
  const caption = (capJson?.choices?.[0]?.message?.content || '').trim();

  const { signal: s2, done: d2 } = withTimeout(20000);
  const tagRes = await fetcher('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    signal: s2,
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.1,
      max_tokens: 60,
      messages: [
        { role: 'system', content: 'Return 3–6 comma-separated tags. Use short, concrete nouns/adjectives only.' },
        { role: 'user', content: `Caption: ${caption}\nReturn only tags.` }
      ]
    })
  });
  d2();
  if (!tagRes.ok) throw new Error(`Vision tags HTTP ${tagRes.status}: ${JSON.stringify(await toJSON(tagRes))}`);
  const tagJson = await tagRes.json();
  const tagLine = (tagJson?.choices?.[0]?.message?.content || '').trim();
  const tags = tagLine.split(',').map(s => s.trim()).filter(Boolean).slice(0, 8);
  return { caption, tags };
}

app.get('/', (_req, res) => {
  res.type('text/plain').send(`Album AI backend is up.
Allowed origins: ${ALLOWED_ORIGINS.length ? ALLOWED_ORIGINS.join(', ') : '(all)'}
Routes:
  GET  /health
  POST /api/ai        { mode: "ask" | "caption", ... }
  POST /api/ask
  POST /api/caption
`);
});
app.get('/health', (_req, res) => res.json({ ok: true }));

const captionCache = new Map();
const CAP_TTL_MS = 60 * 60 * 1000;

app.post('/api/ai', async (req, res) => {
  try {
    const { mode, question, context, imageUrl } = req.body || {};
    if (mode === 'ask') {
      if (!question || !context) return res.status(400).json({ error: 'Missing question/context' });
      if (String(question).length > 2000) return res.status(413).json({ error: 'Question too long' });
      if (PPLX_API_KEY) {
        try { return res.json({ answer: await perplexityAsk({ question, context }), provider: 'perplexity' }); }
        catch (e) { console.warn('[ask] Perplexity failed:', e.message); }
      }
      if (OPENAI_API_KEY) {
        try { return res.json({ answer: await openaiAsk({ question, context }), provider: 'openai' }); }
        catch (e) { console.warn('[ask] OpenAI failed:', e.message); }
      }
      return res.status(502).json({ error: 'All providers failed or no API keys configured' });
    }
    if (mode === 'caption') {
      if (!imageUrl) return res.status(400).json({ error: 'Missing imageUrl' });
      if (!OPENAI_API_KEY) return res.status(500).json({ error: 'OPENAI_API_KEY not configured' });
      const hit = captionCache.get(imageUrl);
      if (hit && Date.now() - hit.t < CAP_TTL_MS) return res.json(hit.data);
      const data = await openaiCaptionAndTags({ imageUrl });
      captionCache.set(imageUrl, { t: Date.now(), data });
      return res.json(data);
    }
    return res.status(400).json({ error: 'Invalid mode. Use "ask" or "caption".' });
  } catch (err) {
    const isAbort = err?.name === 'AbortError';
    console.error('[ai] error:', err);
    return res.status(isAbort ? 504 : 500).json({ error: isAbort ? 'Upstream timeout' : 'Server error' });
  }
});

app.post('/api/ask', (req, res) => { req.body = { ...req.body, mode: 'ask' }; app._router.handle(req, res, () => {}); });
app.post('/api/caption', (req, res) => { req.body = { ...req.body, mode: 'caption' }; app._router.handle(req, res, () => {}); });

const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || '0.0.0.0';
app.listen(PORT, HOST, () => console.log(`AI API listening on http://${HOST}:${PORT}`));
