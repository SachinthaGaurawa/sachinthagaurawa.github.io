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
         kind="Final project report", topic="aavss"),
    dict(id="av-safety-framework", file="docs/AI_Enhanced_Predictive_Safety_Framework.pdf",
         title="AI-Enhanced Predictive Safety Framework for Autonomous Vehicles",
         kind="Research paper", topic="av-safety-framework"),
    dict(id="drone-disaster-response", file="docs/AI_Driven_Disaster_Prediction_Drone_Swarm.pdf",
         title="AI-Driven Disaster Prediction and Rapid Response Drone Swarm",
         kind="Research paper", topic="drone-disaster-response"),
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


def main():
    docs_meta, chunks = [], []
    print("Building knowledge base:")
    for d in DOCS:
        got = extract(d)
        if got is None:
            continue
        chunks.extend(got)
        docs_meta.append({k: d[k] for k in ("id", "file", "title", "kind", "topic")})

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
