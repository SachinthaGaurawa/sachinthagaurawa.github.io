// Helpers
const $  = (s, p=document) => p.querySelector(s);
const $$ = (s, p=document) => [...p.querySelectorAll(s)];

// Data (swap with your real media)
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

/* ---------- OUTSIDE: album list ---------- */
const grid = $('#albumGrid');
function renderGrid(term=""){
  const t = term.trim().toLowerCase();
  grid.innerHTML = "";
  ALBUMS.filter(a => !t || a.title.toLowerCase().includes(t) || a.tags.join(" ").toLowerCase().includes(t))
    .forEach(a=>{
      const hasVideo = a.media.some(m=>m.type!=="image");
      const card = document.createElement('article');
      card.className='card'; card.setAttribute('role','button');
      card.innerHTML = `
        <img src="${a.cover}" alt="${a.title} cover" loading="lazy">
        <div class="label"><div class="title">${a.title}</div></div>
        ${hasVideo?`<div class="badge-video" title="Contains video"><i class="fa-solid fa-play"></i></div>`:""}
      `;
      // AOS for cards
      card.setAttribute('data-aos','zoom-in');
      card.setAttribute('data-aos-delay', String(60 * (grid.children.length % 5)));

      card.addEventListener('click', ()=> openAlbum(a.id, 0, true));
      grid.appendChild(card);
    });

  // Refresh AOS after cards inserted
  if (window.AOS) AOS.refresh();
}
renderGrid();
$('#searchInput').addEventListener('input', e=>renderGrid(e.target.value));

/* ---------- INSIDE: page ---------- */
const albumView   = $('#albumView');
const heroLink    = $('#albumHeroLink');
const heroImg     = $('#albumHeroImg');
const heroTitle   = $('#albumHeroTitle');
const descBox     = $('#albumDesc');
const masonry     = $('#albumMasonry');

let currentAlbum=null, currentIndex=0;

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
    return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : currentAlbum.cover;
  }
  return currentAlbum.cover;
}

/* ---------- FOOTER HELPERS (no fetch; works offline) ---------- */
function updateAllFooterYears() {
  document.querySelectorAll('.site-footer #year').forEach(el => {
    el.textContent = new Date().getFullYear();
  });
}

function ensureAlbumFooter() {
  const mainFooter = document.querySelector('body > .site-footer');
  if (!mainFooter || !albumView) return;

  // avoid duplicates
  const existing = albumView.querySelector('.site-footer.overlay-footer');
  if (existing) return;

  // clone & sanitize
  const clone = mainFooter.cloneNode(true);
  clone.classList.add('overlay-footer');
  clone.setAttribute('role','contentinfo');

  // remove duplicate ids + set year
  clone.querySelectorAll('#year').forEach(el => {
    el.removeAttribute('id');
    el.textContent = new Date().getFullYear();
  });

  // make sure it's visible in overlay regardless of external CSS
  Object.assign(clone.style, {
    width: 'min(1200px,95vw)',
    margin: '28px auto 44px',
    position: 'relative',
    zIndex: '1'
  });

  // insert right after the masonry grid so users actually see it
  const mediaSection = masonry?.parentElement || albumView;
  mediaSection.after(clone);

  if (window.AOS) AOS.refresh();
}

function removeAlbumFooter() {
  const f = albumView.querySelector('.site-footer.overlay-footer');
  if (f) f.remove();
}

// set year in the main footer on load
updateAllFooterYears();

