# Zopper Print Pipeline — Spec & Defect Log

Reference notes from building print-ready PDFs across the Touchwood, Zopper
Diwali (SATHYA/Darling), and Zenova jobs. Two parts: the standing spec every
file was built to, and the specific defects found along the way — what they
looked like, why they happened, and how they were caught.

---

## 1. The standard build

Every print file in this pipeline gets the same treatment unless the piece's
own physical spec says otherwise:

- **Colour**: convert to DeviceCMYK against **FOGRA39L Coated** (ISO 12647-2),
  relative colorimetric intent with black point compensation. Verified zero
  RGB/ICC image objects remain after conversion.
- **Bleed**: source files essentially never came with real bleed, so 3mm is
  **synthesised by edge-pixel extrusion** — the outermost artwork pixel on
  each side is sampled and extended outward, exact on flat colour, seamless
  on photographic edges. Corners get the corner pixel. This is not the same
  as real bleed artwork; it's the best reconstruction possible from a
  trim-size export.
- **Marks**: trim marks at each corner, four registration targets (auto-
  positioned to avoid the colour bar, caption, and any fold marks), a
  22-patch colour control strip, dashed fold marks where the piece folds,
  and a one-line caption stamping job name / page / colour space / trim
  size / bleed on every sheet.
- **Boxes**: TrimBox set to the original artwork size, BleedBox 3mm outside
  it, MediaBox 15mm outside that (room for the marks margin), ArtBox equal
  to TrimBox. A FOGRA39L OutputIntent is embedded in every file.
- **Ink limit**: checked against 330% TAC (coated). Registration marks are
  deliberately 100% on all four channels (400% TAC) so they hit every
  plate — that's normal and they sit outside the trim line, so they never
  print. Ink coverage is only meaningful measured on the artwork itself,
  not the marks margin.
- **QR codes**: every QR gets decoded from the source, decoded again from
  the *finished* file at press resolution, and reported back with its
  actual payload — never assumed to be correct.

---

## 2. Defects found, in order encountered

### Dummy / non-functional QR codes
**Files:** `Furniture_Insurance.pdf`, `half_fold.pdf` (first versions)
The QR on the cover decoded to the literal text `YKART`, not a URL. Caught
by decoding every square raster image in the file rather than trusting it
visually. Fixed once real QR data was supplied, by locking the rebuilt QR
to 100% K (single-plate black) so it can't fringe from plate misregistration.

### Mid-transition deck frames used as static pages
**File:** `Furniture_Insurance.pdf`
Two pages were captured mid-animation from what was originally a scrolling/
animated deck — headlines and images were half-covered by the next panel
sliding in. Visible as text literally cut in half across a panel seam.
Required a corrected export from source; no amount of conversion can fix a
frame that was never a finished page.

### Panel sequencing errors across booklet formats
**Files:** various `Booklet_*` versions
Two failure modes, both from the same root cause — deck order isn't reading
order:
- Spreads placed in export/deck order rather than the order a reader
  encounters them, splitting a title from its matching content list across
  non-adjacent spreads.
- Mixing **printer-spread** convention (back cover + front cover together,
  e.g. pages 12|1) with **reader-spread** convention (facing pages, e.g.
  2|3) in the same file — a printer's imposition software can't reconcile
  both in one document.

Caught by rendering every page/spread as a grid and reading it top to
bottom like a person would, not by trusting page order alone.

### QR object IDs shift between re-exports
**Files:** `Booklet_-_linear_format.pdf`, `Booklet_-_Saddle_Stitch.pdf` (re-edits)
A hardcoded PDF object number for "the QR image" silently pointed at the
wrong image after the designer re-exported the file (object 564 → 560).
Fixed by always **re-locating the QR by content scan** (search every
roughly-square image for a decodable barcode) rather than reusing a
remembered object ID.

