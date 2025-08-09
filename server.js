// server.js (ESM, Node 18+)
// -------------------------------------------------------
// Features:
// - .env/.env.local support
// - CORS allow-list (or open for local dev)
// - /health
// - POST /api/ask  -> Perplexity (primary) + OpenAI fallback
// - POST /api/caption -> OpenAI vision caption + short tags
// - Timeouts, helpful errors, in-memory cache
// -------------------------------------------------------

import 'dotenv/config';
import express from 'express';
import cors from 'cors';

// Use native fetch on Node 18+. (No dependency on node-fetch.)
const fetcher = (...args) => globalThis.fetch(...args);

const app = express();

/* ---------- CORS ----------

  In .env (or .env.local), set:
  CORS_ORIGINS=http://localhost:51461,https://your-domain.com

  If CORS_ORIGINS is empty, we allow all origins (nice for local dev).
------------------------------------------------------- */
const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

const corsOptions = {
  origin(origin, cb) {
    if (!origin || ALLOWED_ORIGINS.length === 0 || ALLOWED_ORIGINS.includes(origin)) {
      return cb(null, true);
    }
    return cb(new Error(`Not allowed by CORS: ${origin}`));
  },
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json({ limit: '1mb' }));

/* ---------- Config / Keys ---------- */
const PPLX_API_KEY   = (process.env.PPLX_API_KEY || '').trim();
const OPENAI_API_KEY = (process.env.OPENAI_API_KEY || '').trim();

console.log('[boot] Perplexity key :', PPLX_API_KEY ? '✅ present' : '❌ missing');
console.log('[boot] OpenAI key     :', OPENAI_API_KEY ? '✅ present' : '— none (optional)');

if (!PPLX_API_KEY && !OPENAI_API_KEY) {
  console.warn('[boot] No provider keys configured. /api/ask will 502.');
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
        model: 'sonar',        // fast, grounded. Switch to 'sonar-small' or 'sonar-pro' if desired.
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

/* ---------- Health ---------- */
app.get('/health', (_req, res) => res.json({ ok: true }));

/* ---------- Q&A ---------- */
app.post('/api/ask', async (req, res) => {
  try {
    const { question, context } = req.body || {};
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
        console.warn('[ask] Perplexity failed:', e.message);
      }
    }

    // Fallback to OpenAI
    if (OPENAI_API_KEY) {
      try {
        const answer = await openaiAsk({ question, context });
        return res.json({ answer, provider: 'openai' });
      } catch (e) {
        console.warn('[ask] OpenAI failed:', e.message);
      }
    }

    return res.status(502).json({ error: 'All providers failed or no API keys configured' });
  } catch (err) {
    console.error('[ask] Server error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

/* ---------- Image Caption + Tags (OpenAI Vision) ---------- */
const captionCache = new Map(); // imageUrl -> { t, data }
const CAP_TTL_MS = 60 * 60 * 1000; // 1h

app.post('/api/caption', async (req, res) => {
  try {
    const { imageUrl } = req.body || {};
    if (!imageUrl) return res.status(400).json({ error: 'Missing imageUrl' });
    if (!OPENAI_API_KEY) return res.status(500).json({ error: 'OPENAI_API_KEY not configured' });

    // cache
    const hit = captionCache.get(imageUrl);
    if (hit && Date.now() - hit.t < CAP_TTL_MS) {
      return res.json(hit.data);
    }

    // 1) caption
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
      return res.status(502).json({ error: `Vision caption HTTP ${capRes.status}`, body });
    }
    const capJson = await capRes.json();
    const caption = (capJson?.choices?.[0]?.message?.content || '').trim();

    // 2) tags
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
      return res.status(502).json({ error: `Vision tags HTTP ${tagRes.status}`, body });
    }
    const tagJson = await tagRes.json();
    const tagLine = (tagJson?.choices?.[0]?.message?.content || '').trim();
    const tags = tagLine.split(',').map(s => s.trim()).filter(Boolean).slice(0, 8);

    const payload = { caption, tags };
    captionCache.set(imageUrl, { t: Date.now(), data: payload });
    return res.json(payload);
  } catch (err) {
    const isAbort = err?.name === 'AbortError';
    console.error('[caption] error:', err);
    return res.status(isAbort ? 504 : 500).json({ error: isAbort ? 'Upstream timeout' : 'Server error' });
  }
});

/* ---------- Start ---------- */
const PORT = Number(process.env.PORT || 8787); // avoid clashing with your static port
app.listen(PORT, () => {
  console.log(`AI API listening on http://localhost:${PORT}`);
});
