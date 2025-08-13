/* -----------------------------------------------------------
   Album Gallery + Overlay + Viewer + (Expert Chat, Ask & Captions)
   Works on static hosting (GitHub Pages) with a remote API.
   ----------------------------------------------------------- */

/* ====== CONFIG (ONE LINE only) ======
   For local dev (running server.js locally): 'http://localhost:8787'
*/
const API_BASE = (window.__API_BASE__ || 'https://album-ai-backend-new.vercel.app').replace(/\/+$/, '');

console.log('[gallery] app.js loaded, API_BASE =', API_BASE);

// Show any uncaught errors so we don’t silently fail
window.addEventListener('error', (e) => {
  console.error('[gallery] Uncaught error:', e.message, 'at', e.filename + ':' + e.lineno);
});

/* ====== tiny helpers ====== */
const $  = (s, p=document) => p.querySelector(s);
const $$ = (s, p=document) => [...p.querySelectorAll(s)];
const sleep = (ms)=> new Promise(r=>setTimeout(r,ms));
const debounce = (fn, ms=150) => { let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), ms); }; };

/* ====== Data (sample) ====== */
const ALBUMS = [
  {
    id: "aavss",
    title: "Advanced Autonomous Vehicle Safety System",
    cover: "https://images.unsplash.com/photo-1519751138087-5a2c6aa5a315?q=80&w=1600&auto=format&fit=crop",
    description: "Patent-pending AAVSS — multi-sensor fusion (LiDAR, radar, camera), embedded AI on Jetson Nano, and real-time driver safety analytics.",
    tags: ["AAVSS","autonomous","safety","jetson","embedded","fusion"],
    media: [
      { type: "image",   src: "https://images.unsplash.com/photo-1503376780353-7e6692767b70?q=80&w=1600&auto=format&fit=crop" },
      { type: "youtube", src: "https://www.youtube.com/embed/dQw4w9WgXcQ" },
      { type: "image",   src: "https://images.unsplash.com/photo-1558985040-ed4d5029c24c?q=80&w=1600&auto=format&fit=crop" }
    ]
  },
  {
    id: "dataset",
    title: "Sri Lanka Autonomous Driving Dataset",
    cover: "https://images.unsplash.com/photo-1524635962361-d7f8ae9c79b1?q=80&w=1600&auto=format&fit=crop",
    description: "Open driving dataset across Sri Lankan road scenarios — urban, rural, rain/fog/night. Includes lane, sign and hazard annotations.",
    tags: ["dataset","Sri Lanka","traffic","vision","research"],
    media: [
      { type: "image",   src: "https://images.unsplash.com/photo-1483721310020-03333e577078?q=80&w=1600&auto=format&fit=crop" },
      { type: "youtube", src: "https://www.youtube.com/embed/3JZ_D3ELwOQ" },
      { type: "image",   src: "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?q=80&w=1600&auto=format&fit=crop" }
    ]
  }
];

/* ====== Local stores ====== */
const CaptionStore = {
  get(key){ try { return JSON.parse(localStorage.getItem('cap:'+key)); } catch { return null; } },
  set(key,val){ try { localStorage.setItem('cap:'+key, JSON.stringify(val)); } catch {} }
};

const AITagStore = {
  // per-album AI tag list
  get(albumId){ try { return JSON.parse(localStorage.getItem('ai-tags:'+albumId)) || []; } catch { return []; } },
  set(albumId, tags){
    try {
      const uniq = Array.from(new Set((tags || []).map(t => String(t).trim()).filter(Boolean)));
      localStorage.setItem('ai-tags:'+albumId, JSON.stringify(uniq));
    } catch {}
  }
};

/* ====== API helpers ====== */
async function postJSON(url, payload, { retries=0 } = {}) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify(payload)
      });
      let j = {};
      try { j = await r.json(); } catch {}
      if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`);
      return j;
    } catch (err) {
      if (attempt < retries) { await sleep(400 * (attempt + 1)); continue; }
      console.error('[gallery] postJSON failed:', err);
      throw err;
    }
  }
}

// Album-scoped Q&A
async function aiAsk(question, context) {
  const j = await postJSON(`${API_BASE}/api/ai`, {
    mode: 'ask',
    question,
    context
  });
  return j?.answer || '';
}

// Vision captions + tags
async function aiCaption(imageUrl) {
  const j = await postJSON(`${API_BASE}/api/ai`, {
    mode: 'caption',
    imageUrl
  });
  return j; // { caption, tags }
}

// Expert deep Q&A (AAVSS + Sri Lankan dataset)
async function expertAsk(question) {
  const r = await fetch(`${API_BASE}/api/ai-expert`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question })
  });
  let j = {};
  try { j = await r.json(); } catch {}
  if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`);
  return j; // { answer, provider, topic, sources }
}

