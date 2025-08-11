import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS ?? '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

function corsHeaders(origin?: string): Record<string, string> {
  if (!origin || ALLOWED_ORIGINS.length === 0 || ALLOWED_ORIGINS.includes(origin)) {
    return {
      'Access-Control-Allow-Origin': origin || '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Cache-Control': 'no-store'
    };
  }
  return { 'Cache-Control': 'no-store' };
}

export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get('origin') ?? undefined;
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin) });
}

function withTimeout(ms = 30_000) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms);
  return { signal: ac.signal, clear: () => clearTimeout(t) };
}

async function askPerplexity({ question, context, signal }: { question: string; context: string; signal: AbortSignal }) {
  const key = process.env.PPLX_API_KEY!;
  const r = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    signal,
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'sonar',
      temperature: 0.2,
      max_tokens: 400,
      messages: [
        { role: 'system', content: 'You are a concise technical assistant for a portfolio site. Only use the provided album context. If unknown, say so briefly.' },
        { role: 'user', content: `Album context:\n${context}\n\nQuestion: ${question}\nAnswer in 2–6 sentences with concrete details if present.` }
      ]
    })
  });
  if (!r.ok) throw new Error(`Perplexity HTTP ${r.status}: ${await r.text().catch(()=>'')}`);
  const j = await r.json();
  return (j?.choices?.[0]?.message?.content ?? '').trim();
}

async function askOpenAI({ question, context, signal }: { question: string; context: string; signal: AbortSignal }) {
  const key = process.env.OPENAI_API_KEY!;
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    signal,
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      max_tokens: 400,
      messages: [
        { role: 'system', content: 'You are a concise technical assistant for a portfolio site. Only use the provided album context. If unknown, say so briefly.' },
        { role: 'user', content: `Album context:\n${context}\n\nQuestion: ${question}` }
      ]
    })
  });
  if (!r.ok) throw new Error(`OpenAI HTTP ${r.status}: ${await r.text().catch(()=>'')}`);
  const j = await r.json();
  return (j?.choices?.[0]?.message?.content ?? '').trim();
}

async function captionWithOpenAI({ imageUrl, signal }: { imageUrl: string; signal: AbortSignal }) {
  const key = process.env.OPENAI_API_KEY!;
  const cap = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    signal,
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      max_tokens: 160,
      messages: [
        { role: 'system', content: 'Describe the image in one concise sentence. Avoid opinions; be specific.' },
        { role: 'user', content: [{ type: 'text', text: 'Describe this image in one sentence.' }, { type: 'image_url', image_url: { url: imageUrl } }] }
      ]
    })
  });
  if (!cap.ok) throw new Error(`Vision HTTP ${cap.status}: ${await cap.text().catch(()=> '')}`);
  const capJson = await cap.json();
  const caption: string = (capJson?.choices?.[0]?.message?.content ?? '').trim();

  const tagsReq = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    signal,
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
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
  if (!tagsReq.ok) throw new Error(`Tags HTTP ${tagsReq.status}: ${await tagsReq.text().catch(()=> '')}`);
  const tagJson = await tagsReq.json();
  const tagLine = (tagJson?.choices?.[0]?.message?.content ?? '').trim();
  const tags = tagLine.split(',').map(s => s.trim()).filter(Boolean).slice(0, 8);
  return { caption, tags };
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get('origin') ?? undefined;
  const headers = corsHeaders(origin);

  let body: any = {};
  try { body = await req.json(); } catch {}
  const { mode, question, context, imageUrl } = body || {};

  const hasPPLX = !!process.env.PPLX_API_KEY;
  const hasOAI  = !!process.env.OPENAI_API_KEY;

  if (!hasPPLX && !hasOAI) {
    return NextResponse.json({ error: 'No provider keys configured (set PPLX_API_KEY and/or OPENAI_API_KEY).' }, { status: 500, headers });
  }

  if (mode === 'ask') {
    if (!question || !context) return NextResponse.json({ error: 'Missing question/context' }, { status: 400, headers });
    if (String(question).length > 2000) return NextResponse.json({ error: 'Question too long' }, { status: 413, headers });

    if (hasPPLX) {
      const { signal, clear } = withTimeout(30_000);
      try {
        const answer = await askPerplexity({ question, context, signal });
        clear();
        return NextResponse.json({ answer, provider: 'perplexity' }, { headers });
      } catch { clear(); }
    }
    if (hasOAI) {
      const { signal, clear } = withTimeout(30_000);
      try {
        const answer = await askOpenAI({ question, context, signal });
        clear();
        return NextResponse.json({ answer, provider: 'openai' }, { headers });
      } catch {
        clear();
        return NextResponse.json({ error: 'All providers failed.' }, { status: 502, headers });
      }
    }
    return NextResponse.json({ error: 'No provider available.' }, { status: 500, headers });
  }

  if (mode === 'caption') {
    if (!imageUrl) return NextResponse.json({ error: 'Missing imageUrl' }, { status: 400, headers });
    if (!hasOAI)   return NextResponse.json({ error: 'OPENAI_API_KEY required for captions' }, { status: 500, headers });

    const { signal, clear } = withTimeout(30_000);
    try {
      const data = await captionWithOpenAI({ imageUrl, signal });
      clear();
      return NextResponse.json(data, { headers });
    } catch (err: any) {
      clear();
      const msg = err?.name === 'AbortError' ? 'Upstream request timed out' : (err?.message || 'Server error');
      return NextResponse.json({ error: msg }, { status: 502, headers });
    }
  }

  return NextResponse.json({ error: 'Invalid mode. Use "ask" or "caption".' }, { status: 400, headers });
}