### Photo running into the spine on a saddle-stitched centre spread
**File:** `Booklet_-_Saddle_Stitch.pdf`
An image started 0.42mm from the fold instead of clearing it by the
standard 5mm, on the one spread that's a physical single sheet (the
centre). Small enough to be easy to miss visually; caught by measuring
pixel distance from the fold line programmatically rather than eyeballing.
Confirmed present in both the original and a later re-edit — not fixed
upstream, flagged twice.

### Registration mark colliding with the colour bar / fold mark
**Files:** narrow booklet pages, saddle-stitch spine
On pages narrow enough, the auto-placed registration target landed on top
of the colour bar or directly on the dashed spine fold mark. Fixed by
giving mark placement a set of fallback positions (centre → quarter →
other quarter) that actively avoid known occupied regions instead of
always defaulting to centre.

### Physical size declared ambiguously (pt vs mm)
**Files:** `Standee_1.pdf`, `Standee.pdf`
Recurring issue with Figma-originated exports: a frame built at, say,
750×1800 **pixels** gets written into the PDF as 750×1800 **points**,
which is a real but wrong physical size (264.6×635mm) rather than the
intended one. There's no way to recover true intent from the file alone —
guessing wrong on a real print run is expensive. **Resolved by asking the
person directly** both times rather than assuming; the two standees turned
out to have different correct answers (one really was the odd small size,
one was a proper roll-up).

### Ink coverage exceeding the coated limit
**File:** `A4_-_97.pdf` / `Frame_97`
342% TAC against a 330% ceiling, located to roughly 3mm² where two dark
elements' antialiased edges overlapped. Left as-is rather than globally
ink-limiting the file for a sub-pixel-scale, imperceptible excess — but
flagged explicitly, since an automated preflight at the print shop could
hard-reject on this number even though it has no visible or physical
consequence.

### Render memory limits on large-format pages
**Files:** `Frame_97/98/99` (33×72in), Marathi equivalents
Rendering a 33×72in page at 300dpi is ~214 million pixels — enough to blow
past PIL's default decompression-bomb guard and, separately, to exhaust
available memory outright (one batch crashed the whole container). Fixed
by scaling the internal bleed-extrusion render resolution down adaptively
based on physical page area, since bleed extrusion only ever needs the
outermost pixel row/column at reasonable fidelity, not a full 300dpi frame.

### False-positive bleed-seam flags on photographic/gradient edges
**Files:** most large photographic pieces (Diwali posters, Zenova)
The automated bleed-continuity check (sampling pixels just inside vs.
just outside the trim line) repeatedly flagged edges that were, on
inspection, completely fine — because backgrounds with real photographic
texture or a radial glow naturally vary by more than the check's
tolerance over a couple of millimetres. Resolved by checking the
**artwork's own internal gradient magnitude** at that scale as a
baseline, and by visually confirming the join in doubtful cases, rather
than trusting a single numeric threshold blind.

### Hard rectangular artifact leaking past rounded corners (real defect)
**File:** `Zenova.pdf`
The one confirmed structural bug in this whole pipeline. A pale rectangular
patch bled out past the rounded corner of two "glass pill" UI elements
after standard vector CMYK conversion — absent from the source render.
Root cause: this file's glow/blur/gradient look was built from **over
23,000 individually stacked bezier-curve fills** with no soft masks, no
shadings, and no transparency at all (a "baked mesh gradient," typical of
a certain kind of Figma export) — an unusually dense vector structure that
tripped something in Ghostscript's vector-preserving CMYK conversion path.
- **Fix**: bypassed the vector conversion entirely for this file. Re-
  rendered every page from the *original source* at 600dpi (a rendering
  path already proven correct throughout this project) and converted to
  CMYK as a true pixel-level ICC transform, rather than rewriting the PDF's
  internal colour operators. Trade-off: the output is a high-resolution
  raster rather than live vector text — sharp well past print standard,
  but no longer searchable or infinitely scalable.
- Confirmed via targeted before/after crops of the exact broken regions,
  not just a general diff.

