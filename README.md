# Zopper Printables Studio

A dashboard that turns a PDF into a press-ready file: sharp vector artwork
(the original page is embedded as-is, not rasterized), 3mm bleed (edge-pixel
extrusion, raster-only in the trimmed-off margin), trim + registration
marks, a 22-patch colour bar, dashed fold marks, a caption stamp, correct
TrimBox/BleedBox/MediaBox/ArtBox, an output intent, an ink-coverage (TAC)
check, and QR verification — built to the spec in
`references/print-pipeline-notes.md`. The PDF itself is read, transformed,
and re-assembled entirely client-side with `pdf.js`, `pdf-lib`, and `jsQR`.

Sign-in is required (Supabase Auth, restricted to `@zopper.com` addresses),
and finished jobs — name, QA report, and the PDF itself — are saved to a
shared Supabase project, so job history is the same for everyone on the
team and survives across devices, not just this browser.

## Sharp by default (vector, not rasterized)

Earlier builds rendered every page to a raster image before reassembling it —
correct-looking on screen, but it pixelated on zoom since text and shapes
lost their vector precision. That's fixed: **the original PDF page is now
embedded directly as a vector object** (via `pdf-lib`'s `embedPage`/`drawPage`,
a real PDF Form XObject reference) inside the TrimBox, so text and vector
art stay infinitely sharp — verified by confirming the source PDF's own text
is still extractable from the output. Only the newly-synthesised bleed
margin (which has no "real" content and gets trimmed off in production)
is raster — four thin edge-extruded strips, not a full-page image.

Toggle **Flatten & convert** per job (off by default) to go back to the old
full-rasterize-and-convert pipeline for cases where you specifically need
CMYK baked into pixels rather than declared via the output intent.

## Run it

```bash
cp .env.example .env.local   # fill in your Supabase project URL + anon key
npm install
npm run dev       # http://localhost:5173
```

```bash
npm run build     # production build in dist/
npm run preview   # serve the production build locally
```

### Supabase setup (one-time, per project)

1. Create a Supabase project, then copy its **Project URL** and **anon/public
   key** (Settings → API) into `.env.local` as `VITE_SUPABASE_URL` and
   `VITE_SUPABASE_ANON_KEY`. Never use the `service_role` key here — this is
   a client-side app, and everything is designed to work safely with the
   anon key plus Row Level Security.
2. Paste `supabase/schema.sql` into the Supabase SQL Editor and run it once.
   It's idempotent (safe to re-run). It sets up:
   - `profiles` and `jobs` tables with Row Level Security — anyone signed in
     can read all jobs (shared team history), but only the creator of a job
     can delete it.
   - A database trigger that rejects any signup whose email doesn't end in
     `@zopper.com`, enforced server-side so it can't be bypassed by calling
     the Supabase API directly.
   - A trigger that auto-creates a `profiles` row for every new user.
   - The `job-pdfs` Storage bucket (private) and its access policies.
   - Realtime enabled on `jobs`, so everyone's list updates live.
3. In Authentication → Providers → Email, decide whether to require email
   confirmation before a new signup can sign in (on by default). Either way
   works — the app shows a "check your email" screen when confirmation is
   pending.

## Certified colour conversion

**Coated FOGRA39L** ships built in (`public/profiles/Coated_Fogra39L_VIGC_300.icc`).
No setup required.

- Ink (TAC) coverage is always computed through a real ICC transform via
  [Little CMS](https://github.com/mm2/Little-CMS) (compiled to WebAssembly
  via [`lcms-wasm`](https://github.com/mattdesl/lcms-wasm)) — the same
  colour engine behind Photoshop and most prepress software — not a formula,
  regardless of whether you flatten to raster.
- The profile itself is embedded in the output PDF's OutputIntent
  (`DestOutputProfile`), so a print shop's preflight tool can verify it
  directly instead of taking a name on trust.
- By default (sharp vector mode), the artwork's own pixels are **not**
  altered — the ICC profile is declared for the print shop's RIP to honour,
  which is standard PDF/X practice and keeps the vector content untouched.
- Check **Flatten & convert** on a job to rasterize it and bake the ICC
  conversion directly into pixels — trades vector sharpness for pre-converted
  colour, only needed for specific press workflows or PDF/X requirements.
- Go to **Settings → Colour profile** to upload a different CMYK output
  profile (e.g. your print shop's own) — it overrides the built-in default
  for every job, stored only in this browser's IndexedDB, never uploaded
  anywhere.

### FOGRA39L licensing

The bundled profile (`Coated_Fogra39L_VIGC_300.icc`, ~8.6MB, fetched lazily —
not part of the JS bundle) is redistributed unmodified. Per
[Fogra's own terms](https://fogra.org/en/downloads/work-tools/characterisation-data):
*"Free use and redistribution of the Fogra characterisation data is
permitted, including redistribution as part of commercial and non-commercial
software, provided that the data are distributed unmodified and Fogra is
identified as the source."* This specific build is credited to VIGC /
X-Rite, Inc. via the [ICC profile registry entry](https://registry.color.org/profile-registry/Coated_Fogra39L_VIGC_300),
which states it *"may be used, embedded, exchanged, and shared without
restriction"* (not to be altered or sold). Source file:
https://registry.color.org/profile-registry/profiles/Coated_Fogra39L_VIGC_300.icc

## Other notes

- If a page's physical size looks unusually large (a common symptom of a
  Figma pixel-as-point export), the app asks you to confirm or correct the
  trim size before processing rather than guessing.
