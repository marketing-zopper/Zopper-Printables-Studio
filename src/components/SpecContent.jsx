const BUILD_ROWS = [
  ['Colour', 'DeviceCMYK against FOGRA39L Coated (ISO 12647-2), relative colorimetric, black point compensation.'],
  ['Bleed', '3mm synthesised by edge-pixel extrusion — the outermost pixel on each side extended outward; corners get the corner pixel.'],
  ['Marks', 'Trim marks at each corner, 4 registration targets (auto-positioned to avoid the colour bar/caption/fold), a 22-patch colour bar, dashed fold marks, and a one-line caption.'],
  ['Boxes', 'TrimBox = artwork size · BleedBox = 3mm outside it · MediaBox = 15mm outside that · ArtBox = TrimBox. FOGRA39L OutputIntent embedded.'],
  ['Ink limit', '330% TAC (coated). Registration marks are deliberately 400% by design and sit outside the trim line — measure ink on the artwork only.'],
  ['QR codes', 'Decoded from source and again from the finished press-resolution file; the actual payload is reported, never assumed.'],
]

const DEFECTS = [
  ['Dummy / non-functional QR codes', 'A QR decoded to literal text, not a URL — caught by decoding every square image rather than trusting it visually.'],
  ['Mid-transition deck frames as static pages', 'Frames captured mid-animation had text cut in half; needed a corrected export from source.'],
  ['Panel sequencing errors across booklets', 'Deck order isn’t reading order — printer-spread and reader-spread conventions got mixed in the same file.'],
  ['QR object IDs shifting between re-exports', 'A hardcoded object number pointed at the wrong image after a re-export — fixed by re-locating QR by content scan, never by object ID.'],
  ['Photo running into the spine', 'An image cleared the fold by 0.42mm instead of the standard 5mm — caught by measuring pixel distance programmatically.'],
  ['Registration marks colliding with the colour bar', 'Fixed with fallback placements (centre → quarter → other quarter) instead of a fixed default.'],
  ['Ambiguous physical size (pt vs mm)', 'A Figma frame in pixels got written into the PDF as points — a real but wrong size. Resolved by asking directly, never guessing.'],
  ['Ink coverage exceeding the coated limit', '342% TAC on ~3mm² of overlapping antialiased edges — flagged explicitly rather than globally ink-limited.'],
  ['Render memory limits on large-format pages', 'A 33×72in page at 300dpi is ~214M pixels — fixed with adaptive render resolution based on page area.'],
  ['False-positive bleed-seam flags', 'Photographic/gradient edges naturally vary more than a flat tolerance allows — checked against the artwork’s own gradient magnitude instead.'],
  ['Hard rectangular artifact past rounded corners', 'The one confirmed structural bug: 23,000+ stacked bezier fills tripped a vector CMYK conversion path. Fixed by rasterizing from source at 600dpi instead.'],
  ['Hairline white seam at the trim line', 'A sub-pixel rounding gap between bleed and artwork — fixed by overlapping every bleed strip 0.35mm into the artwork side.'],
  ['Misleading total-ink reading from marks', 'A 400% TAC reading was the registration marks, not the artwork — true coverage was 317%.'],
  ['High transparency-group count ≠ automatic failure', '334 live transparency groups converted cleanly once tested directly — used as a risk signal, not an automatic fallback trigger.'],
  ['Re-uploads need fresh verification', 'Same filename ≠ same file — every re-upload is hashed, diffed against the prior version, and re-checked from scratch.'],
]

export default function SpecContent() {
  return (
    <>
      <h3 className="text-sm font-bold text-zblue-600 mb-3">The standard build</h3>
      <div className="space-y-3 mb-7">
        {BUILD_ROWS.map(([k, v]) => (
          <div key={k} className="flex gap-4 text-sm">
            <span className="w-28 shrink-0 font-semibold text-zink/70">{k}</span>
            <span className="text-zink/55 leading-relaxed">{v}</span>
          </div>
        ))}
      </div>

      <h3 className="text-sm font-bold text-zorange-600 mb-3">Defects found along the way</h3>
      <div className="space-y-3">
        {DEFECTS.map(([k, v]) => (
          <div key={k} className="rounded-2xl bg-zbg px-4 py-3">
            <p className="text-xs font-semibold text-zink/80">{k}</p>
            <p className="text-[11px] text-zink/50 mt-1 leading-relaxed">{v}</p>
          </div>
        ))}
      </div>
    </>
  )
}