/* ====== Conversational Brain (topic routing + human style) ====== */
const ChatBrain = (() => {
  const TOPICS = { AAVSS: 'aavss', DATASET: 'sldataset' };

  const KEYWORDS = {
    aavss: ['aavss','vehicle safety','autonomous vehicle safety','jetson','sensor fusion','fusion','lidar','radar','camera','nvidia','adas','tracking','lane','fcw','tensorRT'],
    sldataset: ['dataset','sri lanka','annotation','labels','split','download','license','classes','lanes','signs','night','rain','fog']
  };

  const store = {
    getTopic(){ try { return sessionStorage.getItem('chat_topic') || ''; } catch { return ''; } },
    setTopic(t){ try { sessionStorage.setItem('chat_topic', t || ''); } catch {} },
  };

  function currentAlbumTopic() {
    if (!currentAlbum) return '';
    if (currentAlbum.id === 'aavss')  return TOPICS.AAVSS;
    if (currentAlbum.id === 'dataset') return TOPICS.DATASET;
    return '';
  }

  function detectTopic(q) {
    const t = (q || '').toLowerCase();
    if (/\baavss\b/.test(t)) return TOPICS.AAVSS;
    if (/\b(sri\s*lanka|dataset)\b/.test(t)) return TOPICS.DATASET;

    let a=0,d=0; KEYWORDS.aavss.forEach(k=>{ if(t.includes(k)) a++; }); KEYWORDS.sldataset.forEach(k=>{ if(t.includes(k)) d++; });
    if (a>d) return TOPICS.AAVSS;
    if (d>a) return TOPICS.DATASET;
    return currentAlbumTopic() || store.getTopic() || '';
  }

  function isShort(q) {
    const words = (q||'').trim().split(/\s+/).filter(Boolean);
    return words.length <= 3;
  }

  function toneFrom(q){
    const s = q.toLowerCase();
    if (/(why|benefit|value|useful)/.test(s)) return 'executive';
    if (/(how|steps|guide|setup|configure)/.test(s)) return 'step-by-step';
    if (/(spec|model|fps|latency|metric|numbers?)/.test(s)) return 'spec-list';
    return isShort(q) ? 'bullets' : 'balanced';
  }

  function buildGuardedQuestion(topic, q) {
    const style = isShort(q) ? 'Style=crisp bullets, 3–6 lines max.' : 'Style=short paragraphs with bullets.';
    const scope =
      topic === TOPICS.AAVSS
        ? 'Topic=AAVSS. Answer only about AAVSS unless user asks to compare.'
        : topic === TOPICS.DATASET
        ? 'Topic=Sri Lankan Autonomous Driving Dataset. Answer only about the dataset unless user asks to compare.'
        : 'Topic=Auto-detect. Prefer single-topic answer; do not mix topics unless asked.';
    const persona = 'Persona=Friendly senior engineer. Human tone. Avoid speculation. Use only KB facts.';
    const tone = `Tone=${toneFrom(q)} (bold key terms).`;

    return `[${scope}] [${style}] [${persona}] [${tone}] Q: ${q}`;
  }

  async function route(q){
    let topic = detectTopic(q);
    const short = isShort(q);

    if (!topic && short) {
      throw { type: 'clarify', choices: [
        { id: 'aavss', label: 'AAVSS' },
        { id: 'sldataset', label: 'Sri Lankan Dataset' }
      ]};
    }
    if (topic) store.setTopic(topic);
    return { topic, guarded: buildGuardedQuestion(topic, q) };
  }

  function forceTopic(t){ store.setTopic(t); }
  function getTopic(){ return store.getTopic(); }

  return { route, forceTopic, getTopic, isShort };
})();

