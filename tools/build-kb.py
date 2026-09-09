#!/usr/bin/env python3
"""Extract every published document into the gallery's searchable knowledge base.

Run:  python3 tools/build-kb.py
Out:  data/kb.json

Each document is chunked section-aware, with the section number, title and page
carried on every passage so an answer can cite where it came from. Running
headers, tables of contents and bibliographies are dropped: they match almost
any query and would outrank the prose that actually answers it.
"""
import json, math, os, re, sys
import pypdfium2 as pdfium

DOCS = [
    dict(id="aavss", file="reports/AAVSS_Report.pdf",
         title="AAVSS — Advanced Autonomous Vehicle Safety System",
         kind="Final project report", topic="aavss",
         # The project already has its own cover on the homepage; this is
         # only for a gallery context that wants the report's own imagery
         # (e.g. a future hero slot) rather than the homepage photo.
         cover="img/kb/aavss/fig-5-1.webp"),
    dict(id="av-safety-framework", file="docs/AI_Enhanced_Predictive_Safety_Framework.pdf",
         title="AI-Enhanced Predictive Safety Framework for Autonomous Vehicles",
         kind="Research paper", topic="av-safety-framework",
         # fig-4 is the paper's own live camera frame with its detector's
         # bounding boxes on real cars and a pedestrian - not a generated
         # image, the actual figure the paper reports its results with.
         cover="img/kb/av-safety-framework/fig-4.webp"),
    dict(id="drone-disaster-response", file="docs/AI_Driven_Disaster_Prediction_Drone_Swarm.pdf",
         title="AI-Driven Disaster Prediction and Rapid Response Drone Swarm",
         kind="Research paper", topic="drone-disaster-response",
         # This PDF has no usable figure anywhere in it (every embedded
         # image across all 173 pages is either a Gantt chart or a bar
         # chart - checked directly, not assumed), so there is no source
         # image to reuse. img/covers/disaster-drone-hero.svg is a
         # hand-authored illustration instead: a drone swarm in formation,
         # each drone with its own downward detection cone, over flooded
         # terrain with partially-submerged structures - the paper's own
         # subject, not a stand-in for it.
         cover="img/covers/disaster-drone-hero.svg"),
    # The CV is deliberately NOT indexed. Two reasons: its designed layout
    # extracts letter-spaced ("indus tr y s tandard tool s"), which is useless
    # for retrieval; and it carries a home address and phone number. Offering
    # the CV as a download is one thing - an assistant that recites someone's
    # address to any visitor who asks is another.
]

HEAD    = re.compile(r'^\s*(\d+(?:\.\d+)*)\s+([A-Z][^\n]{3,70})\s*$', re.M)
TOPHEAD = re.compile(r'^\s*(\d+)\.\s+([A-Z][A-Z \n&,\-]{4,60})\s*$', re.M)
TOC_LINE = re.compile(r'\.{5,}\s*\d+\s*$', re.M)
BIB_HINT = re.compile(r'\b(bibliography|references)\b', re.I)
MAX, OVER = 900, 150


def running_header(pages):
    """Whatever repeats at the top of most pages is furniture, not content."""
    firsts = {}
    for p in pages:
        line = next((l.strip() for l in p["text"].split("\n") if l.strip()), "")
        line = re.sub(r'\d+', '#', line)
        if len(line) > 12:
            firsts[line] = firsts.get(line, 0) + 1
    if not firsts:
        return None
    line, n = max(firsts.items(), key=lambda kv: kv[1])
    return line if n >= max(3, len(pages) * 0.4) else None


PAGE_MARK = re.compile(r'\b\d{1,4}\s*\|\s*Page\b', re.I)

def clean(t, header_pat):
    if header_pat:
        t = header_pat.sub(' ', t)
    # The header also appears mid-page after extraction, without its title
    # prefix, so strip the bare page marker too.
    t = PAGE_MARK.sub(' ', t)
    t = t.replace('­', '').replace('ﬁ', 'fi').replace('ﬂ', 'fl')
    t = re.sub(r'([a-z])-\n([a-z])', r'\1\2', t)
    t = t.replace('§', '•')
    t = re.sub(r'[ \t]+', ' ', t)
    return re.sub(r'\n{2,}', '\n', t).strip()


def is_toc(text):
    return len(TOC_LINE.findall(text)) >= 4


def is_bibliography(text):
    head = text[:400]
    return bool(BIB_HINT.search(head)) and text.count('(') > 12


