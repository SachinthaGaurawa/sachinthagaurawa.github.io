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

    /* A document has to be clearly about this card to be attached to it.
       Measured over the real cards, a true match scores above 3 on 19-20
       distinct terms, while every false one sits under 1.4 on 8 or fewer -
       "Precision RLC Meter" matched the drone-swarm paper on a single word.
       Below the bar the album gets no document, which is the honest answer
       for a project no published paper describes: the assistant then works
       from the card's own text and, for a question the card cannot answer,
       from the corpus at large, naming whichever document it quotes. */
    const strong = ranked.filter(r => r.hits >= 6 && r.score >= 2);
    if (!strong.length) return [];
    /* The clear winner, or the two closest - never every document, which would
       make one album pull down the whole corpus for a question about it. */
    const keep = strong.filter((r, i) => i === 0 || r.score >= strong[0].score * 0.6);
    return keep.slice(0, 2).map(r => r.id);
  }

  function parseProjects(doc) {
    const out = [];
    doc.querySelectorAll('.portfolio-item .project-card').forEach(card => {
      // The two flagship cards title themselves with an h4 inside a header
      // block; the three smaller ones use a bare h5. Reading only h4 silently
      // dropped three of the five projects from the gallery.
      const title = text(card, '.project-header h4') ||
                    text(card, '.project-content h4, .project-content h5, .project-content h3') ||
                    text(card, 'h3, h4, h5');
      if (!title) return;
      const img = card.querySelector('.project-image img');
      const large = card.querySelector('.project-links a[href]');
      const cover = assetUrl((large && large.getAttribute('href')) || (img && img.getAttribute('src')) || '');
      const desc = text(card, '.project-content p') || text(card, 'p');
      const badge = text(card, '.project-badge');
      const tags = [...card.querySelectorAll('.tech-tag, .project-tech span, .project-badge')]
        .map(t => t.textContent.trim()).filter(Boolean);
      out.push({
        // The card carries its own album id, so the "Ask AI" link printed on
        // it and the album it opens are the same string, read from one place.
        id: card.getAttribute('data-album') || slug(title),
        kind: 'project', title, cover,
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

  /* A research paper with no photograph of its own used to borrow the cover
     of whichever project it matched, or - failing any match - the first
     project in the page, unconditionally. That is how both research cards
     ended up showing the exact same image: the drone-swarm paper shares no
     word with any project title, so it fell straight through to "the first
     cover there is", which happened to be AAVSS's - the same image the
     safety-framework paper had also been given, because its word-match
     victory was AAVSS too. Two different papers, two different code paths,
     one identical wrong picture.

     A document's own cover - set once a real document is resolved, from
     data/kb/index.json's own manifest - now wins outright, before any
     borrowing is considered: build-kb.py records, per document, either a
     figure actually printed in that document, or a purpose-built image
     when the document has no usable figure at all (checked directly against
     the PDF, not assumed). Borrowing a project's cover remains the
     fallback for an album that resolves no document and has no photo of
     its own, so the grid still never shows an empty tile - it just never
     again claims one paper's illustration is another paper's. */
  function fillCovers(albums, docs) {
    docs = docs || [];
    albums.forEach(a => {
      if (a.cover || a.kind !== 'research') return;
      const doc = docs.find(d => a.docs && a.docs.includes(d.id));
      if (doc && doc.cover) {
        a.cover = assetUrl(doc.cover);
        a.media = [{ type: 'image', src: a.cover }];
      }
    });
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

    const docs = kbDocs || [];
    const albums = parseProjects(doc).concat(parseResearch(doc));
    // A paper's document (and therefore its own cover) must be resolved
    // before fillCovers runs, so the cover lookup above has something to
    // find - the reverse order is what let a mismatched image through.
    albums.forEach(a => { a.docs = resolveDocs(a, docs); });
    fillCovers(albums, docs);
    albums.forEach(a => {
      if (a.docs.length && !a.report) {
        const d = docs.find(x => x.id === a.docs[0]);
        if (d && d.file) a.report = { file: assetUrl(d.file) };
      }
    });
    return albums;
  }

  return { build, parseProjects, parseResearch, resolveDocs, slug };
})();
