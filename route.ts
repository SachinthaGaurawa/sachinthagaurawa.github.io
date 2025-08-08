import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

function corsHeaders(origin?: string) {
  if (!origin || ALLOWED_ORIGINS.length === 0 || ALLOWED_ORIGINS.includes(origin)) {
    return {
      'Access-Control-Allow-Origin': origin || '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };
  }
  return {};
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { headers: corsHeaders(req.headers.get('origin') || undefined) });
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get('origin') || undefined;
  const headers = { ...corsHeaders(origin), 'Cache-Control': 'no-store' };

  try {
    const { question, context } = await req.json().catch(() => ({} as any));
    if (!question || !context) {
      return NextResponse.json({ error: 'Missing question/context' }, { status: 400, headers });
    }

    const PPLX_API_KEY = process.env.PPLX_API_KEY;
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

    if (!PPLX_API_KEY && !OPENAI_API_KEY) {
      return NextResponse.json({ error: 'No provider keys configured.' }, { status: 500, headers });
    }

    const ac = new AbortController();
    const timeout = setTimeout(() => ac.abort(), 30_000);

    // Try Perplexity first
    if (PPLX_API_KEY) {
      try {
        const r = await fetch('https://api.perplexity.ai/chat/completions', {
          method: 'POST',
          signal: ac.signal,
          headers: {
            'Authorization': `Bearer ${PPLX_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'sonar',
            temperature: 0.2,
            max_tokens: 400,
            messages: [
              { role: 'system',
                content: 'You are a concise technical assistant for a portfolio site. Only use the provided album context.' },
              { role: 'user',
                content: `Album context:\n${context}\n\nQuestion: ${question}\nAnswer in 2–6 sentences.` }
            ]
          })
        });
        if (!r.ok) throw new Error(`Perplexity HTTP ${r.status}: ${await r.text().catch(()=> '')}`);
        const j = await r.json();
        const answer = j?.choices?.[0]?.message?.content?.trim() || 'No answer.';
        clearTimeout(timeout);
        return NextResponse.json({ answer }, { headers });
      } catch {
        // fall through
      } finally { clearTimeout(timeout); }
    }

    // Fallback OpenAI
    if (OPENAI_API_KEY) {
      const ac2 = new AbortController();
      const timeout2 = setTimeout(() => ac2.abort(), 30_000);
      try {
        const r = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          signal: ac2.signal,
          headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            temperature: 0.2,
            max_tokens: 400,
            messages: [
              { role: 'system',
                content: 'You are a concise technical assistant for a portfolio site. Only use the provided album context.' },
              { role: 'user',
                content: `Album context:\n${context}\n\nQuestion: ${question}` }
            ]
          })
        });
        if (!r.ok) throw new Error(`OpenAI HTTP ${r.status}: ${await r.text().catch(()=> '')}`);
        const j = await r.json();
        const answer = j?.choices?.[0]?.message?.content?.trim() || 'No answer.';
        clearTimeout(timeout2);
        return NextResponse.json({ answer }, { headers });
      } catch {
        clearTimeout(timeout2);
        return NextResponse.json({ error: 'All providers failed.' }, { status: 502, headers });
      }
    }

    return NextResponse.json({ error: 'No provider available.' }, { status: 500, headers });
  } catch (err: any) {
    const msg = err?.name === 'AbortError' ? 'Upstream request timed out' : (err?.message || 'Server error');
    return NextResponse.json({ error: msg }, { status: 500, headers });
  }
}