/* ====== Safe Markdown-ish renderer (bold/italic/underline, lists, links) ====== */
function escapeHtml(s){ return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function linkify(s){
  return s.replace(/(https?:\/\/[^\s)]+)|(www\.[^\s)]+)/gi, (m)=>{
    const url = m.startsWith('http') ? m : 'http://'+m;
    return `<a href="${url}" target="_blank" rel="noopener">${m}</a>`;
  });
}
function inlineMarkup(s){
  // **bold**, *italic*, __underline__
  return s
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/__([^_]+)__/g, '<u>$1</u>');
}
function mdToHtml(text){
  const t = linkify(escapeHtml(text));
  const lines = t.split('\n');
  let html = '';
  let inList = false;

  const flushP = (buf) => { if (buf.trim()) html += `<p>${inlineMarkup(buf.trim())}</p>`; };

  let para = '';
  for (const raw of lines){
    const line = raw.trimEnd();
    if (/^(\*|-)\s+/.test(line)){
      if (para){ flushP(para); para=''; }
      if (!inList){ html += '<ul>'; inList=true; }
      html += `<li>${inlineMarkup(line.replace(/^(\*|-)\s+/, ''))}</li>`;
    } else if (line === ''){
      if (inList){ html += '</ul>'; inList=false; }
      if (para){ flushP(para); para=''; }
    } else {
      para += (para ? ' ' : '') + line;
    }
  }
  if (inList) html += '</ul>';
  if (para) flushP(para);
  return html || '<p></p>';
}

/* ====== Chat UI (bubbles + typing + suggestions) ====== */
function injectChatStylesOnce(){
  if (document.getElementById('chat-css')) return;
  const css = `
  .chat-log { max-width: 1100px; margin: .5rem 0 0; padding:0 0 8px; display:flex; flex-direction:column; gap:.6rem; }
  .bubble { border-radius: 16px; padding: 12px 14px; line-height: 1.45; max-width: 92%; box-shadow: 0 2px 10px rgba(0,0,0,.15); }
  .bubble.me { align-self: flex-end; background: #1e293b; color: #e5e7eb; }
  .bubble.ai { align-self: flex-start; background: #0b1324; color: #e6ecff; border: 1px solid rgba(255,255,255,.08); }
  .bubble.system { align-self:center; background: #0f172a; color:#cbd5e1; padding:8px 12px; font-size:.9rem; border: 1px dashed rgba(255,255,255,.1); }
  .bubble p { margin: .35rem 0; }
  .bubble ul { margin: .35rem 0 .35rem 1.1rem; }
  .typing { display:inline-block; min-width: 36px; }
  .dot { height:6px; width:6px; background:#93c5fd; border-radius:50%; display:inline-block; margin-right:4px; animation: blink 1.2s infinite; }
  .dot:nth-child(2){ animation-delay: .15s; } .dot:nth-child(3){ animation-delay: .3s; }
  @keyframes blink { 0% {opacity:.2} 20%{opacity:1} 100%{opacity:.2} }
  .suggestions { display:flex; flex-wrap:wrap; gap:.4rem; margin-top:.25rem; }
  .suggestions .chip { background:#0f172a; color:#cbd5e1; border:1px solid rgba(255,255,255,.08); padding:.35rem .6rem; border-radius:999px; cursor:pointer; }
  .clarify { background: rgba(0,0,0,.06); border: 1px solid rgba(255,255,255,.08); padding: .75rem; border-radius: 10px; }
  .clarify .chip { cursor: pointer; }
  `;
  const s = document.createElement('style'); s.id='chat-css'; s.textContent = css; document.head.appendChild(s);
}

function makeBubble(role, html){
  const div = document.createElement('div');
  div.className = `bubble ${role}`;
  div.innerHTML = html;
  return div;
}
function makeTyping(){
  const b = document.createElement('div');
  b.className = 'bubble ai';
  b.innerHTML = `<span class="typing"><span class="dot"></span><span class="dot"></span><span class="dot"></span></span>`;
  return b;
}
function scrollToEnd(el){ el.scrollTop = el.scrollHeight; }

/* ====== DOM refs ====== */
const grid       = $('#albumGrid');
const albumView  = $('#albumView');
const heroLink   = $('#albumHeroLink');
const heroImg    = $('#albumHeroImg');
const heroTitle  = $('#albumHeroTitle');
const descBox    = $('#albumDesc');
const masonry    = $('#albumMasonry');

let currentAlbum = null;
let currentIndex = 0;

/* ====== safety: required elements check ====== */
function hasRequiredEls() {
  const required = [
    ['#albumGrid', grid], ['#albumView', albumView], ['#albumHeroImg', heroImg],
    ['#albumHeroTitle', heroTitle], ['#albumHeroLink', heroLink], ['#albumDesc', descBox],
    ['#albumMasonry', masonry],
  ];
  const missing = required.filter(([_, el]) => !el).map(([sel]) => sel);
  if (missing.length) { console.error('[gallery] Missing required elements in HTML:', missing.join(', ')); return false; }
  return true;
}

