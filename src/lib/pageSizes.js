// Output (trim) sizes a job can be built to. Presets are the exact ISO 216
// dimensions in millimetres — never derived from points, so A4 is 210×297, not
// the 209.9×297.0 that a 595×842pt export rounds to.
import { mmToPt } from './units'

export const PAGE_SIZE_PRESETS = {
  A4: { label: 'A4', widthMm: 210, heightMm: 297 },
  A5: { label: 'A5', widthMm: 148, heightMm: 210 },
}

// Custom sizes can be typed in mm or px. Pixels are 1/72in (1px = 1pt) — the same
// unit design tools write into PDFs, so a 595×842px frame comes out as A4.
export const PX_PER_INCH = 72
export const pxToMm = (px) => (px * 25.4) / PX_PER_INCH
export const mmToPx = (mm) => (mm * PX_PER_INCH) / 25.4

export const MIN_CUSTOM_MM = 10
export const MAX_CUSTOM_MM = 3000

const PRESET_MATCH_TOLERANCE = 0.03 // a design within 3% of A4/A5 (either orientation) is treated as that size
const ASPECT_MATCH_TOLERANCE = 0.015 // A-series share one aspect ratio (1:√2)
const A_SERIES_ASPECT = 1 / Math.SQRT2

// A preset keeps its portrait dimensions and follows each page's orientation
// (autoOrient); a custom size is applied exactly as given.
export function presetOverride(id) {
  const { widthMm, heightMm } = PAGE_SIZE_PRESETS[id]
  return { preset: id, widthMm, heightMm, autoOrient: true }
}

export function customOverride(widthMm, heightMm) {
  const valid = [widthMm, heightMm].every((v) => Number.isFinite(v) && v >= MIN_CUSTOM_MM && v <= MAX_CUSTOM_MM)
  return { preset: 'custom', widthMm, heightMm, autoOrient: false, invalid: !valid }
}

// Initial size for a freshly read design. A design that already is A4/A5 gets
// that exact preset (so 425×595pt becomes a true 148×210mm, not 149.9×209.9).
// An oversized page with an A-series aspect (a 3× Figma export, say) is offered
// as A4. Anything else starts as a custom size equal to the artwork's own.
export function suggestSizeOverride(widthMm, heightMm, { oversized = false } = {}) {
  const short = Math.min(widthMm, heightMm)
  const long = Math.max(widthMm, heightMm)

  for (const id of Object.keys(PAGE_SIZE_PRESETS)) {
    const p = PAGE_SIZE_PRESETS[id]
    if (Math.abs(short / p.widthMm - 1) <= PRESET_MATCH_TOLERANCE && Math.abs(long / p.heightMm - 1) <= PRESET_MATCH_TOLERANCE) {
      return presetOverride(id)
    }
  }
  if (oversized && Math.abs(short / long / A_SERIES_ASPECT - 1) <= ASPECT_MATCH_TOLERANCE) return presetOverride('A4')
  return customOverride(Math.round(widthMm * 100) / 100, Math.round(heightMm * 100) / 100)
}

// Resolves an override to the trim size (in pt) for one page, turning a preset
// to match the artwork's orientation. Also reports how much that scaling
// stretches the artwork — non-uniform scaling distorts it.
export function resolveTrimPt(override, artWpt, artHpt) {
  let widthPt = mmToPt(override.widthMm)
  let heightPt = mmToPt(override.heightMm)
  if (override.autoOrient && artWpt > artHpt !== widthPt > heightPt) [widthPt, heightPt] = [heightPt, widthPt]
  const stretchPct = Math.abs(widthPt / heightPt / (artWpt / artHpt) - 1) * 100
  return { widthPt, heightPt, stretchPct }
}
