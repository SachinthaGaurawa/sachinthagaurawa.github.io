/* =============================================================================
   Gallery AI — grounded answers about Sachintha's projects.

   The published documents (AAVSS final report, both research papers) are
   extracted at build time by tools/build-kb.py into data/kb/*.json, one file
   per document, each passage carrying its section number and page. This module
   searches them in the browser and composes an answer.

   Why here rather than on a server: the hosted model needs a green build, a
   public URL, a provider key and a database to answer one question, and any of
   those failing takes the feature down. Searching the documents in the page
   needs none of them. When the hosted model IS reachable it is handed the
   passages this module retrieved, so it writes over real evidence instead of
   guessing — it improves the answer rather than being the only thing that can
   produce one.
   ========================================================================== */
window.GalleryAI = (function () {
  'use strict';

  const MANIFEST = 'data/kb/index.json';

  const STOP = new Set(('a an the and or but if then than that this these those of to in on for with by from as at ' +
    'is are was were be been being it its into over under about what which who whom how why when where does do did ' +
    'can could should would will shall may might must have has had i you he she they we me my your our their there ' +
    'here not no yes any all some more most other such only own same so too very s t just now tell show give explain ' +
    'please me about').split(' '));

  /* ---------------------------------------------------------------- text --- */
  function stem(w) {
    if (w.length > 4 && w.endsWith('ies')) return w.slice(0, -3) + 'y';
    if (w.length > 4 && w.endsWith('sses')) return w.slice(0, -2);
    if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1);
    if (w.length > 5 && w.endsWith('ing')) return w.slice(0, -3);
    if (w.length > 4 && w.endsWith('ed')) return w.slice(0, -2);
    return w;
  }
  function tokens(str) {
    return String(str || '').toLowerCase().replace(/[^a-z0-9\s.-]/g, ' ')
      .split(/\s+/).filter(w => w.length > 1 && !STOP.has(w)).map(stem);
  }

  /* A visitor says "processor"; the documents say "Jetson Nano". Every term on
     the right was verified present in the corpus, so this widens recall without
     inventing vocabulary the documents do not use. */
  const ALIAS = {
    processor: ['jetson', 'nano', 'edge'], microcontroller: ['jetson', 'nano', 'arduino'],
    mcu: ['jetson', 'nano'], chip: ['jetson', 'nano'], cpu: ['jetson', 'nano'],
    gpu: ['jetson', 'nano', 'cuda'], board: ['jetson', 'nano', 'pcb'],
    compute: ['jetson', 'nano', 'edge'], computer: ['jetson', 'nano'],
    hardware: ['jetson', 'nano', 'pcb', 'component', 'sensor'], brain: ['jetson', 'nano'],
    camera: ['imx219', 'vision', 'camera'], vision: ['camera', 'imx219', 'yolo'],
    watch: ['pinetime'], smartwatch: ['pinetime'], wearable: ['pinetime'],
    heart: ['pinetime', 'biometric', 'hr'], biometric: ['pinetime', 'facial', 'health'],
    distance: ['vl53l0x', 'ultrasonic', 'lidar'], proximity: ['vl53l0x', 'ultrasonic'],
    battery: ['li-po', 'power'], connectivity: ['4g', 'gsm', 'gps', 'lora'],
    network: ['4g', 'gsm', 'gps', 'lora', 'mesh'], internet: ['4g', 'gsm'],
    cellular: ['4g', 'gsm'], location: ['gps'], security: ['nfc', 'access'],
    circuit: ['pcb'], speed: ['latency', 'fps', 'response'], fast: ['latency', 'fps'],
    steering: ['servo'], motor: ['servo'], accuracy: ['accuracy', 'precision', 'map'],
    model: ['yolo', 'cnn', 'lstm', 'neural'], algorithm: ['yolo', 'cnn', 'lstm'],
    drone: ['uav', 'swarm', 'drone'], swarm: ['drone', 'uav', 'fleet'],
    disaster: ['flood', 'landslide', 'fire', 'emergency'],
    dataset: ['dataset', 'training', 'annotation'], cost: ['cost', 'budget', 'power']
  };
  function expand(qTokens, raw) {
    const out = new Set(qTokens);
    String(raw || '').toLowerCase().split(/[^a-z0-9]+/)
      .forEach(w => (ALIAS[w] || []).forEach(a => out.add(stem(a))));
    return [...out];
  }

  /* ------------------------------------------------------------ language --- */
  /* A visitor may ask for the answer in their own language. Detect that intent
     from the request, in the language they wrote it in. */
  const LANGS = [
    { code: 'si', name: 'Sinhala', label: 'සිංහල',
      re: /\b(sinhala|sinhalese)\b|සිංහල/i },
    { code: 'ta', name: 'Tamil', label: 'தமிழ்', re: /\btamil\b|தமிழ/i },
    { code: 'en', name: 'English', label: 'English', re: /\benglish\b/i },
    { code: 'fr', name: 'French', label: 'Français', re: /\b(french|fran[cç]ais)\b/i },
    { code: 'es', name: 'Spanish', label: 'Español', re: /\b(spanish|espa[nñ]ol)\b/i },
    { code: 'de', name: 'German', label: 'Deutsch', re: /\b(german|deutsch)\b/i },
    { code: 'zh', name: 'Chinese', label: '中文', re: /\b(chinese|mandarin)\b|中文/i },
    { code: 'hi', name: 'Hindi', label: 'हिन्दी', re: /\bhindi\b|हिन्दी/i },
    { code: 'ar', name: 'Arabic', label: 'العربية', re: /\barabic\b|العربية/i },
    { code: 'ja', name: 'Japanese', label: '日本語', re: /\bjapanese\b|日本語/i },
    { code: 'ru', name: 'Russian', label: 'Русский', re: /\brussian\b|русск/i },
    { code: 'pt', name: 'Portuguese', label: 'Português', re: /\b(portuguese|portugu[eê]s)\b/i },
    { code: 'ko', name: 'Korean', label: '한국어', re: /\bkorean\b|한국어/i }
  ];

  /* Someone writing in their own script is asking IN it, not about it - the
     strongest signal there is, and it needs no keyword. Kana is tested before
     the CJK ideographs, because Japanese uses both and Chinese only the
     latter. */
  const SCRIPTS = [
    [/[\u0D80-\u0DFF]/, 'si'], [/[\u0B80-\u0BFF]/, 'ta'],
    [/[\u3040-\u30FF]/, 'ja'], [/[\uAC00-\uD7AF]/, 'ko'],
    [/[\u4E00-\u9FFF]/, 'zh'], [/[\u0900-\u097F]/, 'hi'],
    [/[\u0600-\u06FF]/, 'ar'], [/[\u0400-\u04FF]/, 'ru']
  ];
  /* Only treat it as a language request when the sentence actually asks for a
     language, so "the Sinhala road dataset" is not mistaken for one. */
  const WANTS_LANG = new RegExp([
    // English
    '\\b(in|into|to|reply|answer|respond|translate|say|write|explain)\\b',
    // The same request made in the language being asked for - "en français",
    // "auf Deutsch", "por favor responde en español".
    '\\b(en|auf|em|su|dans|nel)\\b',
    '\\b(r[ée]pond|responde|responda|antworte|rispondi|risponda|traduce|traduis|traduza)',
    'по-|\\bответ',
    // Sinhala
    'වලින්|වෙන්|කියන්න|ඕන'
  ].join('|'), 'i');
  function detectLanguage(q) {
    const s = String(q || '');

    /* A question typed in Sinhala gets a Sinhala answer. This used to sit
       behind the keyword guard below, so "සිංහලෙන් උත්තර දෙන්න" - answer in
       Sinhala, written in Sinhala - was not recognised as a language request
       at all, and only the English phrasing ever worked. */
    for (const [re, code] of SCRIPTS) {
      if (re.test(s)) {
        const hit = LANGS.find(L => L.code === code);
        if (hit) return hit;
      }
    }

    /* Written in Latin script, the sentence has to actually ask for a
       language, so "the Sinhala road dataset" is not mistaken for one. */
    if (!WANTS_LANG.test(s)) return null;
    for (const L of LANGS) if (L.re.test(s)) return L;
    return null;
  }

  /* --------------------------------------------------------------- state --- */
  const state = { manifest: null, manifestP: null, docs: new Map(), loading: new Map() };

  /* 'force-cache' tells the browser to use any cached copy of this file
     forever, without ever asking the server whether it's still current -
     it overrides the server's own Cache-Control, not just supplements it.
     This manifest is exactly the file that changes when a document gets a
     new cover (build-kb.py rewrites it), so a visitor whose browser had
     cached it even once kept seeing the old covers indefinitely, on every
     future visit, with no way to tell from the page that anything was
     stale - reloading, even in a private tab that still shares the
     browser's HTTP cache, changed nothing. 'no-cache' still lets the
     browser skip re-downloading unchanged bytes via a conditional request,
     but it always asks the server first. */
  async function manifest() {
    if (state.manifest) return state.manifest;
    if (!state.manifestP) {
      state.manifestP = fetch(MANIFEST, { cache: 'no-cache' })
        .then(r => { if (!r.ok) throw new Error('manifest HTTP ' + r.status); return r.json(); })
        .then(j => (state.manifest = j))
        .catch(e => { state.manifestP = null; throw e; });
    }
    return state.manifestP;
  }

  function indexDoc(id, data) {
    const chunks = (data.chunks || []).map(c => {
      const body = tokens(c.t), head = tokens(c.s);
      const tf = new Map();
      body.forEach(w => tf.set(w, (tf.get(w) || 0) + 1));
      head.forEach(w => tf.set(w, (tf.get(w) || 0) + 2)); // titles say what a passage is about
      return { id, s: c.s, p: c.p, t: c.t, tf, len: body.length };
    });
    const df = new Map();
    chunks.forEach(c => new Set(c.tf.keys()).forEach(w => df.set(w, (df.get(w) || 0) + 1)));
    state.docs.set(id, {
      meta: data.doc || { id }, chunks, df,
      avgLen: chunks.reduce((a, c) => a + c.len, 0) / Math.max(1, chunks.length)
    });
  }

  async function load(id) {
    if (state.docs.has(id)) return true;
    if (state.loading.has(id)) return state.loading.get(id);
    const p = manifest()
      .then(m => {
        const d = (m.docs || []).find(x => x.id === id);
        if (!d) throw new Error('unknown document: ' + id);
        return fetch(d.kb, { cache: 'no-cache' });
      })
      .then(r => { if (!r.ok) throw new Error('kb HTTP ' + r.status); return r.json(); })
      .then(j => { indexDoc(id, j); return true; })
      .catch(e => { state.loading.delete(id); throw e; });
    state.loading.set(id, p);
    return p;
  }

  async function loadAll() {
    const m = await manifest();
    await Promise.all((m.docs || []).map(d => load(d.id).catch(() => false)));
    return [...state.docs.keys()];
  }

  /* ------------------------------------------------------------- ranking --- */
  const K1 = 1.5, B = 0.75;
  function search(question, opts) {
    opts = opts || {};
    const only = opts.docs && opts.docs.length ? new Set(opts.docs) : null;
    const q = expand(tokens(question), question);
    if (!q.length) return [];
    const pool = [];
    for (const [id, d] of state.docs) {
      if (only && !only.has(id)) continue;
      const N = d.chunks.length || 1;
      for (const c of d.chunks) {
        let score = 0;
        for (const w of q) {
          const f = c.tf.get(w);
          if (!f) continue;
          const dfw = d.df.get(w) || 1;
          const idf = Math.log(1 + (N - dfw + 0.5) / (dfw + 0.5));
          score += idf * (f * (K1 + 1)) / (f + K1 * (1 - B + B * c.len / d.avgLen));
        }
        if (score <= 0) continue;
        // Appendices are mostly captions and pointers; let them win only when
        // nothing better matches.
        if (/^A\b|appendix/i.test(c.s)) score *= 0.7;
        // A cover page repeats the document's own title and the author's
        // details, so it out-ranks real prose on any question naming the
        // project. It answers nothing.
        if (c.p <= 2 && /submitted by|bachelor of|supervisor|in partial fulfil/i.test(c.t)) score *= 0.25;
        pool.push({ c, score, doc: d.meta });
      }
    }
    pool.sort((a, b) => b.score - a.score);
    return pool.slice(0, opts.topK || 5);
  }

  /* ------------------------------------------------------------ passages --- */
  const META_SENTENCE = /\b(this|the)\s+(appendix|section|chapter|figure|table)\b[^.]{0,40}\b(contains?|includes?|shows?|presents?|provides?|illustrat\w+|depicts?|outlines?)\b/i;

  /* A table flattened by PDF extraction has no full stops in it, so a sentence
     split welds "Urban Roads 2.5 95.7 Heavy Traffic 3.2 94.1" onto the front of
     the paragraph that follows it, and the answer opens with a wall of numbers.
     Cut those runs out before choosing sentences - extractTable puts them back
     below, as an actual table. */
  const TABLE_RUN = /(?:[A-Z][A-Za-z \/()\-]{2,38}?\s+(?:\d+(?:\.\d+)?\s+){1,5}\d+(?:\.\d+)?\s*){2,}/g;

  /* What is left after the rows are gone can still be a column header rather
     than a sentence ("Driving Conditions AI Response Time (Seconds)"). Prose
     runs several plain lowercase words together; a header almost never does. */
  const LOWER_PAIR = /\b[a-z]{2,}\s+[a-z]{2,}\b/g;
  function looksLikeProse(str) {
    return (str.match(LOWER_PAIR) || []).length >= 4;
  }

  function bestSentences(hits, question, limit) {
    const q = new Set(expand(tokens(question), question));
    const cand = [], seen = new Set();
    hits.slice(0, 3).forEach((h, hi) => {
      h.c.t.replace(TABLE_RUN, ' \u00b6 ')
        .split(/\u00b6|(?<=[.!?])\s+(?=[A-Z0-9•])/).forEach((sent, si) => {
        // A bullet marker belongs to the list it came from, not to the front
        // of an answer that no longer shows the list.
        const clean = sent.trim().replace(/^[\u2022\u25cf\u25aa\-\u2013]\s*/, '');
        if (clean.length < 40 || clean.length > 400) return;
        if (META_SENTENCE.test(clean)) return;
        if (/^\(?(figure|table|appendix)\s*\d/i.test(clean)) return;
        if (!looksLikeProse(clean)) return;
        const key = clean.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 90);
        if (seen.has(key)) return;
        seen.add(key);
        const st = tokens(clean);
        if (!st.length) return;
        const overlap = st.filter(w => q.has(w)).length;
        if (!overlap) return;
        cand.push({ text: clean, hi, si, score: overlap / Math.sqrt(st.length) + (3 - hi) * 0.05 });
      });
    });
    cand.sort((a, b) => b.score - a.score);
    const keep = cand.slice(0, limit || 4);
    keep.sort((a, b) => a.hi - b.hi || a.si - b.si);
    return keep.map(k => k.text);
  }

  /* -------------------------------------------------------------- tables --- */
  /* Measurement tables survive PDF extraction as a header phrase followed by
     runs of numbers ("Pedestrian 98.7 250 99.1 Vehicle 96.4 310 97.8"). Flat
     prose loses them, so rebuild the grid. */
  function extractTable(text) {
    // The last row of a table is often followed by its figure caption in
    // brackets rather than by another row, and requiring a capital letter
    // there dropped that row from every such table.
    const rowRe = /([A-Z][A-Za-z \/()\-]{2,38}?)\s+((?:\d+(?:\.\d+)?\s+){1,5}\d+(?:\.\d+)?)(?=\s+[A-Z(]|\s*$)/g;
    const rows = [];
    let m;
    while ((m = rowRe.exec(text)) !== null) {
      const label = m[1].trim().replace(/\s+/g, ' ');
      const nums = m[2].trim().split(/\s+/);
      if (label.length < 3 || nums.length < 2) continue;
      rows.push([label].concat(nums));
    }
    if (rows.length < 2) return null;
    const width = Math.max(...rows.map(r => r.length));
    if (rows.filter(r => r.length === width).length < 2) return null;
    // A header line usually precedes the first row ("Obstacle Type Avoidance
    // Success Rate (%) System Reaction Time (ms) ..."). Splitting it into exact
    // columns is guesswork once the PDF has collapsed the spacing, and a
    // mis-split header is worse than none - so carry it as a caption above the
    // grid, which is accurate and still tells the reader what the columns are.
    const before = text.slice(0, text.indexOf(rows[0][0]));
    const headMatch = before.match(/([A-Z][A-Za-z %()/.,\-]{10,120})\s*$/);
    // Trim any tail of the sentence that ran into the header, so the caption
    // starts where the columns start.
    const caption = headMatch
      ? headMatch[1].replace(/^.*[.:\u2022]\s*/, '').trim().replace(/\s+/g, ' ') || null
      : null;
    return { caption, rows: rows.filter(r => r.length === width).slice(0, 12) };
  }

  /* ------------------------------------------------------------- figures --- */
  /* A question about results deserves the chart that shows them, not only a
     sentence about it. tools/build-kb.py crops every captioned figure out of
     the documents; this picks the ones the retrieved passages actually point
     at - by number when a passage names one, otherwise by the page it came
     from. A figure the build could not crop still appears as its caption, so
     a document with no extractable artwork loses nothing. */
  const FIG_REF = /\bFig(?:ure)?\.?\s*(\d+(?:\.\d+)*)/gi;

  function figuresIn(hits) {
    const named = [], nearby = [], seen = new Set();

    const add = (list, doc, f) => {
      const key = (doc.id || '') + '#' + f.num;
      if (seen.has(key)) return;
      seen.add(key);
      list.push({
        kind: 'Figure', num: f.num, caption: f.caption, page: f.page,
        src: f.src, w: f.w, h: f.h, doc
      });
    };

    hits.forEach(h => {
      const doc = h.doc || {};
      const figs = doc.figures || [];
      if (!figs.length) return;
      const refs = new Set();
      let m;
      FIG_REF.lastIndex = 0;
      while ((m = FIG_REF.exec(h.c.t)) !== null) refs.add(m[1]);
      figs.forEach(f => { if (refs.has(f.num)) add(named, doc, f); });
      figs.forEach(f => { if (Math.abs(f.page - h.c.p) <= 1) add(nearby, doc, f); });
    });

    /* Whatever the build could not crop is still worth naming. */
    const captions = [];
    hits.forEach(h => {
      const re = /\(?(Figure|Table)\s*([\d.]+)\s*[\u2013\-\u2014:]\s*([^)\n]{4,90})\)?/gi;
      let m;
      while ((m = re.exec(h.c.t)) !== null) {
        const key = (m[1] + m[2]).toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        captions.push({ kind: m[1], num: m[2], caption: m[3].trim(), page: h.c.p, doc: h.doc });
      }
    });

    const picked = named.length ? named.slice(0, 2) : nearby.slice(0, 1);
    return picked.concat(captions).slice(0, 3);
  }

  /* ----------------------------------------------------------- assembling -- */
  function cite(h) {
    const short = (h.doc && h.doc.title) ? h.doc.title.split(/[—:(]/)[0].trim() : '';
    return { label: `§${h.c.s} · p${h.c.p}`, doc: short, file: h.doc && h.doc.file };
  }

  function contextFor(question, opts) {
    const hits = search(question, opts);
    if (!hits.length) return '';
    return hits.map(h => `[${(h.doc && h.doc.title) || ''} — §${h.c.s}, p${h.c.p}]\n${h.c.t}`)
      .join('\n---\n');
  }

  /* Returns structured blocks so the page can render a table as a table and a
     figure as a figure, instead of flattening everything into a paragraph. */
  function answer(question, opts) {
    const hits = search(question, opts);
    if (!hits.length) return null;

    const blocks = [];
    const sentences = bestSentences(hits, question, 4);
    if (sentences.length) {
      const body = sentences.join(' ');
      blocks.push({ type: 'text', text: /^[a-z]/.test(body) ? '…' + body : body });
    } else {
      blocks.push({ type: 'text', text: hits[0].c.t });
    }

    for (const h of hits.slice(0, 3)) {
      const t = extractTable(h.c.t);
      if (t) { blocks.push({ type: 'table', caption: t.caption, rows: t.rows, cite: cite(h) }); break; }
    }

    const figs = figuresIn(hits);
    if (figs.length) blocks.push({ type: 'figures', items: figs });

    const sources = [];
    const seen = new Set();
    hits.slice(0, 3).forEach(h => {
      const c = cite(h);
      const k = c.doc + c.label;
      if (!seen.has(k)) { seen.add(k); sources.push(c); }
    });
    return { blocks, sources, top: hits[0] };
  }

  return {
    load, loadAll, manifest, search, answer, contextFor, detectLanguage,
    LANGS,
    get loaded() { return [...state.docs.keys()]; },
    get passages() { let n = 0; for (const d of state.docs.values()) n += d.chunks.length; return n; }
  };
})();
