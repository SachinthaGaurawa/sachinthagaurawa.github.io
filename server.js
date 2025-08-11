// server.js (ESM, Node 18+)
// -------------------------------------------------------
// Features:
// - .env/.env.local support
// - CORS allow-list (or open for local dev)
// - GET /            -> hello + which origins allowed
// - GET /health      -> { ok: true }
// - POST /api/ai     -> mode = 'ask' (PPLX primary, OpenAI fallback)
//                       mode = 'caption' (OpenAI vision caption + tags)
// - Back-compat: POST /api/ask, POST /api/caption (call /api/ai under the hood)
// - Timeouts, helpful errors, in-memory caption cache
// -------------------------------------------------------

import 'dotenv/config';
import express from 'express';
import cors from 'cors';

// Node 18+ has fetch
const fetcher = (...args) => globalThis.fetch(...args);

const app = express();

/* ---------- CORS ----------

  In .env (or .env.local), set:
  CORS_ORIGINS=https://sachinthagaurawa.github.io,https://your-domain.com

  Notes:
  - NO trailing slash in origins (Origin header never has a trailing slash).
  - If CORS_ORIGINS is empty, we allow all origins (good for local dev).
------------------------------------------------------- */
const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map(s => s.trim().replace(/\/+$/, '')) // trim and remove trailing slashes
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
app.options('*', cors(corsOptions));        // preflight
app.use(express.json({ limit: '1mb' }));    // JSON bodies

/* ---------- Config / Keys ---------- */
const PPLX_API_KEY   = (process.env.PPLX_API_KEY || '').trim();
const OPENAI_API_KEY = (process.env.OPENAI_API_KEY || '').trim();

console.log('[boot] Perplexity key :', PPLX_API_KEY ? '✅ present' : '❌ missing');
console.log('[boot] OpenAI key     :', OPENAI_API_KEY ? '✅ present' : '— none (optional)');
console.log('[boot] CORS_ORIGINS   :', ALLOWED_ORIGINS.length ? ALLOWED_ORIGINS.join(', ') : '(all allowed)');

if (!PPLX_API_KEY && !OPENAI_API_KEY) {
  console.warn('[boot] No provider keys configured. /api/ai ask will 502.');
}

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

/* ---------- Providers ---------- */
async function perplexityAsk({ question, context }) {
  const { signal, done } = withTimeout(30000);
  try {
    const r = await fetcher('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      signal,
      headers: {
        Authorization: `Bearer ${PPLX_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar', // fast, grounded (use 'sonar-pro' if you have access)
        temperature: 0.2,
        max_tokens: 400,
        messages: [
          {
            role: 'system',
            content:
              'You are a concise technical assistant for a portfolio site. ' +
              'Answer ONLY using the provided album context. If unknown, say so briefly.',
          },
          {
            role: 'user',
            content:
              `Album context:\n${context}\n\n` +
              `Question: ${question}\n` +
              'Answer in 2–6 sentences with concrete details if present.',
          },
        ],
      }),
    });
    if (!r.ok) {
      const body = await toJSON(r);
      throw new Error(`Perplexity HTTP ${r.status}: ${JSON.stringify(body)}`);
    }
    const j = await r.json();
    return j?.choices?.[0]?.message?.content?.trim() || '';
  } finally {
    done();
  }
}

async function openaiAsk({ question, context }) {
  const { signal, done } = withTimeout(30000);
  try {
    const r = await fetcher('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      signal,
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.2,
        max_tokens: 400,
        messages: [
          {
            role: 'system',
            content: 'You are a concise technical assistant for a portfolio site. Use only the provided album context.',
          },
          { role: 'user', content: `Album context:\n${context}\n\nQuestion: ${question}` },
        ],
      }),
    });
    if (!r.ok) {
      const body = await toJSON(r);
      throw new Error(`OpenAI HTTP ${r.status}: ${JSON.stringify(body)}`);
    }
    const j = await r.json();
    return j?.choices?.[0]?.message?.content?.trim() || '';
  } finally {
    done();
  }
}

async function openaiCaptionAndTags({ imageUrl }) {
  if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not configured');

  // 1) Caption
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
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Describe this image in one sentence.' },
            { type: 'image_url', image_url: { url: imageUrl } },
          ],
        },
      ],
    }),
  });
  d1();
  if (!capRes.ok) {
    const body = await toJSON(capRes);
    throw new Error(`Vision caption HTTP ${capRes.status}: ${JSON.stringify(body)}`);
  }
  const capJson = await capRes.json();
  const caption = (capJson?.choices?.[0]?.message?.content || '').trim();

  // 2) Tags
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
        { role: 'user', content: `Caption: ${caption}\nReturn only tags.` },
      ],
    }),
  });
  d2();
  if (!tagRes.ok) {
    const body = await toJSON(tagRes);
    throw new Error(`Vision tags HTTP ${tagRes.status}: ${JSON.stringify(body)}`);
  }
  const tagJson = await tagRes.json();
  const tagLine = (tagJson?.choices?.[0]?.message?.content || '').trim();
  const tags = tagLine.split(',').map(s => s.trim()).filter(Boolean).slice(0, 8);

  return { caption, tags };
}

/* ---------- Health / Root ---------- */
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

/* ---------- Cache for captions ---------- */
const captionCache = new Map(); // imageUrl -> { t, data }
const CAP_TTL_MS = 60 * 60 * 1000; // 1h

/* ---------- Unified AI Endpoint ---------- */
app.post('/api/ai', async (req, res) => {
  const origin = req.headers.origin;
  console.log('[ai] POST /api/ai from', origin || '(no origin)');
  try {
    const { mode, question, context, imageUrl } = req.body || {};

    if (mode === 'ask') {
      if (!question || !context) {
        return res.status(400).json({ error: 'Missing question/context' });
      }
      if (String(question).length > 2000) {
        return res.status(413).json({ error: 'Question too long' });
      }

      // Prefer Perplexity
      if (PPLX_API_KEY) {
        try {
          const answer = await perplexityAsk({ question, context });
          return res.json({ answer, provider: 'perplexity' });
        } catch (e) {
          console.warn('[ai] Perplexity failed:', e.message);
        }
      }
      // Fallback OpenAI
      if (OPENAI_API_KEY) {
        try {
          const answer = await openaiAsk({ question, context });
          return res.json({ answer, provider: 'openai' });
        } catch (e) {
          console.warn('[ai] OpenAI failed:', e.message);
        }
      }
      return res.status(502).json({ error: 'All providers failed or no API keys configured' });
    }

    if (mode === 'caption') {
      if (!imageUrl) return res.status(400).json({ error: 'Missing imageUrl' });
      if (!OPENAI_API_KEY) return res.status(500).json({ error: 'OPENAI_API_KEY not configured' });

      const hit = captionCache.get(imageUrl);
      if (hit && Date.now() - hit.t < CAP_TTL_MS) {
        return res.json(hit.data);
      }

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

/* ---------- Back-compat shims ---------- */
app.post('/api/ask', async (req, res) => {
  // Delegate to /api/ai
  req.body = { ...req.body, mode: 'ask' };
  return app._router.handle(req, res, () => {}); // reuse handler chain
});

app.post('/api/caption', async (req, res) => {
  // Delegate to /api/ai
  req.body = { ...req.body, mode: 'caption' };
  return app._router.handle(req, res, () => {});
});

/* ---------- Start ---------- */
const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || '0.0.0.0'; // bind all interfaces for hosting platforms
app.listen(PORT, HOST, () => {
  console.log(`AI API listening on http://${HOST}:${PORT}`);
});