### Hairline white seam at the trim line (separate real defect, same file)
**File:** `Zenova.pdf`
Distinct from the corner-leak bug above: a thin white line ran the full
width of the page exactly at the trim boundary, on both pages, visible
once flagged by an unusually large bleed-continuity delta (150+ vs. the
usual single digits). Root cause: the bleed strip and the artwork butted
exactly against each other with no overlap, and the PDF rasterizer left a
sub-pixel rounding gap between them. **Fixed by having every bleed strip
overlap 0.35mm into the artwork side** rather than sit flush against it —
invisible since it's the same extruded edge colour, and it closes the gap
on every file built afterward, not just this one.

### Misleading total-ink reading from registration marks
**File:** `Zenova.pdf`
A 400% TAC reading looked alarming until traced to the registration marks
themselves (intentionally 100% on all four channels, per standard prepress
convention, so they're visible on every plate) rather than the artwork.
The true artwork-only ink coverage was 317%. Lesson: **always measure ink
coverage on the artwork region alone**, excluding the marks margin, or a
correct file reads as a false failure.

### High transparency-group count as a risk signal, not an automatic failure
**File:** `print_zenova.pdf`
This file used 334 live PDF transparency groups — the exact mechanism most
associated with Ghostscript's known color-conversion bugs, and an order of
magnitude more than anything tested previously. Rather than assume it was
broken (or assume it was fine), it was tested directly: converted, diffed
against source, and every rounded-corner element specifically inspected at
full resolution. It converted cleanly — this file's gradients used proper
PDF shading patterns, not the pathological flat-fill-stack structure that
broke the other Zenova file. Kept as live vector output rather than
falling back to rasterization, since the fallback was only needed where a
defect was actually confirmed.

### Re-uploads of the "same" file needing fresh verification
**Files:** `Zenova.pdf`, `print_zenova.pdf` (multiple re-uploads)
Several times a file was re-uploaded under an identical filename expecting
either "no change" or "a small edit." Neither was assumed:
- One re-upload was byte-identical in the region that mattered (confirmed
  via hash and pixel diff) despite being sent as if revised — worth
  surfacing rather than silently rebuilding as if something had changed.
- One "small edit" really was small: a single sub-pixel border nudge on
  one card, isolated by diffing the new upload against the immediately
  prior version rather than the original.
- One later edit was substantive (a full subtitle rewrite) — again found
  by diffing against the prior version first, then confirming the new
  copy rendered correctly in the finished file.

---

## 3. Working rules that came out of this

- **Never trust a first-pass conversion by eye.** Diff the rendered output
  against the source pixel-for-pixel, and specifically inspect any rounded/
  glass/gradient UI element — that shape category is where the one real
  structural bug in this whole project showed up, twice.
- **Re-verify every fresh upload from scratch**, even under a filename
  that's been seen before. Check hash/size, diff against whatever the
  previous version was, and don't reuse old test results for a technically
  different file.
- **Decode every QR twice** — once from the source, once from the finished
  press-resolution file — and report the actual payload rather than
  assuming the image is correct because it looks like a QR.
- **Distinguish real defects from measurement noise.** A low-level diff
  across a gradient or textured background is often just normal rendering
  variance; check it against the artwork's own natural pixel-to-pixel
  variation before flagging it as a seam.
- **Ask rather than guess on ambiguous physical size.** Pixel-as-point
  export mistakes are common and costly to get wrong on a real run.
- **Check what "outlined text" actually means.** Some exports carry an
  invisible, metrics-only Type 3 font layer sitting over text that's
  already vector-outlined shapes — that's not a defect and doesn't need
  fixing, but it's worth confirming rather than assuming either way.
- **Keep a rasterize-from-source fallback ready** for files whose internal
  vector/transparency structure proves genuinely unsafe to convert
  directly — but reach for it only after a defect is actually confirmed,
  not as a precaution, since it costs live vector text to use it.
- **Never hardcode an object reference** (a QR image, a specific glyph)
  across file versions — re-locate by content every time, since re-exports
  reliably renumber internal objects.
