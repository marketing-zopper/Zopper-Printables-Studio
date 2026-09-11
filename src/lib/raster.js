import * as pdfjsLib from 'pdfjs-dist'
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.js?url'
import jsQR from 'jsqr'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl

const MAX_RENDER_PIXELS = 11_000_000 // adaptive cap so large-format pages don't blow past canvas/memory limits
const TARGET_DPI = 300
const MIN_DPI = 96

export async function loadPdfJsDoc(arrayBuffer) {
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer })
  return loadingTask.promise
}

export function computeRenderDpi(widthPt, heightPt) {
  const wIn = widthPt / 72
  const hIn = heightPt / 72
  let dpi = TARGET_DPI
  const pixelsAtTarget = wIn * dpi * (hIn * dpi)
  if (pixelsAtTarget > MAX_RENDER_PIXELS) {
    dpi = dpi * Math.sqrt(MAX_RENDER_PIXELS / pixelsAtTarget)
  }
  return Math.max(dpi, MIN_DPI)
}

export async function renderPageToCanvas(pdfJsDoc, pageIndex, dpi) {
  const page = await pdfJsDoc.getPage(pageIndex + 1)
  const scale = dpi / 72
  const viewport = page.getViewport({ scale })
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(viewport.width)
  canvas.height = Math.round(viewport.height)
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  await page.render({ canvasContext: ctx, viewport }).promise
  return canvas
}

export function getBasePageGeometry(page) {
  const viewport = page.getViewport({ scale: 1 })
  return { widthPt: viewport.width, heightPt: viewport.height }
}

export function extrudeBleed(srcCanvas, bleedPx) {
  const w = srcCanvas.width
  const h = srcCanvas.height
  const out = document.createElement('canvas')
  out.width = w + bleedPx * 2
  out.height = h + bleedPx * 2
  const ctx = out.getContext('2d')

  if (bleedPx > 0) {
    ctx.drawImage(srcCanvas, 0, 0, w, 1, bleedPx, 0, w, bleedPx)
    ctx.drawImage(srcCanvas, 0, h - 1, w, 1, bleedPx, bleedPx + h, w, bleedPx)
    ctx.drawImage(srcCanvas, 0, 0, 1, h, 0, bleedPx, bleedPx, h)
    ctx.drawImage(srcCanvas, w - 1, 0, 1, h, bleedPx + w, bleedPx, bleedPx, h)
    ctx.drawImage(srcCanvas, 0, 0, 1, 1, 0, 0, bleedPx, bleedPx)
    ctx.drawImage(srcCanvas, w - 1, 0, 1, 1, bleedPx + w, 0, bleedPx, bleedPx)
    ctx.drawImage(srcCanvas, 0, h - 1, 1, 1, 0, bleedPx + h, bleedPx, bleedPx)
    ctx.drawImage(srcCanvas, w - 1, h - 1, 1, 1, bleedPx + w, bleedPx + h, bleedPx, bleedPx)
  }

  ctx.drawImage(srcCanvas, 0, 0, w, h, bleedPx, bleedPx, w, h)
  return out
}

// Crops the four bleed-margin bands out of a bled canvas (top/bottom span
// full width including corners; left/right span only the trim height).
// Used to keep bleed synthesis raster-only while the artwork itself stays
// vector — nobody zooms into the strip that gets trimmed off anyway.
export function cropBleedStrips(bledCanvas, bleedPx, origW, origH) {
  const crop = (sx, sy, sw, sh) => {
    const c = document.createElement('canvas')
    c.width = sw
    c.height = sh
    c.getContext('2d').drawImage(bledCanvas, sx, sy, sw, sh, 0, 0, sw, sh)
    return c
  }
  const fullW = origW + bleedPx * 2
  return {
    top: crop(0, 0, fullW, bleedPx),
    bottom: crop(0, bleedPx + origH, fullW, bleedPx),
    left: crop(0, bleedPx, bleedPx, origH),
    right: crop(bleedPx + origW, bleedPx, bleedPx, origH),
  }
}

function rgbToCmyk(r, g, b) {
  const k = 1 - Math.max(r, g, b) / 255
  if (k >= 1) return { c: 0, m: 0, y: 0, k: 1 }
  const c = (1 - r / 255 - k) / (1 - k)
  const m = (1 - g / 255 - k) / (1 - k)
  const y = (1 - b / 255 - k) / (1 - k)
  return { c, m, y, k }
}

// Simulated coated-stock CMYK preview: not a certified FOGRA39L ICC transform,
// just a visual approximation (mild dot-gain + paper-white compression) so
// the preview reads like a press proof rather than an RGB screen render.
export function applyCmykPreview(canvas) {
  const ctx = canvas.getContext('2d')
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const d = imageData.data
  const DOT_GAIN = 1.06
  const PAPER_WHITE = 248

  for (let i = 0; i < d.length; i += 4) {
    const { c, m, y, k } = rgbToCmyk(d[i], d[i + 1], d[i + 2])
    const k2 = Math.min(1, k * DOT_GAIN)
    d[i] = Math.round(PAPER_WHITE * (1 - Math.min(1, c * DOT_GAIN)) * (1 - k2))
    d[i + 1] = Math.round(PAPER_WHITE * (1 - Math.min(1, m * DOT_GAIN)) * (1 - k2))
    d[i + 2] = Math.round(PAPER_WHITE * (1 - Math.min(1, y * DOT_GAIN)) * (1 - k2))
  }
  ctx.putImageData(imageData, 0, 0)
  return canvas
}

export function estimateInkCoverage(canvas, stride = 6) {
  const ctx = canvas.getContext('2d')
  const { width, height } = canvas
  const imageData = ctx.getImageData(0, 0, width, height)
  const d = imageData.data
  let maxTac = 0
  let sumTac = 0
  let samples = 0
  let overLimitSamples = 0

  for (let y = 0; y < height; y += stride) {
    for (let x = 0; x < width; x += stride) {
      const i = (y * width + x) * 4
      const { c, m, y: yy, k } = rgbToCmyk(d[i], d[i + 1], d[i + 2])
      const tac = (c + m + yy + k) * 100
      maxTac = Math.max(maxTac, tac)
      sumTac += tac
      samples++
      if (tac > 330) overLimitSamples++
    }
  }

  return {
    maxTac: Math.round(maxTac),
    avgTac: Math.round(sumTac / Math.max(samples, 1)),
    overLimitPct: Math.round((overLimitSamples / Math.max(samples, 1)) * 1000) / 10,
  }
}

export function decodeQrFromCanvas(canvas) {
  const ctx = canvas.getContext('2d')
  const { width, height } = canvas
  const maxSide = 1800
  let workCanvas = canvas
  if (Math.max(width, height) > maxSide) {
    const scale = maxSide / Math.max(width, height)
    workCanvas = document.createElement('canvas')
    workCanvas.width = Math.round(width * scale)
    workCanvas.height = Math.round(height * scale)
    workCanvas.getContext('2d').drawImage(canvas, 0, 0, workCanvas.width, workCanvas.height)
  }
  const wctx = workCanvas.getContext('2d')
  const imageData = wctx.getImageData(0, 0, workCanvas.width, workCanvas.height)
  const result = jsQR(imageData.data, workCanvas.width, workCanvas.height)
  return result ? { found: true, payload: result.data } : { found: false, payload: null }
}

export function canvasToPngBytes(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(async (blob) => {
      if (!blob) return reject(new Error('Canvas export failed'))
      resolve(new Uint8Array(await blob.arrayBuffer()))
    }, 'image/png')
  })
}