/* ====== Grid rendering ====== */
function addCard(a){
  if (!grid) return;
  const hasVideo = a.media.some(m=>m.type!=="image");
  const card = document.createElement('article');
  card.className='card'; card.setAttribute('role','button');
  card.innerHTML = `
    <img src="${a.cover}" alt="${a.title} cover" loading="lazy">
    <div class="label"><div class="title">${a.title}</div></div>
    ${hasVideo?`<div class="badge-video" title="Contains video"><i class="fa-solid fa-play"></i></div>`:""}
  `;
  card.setAttribute('data-aos','zoom-in');
  card.setAttribute('data-aos-delay', String(60 * (grid.children.length % 5)));
  card.addEventListener('click', ()=> openAlbum(a.id, 0, true));
  grid.appendChild(card);
}

function renderGrid(term=""){
  if (!grid) return;
  const t = term.trim().toLowerCase();
  grid.innerHTML = "";
  ALBUMS
    .filter(a => {
      if (!t) return true;
      const base = (a.title + ' ' + a.description + ' ' + (a.tags || []).join(' ')).toLowerCase();
      const aiTags = (AITagStore.get(a.id) || []).map(x => String(x).toLowerCase());
      const allTagsJoined = (a.tags || []).concat(aiTags).join(' ').toLowerCase();
      return base.includes(t) || allTagsJoined.includes(t);
    })
    .forEach(addCard);
  if (window.AOS && typeof window.AOS.refresh === 'function') window.AOS.refresh();
}

/* ====== Album overlay ====== */
function findAlbum(id){ return ALBUMS.find(a=>a.id===id); }

function ytIdFromEmbed(url){
  try{
    const u=new URL(url);
    if(u.hostname.includes('youtu.be')) return u.pathname.slice(1);
    if(u.searchParams.get('v')) return u.searchParams.get('v');
    const p=u.pathname.split('/'); const i=p.indexOf('embed'); if(i>-1 && p[i+1]) return p[i+1];
  }catch(_){}
  return "";
}
function thumbFor(item){
  if(item.type==='image') return item.src;
  if(item.type==='youtube'){
    const id=ytIdFromEmbed(item.src);
    return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : (currentAlbum?.cover || '');
  }
  return currentAlbum?.cover || '';
}

function ensureAlbumFooter() {
  if (!albumView) return;
  const mainFooter = document.querySelector('body > .site-footer');
  if (!mainFooter) return;
  if (albumView.querySelector('.site-footer.overlay-footer')) return;

  const clone = mainFooter.cloneNode(true);
  clone.classList.add('overlay-footer'); clone.setAttribute('role','contentinfo');
  clone.querySelectorAll('#year').forEach(el => { el.removeAttribute('id'); el.textContent = new Date().getFullYear(); });
  Object.assign(clone.style, { width: 'min(1200px,95vw)', margin: '28px auto 44px', position: 'relative', zIndex: '1', display: 'block' });

  const insertionPoint = masonry?.parentElement && albumView.contains(masonry.parentElement) ? masonry.parentElement.nextSibling : null;
  if (insertionPoint) albumView.insertBefore(clone, insertionPoint); else albumView.appendChild(clone);
  if (window.AOS && typeof window.AOS.refresh === 'function') window.AOS.refresh();
}

function removeAlbumFooter() {
  if (!albumView) return;
  const f = albumView.querySelector('.site-footer.overlay-footer');
  if (f) f.remove();
}

function openAlbum(id, index=0, push=false){
  const a=findAlbum(id); if(!a) return;
  if (!albumView || !heroImg || !heroTitle || !heroLink || !descBox || !masonry) return;

  currentAlbum=a; currentIndex=index;

  heroImg.src=a.cover; heroImg.alt=`${a.title} cover`;
  heroTitle.textContent=a.title; heroLink.href=a.cover;
  descBox.textContent=a.description;

  masonry.innerHTML="";
  a.media.forEach((m,i)=>{
    const tile=document.createElement('div'); 
    tile.className='m-item';
    const lazyAttr = i < 2 ? "" : ' loading="lazy"';
    tile.innerHTML = `<img src="${thumbFor(m)}" alt="${a.title} ${i+1}"${lazyAttr}>` + (m.type!=='image'?`<div class="play"><i class="fa-solid fa-play"></i></div>`:"");
    tile.addEventListener('click', ()=> openViewer(i));
    masonry.appendChild(tile);
  });

  albumView.classList.add('active'); albumView.setAttribute('aria-hidden','false');
  if (window.gsap) gsap.fromTo('.album-hero',{opacity:.6,y:10},{opacity:1,y:0,duration:.35,ease:'power2.out'});

  const tiles = $$('#albumMasonry .m-item');
  if (tiles.length && window.gsap){ gsap.from(tiles, {opacity:0, y:16, duration:.35, ease:'power2.out', stagger:0.05, clearProps:'all'}); }
  if (window.AOS && typeof window.AOS.refresh === 'function') window.AOS.refresh();

  ensureAlbumFooter();
  wireAskUI();         // ensure AI input is wired on open

  if(push){
    const u=new URL(location.href);
    u.searchParams.set('album',id);
    history.pushState({album:id},"",u);
  }

  const doCaptions = ()=> captionImagesInAlbum(currentAlbum).catch(err=>{ console.warn('[gallery] captionImagesInAlbum error:', err?.message || err); });
  (window.requestIdleCallback ? requestIdleCallback(doCaptions, { timeout: 2000 }) : setTimeout(doCaptions, 300));
}

