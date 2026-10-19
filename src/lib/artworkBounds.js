// Finds the real artwork rectangle inside an exported page.
//
// Some exports (browser "print to PDF", Figma frames placed on a larger page)
// put the design inside a flat white margin. If that margin is treated as part
// of the artwork, it ends up *inside* the trim box and its white edge pixels get
// extruded as "bleed" — so the finished sheet shows a white ring between the
// trim marks and the design. Detecting the artwork rectangle first lets the
// trim box sit on the design's own edge, with bleed extruded from real artwork.
//
// Deliberately conservative: it only reports a crop when the page looks like
// "a solid artwork rectangle on a flat background ring". Anything else (a white
// poster with content floating in it, a design with its own white header band)
// returns null and is left untouched.

const BG_TOLERANCE = 6 // per-channel; the margin is flat paper-white straight from the renderer
const CONTENT_START = 0.02 // a line counts as "artwork has started" once 2% of it is non-background
const EDGE_SOLIDITY = 0.85 // ...and the line just inside must span at least this much of the page
const MAX_MARGIN_FRACTION = 0.06 // wider than this per side is a deliberate layout, not an export artifact
const EDGE_INSET_PX = 2 // step past the anti-aliased artwork edge so bleed extrudes a solid colour

// `image` is { data, width, height } with RGBA data (an ImageData works as-is).
// Returns { left, top, right, bottom } in pixels (right/bottom exclusive), or null when
// there is nothing to crop or the page doesn't look like an artwork-in-a-margin export.
export function detectArtworkBounds({ data, width: w, height: h }) {
  if (w < 16 || h < 16) return null

  const refClear = data[3] < 16
  const r0 = data[0]
  const g0 = data[1]
  const b0 = data[2]
  const isBackground = (i) => {
    if (data[i + 3] < 16) return refClear
    if (refClear) return false
    return (
      Math.abs(data[i] - r0) <= BG_TOLERANCE &&
      Math.abs(data[i + 1] - g0) <= BG_TOLERANCE &&
      Math.abs(data[i + 2] - b0) <= BG_TOLERANCE
    )
  }

  // The margin ring only exists if every corner is background.
  const corners = [0, (w - 1) * 4, (h - 1) * w * 4, ((h - 1) * w + (w - 1)) * 4]
  if (!corners.every(isBackground)) return null

  const rowContent = new Uint32Array(h)
  const colContent = new Uint32Array(w)
  for (let y = 0; y < h; y++) {
    let rowCount = 0
    const rowStart = y * w * 4
    for (let x = 0; x < w; x++) {
      if (!isBackground(rowStart + x * 4)) {
        rowCount++
        colContent[x]++
      }
    }
    rowContent[y] = rowCount
  }

  // Margin (in px) on one side: distance to the first line with real content,
  // provided that line is followed by a solid artwork edge. -1 = not a clean margin.
  const marginOf = (contentAt, length, span) => {
    const limit = Math.floor(length * MAX_MARGIN_FRACTION)
    for (let k = 0; k <= limit; k++) {
      if (contentAt(k) / span < CONTENT_START) continue
      const inner = k + EDGE_INSET_PX
      return inner < length && contentAt(inner) / span >= EDGE_SOLIDITY ? k : -1
    }
    return -1
  }

  const top = marginOf((k) => rowContent[k], h, w)
  const bottom = marginOf((k) => rowContent[h - 1 - k], h, w)
  const left = marginOf((k) => colContent[k], w, h)
  const right = marginOf((k) => colContent[w - 1 - k], w, h)
  if (top < 0 || bottom < 0 || left < 0 || right < 0) return null
  if (top + bottom + left + right === 0) return null

  // Only step inside the edge on sides that actually had a margin.
  const pad = (margin) => (margin > 0 ? margin + EDGE_INSET_PX : 0)
  return {
    left: pad(left),
    top: pad(top),
    right: w - pad(right),
    bottom: h - pad(bottom),
  }
}