def chunks_of(text):
    text = re.sub(r'\s+', ' ', text).strip()
    if len(text) <= MAX:
        return [text] if len(text) > 60 else []
    parts, i = [], 0
    while i < len(text):
        end = min(i + MAX, len(text))
        if end < len(text):
            cut = max(text.rfind('. ', i + 400, end), text.rfind('• ', i + 400, end))
            if cut > i + 300:
                end = cut + 1
            else:
                sp = text.rfind(' ', i + 400, end)
                if sp > i + 300:
                    end = sp
        parts.append(text[i:end].strip())
        if end >= len(text):
            break
        nxt = max(end - OVER, i + 1)
        sp = text.find(' ', nxt)
        i = (sp + 1) if 0 < sp < nxt + 80 else nxt
    return [p for p in parts if len(p) > 60]


def extract(doc):
    path = doc["file"]
    if not os.path.exists(path):
        print(f"  !! missing {path}", file=sys.stderr)
        return None
    pdf = pdfium.PdfDocument(path)
    pages = [{"page": i + 1, "text": pdf[i].get_textpage().get_text_range()}
             for i in range(len(pdf))]

    hdr = running_header(pages)
    header_pat = None
    if hdr:
        header_pat = re.compile(re.escape(hdr).replace(r'\#', r'\d+'), re.I)

    sections, cur = [], {"num": "", "title": "Overview", "page": 1, "text": ""}
    skipped = 0
    for p in pages:
        raw = p["text"]
        if is_toc(raw) or is_bibliography(raw):
            skipped += 1
            continue
        txt = clean(raw, header_pat)
        if len(txt) < 40:
            continue
        marks = []
        for m in HEAD.finditer(txt):
            marks.append((m.start(), m.end(), m.group(1), m.group(2).strip()))
        for m in TOPHEAD.finditer(txt):
            marks.append((m.start(), m.end(), m.group(1), " ".join(m.group(2).split()).title()))
        marks.sort()
        if not marks:
            cur["text"] += "\n" + txt
            continue
        cur["text"] += "\n" + txt[:marks[0][0]]
        for i, (s, e, num, title) in enumerate(marks):
            if cur["text"].strip():
                sections.append(cur)
            end = marks[i + 1][0] if i + 1 < len(marks) else len(txt)
            cur = {"num": num, "title": title, "page": p["page"], "text": txt[e:end]}
    if cur["text"].strip():
        sections.append(cur)

    out = []
    for s in sections:
        label = (s["num"] + " " + s["title"]).strip()
        for c in chunks_of(s["text"]):
            out.append({"d": doc["id"], "s": label, "p": s["page"], "t": c})
    print(f"  {doc['id']:<24} {len(pages):>3} pages, {len(sections):>3} sections, "
          f"{len(out):>4} passages ({skipped} nav/ref pages skipped)")
    return out


# Words that carry no signal about which document a question belongs to.
STOP = set("""
the a an and or of for to in on with by from as at is are was were be been being
this that these those it its their there which when while where how what why who
we our us you your they them he she his her can may might will would should could
not no nor than then also such using use used between into over under within each
about after before during through across per via if but so because however thus
more most other others any all both same only very much many few one two three
four five figure table chapter section page appendix results result data value
values system systems model models method methods approach based given shown
"""    .split())

WORD = re.compile(r"[a-z][a-z0-9\-]{2,}")


def distinctive_terms(by_doc, top=48, vocab=400):
    """Terms frequent in one document and rare in the rest.

    Project cards in index.html carry no document id, so the gallery has to
    match them on content. Matching on document *titles* alone picks the wrong
    paper for the Sri Lanka dataset project - the AAVSS report is where that
    dataset is actually described, though its title never says so - so the
    vocabulary each document is recognised by is taken from its own text.
    """
    tf = {}
    for doc_id, cs in by_doc.items():
        counts = {}
        for c in cs:
            for w in WORD.findall(c["t"].lower()):
                if w not in STOP and not w.isdigit():
                    counts[w] = counts.get(w, 0) + 1
        tf[doc_id] = counts

    df = {}
    for counts in tf.values():
        for w in counts:
            df[w] = df.get(w, 0) + 1

    n = len(tf) or 1
    names, weights = {}, {}
    for doc_id, counts in tf.items():
        total = sum(counts.values()) or 1
        # Sub-linear term frequency, so one very common word cannot crowd out
        # the vocabulary that actually distinguishes this document, and a
        # sharp inverse document frequency, so a word all three share counts
        # for little.
        scored = [(w, (1 + math.log(c)) / math.log(1 + total) * math.log((n + 1) / df[w]))
                  for w, c in counts.items() if c >= 4]
        scored.sort(key=lambda kv: (-kv[1], kv[0]))
        names[doc_id] = [w for w, _ in scored[:top]]
        # A wider vocabulary, with weights, is what the gallery actually scores
        # an album card against. Rounded to four places: it is a ranking signal,
        # not a measurement, and full floats would triple the manifest.
        weights[doc_id] = {w: round(x, 4) for w, x in scored[:vocab]}
    return names, weights


