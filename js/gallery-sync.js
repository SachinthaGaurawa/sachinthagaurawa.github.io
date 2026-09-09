/* =============================================================================
   Gallery sync — the album list is read from the portfolio page, not duplicated.

   Projects and research papers live in index.html. Hard-coding them again here
   meant the gallery silently drifted out of date every time the portfolio
   changed. This fetches index.html, reads the same cards a visitor sees, and
   builds the albums from them — so adding a project or a paper to the portfolio
   makes it appear in the gallery with no second edit.
   ========================================================================== */
window.GallerySync = (function () {
  'use strict';

  const SOURCE = 'index.html';

  const text = (el, sel) => {
    const n = el.querySelector(sel);
    return n ? n.textContent.replace(/\s+/g, ' ').trim() : '';
  };

  /* Absolute-ise a URL written relative to index.html, and drop the leading
     slash so it still resolves when the site is served from a sub-path. */
  function assetUrl(raw) {
    if (!raw) return '';
    if (/^(https?:)?\/\//.test(raw) || raw.startsWith('data:')) return raw;
    return raw.replace(/^\//, '');
  }

  function slug(s) {
    return String(s || '').toLowerCase()
      .replace(/\([^)]*\)/g, ' ')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '').slice(0, 48);
  }

  /* Match an album to a knowledge-base document.

     Research cards already carry data-paper, which is the document id, and a
     card whose title names a document is taken at its word. Everything else is
     scored on content: build-kb.py ships, per document, the vocabulary that
     document is recognised by, weighted by how characteristic each word is of
     it. Title matching alone sent the "Autonomous Driving Dataset for Sri
     Lanka" card to the wrong paper - that dataset is described in the AAVSS
     report, whose title never mentions it. */
  const WORD = /[a-z][a-z0-9-]{2,}/g;

  /* Light plural folding, so a card saying "vehicles" still finds "vehicle".
     Anything heavier would need a stemmer, and a wrong stem costs more here
     than a missed one. */
  function forms(w) {
    const out = [w];
    if (/ies$/.test(w)) out.push(w.slice(0, -3) + 'y');
    else if (/(ses|xes|zes|ches|shes)$/.test(w)) out.push(w.slice(0, -2));
    else if (/s$/.test(w) && !/ss$/.test(w)) out.push(w.slice(0, -1));
    return out;
  }

  function scoreAgainst(words, terms) {
    let score = 0, hits = 0;
    for (const w of words) {
      for (const f of forms(w)) {
        const v = terms[f];
        if (v) { score += v; hits++; break; }
      }
    }
    return { score, hits };
  }

  function resolveDocs(album, docs) {
    if (album.paperId && docs.some(d => d.id === album.paperId)) return [album.paperId];
    if (!docs.length) return [];

    const hay = (album.title + ' ' + (album.description || '') + ' ' +
                 (album.tags || []).join(' ')).toLowerCase();

    /* A card that names a document wins outright. */
    const named = docs.filter(d => {
      const key = String(d.topic || d.id).toLowerCase();
      const parts = key.split(/[^a-z0-9]+/).filter(w => w.length > 3);
      return (key && hay.includes(key)) || (parts.length && parts.every(w => hay.includes(w)));
    }).map(d => d.id);
    if (named.length) return named;

    const words = Array.from(new Set(hay.match(WORD) || []));
    const ranked = docs
      .map(d => Object.assign({ id: d.id }, scoreAgainst(words, d.terms || {})))
      .filter(r => r.hits > 0)
      .sort((a, b) => b.score - a.score);

    if (!ranked.length) return docs.map(d => d.id);   // rather all than none
    /* One clear winner, or the two closest - never every document, which would
       make one album pull down the whole corpus for a question about it. */
    const keep = ranked.filter((r, i) => i === 0 || r.score >= ranked[0].score * 0.6);
    return keep.slice(0, 2).map(r => r.id);
  }

  function parseProjects(doc) {
    const out = [];
    doc.querySelectorAll('.portfolio-item .project-card').forEach(card => {
      const title = text(card, '.project-header h4') || text(card, 'h4');
      if (!title) return;
      const img = card.querySelector('.project-image img');
      const large = card.querySelector('.project-links a[href]');
      const cover = assetUrl((large && large.getAttribute('href')) || (img && img.getAttribute('src')) || '');
      const desc = text(card, '.project-content p') || text(card, 'p');
      const badge = text(card, '.project-badge');
      const tags = [...card.querySelectorAll('.tech-tag, .project-tech span, .project-badge')]
        .map(t => t.textContent.trim()).filter(Boolean);
      out.push({
        id: slug(title), kind: 'project', title, cover,
        description: desc || (badge ? badge + '.' : ''),
        tags: tags.length ? tags : ['project'],
        media: cover ? [{ type: 'image', src: cover }] : []
      });
    });
    return out;
  }

  function parseResearch(doc) {
    const out = [];
    doc.querySelectorAll('.research-card').forEach(card => {
      const title = text(card, 'h4');
      if (!title) return;
      const btn = card.querySelector('.download-research[data-paper]');
      const paperId = btn ? btn.getAttribute('data-paper') : '';
      const file = btn ? assetUrl(btn.getAttribute('data-file-url')) : '';
      const status = text(card, '.research-status');
      const year = text(card, '.research-year');
      out.push({
        id: paperId || slug(title), kind: 'research', title,
        cover: '', paperId,
        description: text(card, '.research-abstract'),
        tags: ['research', status, year].filter(Boolean),
        report: file ? { file } : null,
        media: []
      });
    });
    return out;
  }

  /* A research paper has no photograph of its own; borrow the cover of the
     project it belongs to so the grid does not show an empty tile. */
  function fillCovers(albums) {
    const withCover = albums.filter(a => a.cover);
    albums.forEach(a => {
      if (a.cover) return;
      const words = a.title.toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 4);
      const near = withCover.find(p => words.some(w => p.title.toLowerCase().includes(w)));
      a.cover = (near && near.cover) || (withCover[0] && withCover[0].cover) || '';
      if (a.cover && !a.media.length) a.media = [{ type: 'image', src: a.cover }];
    });
    return albums;
  }

  async function build(kbDocs) {
    const res = await fetch(SOURCE, { cache: 'no-cache' });
    if (!res.ok) throw new Error('portfolio HTTP ' + res.status);
    const doc = new DOMParser().parseFromString(await res.text(), 'text/html');

    const albums = fillCovers(parseProjects(doc).concat(parseResearch(doc)));
    const docs = kbDocs || [];
    albums.forEach(a => {
      a.docs = resolveDocs(a, docs);
      if (a.docs.length && !a.report) {
        const d = docs.find(x => x.id === a.docs[0]);
        if (d && d.file) a.report = { file: assetUrl(d.file) };
      }
    });
    return albums;
  }

  return { build, parseProjects, parseResearch, resolveDocs, slug };
})();
