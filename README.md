# Zopper Printables Studio

A browser-only dashboard that turns a PDF into a press-ready file: 3mm bleed
(edge-pixel extrusion), trim + registration marks, a 22-patch colour bar,
dashed fold marks, a caption stamp, correct TrimBox/BleedBox/MediaBox/ArtBox,
a FOGRA39L output intent, an ink-coverage (TAC) check, and QR verification —
built to the spec in `references/print-pipeline-notes.md`. No backend: every
PDF is read, transformed, and re-assembled client-side with `pdf.js`,
`pdf-lib`, and `jsQR`, and the result downloads straight from the browser.

## Run it

```bash
npm install
npm run dev       # http://localhost:5173
```

```bash
npm run build     # production build in dist/
npm run preview   # serve the production build locally
```

## Notes

- The "CMYK preview" toggle applies a visual coated-stock approximation
  (mild dot gain, compressed paper white) — it is **not** a certified
  FOGRA39L ICC transform, since that requires an embedded ICC profile this
  browser-only tool doesn't bundle. The PDF's OutputIntent still declares
  the FOGRA39L target for downstream RIP/preflight software.
- If a page's physical size looks unusually large (a common symptom of a
  Figma pixel-as-point export), the app asks you to confirm or correct the
  trim size before processing rather than guessing.