# ---------------------------------------------------------------- figures ---
# A question about results deserves the chart that shows them, not only a
# sentence about it. Each figure is cropped out of the page it lives on and
# written next to the knowledge base, so an answer can show the real picture.

FIG_CAP = re.compile(r'\b(Figure)\s*(\d+(?:\.\d+)*)\s*[:\u2013\u2014-]\s*([^\n]{4,90})')
FIG_MIN_W, FIG_MIN_H = 90, 70   # smaller than this is a rule or a bullet, not a figure
FIG_MAX_TEXT = 260              # a region with more characters than this is prose
FIG_GAP = 40                    # points of blank space that end a drawing


def _caption_rect(textpage, needle):
    searcher = textpage.search(needle, match_case=False)
    try:
        found = searcher.get_next()
        if not found:
            return None
        i, n = found
        boxes = [b for b in (textpage.get_charbox(k) for k in range(i, i + n)) if b]
        if not boxes:
            return None
        return (min(b[0] for b in boxes), min(b[1] for b in boxes),
                max(b[2] for b in boxes), max(b[3] for b in boxes))
    finally:
        searcher.close()


def _cluster(cands, start, upward):
    """Grow away from the caption while the drawing stays continuous.

    Without this, a figure sitting under a table swallowed the table's rules
    and the prose between them, because nothing above said where to stop.
    """
    cands = sorted(cands, key=(lambda b: b[1]) if upward else (lambda b: -b[3]))
    if not cands:
        return []
    out, edge = [cands[0]], (cands[0][3] if upward else cands[0][1])
    for b in cands[1:]:
        near = (b[1] <= edge + FIG_GAP) if upward else (b[3] >= edge - FIG_GAP)
        if not near:
            break
        out.append(b)
        edge = max(edge, b[3]) if upward else min(edge, b[1])
    return out


def extract_figures(doc, out_dir):
    """Crop every captioned figure out of one document."""
    try:
        import pypdfium2.raw as raw
        from PIL import Image  # noqa: F401  (pypdfium2 renders through Pillow)
    except ImportError:
        print("  (figures skipped - Pillow not installed)")
        return []

    pdf = pdfium.PdfDocument(doc["file"])
    os.makedirs(out_dir, exist_ok=True)
    figures, seen = [], set()

    for pno in range(len(pdf)):
        page = pdf[pno]
        tp = page.get_textpage()
        try:
            text = tp.get_text_range()
            caps = list(FIG_CAP.finditer(text))
            if not caps:
                continue

            W, H = page.get_width(), page.get_height()
            marks = []
            for m in caps:
                # Search for as much of the caption as will match on one line.
                # Searching for "Figure 1" alone found the first mention of it
                # in the body text instead of the caption under the picture,
                # and the crop was then taken from the wrong part of the page.
                r = None
                whole = re.sub(r'\s+', ' ', m.group(0))
                for cut in (46, 34, 24):
                    r = _caption_rect(tp, whole[:cut])
                    if r:
                        break
                if not r:
                    r = _caption_rect(tp, f"{m.group(1)} {m.group(2)}")
                if r:
                    marks.append((r, m))

            drawings = [o.get_bounds() for o in page.get_objects()
                        if o.type in (raw.FPDF_PAGEOBJ_IMAGE, raw.FPDF_PAGEOBJ_PATH,
                                      raw.FPDF_PAGEOBJ_FORM)]
            drawings = [b for b in drawings if (b[2] - b[0]) > 20 and (b[3] - b[1]) > 20]

            for rect, m in marks:
                num = m.group(2)
                if num in seen:
                    continue
                cap_low, cap_high = rect[1], rect[3]

                # Some documents caption a figure underneath it, some above it,
                # and this corpus does both - so take whichever side of the
                # caption the drawing is actually on, nearest first.
                # Which side of the caption a drawing sits on is judged by its
                # middle, not its edges: a figure that is one large image with
                # white padding has a box that reaches past its own caption,
                # and requiring it to clear the caption entirely found nothing.
                mid = lambda b: (b[1] + b[3]) / 2
                above = _cluster([b for b in drawings if mid(b) >= cap_high], cap_high, True)
                below = _cluster([b for b in drawings if mid(b) <= cap_low], cap_low, False)
                box = above or below
                if above and below:
                    d_above = min(b[1] for b in above) - cap_high
                    d_below = cap_low - max(b[3] for b in below)
                    box = above if d_above <= d_below else below

                if not box:
                    continue

                x0 = max(0, min(b[0] for b in box) - 6)
                x1 = min(W, max(b[2] for b in box) + 6)
                y0 = max(0, min(b[1] for b in box) - 2)
                y1 = min(H, max(b[3] for b in box) + 2)
                # Never cross the caption line: cropping to the drawing alone
                # let the top of the caption bleed into the bottom of the crop.
                if box is above:
                    y0 = max(y0, cap_high + 9)
                else:
                    y1 = min(y1, cap_low - 4)

                if (x1 - x0) < FIG_MIN_W or (y1 - y0) < FIG_MIN_H:
                    continue

                chars = sum(1 for k in range(tp.count_chars())
                            for cb in [tp.get_charbox(k)]
                            if cb and cb[0] >= x0 and cb[2] <= x1
                            and cb[1] >= y0 and cb[3] <= y1)
                if chars > FIG_MAX_TEXT:
                    continue        # that is a table or a paragraph, not a picture

                name = f"fig-{num.replace('.', '-')}.webp"
                path = os.path.join(out_dir, name)
                pil = page.render(scale=2.0, crop=(x0, y0, W - x1, H - y1)).to_pil()
                pil.save(path, "WEBP", quality=82, method=5)

                seen.add(num)
                figures.append({
                    "num": num,
                    "caption": re.sub(r'\s+', ' ', m.group(3)).strip().rstrip(')').strip(),
                    "page": pno + 1,
                    "src": path.replace(os.sep, "/"),
                    "w": pil.width, "h": pil.height,
                })
        finally:
            tp.close()

    total = sum(os.path.getsize(f["src"]) for f in figures)
    print(f"  {doc['id']:<24} {len(figures):>3} figures cropped  {total/1024:>5.0f} KB")
    return figures