/* ---------- OPEN/CLOSE ALBUM ---------- */
function openAlbum(id, index=0, push=false){
  const a=findAlbum(id); if(!a) return;
  currentAlbum=a; currentIndex=index;

  // banner + desc
  heroImg.src=a.cover; heroImg.alt=`${a.title} cover`;
  heroTitle.textContent=a.title; heroLink.href=a.cover;
  descBox.textContent=a.description;

  // masonry
  masonry.innerHTML="";
  a.media.forEach((m,i)=>{
    const tile=document.createElement('div'); 
    tile.className='m-item';

    // eager-load first 2 to avoid Safari lazy+columns glitch
    const lazyAttr = i < 2 ? "" : ' loading="lazy"';

    tile.innerHTML = `<img src="${thumbFor(m)}" alt="${a.title} ${i+1}"${lazyAttr}>`
                   + (m.type!=='image'?`<div class="play"><i class="fa-solid fa-play"></i></div>`:"");

    // No AOS on tiles (overlay scroll); GSAP handles reveal
    tile.addEventListener('click', ()=> openViewer(i));
    masonry.appendChild(tile);
  });

  // show page
  albumView.classList.add('active'); 
  albumView.setAttribute('aria-hidden','false');
  gsap.fromTo('.album-hero',{opacity:.6,y:10},{opacity:1,y:0,duration:.35,ease:'power2.out'});

  // Animate tiles in with GSAP
  const tiles = $$('#albumMasonry .m-item');
  if (tiles.length){
    gsap.from(tiles, {opacity:0, y:16, duration:.35, ease:'power2.out', stagger:0.05, clearProps:'all'});
  }

  // Keep AOS for banner/desc only
  if (window.AOS) {
    AOS.refresh();
  }

  // add footer inside overlay (after media section)
  ensureAlbumFooter();

  if(push){
    const u=new URL(location.href);
    u.searchParams.set('album',id);
    history.pushState({album:id},"",u);
  }
}

function closeAlbum(){
  // remove overlay footer copy
  removeAlbumFooter();

  closeViewer(); // ensure viewer closed
  gsap.to('#albumView',{opacity:0,duration:.2,ease:'power2.in',onComplete:()=>{
    albumView.classList.remove('active'); albumView.style.opacity="";
    albumView.setAttribute('aria-hidden','true');
  }});
}
$('#closeAlbum').addEventListener('click', closeAlbum);

/* ---------- CLICK LIGHTBOX ---------- */
const viewer   = $('#viewerOverlay');
const stage    = $('#stage');
const vClose   = $('#viewerClose');
const peekPrev = $('#peekPrev');
const peekNext = $('#peekNext');

function openViewer(i){
  currentIndex = i;
  document.body.classList.add('noscroll');
  viewer.classList.add('active'); viewer.setAttribute('aria-hidden','false');
  loadMedia();
  gsap.fromTo('.viewer-shell',{y:18,opacity:0},{y:0,opacity:1,duration:.25});
}
function closeViewer(){
  stopYouTube();
  gsap.to('.viewer-shell',{y:14,opacity:0,duration:.18,onComplete:()=>{
    viewer.classList.remove('active'); viewer.setAttribute('aria-hidden','true');
    document.body.classList.remove('noscroll'); stage.innerHTML='';
    gsap.set('.viewer-shell',{y:0,opacity:1});
  }});
}
vClose.addEventListener('click', closeViewer);

function previewSrc(m){ return m.type==='image'?m.src:thumbFor(m); }

let ytIframe=null;
function ytCommand(func){
  if(!ytIframe) return;
  ytIframe.contentWindow?.postMessage(JSON.stringify({event:"command",func, args:[]}),"*");
}
function stopYouTube(){
  if(ytIframe){ try{ ytCommand('stopVideo'); }catch(_){ } ytIframe=null; }
}

