/* -----------------------------------------------------------
   Album Gallery + Overlay + Viewer + (AI Ask & Captions)
   Works on static hosting (GitHub Pages) with a remote API.
   ----------------------------------------------------------- */

/* ====== CONFIG (ONE LINE only) ======
   For local dev (running server.js locally): 'http://localhost:8787'
*/
const API_BASE = (window.__API_BASE__ || 'https://album-ai-backend-new.vercel.app').replace(/\/+$/,'');

console.log('[gallery] app.js loaded, API_BASE =', API_BASE);

// Show any uncaught errors so we don’t silently fail
window.addEventListener('error', (e) => {
  console.error('[gallery] Uncaught error:', e.message, 'at', e.filename + ':' + e.lineno);
});

/* ====== tiny helpers ====== */
const $  = (s, p=document) => p.querySelector(s);
const $$ = (s, p=document) => [...p.querySelectorAll(s)];
const sleep = (ms)=> new Promise(r=>setTimeout(r,ms));

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

/* ====== API helpers (unified /api/ai) ====== */
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
      if (attempt < retries) {
        await sleep(400 * (attempt + 1));
        continue;
      }
      console.error('[gallery] postJSON failed:', err);
      throw err;
    }
  }
}

async function aiAsk(question, context) {
  const j = await postJSON(`${API_BASE}/api/ai`, {
    mode: 'ask',
    question,
    context
  }, { retries: 0 });
  return j?.answer || '';
}

async function aiCaption(imageUrl) {
  const j = await postJSON(`${API_BASE}/api/ai`, {
    mode: 'caption',
    imageUrl
  }, { retries: 0 });
  // { caption, tags }
  return j;
}

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

function renderGrid(term = "") {
  if (!grid) return;
  const t = term.trim().toLowerCase();

  grid.innerHTML = "";

  ALBUMS
    .filter(a => {
      if (!t) return true;
      const aiTags = (AITagStore.get(a.id) || []).join(" ");
      const builtin = (a.tags || []).join(" ");
      const hay = [
        a.title || "",
        a.description || "",
        builtin,
        aiTags
      ].join(" ").toLowerCase();
      return hay.includes(t);
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
  wireAskUI();         // ensure AI input is wired on open

  if(push){
    const u=new URL(location.href);
    u.searchParams.set('album',id);
    history.pushState({album:id},"",u);
  }

  // kick off AI captions (non-blocking)
  captionImagesInAlbum(currentAlbum).catch(err=>{
    console.warn('[gallery] captionImagesInAlbum error:', err?.message || err);
  });
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

async function askAboutAlbum(question){
  const input = $('#askInput');
  const btn   = $('#askBtn');
  const out   = $('#askResult');

  if (!question || !currentAlbum || !out || !btn) return;
  const context = buildAlbumContext(currentAlbum);

  btn.disabled = true;
  out.textContent = 'Thinking…';

  try{
    const answer = await aiAsk(question, context);
    out.textContent = answer || 'No answer.';
  }catch(err){
    console.error('[gallery] ask error:', err);
    out.textContent = 'Sorry — the assistant had an issue. Please try again.';
  }finally{
    btn.disabled = false;
  }
}

function wireAskUI(){
  const input = $('#askInput');
  const btn   = $('#askBtn');
  const out   = $('#askResult');
  if (!input || !btn || !out) return;
  out.textContent = '';
  input.value = '';
  setTimeout(()=> input.focus(), 50);
  btn.onclick = () => askAboutAlbum(input.value.trim());
  input.onkeydown = (e) => { if (e.key === 'Enter') askAboutAlbum(input.value.trim()); };
}

/* ====== AI: Smart image captions (optional) ====== */
const CaptionStore = {
  get(key){ try { return JSON.parse(localStorage.getItem('cap:'+key)); } catch { return null; } },
  set(key,val){ try { localStorage.setItem('cap:'+key, JSON.stringify(val)); } catch {} }
};

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
        tile.setAttribute('title', data.caption);
        let tr = tile.querySelector('.mini-tags');
        if (!tr) { tr = document.createElement('div'); tr.className = 'mini-tags'; tile.appendChild(tr); }
        tr.innerHTML = (data.tags||[]).slice(0,3).map(t=>`<span class="mini-chip">${t}</span>`).join('');
      }
      (data.tags||[]).forEach(t=> allTags.add(t));
    } catch(err){
      console.warn('[gallery] caption error:', err?.message || err);
    }
  }

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
    gsap.fromTo('.hero .word',
      {y:20, opacity:0},
      {y:0, opacity:1, duration:.6, stagger:.06, ease:'power2.out', delay:.1}
    );
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
  search.addEventListener('input', e=>renderGrid(e.target.value));
}

/* Optional: semantic search (only if transformers loaded) */
const Emb = { model:null, cache:new Map(), ready:false };
async function maybeSetupSemantic(){
  if (!window.transformers) return; // library not loaded
  try {
    Emb.model = await window.transformers.pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    Emb.ready = true;
  } catch { /* ignore */ }
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
  search.addEventListener('input', async (e)=>{
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
  });
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

  // grid + search
  renderGrid();
  setupSearch();
  setupChips();

  // hero + lazy
  setupHeroAnimation();
  setupLazyHero();

  // footer year
  updateAllFooterYears();

  // parallax hero (optional)
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

  // card tilt (desktop only)
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

  // open deep-linked album (if any)
  const id=new URL(location.href).searchParams.get('album');
  if(id) openAlbum(id,0,false);

  // semantic search (optional)
  maybeSetupSemantic().then(wireSemanticSearch);
}

document.addEventListener('DOMContentLoaded', init);
console.log('app.js fully initialized');

// Quick backend sanity ping (shows result in console)
fetch(`${API_BASE}/api/ai`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    mode: 'ask',
    question: 'Ping from browser',
    context: 'Test context'
  })
})
  .then(async r => {
    const t = await r.text();
    console.log('[gallery] API ping →', t);
    if (!r.ok) {
      console.warn('[gallery] Ping failed. Check CORS_ORIGINS on backend and API_BASE here.');
    }
  })
  .catch(err => console.error('[gallery] API ping failed:', err));





/* ====== Persisted album-level AI tags (used by global search) ====== */
const AITagStore = {
  key(id) { return `ai-tags:album:${id}`; },
  get(id) {
    try { return JSON.parse(localStorage.getItem(this.key(id)) || '[]'); }
    catch { return []; }
  },
  set(id, tagsArr) {
    try {
      const uniq = Array.from(new Set((tagsArr || []).map(t => String(t).trim()).filter(Boolean)));
      localStorage.setItem(this.key(id), JSON.stringify(uniq));
      return uniq;
    } catch { return []; }
  }
};