def main():
    docs_meta, chunks, figures = [], [], {}
    print("Building knowledge base:")
    for d in DOCS:
        got = extract(d)
        if got is None:
            continue
        chunks.extend(got)
        docs_meta.append({k: d[k] for k in ("id", "file", "title", "kind", "topic") })
        if d.get("cover"):
            docs_meta[-1]["cover"] = d["cover"]

    print("Cropping figures:")
    for d in DOCS:
        if not os.path.exists(d["file"]):
            continue
        figures[d["id"]] = extract_figures(d, f"img/kb/{d['id']}")

    # One file per document, plus a small manifest. An album only needs its own
    # document, so opening AAVSS must not pull down the drone-swarm paper too.
    os.makedirs("data/kb", exist_ok=True)
    by_doc = {}
    for c in chunks:
        by_doc.setdefault(c.pop("d"), []).append(c)
    names, weights = distinctive_terms(by_doc)
    for meta in docs_meta:
        own = by_doc.get(meta["id"], [])
        meta["keywords"] = names.get(meta["id"], [])
        meta["terms"] = weights.get(meta["id"], {})
        meta["figures"] = figures.get(meta["id"], [])
        path = f"data/kb/{meta['id']}.json"
        # The routing vocabulary belongs in the manifest only. Repeating it in
        # every document file would add 20 KB to each fetch for data the
        # gallery has already read.
        slim = {k: v for k, v in meta.items() if k not in ("keywords", "terms")}
        with open(path, "w", encoding="utf-8") as f:
            json.dump({"doc": slim, "chunks": own}, f, ensure_ascii=False, separators=(",", ":"))
        meta["passages"] = len(own)
        meta["kb"] = path
        meta["bytes"] = os.path.getsize(path)
        print(f"  {path:<34} {len(own):>4} passages  {meta['bytes']/1024:>5.0f} KB")
        print(f"  {'':<34} recognised by: {', '.join(meta['keywords'][:12])}")

    with open("data/kb/index.json", "w", encoding="utf-8") as f:
        json.dump({"built": "tools/build-kb.py", "docs": docs_meta}, f,
                  ensure_ascii=False, separators=(",", ":"))
    total = sum(m["bytes"] for m in docs_meta)
    print(f"\n  {len(docs_meta)} documents, {len(chunks)} passages, {total/1024:.0f} KB total "
          f"(largest single fetch {max(m['bytes'] for m in docs_meta)/1024:.0f} KB)")


if __name__ == "__main__":
    main()