function loadMedia(dir=0){
  const m=currentAlbum.media[currentIndex];
  stage.innerHTML=''; ytIframe=null;

  let el;
  if(m.type==='image'){
    el=document.createElement('img');
    el.src=m.src; el.alt=currentAlbum.title; el.loading='lazy';
    // images naturally scale via CSS (object-fit: contain)
  }else if(m.type==='video'){
    el=document.createElement('video');
    el.src=m.src;
    el.controls=true; el.playsInline=true; el.muted=true; el.autoplay=true;
    // Force fill like images:
    el.style.width="100%";
    el.style.height="100%";
    el.addEventListener('click', ()=> el.paused?el.play():el.pause());
  }else{ // youtube iframe
    const url=new URL(m.src);
    url.searchParams.set('enablejsapi','1');
    url.searchParams.set('rel','0');
    url.searchParams.set('modestbranding','1');
    url.searchParams.set('autoplay','1');
    url.searchParams.set('mute','1');
    url.searchParams.set('origin', location.origin);

    el=document.createElement('iframe');
    // DO NOT set el.width/el.height attributes (kept small)!
    el.src=url.toString();
    el.allow="autoplay; encrypted-media; picture-in-picture";
    el.allowFullscreen=true; el.title="YouTube video player"; el.id=`yt_${Date.now()}`;

    // Force fill the stage (Safari respects inline style best)
    el.style.width="100%";
    el.style.height="100%";

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

/* Viewer nav + input */
function nav(d){
  stopYouTube();
  const L=currentAlbum.media.length;
  currentIndex=(currentIndex+d+L)%L;
  loadMedia(d);
}
$('#prevBtn').addEventListener('click', ()=>nav(-1));
$('#nextBtn').addEventListener('click', ()=>nav(1));

document.addEventListener('keydown', e=>{
  if(viewer.classList.contains('active')){
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
  // album page level
  if(albumView.classList.contains('active') && e.key==='Escape'){ closeAlbum(); }
});

/* Swipe inside viewer */
let startX=0;
stage.addEventListener('pointerdown', e=> startX=e.clientX);
stage.addEventListener('pointerup',   e=> { const dx=e.clientX-startX; if(Math.abs(dx)>40) nav(dx<0?1:-1); });

/* Deep link */
window.addEventListener('popstate', ()=>{
  const id=new URL(location.href).searchParams.get('album');
  if(id) openAlbum(id,0,false); else closeAlbum();
});

// On first load: open album only if param is present; otherwise ensure album page is hidden
(function(){
  const id=new URL(location.href).searchParams.get('album');
  if(id){
    openAlbum(id,0,false);
  }else{
    // safety: make sure the album overlay is not visible
    albumView.classList.remove('active');
    albumView.setAttribute('aria-hidden','true');
  }
})();

/* =========================
   NEXT-LEVEL MOTION LAYER
   ========================= */
window.addEventListener('load', () => {
  if (!window.gsap) return;

  // Register ScrollTrigger if present
  if (window.ScrollTrigger) gsap.registerPlugin(ScrollTrigger);

  // --- Global: outside hero parallax (Framer-ish) ---
  const heroImgEl = document.querySelector('.hero-media img');
  const heroWrap = document.querySelector('.hero-media');
  if (heroImgEl && window.ScrollTrigger) {
    gsap.fromTo(heroImgEl, {scale:1.08, y:0}, {
      scale:1,
      y:-30,
      ease:'power2.out',
      scrollTrigger:{
        trigger: heroWrap,
        start: 'top top',
        end: 'bottom top',
        scrub: true
      }
    });
  }

  // --- Card tilt (desktop only) ---
  const supportsFinePointer = matchMedia('(hover:hover) and (pointer:fine)').matches;
  if (supportsFinePointer) {
    const cards = document.querySelectorAll('.card');
    cards.forEach(card => {
      let rAF = 0;
      const onMove = (e) => {
        cancelAnimationFrame(rAF);
        rAF = requestAnimationFrame(()=>{
          const b = card.getBoundingClientRect();
          const cx = e.clientX - b.left;
          const cy = e.clientY - b.top;
          const rx = ((cy / b.height) - .5) * -6; // tilt X
          const ry = ((cx / b.width)  - .5) *  6; // tilt Y
          card.style.transform = `translateY(-6px) rotateX(${rx}deg) rotateY(${ry}deg)`;
        });
      };
      const reset = () => { card.style.transform = ''; };
      card.addEventListener('mousemove', onMove);
      card.addEventListener('mouseleave', reset);
    });
  }

  // --- Album overlay animations (auto-detected) ---
  const albumEl = document.getElementById('albumView');

  function animateAlbumOnceVisible(){
    // Banner parallax: image + mega title
    const banner = document.querySelector('.album-hero.slim');
    const bannerImg = document.getElementById('albumHeroImg');
    const bannerH2  = document.getElementById('albumHeroTitle');

    if (banner && bannerImg && window.ScrollTrigger) {
      ScrollTrigger.getAll().forEach(t => {
        // Clean old triggers bound to banner to avoid duplicates
        if (t.trigger === banner) t.kill();
      });

      gsap.fromTo(bannerImg, {scale:1.1, y:0}, {
        scale:1,
        y:-40,
        ease:'power2.out',
        scrollTrigger:{
          trigger: banner,
          start: 'top top',
          end: '+=40%',
          scrub: true,
          scroller: albumEl   // <— scrolls inside overlay
        }
      });

      gsap.fromTo(bannerH2, {y:20, opacity:0.001}, {
        y:0,
        opacity:1,
        ease:'power2.out',
        scrollTrigger:{
          trigger: banner,
          start: 'top center',
          end: '+=20%',
          scrub: true,
          scroller: albumEl
        }
      });
    }

    // Description float-in (GSAP so it works inside overlay)
    const desc = document.querySelector('.album-desc-block');
    if (desc && window.ScrollTrigger) {
      gsap.fromTo(desc, {opacity:0, y:16}, {
        opacity:1, y:0, duration:.6, ease:'power2.out',
        scrollTrigger:{
          trigger: desc,
          start: 'top 85%',
          scroller: albumEl
        }
      });
    }

    // Masonry stagger (works in overlay; avoids AOS opacity lock)
    const tiles = document.querySelectorAll('#albumMasonry .m-item');
    if (tiles.length) {
      gsap.from(tiles, {
        opacity:0, y:20, duration:.35, ease:'power2.out',
        stagger:0.05, clearProps:'all',
        scrollTrigger: window.ScrollTrigger ? {
          trigger: tiles[0].parentElement,
          start: 'top 90%',
          scroller: albumEl
        } : undefined
      });
    }
  }

  // Observe when #albumView becomes active, then animate
  const mo = new MutationObserver(()=> {
    if (albumEl.classList.contains('active')) {
      // Delay a tick so images are in the DOM
      requestAnimationFrame(()=> animateAlbumOnceVisible());
    }
  });
  mo.observe(albumEl, { attributes:true, attributeFilter:['class'] });

  // If an album is already open via ?album=… on load, animate it
  if (albumEl.classList.contains('active')) {
    animateAlbumOnceVisible();
  }
});



function ensureAlbumFooter() {
  const mainFooter = document.querySelector('body > .site-footer');
  if (!mainFooter || !albumView) return;

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

  // ⬇️ Always append into albumView to avoid edge-case reflows
  const insertionPoint = masonry?.parentElement && albumView.contains(masonry.parentElement)
    ? masonry.parentElement.nextSibling
    : null;

  if (insertionPoint) {
    albumView.insertBefore(clone, insertionPoint);
  } else {
    albumView.appendChild(clone);
  }

  if (window.AOS) AOS.refresh();
}




/* ===== Footer: reuse the same footer everywhere ===== */
function setFooterYear(scope=document){
  scope.querySelectorAll('#year').forEach(el => {
    el.textContent = new Date().getFullYear();
  });
}

function mountFooterInto(target){
  const base = document.getElementById('siteFooter'); // canonical footer on home
  if (!base || !target) return;

  // If this target already has a footer, skip
  if (target.querySelector('.site-footer')) return;

  const clone = base.cloneNode(true);
  clone.id = ''; // avoid duplicate id in DOM
  // ensure the year inside the clone is correct
  setFooterYear(clone);

  target.appendChild(clone);
  if (window.AOS) AOS.refresh();
}

function removeFooterFrom(target){
  const f = target?.querySelector?.('.site-footer');
  if (f) f.remove();
}

// On initial page load, set the year in the main footer
setFooterYear(document);


// after DOM ready
const h2 = document.querySelector('.hero-text h2');
if (h2 && window.gsap) {
  const words = h2.textContent.split(' ');
  h2.innerHTML = words.map(w=>`<span class="word">${w}</span>`).join(' ');
  gsap.fromTo('.hero .word',
    {y:20, opacity:0},
    {y:0, opacity:1, duration:.6, stagger:.06, ease:'power2.out', delay:.1}
  );
}



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



const POPULAR = ['AAVSS','dataset','lidar','night','rain'];
const chips = document.getElementById('chips');
chips.innerHTML = POPULAR.map(t=>`<button class="chip" data-t="${t}">${t}</button>`).join('');
chips.addEventListener('click',e=>{
  const b=e.target.closest('.chip'); if(!b) return;
  const t=b.dataset.t.toLowerCase();
  document.getElementById('searchInput').value = t;
  renderGrid(t);
});


function withWillChange(el, fn){
  el.style.willChange = 'transform, opacity';
  requestAnimationFrame(()=> {
    fn();
    setTimeout(()=> el.style.willChange = '', 600);
  });
}



// Semantic search enhancer
const Emb = { model: null, cache: new Map() };

async function loadEmbedder(){
  if (Emb.model) return Emb.model;
  Emb.model = await window.transformers.pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  return Emb.model;
}

async function embed(text){
  if (Emb.cache.has(text)) return Emb.cache.get(text);
  const pipe = await loadEmbedder();
  const out = await pipe(text, { pooling: 'mean', normalize: true });
  const vec = Array.from(out.data);
  Emb.cache.set(text, vec);
  return vec;
}

function cosine(a,b){ let s=0; for(let i=0;i<a.length;i++) s+=a[i]*b[i]; return s; }

// Precompute album embeddings once
let ALBUM_VECS = null;
async function ensureAlbumVecs(){
  if (ALBUM_VECS) return;
  ALBUM_VECS = await Promise.all(ALBUMS.map(async (a) => {
    const text = `${a.title}. ${a.description}. ${a.tags.join(' ')}`;
    return { id:a.id, v: await embed(text) };
  }));
}

// Hook your existing search input
const search = document.getElementById('searchInput');
if (search){
  search.addEventListener('input', async (e)=>{
    const q = e.target.value.trim();
    if (!q){ renderGrid(''); return; }             // fallback shows all
    await ensureAlbumVecs();
    const qv = await embed(q);

    // combine semantic score with keyword bonus to keep exact matches snappy
    const ranked = await Promise.all(ALBUMS.map(async (a, i) => {
      const kw = (a.title + ' ' + a.tags.join(' ') + ' ' + a.description).toLowerCase();
      const kwBoost = kw.includes(q.toLowerCase()) ? 0.15 : 0;   // small bump
      const sem = cosine(qv, ALBUM_VECS[i].v);
      return { a, score: sem + kwBoost };
    }));
    ranked.sort((x,y)=> y.score - x.score);
    grid.innerHTML = '';
    ranked.forEach(({a}) => addCard(a));          // reuse your card creator
  });
}

function addCard(a){
  const hasVideo = a.media.some(m=>m.type!=="image");
  const card = document.createElement('article');
  card.className='card'; card.setAttribute('role','button');
  card.innerHTML = `
    <img class="lazy" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==" 
         data-src="${a.cover}" alt="${a.title} cover">
    <div class="label"><div class="title">${a.title}</div></div>
    ${hasVideo?`<div class="badge-video" title="Contains video"><i class="fa-solid fa-play"></i></div>`:""}
  `;
  card.addEventListener('click', ()=> openAlbum(a.id, 0, true));
  grid.appendChild(card);
}



async function askAboutAlbum(q){
  if (!currentAlbum) return;
  const context = `Title: ${currentAlbum.title}
Description: ${currentAlbum.description}
Tags: ${currentAlbum.tags.join(', ')}
Media: ${currentAlbum.media.map(m=>m.type).join(', ')}`;

  // POST to your serverless endpoint that calls your LLM
  const res = await fetch('/api/ask', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ question:q, context })
  });
  const { answer } = await res.json();
  $('#askResult').textContent = answer || 'No answer.';
}
$('#askBtn')?.addEventListener('click', ()=> askAboutAlbum($('#askInput').value));


