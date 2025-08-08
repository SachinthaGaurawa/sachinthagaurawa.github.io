// app/api/ask/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';       // needed for env & fetch timeouts
export const dynamic = 'force-dynamic';
export const maxDuration = 60;         // Vercel/Node safeguard

/** Comma-separated origins in env, e.g.
 *  CORS_ORIGINS=https://sachinthagaurawa.github.io,https://your-domain.com
 */
const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS ?? '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

function corsHeaders(origin?: string) {
  if (!origin || ALLOWED_ORIGINS.length === 0 || ALLOWED_ORIGINS.includes(origin)) {
    return {
      'Access-Control-Allow-Origin': origin || '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    };
  }
  // Disallowed origin -> no CORS headers
  return {};
}

export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get('origin') ?? undefined;
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(origin),
  });
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get('origin') ?? undefined;
  const baseHeaders = { ...corsHeaders(origin), 'Cache-Control': 'no-store' };

  // Parse body safely
  let body: any = {};
  try { body = await req.json(); } catch {}
  const { question, context } = body;
  if (!question || !context) {
    return NextResponse.json({ error: 'Missing question/context' }, { status: 400, headers: baseHeaders });
  }

  const PPLX_API_KEY  = process.env.PPLX_API_KEY;
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY; // optional fallback

  if (!PPLX_API_KEY && !OPENAI_API_KEY) {
    return NextResponse.json(
      { error: 'No provider keys configured (set PPLX_API_KEY and/or OPENAI_API_KEY).' },
      { status: 500, headers: baseHeaders }
    );
  }

  // --- Try Perplexity first ---
  if (PPLX_API_KEY) {
    const ac = new AbortController();
    const to = setTimeout(() => ac.abort(), 30_000);

    try {
      const r = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        signal: ac.signal,
        headers: {
          'Authorization': `Bearer ${PPLX_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'sonar', // use 'sonar-pro' if you have access
          temperature: 0.2,
          max_tokens: 400,
          messages: [
            {
              role: 'system',
              content:
                'You are a concise technical assistant for a portfolio site. ' +
                'Only use the provided album context. If unknown, say so briefly.',
            },
            {
              role: 'user',
              content:
                `Album context:\n${context}\n\n` +
                `Question: ${question}\n` +
                `Answer in 2–6 sentences with concrete details if present.`,
            },
          ],
        }),
      });

      clearTimeout(to);

      if (!r.ok) {
        const txt = await r.text().catch(() => '');
        throw new Error(`Perplexity HTTP ${r.status}: ${txt}`);
      }

      const j = await r.json();
      const answer = j?.choices?.[0]?.message?.content?.trim() ?? 'No answer.';
      return NextResponse.json({ answer }, { headers: baseHeaders });
    } catch {
      // fall through to OpenAI
    }
  }

  // --- Fallback: OpenAI ---
  if (OPENAI_API_KEY) {
    const ac = new AbortController();
    const to = setTimeout(() => ac.abort(), 30_000);

    try {
      const r = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        signal: ac.signal,
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          temperature: 0.2,
          max_tokens: 400,
          messages: [
            {
              role: 'system',
              content: 'You are a concise technical assistant for a portfolio site. Only use the provided album context.',
            },
            {
              role: 'user',
              content: `Album context:\n${context}\n\nQuestion: ${question}`,
            },
          ],
        }),
      });

      clearTimeout(to);

      if (!r.ok) {
        const txt = await r.text().catch(() => '');
        throw new Error(`OpenAI HTTP ${r.status}: ${txt}`);
      }

      const j = await r.json();
      const answer = j?.choices?.[0]?.message?.content?.trim() ?? 'No answer.';
      return NextResponse.json({ answer }, { headers: baseHeaders });
    } catch {
      return NextResponse.json(
        { error: 'All providers failed. Try again later.' },
        { status: 502, headers: baseHeaders }
      );
    }
  }

  // Should not reach here
  return NextResponse.json({ error: 'No provider available.' }, { status: 500, headers: baseHeaders });
}
