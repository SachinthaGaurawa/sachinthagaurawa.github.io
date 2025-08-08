// server.js (ESM)
import 'dotenv/config';               // loads .env / .env.local at boot
import express from 'express';
import cors from 'cors';

// Node 18+ has global fetch. For Node <18, dynamically load node-fetch.
const fetcher = (...args) =>
  (globalThis.fetch
    ? globalThis.fetch(...args)
    : import('node-fetch').then(({ default: f }) => f(...args)));

const app = express();

/* ---------- CORS ----------
   Put a comma-separated list of allowed origins in .env:
   CORS_ORIGINS=https://yourdomain.com,https://sachinthagaurawa.github.io
   If empty, all origins are allowed (useful for local dev).
-------------------------------- */
const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

const corsOptions = {
  origin(origin, cb) {
    // Allow same-origin / curl / postman (no Origin header),
    // OR allow all if no list was provided,
    // OR allow if on the whitelist:
    if (!origin || ALLOWED_ORIGINS.length === 0 || ALLOWED_ORIGINS.includes(origin)) {
      return cb(null, true);
    }
    return cb(new Error(`Not allowed by CORS: ${origin}`));
  },
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // handle preflight
app.use(express.json({ limit: '1mb' }));

/* ---------- API keys ---------- */
const PPLX_API_KEY   = (process.env.PPLX_API_KEY || '').trim();
const OPENAI_API_KEY = (process.env.OPENAI_API_KEY || '').trim();

console.log('[boot] Perplexity key:', PPLX_API_KEY ? '✅ present' : '❌ missing');
console.log('[boot] OpenAI key    :', OPENAI_API_KEY ? '✅ present' : '— none (optional)');

if (!PPLX_API_KEY && !OPENAI_API_KEY) {
  console.warn('[boot] No provider keys found. /api/ask will fail until you set .env(.local)');
}

/* ---------- Providers ---------- */
async function perplexityAsk({ question, context }) {
  const r = await fetcher('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${PPLX_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'sonar', // strong/grounded; switch to sonar-small/sonar-pro if you want
      temperature: 0.2,
      max_tokens: 400,
      messages: [
        {
          role: 'system',
          content:
            'You are a concise technical assistant for a portfolio site. ' +
            'Only answer using the provided album context. If unknown, say so briefly.',
        },
        {
          role: 'user',
          content:
            `Album context:\n${context}\n\n` +
            `Question: ${question}\n` +
            'Answer in 2–6 sentences. Include concrete details/numbers if present.',
        },
      ],
    }),
  });

  if (!r.ok) {
    const text = await r.text().catch(() => '');
    throw new Error(`Perplexity HTTP ${r.status}${text ? `: ${text}` : ''}`);
  }
  const j = await r.json();
  return j?.choices?.[0]?.message?.content?.trim() || '';
}

async function openaiAsk({ question, context }) {
  const r = await fetcher('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
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
          content:
            'You are a concise technical assistant for a portfolio site. ' +
            'Only use the provided album context.',
        },
        { role: 'user', content: `Album context:\n${context}\n\nQuestion: ${question}` },
      ],
    }),
  });

  if (!r.ok) {
    const text = await r.text().catch(() => '');
    throw new Error(`OpenAI HTTP ${r.status}${text ? `: ${text}` : ''}`);
  }
  const j = await r.json();
  return j?.choices?.[0]?.message?.content?.trim() || '';
}

/* ---------- Routes ---------- */
app.get('/health', (_req, res) => res.json({ ok: true }));

app.post('/api/ask', async (req, res) => {
  try {
    const { question, context, albumId } = req.body || {};
    if (!question || !context) {
      return res.status(400).json({ error: 'Missing question/context' });
    }

    // (Optional) guardrails
    if (String(question).length > 2000) {
      return res.status(413).json({ error: 'Question too long' });
    }

    // 1) Try Perplexity first (if configured)
    if (PPLX_API_KEY) {
      try {
        const answer = await perplexityAsk({ question, context, albumId });
        return res.json({ answer, provider: 'perplexity' });
      } catch (err) {
        console.warn('[ask] Perplexity failed:', err.message);
      }
    }

    // 2) Fallback to OpenAI (optional)
    if (OPENAI_API_KEY) {
      try {
        const answer = await openaiAsk({ question, context, albumId });
        return res.json({ answer, provider: 'openai' });
      } catch (err) {
        console.warn('[ask] OpenAI failed:', err.message);
      }
    }

    // 3) Nothing worked
    return res.status(502).json({ error: 'All providers failed or no API keys configured' });
  } catch (err) {
    console.error('[ask] Server error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

/* ---------- Start server ---------- */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`AI API listening on http://localhost:${PORT}`);
});















// Add near top: in-memory cache
const captionCache = new Map(); // url -> { t, data }
const TTL = 60 * 60 * 1000;

// Add route:
app.post('/api/caption', async (req, res) => {
  try {
    const { imageUrl } = req.body || {};
    if (!imageUrl) return res.status(400).json({ error: 'Missing imageUrl' });

    const hit = captionCache.get(imageUrl);
    if (hit && Date.now() - hit.t < TTL) return res.json(hit.data);

    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_API_KEY) return res.status(500).json({ error: 'OPENAI_API_KEY missing on server' });

    // Vision caption
    const capReq = await fetcher('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.2,
        max_tokens: 160,
        messages: [
          { role: 'system', content: 'Describe the image in one concise sentence. Avoid opinions; be specific.' },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Describe this image in one sentence.' },
              { type: 'image_url', image_url: { url: imageUrl } }
            ]
          }
        ]
      })
    });
    if (!capReq.ok) {
      const txt = await capReq.text().catch(()=> '');
      return res.status(502).json({ error: `Vision HTTP ${capReq.status}: ${txt}` });
    }
    const capJson = await capReq.json();
    const caption = (capJson?.choices?.[0]?.message?.content || '').trim();

    // Tag extraction
    const tagReq = await fetcher('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
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
    const tagJson = await tagReq.json();
    const tagLine = (tagJson?.choices?.[0]?.message?.content || '').trim();
    const tags = tagLine.split(',').map(s=>s.trim()).filter(Boolean).slice(0, 8);

    const payload = { caption, tags };
    captionCache.set(imageUrl, { t: Date.now(), data: payload });
    res.json(payload);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error:'Server error' });
  }
});