/* ========= ALBUM AI: Ask this album ========= */
function buildAlbumContext(album){
  if (!album) return "";
  const mediaList = album.media.map(m => `${m.type}${m.src?`:${m.src}`:""}`).join('\n');
  return [
    `Title: ${album.title}`,
    `Description: ${album.description}`,
    `Tags: ${album.tags?.join(', ') || ''}`,
    `Media:\n${mediaList}`
  ].join('\n');
}

async function askAboutAlbum(question){
  const input = document.getElementById('askInput');
  const btn   = document.getElementById('askBtn');
  const out   = document.getElementById('askResult');

  if (!question || !currentAlbum) return;
  const context = buildAlbumContext(currentAlbum);

  btn.disabled = true;
  out.textContent = 'Thinking…';

  try{
    const res = await fetch('/api/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question,
        context,
        // optional: send album id so you can cache answers per album
        albumId: currentAlbum.id
      })
    });
    if (!res.ok){
      const text = await res.text();
      throw new Error(text || `HTTP ${res.status}`);
    }
    const data = await res.json();
    out.textContent = data.answer || 'No answer.';
  }catch(err){
    console.error(err);
    out.textContent = 'Sorry — the assistant had an issue. Please try again.';
  }finally{
    btn.disabled = false;
  }
}

