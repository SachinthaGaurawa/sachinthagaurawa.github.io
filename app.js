/* -----------------------------------------------------------
   Album Gallery + Overlay + Viewer + (AI Ask & Captions + Expert Q&A)
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
const clamp = (v, min, max)=> Math.max(min, Math.min(max, v));

/* ====== Data (sample) ====== */
const ALBUMS = [
  {
    id: "aavss",
    title: "Advanced Autonomous Vehicle Safety System",
    cover: "https://res.cloudinary.com/dzrfpc9be/image/upload/v1755231573/IMG_8893_1_wtmgsn.jpg",
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
  const j = await postJSON(`${API_BASE}/api/ai`, { mode: 'ask', question, context });
  return j?.answer || '';
}

// Vision captions + tags
async function aiCaption(imageUrl) {
  const j = await postJSON(`${API_BASE}/api/ai`, { mode: 'caption', imageUrl });
  return j; // { caption, tags }
}

// Expert deep Q&A
async function expertAsk(question) {
  const r = await fetch(`${API_BASE}/api/ai-expert`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question })
  });
  let j = {};
  try { j = await r.json(); } catch {}
  if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`);
  return j.answer;
}

/* ====== Conversational Brain ====== */
const ChatBrain = (() => {
  const TOPICS = { AAVSS:'AAVSS', DATASET:'Sri_Lanka_Dataset' };
  const KEYWORDS = {
    AAVSS: ['aavss','vehicle safety','autonomous vehicle safety','jetson','sensor fusion','fusion','lidar','radar','camera','nvidia','driver monitoring','dms','adas','can bus','v2x'],
    DATASET: ['dataset','sri lanka','colombo','kandy','galle','annotations','segmentation','bounding box','lane','night','rain','fog','traffic signs','autonomous driving dataset']
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
    const txt = (q || '').toLowerCase();
    if (/\b(aavss)\b/.test(txt)) return TOPICS.AAVSS;
    if (/\b(sri\s*lanka|dataset)\b/.test(txt)) return TOPICS.DATASET;
    let a=0,d=0; KEYWORDS.AAVSS.forEach(k=>{ if (txt.includes(k)) a++; }); KEYWORDS.DATASET.forEach(k=>{ if (txt.includes(k)) d++; });
    if (a>d) return TOPICS.AAVSS; if (d>a) return TOPICS.DATASET;
    return currentAlbumTopic() || store.getTopic() || '';
  }
  function isShort(q){ return (q||'').trim().split(/\s+/).filter(Boolean).length <= 3; }
  function buildGuardedQuestion(topic, q){
    const style = isShort(q) ? 'Style=concise bullets, 1–5 lines max.' : 'Style=clear, structured, short paragraphs.';
    const scope =
      topic === TOPICS.AAVSS ? 'Topic=AAVSS. Only answer about AAVSS unless explicitly asked to compare.'
      : topic === TOPICS.DATASET ? 'Topic=Sri Lankan Autonomous Driving Dataset. Only answer about the dataset unless explicitly asked to compare.'
      : 'Topic=Auto-detect. Prefer single-topic answer; do not mix topics unless asked.';
    const persona = 'Persona=Friendly expert, human tone. Be concrete and practical.';
    return `[${scope}] [${style}] [${persona}] Q: ${q}`;
  }
  async function ask(q){
    let topic = detectTopic(q);
    if (!topic && isShort(q)) {
      throw { type:'clarify', choices:[{id:TOPICS.AAVSS,label:'AAVSS'},{id:TOPICS.DATASET,label:'Sri Lankan Dataset'}] };
    }
    if (topic) store.setTopic(topic);
    const guarded = buildGuardedQuestion(topic, q);
    return { topic, guarded };
  }
  function forceTopic(topic){ store.setTopic(topic); }
  return { ask, forceTopic, TOPICS };
})();

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
    ['#albumGrid', grid],
    ['#albumView', albumView],
    ['#albumHeroImg', heroImg],
    ['#albumHeroTitle', heroTitle],
    ['#albumHeroLink', heroLink],
    ['#albumDesc', descBox],
    ['#albumMasonry', masonry],
  ];
  const missing = required.filter(([_, el]) => !el).map(([sel]) => sel);
  if (missing.length) {
    console.error('[gallery] Missing required elements in HTML:', missing.join(', '));
    return false;
  }
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
  clone.classList.add('overlay-footer');
  clone.setAttribute('role','contentinfo');
  clone.querySelectorAll('#year').forEach(el => {
    el.removeAttribute('id');
    el.textContent = new Date().getFullYear();
  });
  Object.assign(clone.style, {
    width: 'min(1200px,95vw)',
    margin: '28px auto 44px',
    position: 'relative',
    zIndex: '1',
    display: 'block'
  });

  const insertionPoint = masonry?.parentElement && albumView.contains(masonry.parentElement)
    ? masonry.parentElement.nextSibling
    : null;

  if (insertionPoint) albumView.insertBefore(clone, insertionPoint);
  else albumView.appendChild(clone);

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
    tile.innerHTML = `<img src="${thumbFor(m)}" alt="${a.title} ${i+1}"${lazyAttr}>`
                   + (m.type!=='image'?`<div class="play"><i class="fa-solid fa-play"></i></div>`:"");
    tile.addEventListener('click', ()=> openViewer(i));
    masonry.appendChild(tile);
  });

  albumView.classList.add('active'); 
  albumView.setAttribute('aria-hidden','false');
  if (window.gsap) gsap.fromTo('.album-hero',{opacity:.6,y:10},{opacity:1,y:0,duration:.35,ease:'power2.out'});

  const tiles = $$('#albumMasonry .m-item');
  if (tiles.length && window.gsap){
    gsap.from(tiles, {opacity:0, y:16, duration:.35, ease:'power2.out', stagger:0.05, clearProps:'all'});
  }
  if (window.AOS && typeof window.AOS.refresh === 'function') window.AOS.refresh();

  ensureAlbumFooter();
  wireAskUI();                 // ensure AI input is wired on open
  insertAlbumAskHintBelowChat(); // centered responsive pill

  if(push){
    const u=new URL(location.href);
    u.searchParams.set('album',id);
    history.pushState({album:id},"",u);
  }

  // kick off AI captions (non-blocking)
  const doCaptions = ()=> captionImagesInAlbum(currentAlbum).catch(err=>{
    console.warn('[gallery] captionImagesInAlbum error:', err?.message || err);
  });
  (window.requestIdleCallback ? requestIdleCallback(doCaptions, { timeout: 2000 }) : setTimeout(doCaptions, 300));
}

function closeAlbum(){
  removeAlbumFooter();
  closeViewer();
  if (!albumView) return;
  if (window.gsap) {
    gsap.to('#albumView',{opacity:0,duration:.2,ease:'power2.in',onComplete:()=>{
      albumView.classList.remove('active'); albumView.style.opacity="";
      albumView.setAttribute('aria-hidden','true');
    }});
  } else {
    albumView.classList.remove('active');
    albumView.setAttribute('aria-hidden','true');
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
function stopYouTube(){
  if(ytIframe){ try{ ytCommand('stopVideo'); }catch(_){ } ytIframe=null; }
}

function previewSrc(m){ return m.type==='image'?m.src:thumbFor(m); }

function loadMedia(){
  if (!currentAlbum || !stage || !peekPrev || !peekNext) return;
  const m=currentAlbum.media[currentIndex];
  stage.innerHTML=''; ytIframe=null;

  let el;
  if(m.type==='image'){
    el=document.createElement('img');
    el.src=m.src; el.alt=currentAlbum.title; el.loading='lazy';
  }else if(m.type==='video'){
    el=document.createElement('video');
    el.src=m.src;
    el.controls=true; el.playsInline=true; el.muted=true; el.autoplay=true;
    el.style.width="100%"; el.style.height="100%";
    el.addEventListener('click', ()=> el.paused?el.play():el.pause());
  }else{ // youtube
    const url=new URL(m.src);
    url.searchParams.set('enablejsapi','1');
    url.searchParams.set('rel','0');
    url.searchParams.set('modestbranding','1');
    url.searchParams.set('autoplay','1');
    url.searchParams.set('mute','1');
    url.searchParams.set('origin', location.origin);

    el=document.createElement('iframe');
    el.src=url.toString();
    el.allow="autoplay; encrypted-media; picture-in-picture";
    el.allowFullscreen=true; el.title="YouTube video player"; el.id=`yt_${Date.now()}`;
    el.style.width="100%"; el.style.height="100%";
    el.addEventListener('load', ()=> ytIframe=el);
    el.addEventListener('click', ()=>{
      ytCommand("playVideo");
      setTimeout(()=>ytCommand("pauseVideo"),0);
    });
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

/* ====== AI: Album context builder ====== */
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

// kept for compatibility
async function askAboutAlbum(question){
  const input = $('#askInput');
  const btn   = $('#askBtn');
  const out   = $('#askResult');
  if (!question || !currentAlbum || !out || !btn) return;
  const context = buildAlbumContext(currentAlbum);
  btn.disabled = true; out.textContent = 'Thinking…';
  try{
    const answer = await aiAsk(question, context);
    out.textContent = answer || 'No answer.';
  }catch(err){
    console.error('[gallery] ask error:', err);
    out.textContent = 'Sorry — the assistant had an issue. Please try again.';
  }finally{ btn.disabled = false; }
}

/* ====== Chat UI Enhancements ====== */
function injectChatStylesOnce(){
  if (document.getElementById('chatfx-css')) return;
  const css = `
  #askResult{ position:relative; margin-top:10px; }
  .chat-bubble{ background:#0e1a24; color:#e9f2f9; border:1px solid rgba(255,255,255,.08);
    border-radius:16px; padding:16px 18px; line-height:1.55; box-shadow: 0 6px 22px rgba(0,0,0,.25); }
  .chat-bubble.enter{ animation: bubbleIn .22s ease-out both; }
  @keyframes bubbleIn{ from{ transform:translateY(6px); opacity:.0 } to{ transform:translateY(0); opacity:1 } }
  .chat-toolbar{ display:flex; gap:10px; margin-top:8px; }
  .chat-toolbar button{ border:1px solid rgba(255,255,255,.15); background:#0b1218; color:#dbe6ef;
    padding:6px 10px; border-radius:10px; font-size:12px; cursor:pointer; }
  .chat-toolbar button:hover{ background:#0f1720; }
  .topic-chip{ display:inline-flex; align-items:center; gap:6px; padding:4px 10px; border-radius:999px;
    border:1px solid rgba(255,255,255,.16); background:#0b141d; color:#cfe3ff; font-size:12px; margin-bottom:8px }
  .typing-dot{ display:inline-block; width:6px; height:6px; border-radius:999px; background:#9cc3ff; margin-right:4px;
    animation: blink 1s infinite ease-in-out; }
  .typing-dot:nth-child(2){ animation-delay:.2s } .typing-dot:nth-child(3){ animation-delay:.4s }
  @keyframes blink{ 0%{ opacity:.2 } 50%{ opacity:1 } 100%{ opacity:.2 } }
  .msg h1,.msg h2,.msg h3{ margin:.5em 0 .3em; line-height:1.2; }
  .msg h1{ font-size:1.2rem } .msg h2{ font-size:1.1rem } .msg h3{ font-size:1.05rem }
  .msg p{ margin:.45em 0; }
  .msg ul{ padding-left:1.2em; margin:.35em 0; list-style: disc; }
  .msg ol{ padding-left:1.4em; margin:.35em 0; list-style: decimal; }
  .msg li{ margin:.2em 0; }
  .msg strong{ font-weight:700; }
  .msg em{ font-style:italic; }
  .msg u{ text-decoration: underline; text-underline-offset: 3px; }
  .msg del{ text-decoration: line-through; }
  .msg a{ color:#9cc3ff; text-decoration: underline; text-underline-offset:3px; }
  .msg code{ font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size:.95em; padding:.12em .3em;
    background:#0a1118; border:1px solid rgba(255,255,255,.08); border-radius:8px; }
  .chat-bubble .msg-scroll{ max-height: min(42vh, 520px); overflow:auto; scrollbar-width: thin; }
  `;
  const s = document.createElement('style');
  s.id='chatfx-css'; s.textContent = css; document.head.appendChild(s);
}

/* --- Ultra-light Markdown → HTML --- */
function mdToHtml(md){
  if (!md) return '';
  let t = md;
  t = t.replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
  t = t.replace(/[&<>]/g, s=> ({'&':'&amp;','<':'&lt;','>':'&gt;'}[s]));
  t = t.replace(/(https?:\/\/[^\s)]+)(?=\)|\s|$)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
  t = t.replace(/^[ \t]*###?[ \t]+(.+)$/gm, (m, h)=>m.startsWith('###')?`<h3>${h}</h3>`:`<h2>${h}</h2>`);
  t = t.replace(/^[ \t]*#[ \t]+(.+)$/gm, (_m, h)=>`<h1>${h}</h1>`);
  t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  t = t.replace(/__([^_]+)__/g, '<strong>$1</strong>');
  t = t.replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).,!?:;]|$)/g, '$1<em>$2</em>');
  t = t.replace(/(^|[\s(])_([^_\n]+)_(?=[\s).,!?:;]|$)/g, '$1<em>$2</em>');
  t = t.replace(/\+\+([^+\n]+)\+\+/g, '<u>$1</u>');
  t = t.replace(/~~([^~\n]+)~~/g, '<del>$1</del>');
  t = t.replace(/`([^`]+)`/g, '<code>$1</code>');
  t = t.replace(/^(?:\s*\d+\.\s.+(?:\n|$))+?/gm, (block)=>{
    const items = block.trim().split('\n').map(l=> l.replace(/^\s*\d+\.\s/,'').trim());
    return `<ol>${items.map(i=>`<li>${i}</li>`).join('')}</ol>`;
  });
  t = t.replace(/^(?:\s*[-*]\s.+(?:\n|$))+?/gm, (block)=>{
    const items = block.trim().split('\n').map(l=> l.replace(/^\s*[-*]\s/,'').trim());
    return `<ul>${items.map(i=>`<li>${i}</li>`).join('')}</ul>`;
  });
  t = t.replace(/(<li>)([^:<]+?):\s*/g, (_m, li, label)=> `${li}<strong>${label}:</strong> `);
  t = t.split(/\n{2,}/).map(chunk=>{
    if (/^<(ul|ol|h1|h2|h3)/.test(chunk)) return chunk;
    return `<p>${chunk.replace(/\n/g,'<br>')}</p>`;
  }).join('\n');
  return t;
}

// typing animation
async function typeWrite(el, text, { cps=48, minDelay=8, maxDelay=26 } = {}){
  const safe = text || '';
  let buf = '';
  const total = safe.length;
  for (let i=0;i<total;i++){
    buf += safe[i];
    el.innerHTML = mdToHtml(buf);
    const jitter = clamp(Math.random()* (maxDelay-minDelay) + minDelay, minDelay, maxDelay);
    await sleep(jitter * (60/cps));
  }
}

// single-turn bubble
function renderChat(answerText, topicLabel){
  const out = $('#askResult'); if (!out) return;
  out.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'chat-bubble enter';

  const topic = document.createElement('div');
  topic.className = 'topic-chip';
  topic.innerHTML = `<span class="typing-dot"></span><span>${topicLabel || 'Assistant'}</span>`;

  const msg = document.createElement('div');
  msg.className = 'msg msg-scroll';
  msg.innerHTML = `<span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span>`;

  const tools = document.createElement('div');
  tools.className = 'chat-toolbar';
  tools.innerHTML = `
    <button id="copyAns" title="Copy">Copy</button>
    <button id="regenAns" title="Regenerate">Regenerate</button>
  `;

  wrap.appendChild(topic);
  wrap.appendChild(msg);
  wrap.appendChild(tools);
  out.appendChild(wrap);

  typeWrite(msg, answerText, { cps: 56 }).catch(()=> { msg.innerHTML = mdToHtml(answerText); });

  tools.querySelector('#copyAns').onclick = async ()=>{
    try{
      await navigator.clipboard.writeText(answerText);
      const b = tools.querySelector('#copyAns'); b.textContent='Copied'; setTimeout(()=>b.textContent='Copy', 1200);
    }catch{}
  };
  tools.querySelector('#regenAns').onclick = ()=> $('#askBtn')?.click();
}

/* ====== Hint under search (generic) ====== */
function insertAskHint(){
  if (document.getElementById('ask-hint-row')) return;
  const search = $('#searchInput');
  if (!search) return;
  const hint = document.createElement('div');
  hint.id = 'ask-hint-row';
  hint.innerHTML = `
    <div style="margin:.5rem 0 .25rem; font-size:.92rem; color:#6e8096;">
      <strong>Tip:</strong> Ask the AI about any album — e.g. <em>Sensors</em>, <em>Fusion pipeline</em>, <em>dataset license</em>, or <em>night driving</em>.
    </div>
  `;
  search.parentElement?.insertBefore(hint, search.nextSibling);
}

/* ====== Responsive center pill between chat & gallery ====== */
function injectAskPillStylesOnce(){
  if (document.getElementById('ask-hint-pill-css')) return;
  const s = document.createElement('style');
  s.id = 'ask-hint-pill-css';
  s.textContent = `
    #album-ask-hint-row{
      display:flex; justify-content:center; align-items:center;
      width:100%;
      margin:10px 0 14px;
    }
    .ask-hint-pill{
      max-width:min(1080px, 94vw);
      width:auto;
      display:flex; justify-content:center; align-items:center; gap:.6rem;
      flex-wrap:wrap;
      padding:10px 16px;
      border-radius:999px;
      font-size:.9rem; line-height:1.35;
      text-align:center;
      color:#e8f1ff;
      background:linear-gradient(180deg, rgba(120,170,255,.18), rgba(120,170,255,.10));
      border:2px dashed rgba(150,190,255,.95);
      box-shadow: inset 0 0 0 1px rgba(255,255,255,.06), 0 6px 18px rgba(0,0,0,.22);
      backdrop-filter: blur(2px);
      word-break: keep-all;
    }
    .ask-hint-pill .spark{ filter:drop-shadow(0 0 6px rgba(150,190,255,.75)); }
    .ask-hint-pill strong{ font-weight:700; color:#f3f7ff; }
    .ask-hint-pill .examples{ display:flex; gap:.9rem; flex-wrap:wrap; }
    .ask-hint-pill .examples em{ font-style:italic; font-weight:600; opacity:.98; padding:0 .05rem; white-space:nowrap; }
    @media (max-width: 900px){
      .ask-hint-pill{ font-size:.86rem; padding:9px 14px; max-width:94vw; }
      .ask-hint-pill .examples{ gap:.6rem; }
    }
    @media (max-width: 520px){
      .ask-hint-pill{ font-size:.82rem; padding:8px 12px; border-width:1.8px; }
      .ask-hint-pill .examples{ gap:.5rem; }
    }
    @media (max-width: 380px){
      .ask-hint-pill{ font-size:.8rem; }
      .ask-hint-pill .examples em:nth-child(3),
      .ask-hint-pill .examples em:nth-child(4){ display:none; }
    }
    @media (max-width: 320px){
      .ask-hint-pill{ font-size:.78rem; padding:7px 10px; }
      .ask-hint-pill .examples em:nth-child(2){ display:none; }
    }
  `;
  document.head.appendChild(s);
}

function insertAlbumAskHintBelowChat(){
  const out = document.getElementById('askResult');
  const masonry = document.getElementById('albumMasonry');
  if (!out || !masonry) return;

  injectAskPillStylesOnce();

  let row = document.getElementById('album-ask-hint-row');
  if (!row) {
    row = document.createElement('div');
    row.id = 'album-ask-hint-row';

    const pill = document.createElement('div');
    pill.className = 'ask-hint-pill';
    pill.setAttribute('role','note');
    pill.innerHTML = `
      <span class="spark">✨</span>
      <strong>Tip:</strong>
      <span>Ask about —</span>
      <span class="examples">
        <em>“Overview”</em>
        <em>“How it works?”</em>
        <em>“Specs”</em>
        <em>“License”</em>
      </span>
    `;
    row.appendChild(pill);
  }

  // Place the pill between chat and gallery (with guard)
  const parent = masonry.parentElement;
  if (parent) {
    if (row.parentElement !== parent || row.nextSibling !== masonry) {
      parent.insertBefore(row, masonry);
    }
  }
}

/* ====== AI UI (Expert-first with topic focus + clarify) ====== */
function wireAskUI(){
  const input = $('#askInput');
  const btn   = $('#askBtn');
  const out   = $('#askResult');
  if (!input || !btn || !out) return;

  injectChatStylesOnce();
  insertAskHint();

  out.textContent = '';
  input.value = '';
  setTimeout(() => input.focus(), 50);

  const renderClarify = (choices) => {
    out.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.className = 'chat-bubble enter';
    wrap.innerHTML = `
      <div class="topic-chip"><span class="typing-dot"></span><span>What did you mean?</span></div>
      <div class="msg">
        <p>Please pick a topic so I can answer precisely:</p>
        <div style="display:flex;gap:.5rem;flex-wrap:wrap;margin-top:.4rem">
          ${choices.map(c => `<button class="chip" data-id="${c.id}">${c.label}</button>`).join('')}
        </div>
      </div>
    `;
    out.appendChild(wrap);
    wrap.querySelector('.msg').onclick = (e)=>{
      const b=e.target.closest('button[data-id]'); if(!b) return;
      ChatBrain.forceTopic(b.dataset.id);
      btn.click();
    };
  };

  const ask = async () => {
    const q = (input.value || '').trim();
    if (!q) return;

    btn.disabled = true;
    renderChat('_Thinking…_', 'Assistant');

    try {
      let routed;
      try {
        routed = await ChatBrain.ask(q);
      } catch (e) {
        if (e?.type === 'clarify') { btn.disabled = false; renderClarify(e.choices); return; }
        throw e;
      }

      let answer = '';
      try {
        answer = await expertAsk(routed.guarded);
      } catch (ex) {
        console.warn('[gallery] expertAsk failed, falling back:', ex?.message || ex);
        const ctx = buildAlbumContext(currentAlbum || ALBUMS[0]);
        answer = await aiAsk(q, ctx);
      }

      renderChat(answer || 'No answer.', routed.topic || 'Assistant');
    } catch (err) {
      console.error('[gallery] ask error:', err);
      renderChat('Sorry — the assistant had an issue. Please try again.', 'Assistant');
    } finally {
      btn.disabled = false;
    }
  };

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

  AITagStore.set(album.id, [...allTags]);

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
  document.querySelectorAll('.site-footer #year').forEach(el => {
    el.textContent = new Date().getFullYear();
  });
}

function setupHeroAnimation(){
  const h2 = document.querySelector('.hero-text h2');
  if (!h2) return;
  const words = h2.textContent.split(' ');
  h2.innerHTML = words.map(w=>`<span class="word">${w}</span>`).join(' ');
  if (window.gsap) {
    gsap.fromTo('.hero .word', {y:20, opacity:0}, {y:0, opacity:1, duration:.6, stagger:.06, ease:'power2.out', delay:.1});
  }
}

function setupLazyHero(){
  const io = new IntersectionObserver(es=>{
    es.forEach(e=>{
      if (!e.isIntersecting) return;
      const img = e.target;
      img.src = img.dataset.src;
      img.onload = ()=> img.classList.add('is-loaded');
      io.unobserve(img);
    });
  }, {rootMargin:'150px'});
  document.querySelectorAll('img.lazy-cover').forEach(i=>io.observe(i));
}

function setupChips(){
  const POPULAR = ['AAVSS','dataset','lidar','night','rain'];
  const chips = document.getElementById('chips');
  if (!chips) return;
  chips.innerHTML = POPULAR.map(t=>`<button class="chip" data-t="${t}">${t}</button>`).join('');
  chips.addEventListener('click',e=>{
    const b=e.target.closest('.chip'); if(!b) return;
    const t=b.dataset.t.toLowerCase();
    $('#searchInput').value = t;
    renderGrid(t);
  });
}

function setupSearch(){
  const search = $('#searchInput');
  if (!search) return;
  search.addEventListener('input', debounce(e=>renderGrid(e.target.value), 120));
}

/* Optional: semantic search */
const Emb = { model:null, cache:new Map(), ready:false };
async function maybeSetupSemantic(){
  if (!window.transformers) return;
  try {
    Emb.model = await window.transformers.pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    Emb.ready = true;
  } catch {}
}
function wireSemanticSearch(){
  const search = $('#searchInput');
  if (!search || !Emb.ready) return;
  function cosine(a,b){ let s=0; for(let i=0;i<a.length;i++) s+=a[i]*b[i]; return s; }
  async function embed(text){
    if (Emb.cache.has(text)) return Emb.cache.get(text);
    const out = await Emb.model(text, { pooling: 'mean', normalize: true });
    const vec = Array.from(out.data);
    Emb.cache.set(text, vec);
    return vec;
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
    const q = e.target.value.trim();
    if (!q){ renderGrid(''); return; }
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
  if (!hasRequiredEls()) {
    console.warn('[gallery] Init stopped because required elements are missing on this page.');
    return;
  }

  renderGrid();
  setupSearch();
  setupChips();
  setupResponsiveToolbar();   // phones/tablets layout
  setupHeroAnimation();
  setupLazyHero();
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
          const cx = e.clientX - b.left;
          const cy = e.clientY - b.top;
          const rx = ((cy / b.height) - .5) * -6;
          const ry = ((cx / b.width)  - .5) *  6;
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
}

document.addEventListener('DOMContentLoaded', init);
console.log('app.js fully initialized');

// Quick backend sanity ping (shows result in console)
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


/* ====== Mobile/Tablet toolbar: chips (left) + search (right) + tip below ====== */
let __toolbarState = {
  applied:false, row:null, chipsParent:null, searchParent:null,
  tipNode:null, tipParent:null, tipWasAfterSearch:false
};

function injectResponsiveToolbarStylesOnce(){
  if (document.getElementById('toolbar-mobile-css')) return;
  const s = document.createElement('style');
  s.id = 'toolbar-mobile-css';
  s.textContent = `
    @media (max-width: 1024px){
      .album-toolbar{ display:flex; align-items:center; gap:10px; width:100%; }
      .chips-scroll{
        display:flex; gap:8px; overflow-x:auto; -webkit-overflow-scrolling:touch; scrollbar-width:none;
        padding-bottom:4px; flex:1 1 50%;
        mask-image: linear-gradient(to right, transparent, #000 12px, #000 calc(100% - 12px), transparent);
      }
      .chips-scroll::-webkit-scrollbar{ display:none; }
      .search-slot{ flex:0 1 50%; min-width:180px; display:flex; }
      .search-slot input{ width:100%; box-sizing:border-box; font-size:14px; padding:9px 12px; border-radius:10px; }
      /* compact generic tip moved below toolbar */
      #ask-hint-row.ask-hint-compact{
        display:flex; justify-content:center; margin:8px auto 2px; max-width: min(840px, 96%);
        background: linear-gradient(180deg, rgba(255,255,255,.06), rgba(255,255,255,.03));
        border:1px dashed rgba(158,193,255,.55); border-radius:999px; padding:8px 12px;
        font-size:13px; color:rgba(230,240,255,.92); backdrop-filter: blur(4px);
      }
      #ask-hint-row.ask-hint-compact em{ font-style: italic; opacity:.95; white-space: nowrap; }
    }
    @media (max-width: 600px){
      .chips-scroll{ flex-basis:46%; }
      .search-slot{ flex-basis:54%; min-width:160px; }
      .search-slot input{ font-size:13.5px; padding:8px 11px; }
    }
    @media (max-width: 420px){
      .chips-scroll{ flex-basis:42%; }
      .search-slot{ flex-basis:58%; min-width:150px; }
      .search-slot input{ font-size:13px; padding:7.5px 10px; }
      #ask-hint-row.ask-hint-compact{ font-size:12.5px; padding:7px 10px; }
    }
  `;
  document.head.appendChild(s);
}

function applyMobileToolbar(){
  if (__toolbarState.applied) return;

  const chips = document.getElementById('chips');
  const input = document.getElementById('searchInput');
  if (!chips || !input) return;

  injectResponsiveToolbarStylesOnce();

  // capture the (long) generic tip that sits near the search bar
  const tip = document.getElementById('ask-hint-row'); // created by insertAskHint()
  if (tip) {
    __toolbarState.tipNode   = tip;
    __toolbarState.tipParent = tip.parentElement;
    __toolbarState.tipWasAfterSearch = (tip.previousElementSibling === input) || (tip.nextElementSibling === input);
  }

  // remember original parents
  __toolbarState.chipsParent  = chips.parentElement;
  __toolbarState.searchParent = input.parentElement;

  // row container
  const row = document.createElement('div');
  row.id = 'albumToolbarRow';
  row.className = 'album-toolbar';
  __toolbarState.chipsParent.insertBefore(row, chips);

  // left: chips (horizontal scroll)
  chips.classList.add('chips-scroll');
  row.appendChild(chips);

  // right: search
  const slot = document.createElement('div');
  slot.className = 'search-slot';
  row.appendChild(slot);
  slot.appendChild(input);

  // compact tip: move below the row (and shrink on mobile with CSS)
  if (tip) {
    tip.classList.add('ask-hint-compact');
    row.insertAdjacentElement('afterend', tip);
  }

  __toolbarState.row = row;
  __toolbarState.applied = true;
}

function removeMobileToolbar(){
  if (!__toolbarState.applied) return;

  const { row, chipsParent, searchParent, tipNode, tipParent, tipWasAfterSearch } = __toolbarState;
  const chips = document.getElementById('chips');
  const input = document.getElementById('searchInput');

  if (chips && chipsParent) {
    chips.classList.remove('chips-scroll');
    chipsParent.insertBefore(chips, row);
  }
  if (input && searchParent) {
    searchParent.appendChild(input);
  }

  // return the tip to where it was on desktop
  if (tipNode && tipParent) {
    tipNode.classList.remove('ask-hint-compact');
    if (tipWasAfterSearch && input?.parentElement) {
      input.parentElement.insertAdjacentElement('afterend', tipNode);
    } else {
      tipParent.appendChild(tipNode);
    }
  }

  row?.remove();
  __toolbarState = {
    applied:false, row:null, chipsParent:null, searchParent:null,
    tipNode:null, tipParent:null, tipWasAfterSearch:false
  };
}

function setupResponsiveToolbar(){
  const mq = window.matchMedia('(max-width: 1024px)');
  const update = () => (mq.matches ? applyMobileToolbar() : removeMobileToolbar());
  update();
  if (mq.addEventListener) mq.addEventListener('change', update);
  else mq.addListener(update); // Safari < 14
}










(function () {
  function applyTheme(theme) {
    const html = document.documentElement;
    const body = document.body;

    html.setAttribute('data-theme', theme);
    body.classList.toggle('is-dark', theme === 'dark');
    body.classList.toggle('is-light', theme === 'light');
  }

  const saved = localStorage.getItem('theme');
  const isGallery =
    /(^|\/)gallery(\.html)?(?:$|[?#/])/.test(location.pathname) ||
    /[?&]page=gallery\b/.test(location.search);

  if (saved === 'dark' || saved === 'light') {
    applyTheme(saved);
  } else if (isGallery) {
    applyTheme('dark');
  }

  document.addEventListener('click', function (e) {
    const btn = e.target.closest('.theme-toggle');
    if (!btn) return;

    const current = (document.documentElement.getAttribute('data-theme') || 'light').toLowerCase();
    const next = current === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    localStorage.setItem('theme', next);
  });
})();









   






// Paste the theme toggle script here at the end of your main JS file
(function(){
    if (!document.body.classList.contains('home')) return;

    const KEY = 'site_theme_home';
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;

    function applyTheme(mode){
        document.body.classList.remove('is-dark','is-light');
        document.body.classList.add(mode === 'dark' ? 'is-dark' : 'is-light');
        localStorage.setItem(KEY, mode);
        updateToggle(mode);
    }

    function currentTheme(){
        if (document.body.classList.contains('is-dark')) return 'dark';
        if (document.body.classList.contains('is-light')) return 'light';
        return prefersDark ? 'dark' : 'light';
    }

    function ensureToggle(){
        let btn = document.getElementById('themeToggle');
        if (!btn){
            btn = document.createElement('button');
            btn.id = 'themeToggle';
            btn.className = 'theme-toggle';
            btn.innerHTML = '<i>🌗</i><span>Dark</span>';
            btn.setAttribute('aria-pressed', 'false');
            const topbar = document.querySelector('.topbar');
            if (topbar){
                topbar.appendChild(btn);
            } else {
                document.body.appendChild(btn);
                btn.style.position = 'fixed';
                btn.style.right = '16px';
                btn.style.top = '16px';
                btn.style.zIndex = '1000';
            }
        }
        return btn;
    }

    function updateToggle(mode){
        const btn = ensureToggle();
        const span = btn.querySelector('span');
        const dark = (mode === 'dark');
        btn.setAttribute('aria-pressed', String(dark));
        if (span) span.textContent = dark ? 'Light' : 'Dark';
        btn.title = dark ? 'Switch to light theme' : 'Switch to dark theme';
    }

    const saved = localStorage.getItem(KEY);
    if (saved === 'dark' || saved === 'light') applyTheme(saved);
    else updateToggle(currentTheme());

    ensureToggle().addEventListener('click', function(){
        const next = currentTheme() === 'dark' ? 'light' : 'dark';
        applyTheme(next);
    });
})();




/* ==========================================================
   Gallery routing fix: clear ?album=… when closing overlay
   (Paste at the end of app.js — no <script> tags here)
   ========================================================== */
(function manageAlbumRouting() {
  const overlay   = document.getElementById('albumView');
  const closeBtn  = document.getElementById('closeAlbum');

  // Hide overlay + unlock scroll (uses your existing CSS classes/IDs)
  function hideOverlay() {
    if (!overlay) return;
    overlay.classList.remove('active');
    document.body.classList.remove('noscroll');
  }

  // Remove only the album query parameter and normalize the URL
  function clearAlbumParam(replace = true) {
    const url = new URL(window.location.href);
    url.searchParams.delete('album');

    // Build a clean URL for this page (keep any other params/hash if present)
    const clean =
      url.pathname +
      (url.searchParams.toString() ? `?${url.searchParams.toString()}` : '') +
      (url.hash || '');

    // Replace current history entry so refresh/back don’t reopen the album
    if (replace) {
      history.replaceState({ view: 'grid' }, '', clean);
    } else {
      history.pushState({ view: 'grid' }, '', clean);
    }
  }

  // Close button → hide and clear query
  closeBtn && closeBtn.addEventListener('click', () => {
    hideOverlay();
    clearAlbumParam(true); // replaceState so refresh stays on the grid
  });

  // Keep Back/Forward in sync: if URL has no ?album, ensure overlay is closed
  window.addEventListener('popstate', () => {
    const hasAlbum = new URLSearchParams(location.search).has('album');
    if (!hasAlbum) {
      hideOverlay();
    }
    // If hasAlbum, your existing code that reacts to URL (if any) can open it.
  });
})();