function closeAlbum(){
  removeAlbumFooter(); closeViewer();
  if (!albumView) return;
  if (window.gsap) {
    gsap.to('#albumView',{opacity:0,duration:.2,ease:'power2.in',onComplete:()=>{
      albumView.classList.remove('active'); albumView.style.opacity="";
      albumView.setAttribute('aria-hidden','true');
    }});
  } else {
    albumView.classList.remove('active'); albumView.setAttribute('aria-hidden','true');
  }
}
$('#closeAlbum')?.addEventListener('click', closeAlbum);

/* ====== Viewer ====== */
const viewer   = $('#viewerOverlay');
const stage    = $('#stage');
const vClose   = $('#viewerClose');
const peekPrev = $('#peekPrev');
const peekNext = $('#peekNext');

let ytIframe=null;
function ytCommand(func){
  if(!ytIframe) return;
  ytIframe.contentWindow?.postMessage(JSON.stringify({event:"command",func, args:[]}),"*");
}
function stopYouTube(){ if(ytIframe){ try{ ytCommand('stopVideo'); }catch(_){ } ytIframe=null; } }
function previewSrc(m){ return m.type==='image'?m.src:thumbFor(m); }

function loadMedia(){
  if (!currentAlbum || !stage || !peekPrev || !peekNext) return;
  const m=currentAlbum.media[currentIndex];
  stage.innerHTML=''; ytIframe=null;

  let el;
  if(m.type==='image'){
    el=document.createElement('img'); el.src=m.src; el.alt=currentAlbum.title; el.loading='lazy';
  }else if(m.type==='video'){
    el=document.createElement('video');
    el.src=m.src; el.controls=true; el.playsInline=true; el.muted=true; el.autoplay=true;
    el.style.width="100%"; el.style.height="100%";
    el.addEventListener('click', ()=> el.paused?el.play():el.pause());
  }else{
    const url=new URL(m.src);
    url.searchParams.set('enablejsapi','1'); url.searchParams.set('rel','0'); url.searchParams.set('modestbranding','1');
    url.searchParams.set('autoplay','1'); url.searchParams.set('mute','1'); url.searchParams.set('origin', location.origin);

    el=document.createElement('iframe');
    el.src=url.toString();
    el.allow="autoplay; encrypted-media; picture-in-picture";
    el.allowFullscreen=true; el.title="YouTube video player"; el.id=`yt_${Date.now()}`;
    el.style.width="100%"; el.style.height="100%";
    el.addEventListener('load', ()=> ytIframe=el);
    el.addEventListener('click', ()=>{ ytCommand("playVideo"); setTimeout(()=>ytCommand("pauseVideo"),0); });
  }

  stage.appendChild(el);
  const len=currentAlbum.media.length;
  peekPrev.src=previewSrc(currentAlbum.media[(currentIndex-1+len)%len]);
  peekNext.src=previewSrc(currentAlbum.media[(currentIndex+1)%len]);
}

function openViewer(i){
  currentIndex = i;
  document.body.classList.add('noscroll');
  if (!viewer) return;
  viewer.classList.add('active'); viewer.setAttribute('aria-hidden','false');
  loadMedia();
  if (window.gsap) gsap.fromTo('.viewer-shell',{y:18,opacity:0},{y:0,opacity:1,duration:.25});
}
function closeViewer(){
  stopYouTube();
  if (!viewer || !stage) return;
  if (window.gsap) {
    gsap.to('.viewer-shell',{y:14,opacity:0,duration:.18,onComplete:()=>{
      viewer.classList.remove('active'); viewer.setAttribute('aria-hidden','true');
      document.body.classList.remove('noscroll'); stage.innerHTML='';
      gsap.set('.viewer-shell',{y:0,opacity:1});
    }});
  } else {
    viewer.classList.remove('active'); viewer.setAttribute('aria-hidden','true');
    document.body.classList.remove('noscroll'); stage.innerHTML='';
  }
}
vClose?.addEventListener('click', closeViewer);

