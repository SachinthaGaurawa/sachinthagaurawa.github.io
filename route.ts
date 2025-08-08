// app/api/caption/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type CaptionResp = { caption: string; tags: string[] };

// simple 1-hour memory cache (per instance)
const cache = new Map<string, { t: number; data: CaptionResp }>();
const TTL = 60 * 60 * 1000;

function ok(data: any, origin?: string) {
  return NextResponse.json(data, {
    headers: {
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': origin || '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    },
  });
}
export async function OPTIONS(req: NextRequest) { return ok(null, req.headers.get('origin') || undefined); }

export async function POST(req: NextRequest) {
  const origin = req.headers.get('origin') || undefined;
  try {
    const { imageUrl } = await req.json();
    if (!imageUrl) return ok({ error: 'Missing imageUrl' }, origin);

    // cache
    const hit = cache.get(imageUrl);
    if (hit && Date.now() - hit.t < TTL) return ok(hit.data, origin);

    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_API_KEY) return ok({ error: 'OPENAI_API_KEY missing on server' }, origin);

    // 1) Vision caption
    const capReq = await fetch('https://api.openai.com/v1/chat/completions', {
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
      const txt = await capReq.text().catch(()=>''); 
      return ok({ error: `Vision HTTP ${capReq.status}: ${txt}` }, origin);
    }
    const capJson = await capReq.json();
    const caption = (capJson?.choices?.[0]?.message?.content || '').trim();

    // 2) Tags from caption (no external fetch needed)
    const tagReq = await fetch('https://api.openai.com/v1/chat/completions', {
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

    const payload: CaptionResp = { caption, tags };
    cache.set(imageUrl, { t: Date.now(), data: payload });
    return ok(payload, origin);
  } catch (e:any) {
    return ok({ error: e?.message || 'Server error' }, origin);
  }
}