/* wire up UI */
function wireAskUI(){
  const input = document.getElementById('askInput');
  const btn   = document.getElementById('askBtn');
  const out   = document.getElementById('askResult');
  if (!input || !btn || !out) return;

  // clear & focus whenever an album opens
  out.textContent = '';
  input.value = '';
  setTimeout(()=> input.focus(), 50);

  btn.onclick = () => askAboutAlbum(input.value.trim());
  input.onkeydown = (e) => {
    if (e.key === 'Enter') askAboutAlbum(input.value.trim());
  };
}

/* call wireAskUI at the end of openAlbum() */
const _openAlbumOriginal = openAlbum;
openAlbum = function(id, index=0, push=false){
  _openAlbumOriginal(id, index, push);
  wireAskUI();
};


// Tiny prefetch on hover
grid?.addEventListener('mouseover', (e)=>{
  const card = e.target.closest('.card'); if(!card) return;
  const img = card.querySelector('img[data-src], img[src]');
  const url = img?.getAttribute('data-src') || img?.src;
  if (!url) return;
  const link = document.createElement('link');
  link.rel='prefetch'; link.as='image'; link.href=url;
  document.head.appendChild(link);
});






// ---- Smart captions client helpers ----
const CaptionStore = {
  get(key){ try { return JSON.parse(localStorage.getItem('cap:'+key)); } catch { return null; } },
  set(key,val){ try { localStorage.setItem('cap:'+key, JSON.stringify(val)); } catch {} }
};