function nav(d){
  stopYouTube();
  if (!currentAlbum) return;
  const L=currentAlbum.media.length;
  currentIndex=(currentIndex+d+L)%L;
  loadMedia();
}
$('#prevBtn')?.addEventListener('click', ()=>nav(-1));
$('#nextBtn')?.addEventListener('click', ()=>nav(1));

document.addEventListener('keydown', e=>{
  if(viewer?.classList.contains('active')){
    if(e.key==='Escape') closeViewer();
    if(e.key==='ArrowRight') nav(1);
    if(e.key==='ArrowLeft')  nav(-1);
    if(e.key===' '){
      e.preventDefault();
      const v=$('video',stage);
      if(v){ v.paused? v.play(): v.pause(); return; }
      ytCommand("playVideo"); setTimeout(()=>ytCommand("pauseVideo"),10);
    }
    return;
  }
  if(albumView?.classList.contains('active') && e.key==='Escape'){ closeAlbum(); }
});
let startX=0;
stage?.addEventListener('pointerdown', e=> startX=e.clientX);
stage?.addEventListener('pointerup',   e=> { const dx=e.clientX-startX; if(Math.abs(dx)>40) nav(dx<0?1:-1); });

/* ====== AI: Ask this album ====== */
function buildAlbumContext(album){
  if (!album) return "";
  const mediaLines = album.media.map((m,i)=> `${i+1}. ${m.type}${m.src?`:${m.src}`:""}`).join('\n');
  return [
    `Title: ${album.title}`,
    `Description: ${album.description}`,
    `Tags: ${album.tags?.join(', ') || ''}`,
    `Media:\n${mediaLines}`
  ].join('\n');
}

/* ====== AI UI (Expert-first with topic focus + clarify + chat bubbles) ====== */
function wireAskUI(){
  const input = $('#askInput');
  const btn   = $('#askBtn');
  const resultHost = $('#askResult');
  if (!input || !btn || !resultHost) return;

  injectChatStylesOnce();

  // Build/restore chat log container
  if (!resultHost.querySelector('.chat-log')){
    resultHost.innerHTML = '';
    const log = document.createElement('div');
    log.className = 'chat-log';
    resultHost.appendChild(log);
    const hello = makeBubble('system', 'Ask about <strong>AAVSS</strong> or the <strong>Sri Lankan autonomous driving dataset</strong>. Short questions like <em>“Sensors?”</em> will get crisp bullets.');
    log.appendChild(hello);
  }
  const log = resultHost.querySelector('.chat-log');

  // Quick suggestions based on topic
  function suggestionsFor(topic){
    if (topic === 'aavss') return ['Sensors', 'Fusion pipeline', 'Safety features', 'Compute budget', 'Latency targets'];
    if (topic === 'sldataset') return ['Classes', 'Annotations', 'Splits & metrics', 'License', 'Sri Lanka specifics'];
    return ['AAVSS', 'Sri Lankan dataset', 'Sensors', 'Annotations', 'Fusion'];
  }
  function renderSuggestions(topic){
    const row = document.createElement('div');
    row.className = 'suggestions';
    row.innerHTML = suggestionsFor(topic).map(t=>`<button class="chip">${t}</button>`).join('');
    row.onclick = (e)=>{ const b=e.target.closest('.chip'); if(!b) return; input.value=b.textContent; btn.click(); };
    return row;
  }

  // Clarify UI (for ultra-short/ambiguous)
  function renderClarify(choices){
    const div = document.createElement('div');
    div.className = 'bubble ai';
    div.innerHTML = `<div class="clarify">Which one did you mean?
      <div class="suggestions" style="margin-top:.5rem">${choices.map(c=>`<button class="chip" data-id="${c.id}">${c.label}</button>`).join('')}</div>
    </div>`;
    div.querySelector('.suggestions').onclick = (e)=>{
      const b = e.target.closest('button[data-id]'); if (!b) return;
      ChatBrain.forceTopic(b.dataset.id); btn.click();
    };
    return div;
  }

  async function ask(){
    const q = (input.value || '').trim();
    if (!q) return;

    // Render my bubble
    const me = makeBubble('me', mdToHtml(q));
    log.appendChild(me);

    // Typing placeholder
    const typing = makeTyping();
    log.appendChild(typing);
    scrollToEnd(log);

    btn.disabled = true;
    input.value = '';

    try {
      // Route by topic + style
      let routed;
      try {
        routed = await ChatBrain.route(q);
      } catch (e) {
        // Replace typing with clarify chips
        typing.remove();
        if (e?.type === 'clarify') { log.appendChild(renderClarify(e.choices)); scrollToEnd(log); return; }
        throw e;
      }

      // Expert first
      let answer = '';
      try {
        const res = await expertAsk(routed.guarded);
        answer = res?.answer || '';
      } catch (ex) {
        console.warn('[gallery] expertAsk failed, falling back:', ex?.message || ex);
        const ctx = buildAlbumContext(currentAlbum || ALBUMS[0]);
        answer = await aiAsk(q, ctx);
      }

      // Replace typing with AI bubble (formatted)
      typing.remove();
      const ai = makeBubble('ai', mdToHtml(answer || 'No answer.'));
      log.appendChild(ai);

      // Follow-ups
      log.appendChild(renderSuggestions(ChatBrain.getTopic() || ''));

      scrollToEnd(log);
    } catch (err) {
      console.error('[gallery] ask error:', err);
      typing.remove();
      const errB = makeBubble('ai', mdToHtml('Sorry — the assistant had an issue. Please try again.'));
      log.appendChild(errB);
      scrollToEnd(log);
    } finally {
      btn.disabled = false;
    }
  }

  btn.onclick = ask;
  input.onkeydown = (e) => { if (e.key === 'Enter') ask(); };
}

