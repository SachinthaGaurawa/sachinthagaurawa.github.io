// app.js (clean, complete, no duplicates)
// All code is scoped so we don't leak globals or collide with other pages.
(() => {
  'use strict';

  /* =========================
   * Helpers
   * ========================= */
  const $  = (s, p=document) => p.querySelector(s);
  const $$ = (s, p=document) => [...p.querySelectorAll(s)];

  // Runtime API base:
  // - override by setting window.__API_BASE__ before loading this script
  // - falls back to localhost in dev, Vercel (or your server) in prod
  const API_BASE =
    window.__API_BASE__ ||
    (['localhost','127.0.0.1'].includes(location.hostname)
      ? 'http://localhost:8787'
      : 'https://album-ai-api.vercel.app');

  async function postJSON(path, payload) {
    const r = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!r.ok) {
      const txt = await r.text().catch(()=>'');
      throw new Error(`HTTP ${r.status} ${r.statusText} — ${txt}`);
    }
    return r.json();
  }

  /* =========================
   * Demo data (replace with real)
   * ========================= */
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

  /* =========================
   * State + DOM refs
   * ========================= */
  const grid       = $('#albumGrid');
  const albumView  = $('#albumView');
  const heroLink   = $('#albumHeroLink');
  const heroImg    = $('#albumHeroImg');
  const heroTitle  = $('#albumHeroTitle');
  const descBox    = $('#albumDesc');
  const masonry    = $('#albumMasonry');
  let currentAlbum = null;
  let currentIndex = 0;

  /* =========================
   * Utilities
   * ========================= */
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

  function updateAllFooterYears() {
    document.querySelectorAll('.site-footer #year').forEach(el => {
      el.textContent = new Date().getFullYear();
    });
  }

  /* =========================
   * Grid rendering + search
   * ========================= */
  function cardHTML(a){
    const hasVideo = a.media.some(m=>m.type!=="image");
    return `
      <img class="card-cover" src="${a.cover}" alt="${a.title} cover" loading="lazy">
      <div class="label"><div class="title">${a.title}</div></div>
      ${hasVideo?`<div class="badge-video" title="Contains video"><i class="fa-solid fa-play"></i></div>`:""}
    `;
  }

  function addCard(a){
    const card = document.createElement('article');
    card.className='card'; 
    card.setAttribute('role','button');
    card.setAttribute('data-aos','zoom-in');
    card.setAttribute('data-aos-delay', String(60 * (grid.children.length % 5)));
    card.innerHTML = cardHTML(a);
    card.addEventListener('click', ()=> openAlbum(a.id, 0, true));
    grid.appendChild(card);
  }

  function renderGrid(term=""){
    if (!grid) return;
    const t = term.trim().toLowerCase();
    grid.innerHTML = "";
    ALBUMS
      .filter(a => !t || a.title.toLowerCase().includes(t) || a.tags.join(" ").toLowerCase().includes(t))
      .forEach(addCard);

    if (window.AOS) AOS.refresh();
  }

  /* =========================
   * Footer clone inside overlay
   * ========================= */
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

    const insertionPoint = masonry?.parentElement && albumView.contains(masonry.parentElement)
      ? masonry.parentElement.nextSibling
      : null;

    if (insertionPoint) albumView.insertBefore(clone, insertionPoint);
    else albumView.appendChild(clone);

    if (window.AOS) AOS.refresh();
  }

  function removeAlbumFooter() {
    const f = albumView?.querySelector('.site-footer.overlay-footer');
    if (f) f.remove();
  }

  /* =========================
   * Album open/close
   * ========================= */
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
      const lazyAttr = i < 2 ? "" : ' loading="lazy"';
      tile.innerHTML = `<img src="${thumbFor(m)}" alt="${a.title} ${i+1}"${lazyAttr}>`
                     + (m.type!=='image'?`<div class="play"><i class="fa-solid fa-play"></i></div>`:"");
      tile.addEventListener('click', ()=> openViewer(i));
      masonry.appendChild(tile);
    });

    // show page
    albumView.classList.add('active'); 
    albumView.setAttribute('aria-hidden','false');

    // GSAP banner + tiles
    if (window.gsap){
      window.gsap.fromTo('.album-hero',{opacity:.6,y:10},{opacity:1,y:0,duration:.35,ease:'power2.out'});
      const tiles = $$('#albumMasonry .m-item');
      if (tiles.length){
        window.gsap.from(tiles, {opacity:0, y:16, duration:.35, ease:'power2.out', stagger:0.05, clearProps:'all'});
      }
    }

    if (window.AOS) AOS.refresh();
    ensureAlbumFooter();
    wireAskUI();
    captionImagesInAlbum(currentAlbum).then(injectAlbumTags).catch(()=>{});

    if(push){
      const u=new URL(location.href);
      u.searchParams.set('album',id);
      history.pushState({album:id},"",u);
    }
  }

  function closeAlbum(){
    removeAlbumFooter();
    closeViewer();
    if (window.gsap){
      window.gsap.to('#albumView',{opacity:0,duration:.2,ease:'power2.in',onComplete:()=>{
        albumView.classList.remove('active'); albumView.style.opacity="";
        albumView.setAttribute('aria-hidden','true');
      }});
    } else {
      albumView.classList.remove('active');
      albumView.setAttribute('aria-hidden','true');
    }
  }
  $('#closeAlbum')?.addEventListener('click', closeAlbum);

  /* =========================
   * Lightbox viewer (images/video/youtube)
   * ========================= */
  const viewer   = $('#viewerOverlay');
  const stage    = $('#stage');
  const vClose   = $('#viewerClose');
  const peekPrev = $('#peekPrev');
  const peekNext = $('#peekNext');

  function previewSrc(m){ return m.type==='image'?m.src:thumbFor(m); }

  let ytIframe=null;
  function ytCommand(func){
    try{ ytIframe?.contentWindow?.postMessage(JSON.stringify({event:"command",func, args:[]}),"*"); }catch(_){}
  }
  function stopYouTube(){ if(ytIframe){ ytCommand('stopVideo'); ytIframe=null; } }

  function loadMedia(){
    const m=currentAlbum.media[currentIndex];
    stage.innerHTML=''; ytIframe=null;

    let el;
    if(m.type==='image'){
      el=document.createElement('img');
      el.src=m.src; el.alt=currentAlbum.title; el.loading='lazy';
    }else if(m.type==='video'){
      el=document.createElement('video');
      el.src=m.src; el.controls=true; el.playsInline=true; el.muted=true; el.autoplay=true;
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
      el.allowFullscreen=true; el.title="YouTube video player";
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
    viewer.classList.add('active'); viewer.setAttribute('aria-hidden','false');
    loadMedia();
    if (window.gsap) window.gsap.fromTo('.viewer-shell',{y:18,opacity:0},{y:0,opacity:1,duration:.25});
  }
  function closeViewer(){
    stopYouTube();
    if (window.gsap){
      window.gsap.to('.viewer-shell',{y:14,opacity:0,duration:.18,onComplete:()=>{
        viewer.classList.remove('active'); viewer.setAttribute('aria-hidden','true');
        document.body.classList.remove('noscroll'); stage.innerHTML='';
        window.gsap.set('.viewer-shell',{y:0,opacity:1});
      }});
    }else{
      viewer.classList.remove('active'); viewer.setAttribute('aria-hidden','true');
      document.body.classList.remove('noscroll'); stage.innerHTML='';
    }
  }
  vClose?.addEventListener('click', closeViewer);

  function nav(d){
    stopYouTube();
    const L=currentAlbum.media.length;
    currentIndex=(currentIndex+d+L)%L;
    loadMedia();
  }
  $('#prevBtn')?.addEventListener('click', ()=>nav(-1));
  $('#nextBtn')?.addEventListener('click', ()=>nav(1));

  // keyboard + swipe
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
    if(albumView.classList.contains('active') && e.key==='Escape'){ closeAlbum(); }
  });
  let startX=0;
  stage.addEventListener('pointerdown', e=> startX=e.clientX);
  stage.addEventListener('pointerup',   e=> { const dx=e.clientX-startX; if(Math.abs(dx)>40) nav(dx<0?1:-1); });

  /* =========================
   * Ask this album (AI)
   * ========================= */
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

  async function askAboutAlbum(question){
    const input = $('#askInput');
    const btn   = $('#askBtn');
    const out   = $('#askResult');

    if (!question || !currentAlbum || !out || !btn) return;
    const context = buildAlbumContext(currentAlbum);

    btn.disabled = true;
    out.textContent = 'Thinking…';

    try{
      const data = await postJSON('/api/ask', {
        question,
        context,
        albumId: currentAlbum.id
      });
      out.textContent = data.answer || 'No answer.';
    }catch(err){
      console.error(err);
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

  /* =========================
   * Smart captions (optional, via /api/caption)
   * ========================= */
  const CaptionStore = {
    get(key){ try { return JSON.parse(localStorage.getItem('cap:'+key)); } catch { return null; } },
    set(key,val){ try { localStorage.setItem('cap:'+key, JSON.stringify(val)); } catch {} }
  };

  async function fetchCaption(imageUrl){
    const cached = CaptionStore.get(imageUrl);
    if (cached) return cached;
    const data = await postJSON('/api/caption', { imageUrl });
    CaptionStore.set(imageUrl, data);
    return data;
  }

  async function captionImagesInAlbum(album){
    if (!album) return { items:[], allTags:new Set() };
    const items = [];
    const allTags = new Set();

    const imgs = album.media
      .map((m,i)=> ({...m, index:i}))
      .filter(m => m.type === 'image');

    for (const m of imgs) {
      try {
        const data = await fetchCaption(m.src);
        items.push({ index:m.index, src:m.src, ...data });
        data.tags?.forEach(t=> allTags.add(t));
        const tile = $$('#albumMasonry .m-item')[m.index];
        if (tile) {
          tile.setAttribute('title', data.caption);
          let tr = tile.querySelector('.mini-tags');
          if (!tr) {
            tr = document.createElement('div');
            tr.className = 'mini-tags';
            tile.appendChild(tr);
          }
          tr.innerHTML = (data.tags||[]).slice(0,3).map(t=>`<span class="mini-chip">${t}</span>`).join('');
        }
      } catch(e){ /* ignore single failures */ }
    }
    return { items, allTags };
  }

  function injectAlbumTags({ allTags }){
    const desc = document.querySelector('.album-desc-inner');
    if (!desc || !allTags) return;
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
      $('#searchInput').value = t;
      renderGrid(t);
    };
  }

  /* =========================
   * Semantic search (optional – Xenova)
   * ========================= */
  const Emb = { model: null, cache: new Map(), ready:false };

  async function loadEmbedder(){
    if (Emb.model) return Emb.model;
    if (!window.transformers) { Emb.ready=false; return null; }
    Emb.model = await window.transformers.pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    Emb.ready = true;
    return Emb.model;
  }

  async function embed(text){
    if (!Emb.ready) return null;
    if (Emb.cache.has(text)) return Emb.cache.get(text);
    const pipe = await loadEmbedder();
    if (!pipe) return null;
    const out = await pipe(text, { pooling: 'mean', normalize: true });
    const vec = Array.from(out.data);
    Emb.cache.set(text, vec);
    return vec;
  }

  function cosine(a,b){ let s=0; for(let i=0;i<a.length;i++) s+=a[i]*b[i]; return s; }

  let ALBUM_VECS = null;
  async function ensureAlbumVecs(){
    if (ALBUM_VECS || !Emb.ready) return;
    ALBUM_VECS = await Promise.all(ALBUMS.map(async (a) => {
      const text = `${a.title}. ${a.description}. ${a.tags.join(' ')}`;
      return { id:a.id, v: await embed(text) };
    }));
  }

  async function semanticSearchHook(){
    const search = $('#searchInput');
    if (!search) return;

    // try to init model in background; if it fails, normal keyword search still works
    loadEmbedder().then(ensureAlbumVecs).catch(()=>{});

    search.addEventListener('input', async (e)=>{
      const q = e.target.value.trim();
      if (!q || !Emb.ready){ renderGrid(q); return; }

      await ensureAlbumVecs();
      const qv = await embed(q);
      if (!qv) { renderGrid(q); return; }

      const ranked = ALBUMS.map((a, i) => {
        const kw = (a.title + ' ' + a.tags.join(' ') + ' ' + a.description).toLowerCase();
        const kwBoost = kw.includes(q.toLowerCase()) ? 0.15 : 0;
        const sem = cosine(qv, ALBUM_VECS[i].v);
        return { a, score: sem + kwBoost };
      }).sort((x,y)=> y.score - x.score);

      grid.innerHTML = '';
      ranked.forEach(({a}) => addCard(a));
    });
  }

  /* =========================
   * Misc polish
   * ========================= */
  // Prefetch cover on hover
  grid?.addEventListener('mouseover', (e)=>{
    const card = e.target.closest('.card'); if(!card) return;
    const img = card.querySelector('.card-cover');
    const url = img?.src;
    if (!url) return;
    const link = document.createElement('link');
    link.rel='prefetch'; link.as='image'; link.href=url;
    document.head.appendChild(link);
  });

  // Deep link (?album=..)
  window.addEventListener('popstate', ()=>{
    const id=new URL(location.href).searchParams.get('album');
    if(id) openAlbum(id,0,false); else closeAlbum();
  });

  // Lazy hero cover
  function wireHeroLazy(){
    const el = document.querySelector('img.lazy-cover');
    if (!el) return;
    const io = new IntersectionObserver(es=>{
      es.forEach(e=>{
        if (!e.isIntersecting) return;
        const img = e.target;
        const src = img.dataset.src;
        if (src) img.src = src;
        img.onload = ()=> img.classList.add('is-loaded');
        io.unobserve(img);
      });
    }, {rootMargin:'150px'});
    io.observe(el);
  }

  // Tag chips
  function mountChips(){
    const POPULAR = ['AAVSS','dataset','lidar','night','rain'];
    const chips = document.getElementById('chips');
    if (!chips) return;
    chips.innerHTML = POPULAR.map(t=>`<button class="chip" data-t="${t}">${t}</button>`).join('');
    chips.addEventListener('click',e=>{
      const b=e.target.closest('.chip'); if(!b) return;
      const t=b.dataset.t.toLowerCase();
      const input = document.getElementById('searchInput');
      if (input) input.value = t;
      renderGrid(t);
    });
  }

  // GSAP niceties
  function initGSAP(){
    if (!window.gsap) return;

    // Register ScrollTrigger if present
    if (window.ScrollTrigger) window.gsap.registerPlugin(window.ScrollTrigger);

    // Outside hero parallax
    const heroImgEl = document.querySelector('.hero-media img');
    const heroWrap = document.querySelector('.hero-media');
    if (heroImgEl && window.ScrollTrigger) {
      window.gsap.fromTo(heroImgEl, {scale:1.08, y:0}, {
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

    // Card tilt (desktop only)
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

    // Animate album sections when overlay opens
    const albumEl = document.getElementById('albumView');
    const mo = new MutationObserver(()=> {
      if (!albumEl.classList.contains('active')) return;

      const banner = document.querySelector('.album-hero.slim');
      const bannerImg = document.getElementById('albumHeroImg');
      const bannerH2  = document.getElementById('albumHeroTitle');

      if (banner && bannerImg && window.ScrollTrigger) {
        window.ScrollTrigger.getAll().forEach(t => { if (t.trigger === banner) t.kill(); });

        window.gsap.fromTo(bannerImg, {scale:1.1, y:0}, {
          scale:1,
          y:-40,
          ease:'power2.out',
          scrollTrigger:{
            trigger: banner,
            start: 'top top',
            end: '+=40%',
            scrub: true,
            scroller: albumEl
          }
        });

        window.gsap.fromTo(bannerH2, {y:20, opacity:0.001}, {
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

      const desc = document.querySelector('.album-desc-block');
      if (desc && window.ScrollTrigger) {
        window.gsap.fromTo(desc, {opacity:0, y:16}, {
          opacity:1, y:0, duration:.6, ease:'power2.out',
          scrollTrigger:{
            trigger: desc,
            start: 'top 85%',
            scroller: albumEl
          }
        });
      }
    });
    mo.observe(albumEl, { attributes:true, attributeFilter:['class'] });
  }

  /* =========================
   * Boot
   * ========================= */
  document.addEventListener('DOMContentLoaded', () => {
    // Year in footer
    updateAllFooterYears();

    // Grid + search
    renderGrid();
    $('#searchInput')?.addEventListener('input', e=>renderGrid(e.target.value));

    // Chips, hero lazy, semantic hook
    mountChips();
    wireHeroLazy();
    semanticSearchHook();

    // Deep link open
    const id=new URL(location.href).searchParams.get('album');
    if(id){ openAlbum(id,0,false); }
    else{
      albumView.classList.remove('active');
      albumView.setAttribute('aria-hidden','true');
    }

    initGSAP();
    console.log('[gallery] app.js ready. API_BASE =', API_BASE);
  });
})();



async function aiAsk(question, context) {
  const r = await fetch('/api/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: 'ask', question, context })
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error || 'AI failed');
  return j.answer; // string
}

async function aiCaption(imageUrl) {
  const r = await fetch('/api/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: 'caption', imageUrl })
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error || 'caption failed');
  return j; // { caption, tags }
}




// ----- API base helper -----
// If your API is on the same origin (Next.js / Vercel), leave it ''.
// If you use a separate server (e.g. Express on Vercel/Fly/etc.), set that absolute URL.
const API_BASE = window.__API_BASE__ || ''; // e.g. 'https://album-ai-api.vercel.app'

// Build an endpoint
const api = (path) => `${API_BASE}${path}`;



async function aiAsk(question, context) {
  const r = await fetch(api('/api/ask'), {
    method: 'POST',
    headers: { 'Content-Type':'application/json' },
    body: JSON.stringify({ question, context })
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error || 'AI failed');
  return j.answer;
}

async function aiCaption(imageUrl) {
  const r = await fetch(api('/api/caption'), {
    method: 'POST',
    headers: { 'Content-Type':'application/json' },
    body: JSON.stringify({ imageUrl })
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error || 'caption failed');
  return j; // { caption, tags }
}





async function aiAsk(question, context) {
  const r = await fetch(api('/api/ai'), {
    method: 'POST',
    headers: { 'Content-Type':'application/json' },
    body: JSON.stringify({ mode:'ask', question, context })
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error || 'AI failed');
  return j.answer;
}

async function aiCaption(imageUrl) {
  const r = await fetch(api('/api/ai'), {
    method: 'POST',
    headers: { 'Content-Type':'application/json' },
    body: JSON.stringify({ mode:'caption', imageUrl })
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error || 'caption failed');
  return j; // { caption, tags }
}




document.addEventListener('DOMContentLoaded', () => {
  renderGrid();
  document.getElementById('searchInput')?.addEventListener('input', e => renderGrid(e.target.value));
});

