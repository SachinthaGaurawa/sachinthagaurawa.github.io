#!/usr/bin/env python3
"""Rewrite gallery.html's own ?v=... cache-busting query strings to a short
hash of each referenced file's actual current content.

Why: a manually-incremented integer has to be remembered on every edit, and
it was forgotten twice in one evening - app.js and js/gallery-sync.js both
shipped real fixes whose content changed while their ?v= stayed put, so a
browser or Vercel's CDN holding a cached copy of the old URL (Cache-Control:
max-age=3600, stale-while-revalidate=86400 in vercel.json) kept serving the
pre-fix script indefinitely, even though the correct file was live on the
server the whole time. A hash of the file's own bytes cannot be forgotten to
update, because it isn't a number anyone chooses - it changes exactly when,
and only when, the file's content does.

Only rewrites references gallery.html makes to files in this repo (relative
src/href, no scheme, not the Font Awesome CDN link) - and only within
gallery.html, deliberately: index.html is out of scope for this project.

Usage: python3 tools/bump-versions.py [--check]
  --check   exit 1 if gallery.html's versions don't already match current
            file content, without writing anything (for a pre-ship gate).
"""
import hashlib
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TARGET = ROOT / "gallery.html"

# <script src="js/app.js?v=16" ...> or <link ... href="style.css?v=4">
TAG_RE = re.compile(
    r'((?:src|href)=")([^":?]+\.(?:js|css))\?v=[^"]*(")'
)


def file_hash(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()[:10]


def rewrite(text: str, check: bool):
    mismatches = []

    def sub(m):
        prefix, rel, suffix = m.group(1), m.group(2), m.group(3)
        local = ROOT / rel
        if not local.is_file():
            # Not a local asset (or a typo) - leave it exactly as found.
            return m.group(0)
        want = file_hash(local)
        old = m.group(0)
        new = f'{prefix}{rel}?v={want}{suffix}'
        if old != new:
            mismatches.append((rel, old, new))
        return new

    new_text = TAG_RE.sub(sub, text)
    return new_text, mismatches


def main():
    check = "--check" in sys.argv
    text = TARGET.read_text()
    new_text, mismatches = rewrite(text, check)

    if not mismatches:
        print("gallery.html: every cache-busting version already matches its file's content.")
        return 0

    for rel, old, new in mismatches:
        print(f"  {rel}: {old} -> {new}")

    if check:
        print(f"\n{len(mismatches)} version(s) out of date - run without --check to fix.")
        return 1

    TARGET.write_text(new_text)
    print(f"\nUpdated {len(mismatches)} version(s) in gallery.html.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
