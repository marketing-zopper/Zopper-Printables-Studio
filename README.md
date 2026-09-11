# Zopper Printables Studio

A browser-only dashboard that turns a PDF into a press-ready file: 3mm bleed
(edge-pixel extrusion), trim + registration marks, a 22-patch colour bar,
dashed fold marks, a caption stamp, correct TrimBox/BleedBox/MediaBox/ArtBox,
an output intent, an ink-coverage (TAC) check, and QR verification — built to
the spec in `references/print-pipeline-notes.md`. No backend: every PDF is
read, transformed, and re-assembled client-side with `pdf.js`, `pdf-lib`, and
`jsQR`, and the result downloads straight from the browser.

Finished jobs (name, QA report, and the PDF itself) persist in this browser's
IndexedDB, so job history survives a refresh — nothing leaves the device.

## Run it

```bash
npm install
npm run dev       # http://localhost:5173
```

```bash
npm run build     # production build in dist/
npm run preview   # serve the production build locally
```

## Certified colour conversion

Every job converts through a real, certified ICC transform by default —
**Coated FOGRA39L** ships built in (`public/profiles/Coated_Fogra39L_VIGC_300.icc`).
No setup required.

- The conversion runs through [Little CMS](https://github.com/mm2/Little-CMS)
  (compiled to WebAssembly via
  [`lcms-wasm`](https://github.com/mattdesl/lcms-wasm)) — the same colour
  engine behind Photoshop and most prepress software — doing a real
  relative-colorimetric transform with black point compensation.
- Ink (TAC) coverage is computed from the real CMYK values, not a formula.
- The profile itself is embedded in the output PDF's OutputIntent
  (`DestOutputProfile`), so a print shop's preflight tool can verify it
  directly instead of taking a name on trust.
- Go to **Settings → Colour profile** to upload a different CMYK output
  profile (e.g. your print shop's own) — it overrides the built-in default
  for every job, stored only in this browser's IndexedDB, never uploaded
  anywhere.

The output page is still a rasterized image (not live vector text) either
way — a browser can't rewrite a PDF's internal vector colour operators the
way a tool like Ghostscript does, so this is certified *colour*, not a
vector-preserving PDF/X-4 conversion.

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
