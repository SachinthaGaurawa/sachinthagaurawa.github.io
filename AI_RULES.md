# AI & Visual Asset Rules

This portfolio uses AI in two ways: the gallery's Ask-AI chat, and the
images/illustrations shown on the site. Both represent Sachintha publicly, so
both are held to rules written down here rather than left to judgment call by
call — a bad answer or a wrong image doesn't just look wrong, it reflects on
him.

**The Ask-AI chat's behavior and access-control rules live in the backend
repo, `album-ai-backend/AI_RULES.md`** — this file doesn't duplicate them.
This file covers what's decided in *this* repo: the visual standard every
shipped image must clear, and why.

## Visual asset quality standard

Every image actually shipped on the site — hero banners, album covers, any
future asset — must clear all of the following before it's committed, no
exceptions:

1. **Technically accurate.** Verified against its real source wherever one
   exists — a document's own figure or photo, checked page by page rather
   than assumed to exist. Hand-authored artwork is used only when no real
   source exists (checked directly, e.g. a full page-by-page scan of a PDF
   for usable figures before deciding to build one), and only after being
   grounded in the actual subject matter it depicts — the real sensors, the
   real pipeline, the real domain — never generic stock-style decoration.
2. **Highest quality actually achievable and verifiable.** Vector (SVG) art
   renders losslessly at any resolution the site displays it at. A real
   photographic figure always outranks a generated or illustrated
   alternative when one exists. An asset from a source that can't be
   previewed or verified in this environment is never shipped unseen — see
   "Never ship the unverified" below.
3. **On-topic and content-matched.** The image depicts the specific
   project or paper it's attached to — its actual sensors, its actual
   architecture, its actual results — not a generic illustration that
   happens to be adjacent to the subject.
4. **Understandable at a glance.** A viewer should be able to tell roughly
   what the image is about without reading the caption — label the key
   elements directly in the image where that helps (as the hero banners
   label LiDAR/camera/radar/ultrasonic, or a PCB's MCU and passives),
   rather than relying on surrounding text to carry that weight.
5. **Attractive, not just correct.** Consistent with the site's own visual
   identity — the palette, typography, and layout conventions already
   established in `style.css` — so a new asset reads as part of this
   portfolio, not as a mismatched insert.
6. **Self-verified before shipping.** Rendered and actually looked at before
   being committed — via a real headless-browser screenshot (the pattern
   already used in this repo's QA scripts), not trusted from a tool's
   textual description of what it produced.

## Never ship the unverified

If an image's actual pixels can't be reached and inspected from this
environment before shipping — a generator whose preview domain is
egress-blocked, a third-party service whose result can't be fetched back —
it does not get shipped, full stop, even if the tool claims success. This
portfolio has hit exactly this case before (a design-tool's own preview CDN
and the site's Cloudinary domain were both unreachable from the sandboxed
environment used to build these features) and the resolution was the same
each time: use a real, checked source image when one exists, or hand-author
and self-render new artwork rather than pass along something never actually
seen. A viewer being able to say "this is wrong" about a shipped image is the
one failure this whole standard exists to prevent.

## Extending this

A new image on the site is not done until it clears every point in the
quality standard above — treat a shortcut on any one of them (unverified
source, off-topic content, no self-render check) as a shipped defect, not a
style choice.