/* ====== AI: Smart image captions ====== */
async function captionImagesInAlbum(album){
  if (!album) return;
  const imgs = album.media.map((m,i)=> ({...m, index:i})).filter(m => m.type === 'image');

  const allTags = new Set();
  for (const m of imgs) {
    try {
      const cached = CaptionStore.get(m.src);
      const data = cached || await aiCaption(m.src);
      if (!cached) CaptionStore.set(m.src, data);

      // annotate tile if present
      const tile = $$('#albumMasonry .m-item')[m.index];
      if (tile) {
        tile.setAttribute('title', data.caption || '');
        let tr = tile.querySelector('.mini-tags');
        if (!tr) { tr = document.createElement('div'); tr.className = 'mini-tags'; tile.appendChild(tr); }
        tr.innerHTML = (data.tags||[]).slice(0,3).map(t=>`<span class="mini-chip">${t}</span>`).join('');
      }
      (data.tags||[]).forEach(t=> allTags.add(t));
    } catch(err){
      console.warn('[gallery] caption error:', err?.message || err);
    }
  }

  // Save album-level AI tags for global search
  AITagStore.set(album.id, [...allTags]);

  // surface album-level tags below description
  const desc = document.querySelector('.album-desc-inner');
  if (desc) {
    let row = document.getElementById('album-ai-tags');
    if (!row) { row = document.createElement('div'); row.id = 'album-ai-tags'; row.className = 'tag-chips'; desc.appendChild(row); }
    row.innerHTML = [...allTags].slice(0,12).map(t=>`<button class="chip" data-t="${t}">${t}</button>`).join('');
    row.onclick = (e)=>{
      const b=e.target.closest('.chip'); if (!b) return;
      const t=b.dataset.t;
      $('#searchInput').value = t;
      renderGrid(t);
    };
  }
}

/* ====== Misc UX ====== */
function updateAllFooterYears() {
  document.querySelectorAll('.site-footer #year').forEach(el => { el.textContent = new Date().getFullYear(); });
}
function setupHeroAnimation(){
  const h2 = document.querySelector('.hero-text h2'); if (!h2) return;
  const words = h2.textContent.split(' '); h2.innerHTML = words.map(w=>`<span class="word">${w}</span>`).join(' ');
  if (window.gsap) gsap.fromTo('.hero .word',{y:20, opacity:0},{y:0, opacity:1, duration:.6, stagger:.06, ease:'power2.out', delay:.1});
}
function setupLazyHero(){
  const io = new IntersectionObserver(es=>{
    es.forEach(e=>{
      if (!e.isIntersecting) return;
      const img = e.target; img.src = img.dataset.src; img.onload = ()=> img.classList.add('is-loaded'); io.unobserve(img);
    });
  }, {rootMargin:'150px'});
  document.querySelectorAll('img.lazy-cover').forEach(i=>io.observe(i));
}
function setupChips(){
  const POPULAR = ['AAVSS','dataset','lidar','night','rain'];
  const chips = document.getElementById('chips'); if (!chips) return;
  chips.innerHTML = POPULAR.map(t=>`<button class="chip" data-t="${t}">${t}</button>`).join('');
  chips.addEventListener('click',e=>{
    const b=e.target.closest('.chip'); if(!b) return;
    const t=b.dataset.t.toLowerCase(); $('#searchInput').value = t; renderGrid(t);
  });
}
function setupSearch(){
  const search = $('#searchInput'); if (!search) return;
  search.addEventListener('input', debounce(e=>renderGrid(e.target.value), 120));
}

