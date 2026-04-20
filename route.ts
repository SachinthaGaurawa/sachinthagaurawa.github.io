import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Vercel Free (Hobby) Plan එකේ උපරිම කාලය තත්පර 10යි. 60ක් දැම්මොත් Deploy fail වෙන නිසා එය අයින් කර ඇත.

/* ────────────────── CORS ────────────────── */
const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS?? '')
 .split(',')
 .map(s => s.trim().replace(/\/+$/, ''))
 .filter(Boolean);

function corsHeaders(origin?: string): Record<string, string> {
  const o = (origin |

| '').replace(/\/+$/, '');
  if (!origin |

| ALLOWED_ORIGINS.length === 0 |
| ALLOWED_ORIGINS.includes(o)) {
    return {
      'Access-Control-Allow-Origin': origin |

| '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Cache-Control': 'no-store',
    };
  }
  return { 'Cache-Control': 'no-store' };
}

export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get('origin')?? undefined;
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin) });
}

/* ─────────────── Helpers / timeout ─────────────── */
// Vercel Free plan එකේ සීමාව නිසා 30s වෙනුවට 9s (9_000ms) ලෙස වෙනස් කර ඇත.
function withTimeout(ms = 9_000) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms);
  return { signal: ac.signal, clear: () => clearTimeout(t) };
}

async function toJSON(r: Response) {
  const txt = await r.text();
  try { return JSON.parse(txt); } catch { return { raw: txt }; }
}

/* ─────────────── Providers: ASK ─────────────── */

// 1) Groq (primary)
async function groqAsk({
  question, context, signal,
}: { question: string; context: string; signal: AbortSignal }) {
  const key = process.env.GROQ_API_KEY!;
  if (!key) throw new Error('GROQ_API_KEY missing');
  
  const model = process.env.GROQ_MODEL |

| 'llama-3.1-70b-versatile';

  const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    signal,
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: 400,
      messages:,
    }),
  });
  if (!r.ok) throw new Error(`Groq HTTP ${r.status}: ${JSON.stringify(await toJSON(r))}`);
  const j = await r.json();
  return (j?.choices?.?.message?.content?? '').trim();
}

// 2) DeepInfra (fallback)
async function deepinfraAsk({
  question, context, signal,
}: { question: string; context: string; signal: AbortSignal }) {
  const key = process.env.DEEPINFRA_API_KEY!;
  if (!key) throw new Error('DEEPINFRA_API_KEY missing');
  
  const model = process.env.DEEPINFRA_MODEL |

| 'meta-llama/Meta-Llama-3-70B-Instruct';

  const r = await fetch('https://api.deepinfra.com/v1/openai/chat/completions', {
    method: 'POST',
    signal,
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: 400,
      messages:,
    }),
  });
  if (!r.ok) throw new Error(`DeepInfra HTTP ${r.status}: ${JSON.stringify(await toJSON(r))}`);
  const j = await r.json();
  return (j?.choices?.?.message?.content?? '').trim();
}

/* ─────────────── Provider: CAPTION (Gemini) ─────────────── */
async function fetchImageAsBase64(url: string, signal: AbortSignal) {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Image fetch failed ${res.status}`);
  const ct = res.headers.get('content-type') |

| 'image/jpeg';
  const buf = await res.arrayBuffer();
  const b64 = Buffer.from(buf).toString('base64');
  return { mime: ct, base64: b64 };
}

async function geminiGenerate({
  systemPrompt,
  parts,
  signal,
}: {
  systemPrompt: string;
  parts: any; 
  signal: AbortSignal;
}) {
  const key = process.env.GEMINI_API_KEY!;
  if (!key) throw new Error('GEMINI_API_KEY missing');

  const model = process.env.GEMINI_MODEL |

| 'gemini-1.5-flash';
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${key}`,
    {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              { text: systemPrompt },
             ...parts,
            ],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 256,
        },
      }),
    }
  );
  if (!r.ok) throw new Error(`Gemini HTTP ${r.status}: ${JSON.stringify(await toJSON(r))}`);
  const j = await r.json();
  const text = j?.candidates?.?.content?.parts?.map((p: any) => p?.text |

| '').join('').trim() |
| '';
  return text;
}

async function geminiCaptionAndTags({
  imageUrl,
  signal,
}: {
  imageUrl: string;
  signal: AbortSignal;
}) {
  const { mime, base64 } = await fetchImageAsBase64(imageUrl, signal);

  const caption = await geminiGenerate({
    systemPrompt: 'Describe the image in ONE concise sentence. Be specific and neutral.',
    parts:,
    signal,
  });

  const tagLine = await geminiGenerate({
    systemPrompt:
      'Return 3–6 comma-separated tags based only on the given caption. ' +
      'Use short, concrete nouns/adjectives only. Return ONLY the comma list.',
    parts: [{ text: `Caption: ${caption}` }],
    signal,
  });

  const tags = tagLine.split(',').map((s: string) => s.trim()).filter(Boolean).slice(0, 8);
  return { caption, tags };
}

/* ─────────────── Main handler ─────────────── */
export async function POST(req: NextRequest) {
  const origin = req.headers.get('origin')?? undefined;
  const headers = corsHeaders(origin);

  let body: any = {};
  try { body = await req.json(); } catch {}
  const { mode, question, context, imageUrl } = body |

| {};

  const hasGroq      =!!process.env.GROQ_API_KEY;
  const hasDeepInfra =!!process.env.DEEPINFRA_API_KEY;
  const hasGemini    =!!process.env.GEMINI_API_KEY;

  if (mode === 'ask') {
    if (!question ||!context) {
      return NextResponse.json({ error: 'Missing question/context' }, { status: 400, headers });
    }
    if (String(question).length > 2000) {
      return NextResponse.json({ error: 'Question too long' }, { status: 413, headers });
    }
    if (!hasGroq &&!hasDeepInfra) {
      return NextResponse.json({ error: 'No ASK provider configured.' }, { status: 500, headers });
    }

    if (hasGroq) {
      const { signal, clear } = withTimeout(9_000); // Changed to 9s
      try {
        const answer = await groqAsk({ question, context, signal });
        clear();
        return NextResponse.json({ answer, provider: 'groq' }, { headers });
      } catch (e) {
        clear();
        // fall through to DeepInfra
      }
    }
    
    if (hasDeepInfra) {
      const { signal, clear } = withTimeout(9_000); // Changed to 9s
      try {
        const answer = await deepinfraAsk({ question, context, signal });
        clear();
        return NextResponse.json({ answer, provider: 'deepinfra' }, { headers });
      } catch (e) {
        clear();
        return NextResponse.json({ error: 'All providers failed.' }, { status: 502, headers });
      }
    }

    return NextResponse.json({ error: 'No provider available.' }, { status: 500, headers });
  }

  if (mode === 'caption') {
    if (!imageUrl) {
      return NextResponse.json({ error: 'Missing imageUrl' }, { status: 400, headers });
    }
    if (!hasGemini) {
      return NextResponse.json({ error: 'No CAPTION provider configured.' }, { status: 500, headers });
    }

    const { signal, clear } = withTimeout(9_000); // Changed to 9s
    try {
      const data = await geminiCaptionAndTags({ imageUrl, signal });
      clear();
      return NextResponse.json(data, { headers });
    } catch (err: any) {
      clear();
      const msg = err?.name === 'AbortError'? 'Upstream request timed out' : (err?.message |

| 'Server error');
      return NextResponse.json({ error: msg }, { status: 502, headers });
    }
  }

  return NextResponse.json({ error: 'Invalid mode. Use "ask" or "caption".' }, { status: 400, headers });
}