async function fetchCaption(imageUrl){
  const cached = CaptionStore.get(imageUrl);
  if (cached) return cached;

  const r = await fetch('/api/caption', {
    method:'POST',
    headers:{ 'Content-Type':'application/json' },
    body: JSON.stringify({ imageUrl })
  });
  if (!r.ok) throw new Error('caption http '+r.status);
  const data = await r.json();
  CaptionStore.set(imageUrl, data);
  return data;
}

async function captionImagesInAlbum(album){
  if (!album) return { items:[], allTags:new Set() };
  const items = [];
  const allTags = new Set();

  // only images (skip video/youtube)
  const imgs = album.media
    .map((m,i)=> ({...m, index:i}))
    .filter(m => m.type === 'image');

  for (const m of imgs) {
    try {
      const data = await fetchCaption(m.src);
      items.push({ index:m.index, src:m.src, ...data });
      data.tags?.forEach(t=> allTags.add(t));
      // annotate tile if present
      const tile = $$('#albumMasonry .m-item')[m.index];
      if (tile) {
        tile.setAttribute('title', data.caption);
        // optional: small tag row
        let tr = tile.querySelector('.mini-tags');
        if (!tr) {
          tr = document.createElement('div');
          tr.className = 'mini-tags';
          tile.appendChild(tr);
        }
        tr.innerHTML = (data.tags||[]).slice(0,3).map(t=>`<span class="mini-chip">${t}</span>`).join('');
      }
    } catch(e){
      // ignore single failures
    }
  }
  return { items, allTags };
}







openAlbum = function(id, index=0, push=false){
  _openAlbumOriginal(id, index, push);
  wireAskUI();

  // After tiles exist, start captions (non-blocking)
  captionImagesInAlbum(currentAlbum).then(({ allTags }) => {
    // surface album-level tags below the description
    const desc = document.querySelector('.album-desc-inner');
    if (!desc) return;
    let row = document.getElementById('album-ai-tags');
    if (!row) {
      row = document.createElement('div');
      row.id = 'album-ai-tags';
      row.className = 'tag-chips';
      desc.appendChild(row);
    }
    row.innerHTML = [...allTags].slice(0,12).map(t=>`<button class="chip" data-t="${t}">${t}</button>`).join('');
    row.onclick = (e)=>{
      const b=e.target.closest('.chip'); if (!b) return;
      const t=b.dataset.t;
      document.getElementById('searchInput').value = t;
      renderGrid(t);
    };
  });
};







function buildAlbumContext(album){
  if (!album) return "";
  const mediaLines = album.media.map((m,i)=> `${i+1}. ${m.type}${m.src?`:${m.src}`:""}`).join('\n');

  // pull any cached captions we already have
  const caps = album.media
    .map(m => m.type==='image' ? CaptionStore.get(m.src) : null)
    .filter(Boolean)
    .map((c, idx) => `img#${idx+1}: ${c.caption} | tags: ${(c.tags||[]).join(', ')}`)
    .join('\n');

  return [
    `Title: ${album.title}`,
    `Description: ${album.description}`,
    `Tags: ${album.tags?.join(', ') || ''}`,
    `Media:\n${mediaLines}`,
    caps ? `Captions:\n${caps}` : ''
  ].filter(Boolean).join('\n');
}