/* Optional: semantic search (only if transformers loaded) */
const Emb = { model:null, cache:new Map(), ready:false };
async function maybeSetupSemantic(){
  if (!window.transformers) return;
  try { Emb.model = await window.transformers.pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2'); Emb.ready = true; }
  catch { /* ignore */ }
}
function wireSemanticSearch(){
  const search = $('#searchInput'); if (!search || !Emb.ready) return;
  function cosine(a,b){ let s=0; for(let i=0;i<a.length;i++) s+=a[i]*b[i]; return s; }
  async function embed(text){
    if (Emb.cache.has(text)) return Emb.cache.get(text);
    const out = await Emb.model(text, { pooling: 'mean', normalize: true });
    const vec = Array.from(out.data); Emb.cache.set(text, vec); return vec;
  }
  let ALBUM_VECS = null;
  async function ensureVecs(){
    if (ALBUM_VECS) return;
    ALBUM_VECS = await Promise.all(ALBUMS.map(async (a) => {
      const text = `${a.title}. ${a.description}. ${a.tags.join(' ')}`;
      return { id:a.id, v: await embed(text) };
    }));
  }
  search.addEventListener('input', debounce(async (e)=>{
    const q = e.target.value.trim(); if (!q){ renderGrid(''); return; }
    await ensureVecs();
    const qv = await embed(q);
    const ranked = await Promise.all(ALBUMS.map(async (a, i) => {
      const kw = (a.title + ' ' + a.tags.join(' ') + ' ' + a.description).toLowerCase();
      const kwBoost = kw.includes(q.toLowerCase()) ? 0.15 : 0;
      const sem = cosine(qv, ALBUM_VECS[i].v);
      return { a, score: sem + kwBoost };
    }));
    ranked.sort((x,y)=> y.score - x.score);
    grid.innerHTML = '';
    ranked.forEach(({a}) => addCard(a));
  }, 160));
}

/* ====== Deep link ====== */
window.addEventListener('popstate', ()=>{
  const id=new URL(location.href).searchParams.get('album');
  if(id) openAlbum(id,0,false); else closeAlbum();
});

/* ====== Init ====== */
function init(){
  if (!hasRequiredEls()) { console.warn('[gallery] Init stopped because required elements are missing on this page.'); return; }

  renderGrid(); setupSearch(); setupChips();
  setupHeroAnimation(); setupLazyHero();
  updateAllFooterYears();

  if (window.gsap && window.ScrollTrigger) {
    gsap.registerPlugin(ScrollTrigger);
    const heroImgEl = document.querySelector('.hero-media img');
    const heroWrap = document.querySelector('.hero-media');
    if (heroImgEl) {
      gsap.fromTo(heroImgEl, {scale:1.08, y:0}, {
        scale:1, y:-30, ease:'power2.out',
        scrollTrigger:{ trigger: heroWrap, start:'top top', end:'bottom top', scrub:true }
      });
    }
  }

  const supportsFinePointer = matchMedia('(hover:hover) and (pointer:fine)').matches;
  if (supportsFinePointer && grid) {
    $$('.card').forEach(card => {
      let rAF = 0;
      const onMove = (e) => {
        cancelAnimationFrame(rAF);
        rAF = requestAnimationFrame(()=>{
          const b = card.getBoundingClientRect();
          const cx = e.clientX - b.left; const cy = e.clientY - b.top;
          const rx = ((cy / b.height) - .5) * -6; const ry = ((cx / b.width)  - .5) *  6;
          card.style.transform = `translateY(-6px) rotateX(${rx}deg) rotateY(${ry}deg)`;
        });
      };
      const reset = () => { card.style.transform = ''; };
      card.addEventListener('mousemove', onMove);
      card.addEventListener('mouseleave', reset);
    });
  }

  const id=new URL(location.href).searchParams.get('album');
  if(id) openAlbum(id,0,false);

  maybeSetupSemantic().then(wireSemanticSearch);

  // Backend sanity ping (console only)
  fetch(`${API_BASE}/api/ai`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: 'ask', question: 'Ping from browser', context: 'Test context' })
  })
  .then(async r => {
    const t = await r.text();
    console.log('[gallery] API ping →', t);
    if (!r.ok) console.warn('[gallery] Ping failed. Check CORS_ORIGINS on backend and API_BASE here.');
  })
  .catch(err => console.error('[gallery] API ping failed:', err));
}

document.addEventListener('DOMContentLoaded', init);
console.log('app.js fully initialized');
