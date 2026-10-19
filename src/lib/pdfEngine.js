import { PDFDocument, StandardFonts } from 'pdf-lib'
import {
  loadPdfJsDoc,
  computeRenderDpi,
  renderPageToCanvas,
  getBasePageGeometry,
  findArtworkBounds,
  cropCanvas,
  extrudeBleed,
  cropBleedStrips,
  applyCmykPreview,
  estimateInkCoverage,
  decodeQrFromCanvas,
  canvasToPngBytes,
} from './raster'
import {
  setPdfBox,
  drawTrimMarks,
  drawRegistrationMarks,
  drawColorBar,
  drawFoldMarks,
  drawCaption,
  setOutputIntent,
} from './pdfMarks'
import { mmToPt, ptToMm } from './units'
import { resolveTrimPt, suggestSizeOverride } from './pageSizes'
import { createCmykConverter } from './colorEngine'

const MARGIN_MM = 15
const SUSPICIOUS_SIZE_MM = 400
const BLEED_OVERLAP_MM = 0.35 // how far each bleed strip tucks under the artwork edge
const VERIFY_DPI_CAP = 150 // the final QR re-check only needs to be legible, not press-resolution

const INSPECT_RENDER_PIXELS = 2_000_000 // upload-time look at page 1 only needs to find the artwork edge
const STRETCH_WARN_PCT = 2 // below this, fitting the artwork to an exact A4/A5 is imperceptible; above it, distortion shows

// Finds the real artwork rectangle on a rendered page (see artworkBounds.js) and
// maps it back into the source PDF's user space. Returns null if the page is
// rotated or has no flat margin around the design.
function measureArtwork(pdfJsPage, baseGeom, canvas) {
  const bounds = pdfJsPage.rotate ? null : findArtworkBounds(canvas)
  if (!bounds) return null

  const pxPerPtX = canvas.width / baseGeom.widthPt
  const pxPerPtY = canvas.height / baseGeom.heightPt
  const [viewX0, , , viewY1] = pdfJsPage.view
  const boxPt = {
    left: viewX0 + bounds.left / pxPerPtX,
    right: viewX0 + bounds.right / pxPerPtX,
    top: viewY1 - bounds.top / pxPerPtY,
    bottom: viewY1 - bounds.bottom / pxPerPtY,
  }
  const toMm = (px, pxPerPt) => Math.round(ptToMm(px / pxPerPt) * 10) / 10
  return {
    bounds,
    boxPt,
    widthPt: boxPt.right - boxPt.left,
    heightPt: boxPt.top - boxPt.bottom,
    marginTrimMm: {
      left: toMm(bounds.left, pxPerPtX),
      top: toMm(bounds.top, pxPerPtY),
      right: toMm(canvas.width - bounds.right, pxPerPtX),
      bottom: toMm(canvas.height - bounds.bottom, pxPerPtY),
    },
  }
}

export async function inspectPdf(file) {
  const buffer = await file.arrayBuffer()
  const pdfJsDoc = await loadPdfJsDoc(buffer.slice(0))
  const firstPage = await pdfJsDoc.getPage(1)
  const baseGeom = getBasePageGeometry(firstPage)

  // Report the size of the design itself, not of the page it was exported onto.
  const inspectDpi = Math.min(100, Math.sqrt(INSPECT_RENDER_PIXELS / ((baseGeom.widthPt / 72) * (baseGeom.heightPt / 72))))
  const probeCanvas = await renderPageToCanvas(pdfJsDoc, 0, Math.max(inspectDpi, 24))
  const artwork = measureArtwork(firstPage, baseGeom, probeCanvas)
  const widthPt = artwork ? artwork.widthPt : baseGeom.widthPt
  const heightPt = artwork ? artwork.heightPt : baseGeom.heightPt

  const widthMm = ptToMm(widthPt)
  const heightMm = ptToMm(heightPt)
  const suspicious = Math.max(widthMm, heightMm) > SUSPICIOUS_SIZE_MM

  return {
    buffer,
    pageCount: pdfJsDoc.numPages,
    widthPt,
    heightPt,
    widthMm,
    heightMm,
    suspicious,
    suggestedSize: suggestSizeOverride(widthMm, heightMm, { oversized: suspicious }),
  }
}

export async function processPdf({ file, buffer, options, onProgress }) {
  const {
    jobName,
    bleedMm = 3,
    fold = 'none',
    sizeOverride = null, // { widthMm, heightMm, autoOrient } — see pageSizes.js; applied to every page
    iccProfile = null, // { bytes, name } — a real CMYK output profile, if the user supplied one
  } = options
  // default: keep artwork as sharp vector; true = old rasterize-everything path.
  // May be forced true below if the source can't be parsed for vector embedding.
  let flattenToRaster = options.flattenToRaster ?? false

  const report = { jobName, bleedMm, fold, pages: [], warnings: [], colorEngine: 'formula' }
  const progress = (payload) => onProgress && onProgress(payload)

  // The converter is used for real ink (TAC) measurement in both modes, and
  // additionally to convert pixels when flattening to raster.
  let converter = null
  if (iccProfile?.bytes) {
    progress({ step: 'cmyk', pageIndex: 0, pageCount: 1, message: `Loading ${iccProfile.name || 'colour profile'}…` })
    try {
      converter = await createCmykConverter(iccProfile.bytes)
      report.colorEngine = 'icc'
      report.iccProfileName = converter.name
    } catch (err) {
      report.warnings.push(`Could not use the supplied colour profile (${err.message}) — fell back to the formula-based estimate.`)
    }
  }

  const srcBuffer = buffer || (await file.arrayBuffer())
  const pdfJsDoc = await loadPdfJsDoc(srcBuffer.slice(0))

  let srcDoc = null
  if (!flattenToRaster) {
    try {
      srcDoc = await PDFDocument.load(srcBuffer.slice(0))
    } catch (err) {
      flattenToRaster = true
      report.warnings.push(`Could not parse this PDF for vector embedding (${err.message}) — fell back to rasterizing from source.`)
    }
  }

  const pageCount = pdfJsDoc.numPages
  report.pageCount = pageCount
  report.flattenToRaster = flattenToRaster

  const outDoc = await PDFDocument.create()
  outDoc.setTitle(jobName)
  outDoc.setProducer('Zopper Printables Studio')
  outDoc.setCreator('Zopper Printables Studio')
  outDoc.setSubject(
    flattenToRaster
      ? 'Print-ready export (rasterized, 3mm bleed synthesised)'
      : 'Print-ready export (vector artwork preserved, 3mm bleed synthesised)',
  )
  const font = await outDoc.embedFont(StandardFonts.Helvetica)

  const marginPt = mmToPt(MARGIN_MM)
  const bleedPt = mmToPt(bleedMm)
  const pageRecords = []

  try {
    for (let i = 0; i < pageCount; i++) {
      progress({ step: 'render', pageIndex: i, pageCount, message: `Rendering page ${i + 1} of ${pageCount}` })

      const pdfJsPage = await pdfJsDoc.getPage(i + 1)
      const baseGeom = getBasePageGeometry(pdfJsPage)

      const dpi = computeRenderDpi(baseGeom.widthPt, baseGeom.heightPt)
      const renderedCanvas = await renderPageToCanvas(pdfJsDoc, i, dpi)

      // If the design sits inside a flat white page margin, the trim box has to
      // sit on the design's own edge — otherwise the margin lands inside the trim
      // and gets extruded as bleed. Rotated pages are left alone (the crop box
      // is only mapped back to PDF space for upright pages).
      const artwork = measureArtwork(pdfJsPage, baseGeom, renderedCanvas)
      const sourceCanvas = artwork ? cropCanvas(renderedCanvas, artwork.bounds) : renderedCanvas
      const artBoxPt = artwork ? artwork.boxPt : null // artwork rectangle in the source PDF's user space
      const marginTrimMm = artwork ? artwork.marginTrimMm : null
      const artWpt = artwork ? artwork.widthPt : baseGeom.widthPt
      const artHpt = artwork ? artwork.heightPt : baseGeom.heightPt

      // The requested output size (A4 / A5 / custom). Scaling is exact; if the
      // artwork's shape differs from the target it is stretched, which we flag.
      let trimWpt = artWpt
      let trimHpt = artHpt
      let stretchPct = 0
      if (sizeOverride) {
        ;({ widthPt: trimWpt, heightPt: trimHpt, stretchPct } = resolveTrimPt(sizeOverride, artWpt, artHpt))
      }

      progress({ step: 'qr-source', pageIndex: i, pageCount, message: `Scanning page ${i + 1} for QR codes` })
      const qrSource = decodeQrFromCanvas(sourceCanvas)

      progress({ step: 'bleed', pageIndex: i, pageCount, message: `Synthesising ${bleedMm}mm bleed on page ${i + 1}` })
      const pxPerMm = dpi / 25.4
      const bleedPx = Math.round(bleedMm * pxPerMm)
      const bledCanvas = extrudeBleed(sourceCanvas, bleedPx)

      progress({ step: 'ink', pageIndex: i, pageCount, message: `Estimating ink coverage on page ${i + 1}` })
      const ink = converter ? converter.sampleInkCoverage(sourceCanvas) : estimateInkCoverage(sourceCanvas)

      progress({ step: 'marks', pageIndex: i, pageCount, message: `Placing artwork, marks & boxes on page ${i + 1}` })

      const mediaW = trimWpt + bleedPt * 2 + marginPt * 2
      const mediaH = trimHpt + bleedPt * 2 + marginPt * 2
      const page = outDoc.addPage([mediaW, mediaH])

      const bleedX0 = marginPt
      const bleedY0 = marginPt
      const bleedX1 = mediaW - marginPt
      const bleedY1 = mediaH - marginPt
      const trimX0 = bleedX0 + bleedPt
      const trimY0 = bleedY0 + bleedPt
      const trimX1 = bleedX1 - bleedPt
      const trimY1 = bleedY1 - bleedPt

      if (flattenToRaster) {
        progress({
          step: 'cmyk',
          pageIndex: i,
          pageCount,
          message: converter ? `Converting page ${i + 1} through ${converter.name}` : `Applying CMYK preview to page ${i + 1}`,
        })
        const convertedCanvas = converter ? converter.applyToCanvas(bledCanvas) : applyCmykPreview(bledCanvas)
        const pngBytes = await canvasToPngBytes(convertedCanvas)
        const png = await outDoc.embedPng(pngBytes)
        page.drawImage(png, { x: marginPt, y: marginPt, width: trimWpt + bleedPt * 2, height: trimHpt + bleedPt * 2 })
      } else {
        // Bleed strips go down first and reach BLEED_OVERLAP_MM under the artwork;
        // the artwork is drawn over them so no hairline of paper shows at the trim edge.
        if (bleedPx > 0) {
          const overlapPt = mmToPt(BLEED_OVERLAP_MM)
          const strips = cropBleedStrips(bledCanvas, bleedPx, sourceCanvas.width, sourceCanvas.height)
          const placements = [
            [strips.top, bleedX0, trimY1 - overlapPt, bleedX1 - bleedX0, bleedPt + overlapPt],
            [strips.bottom, bleedX0, bleedY0, bleedX1 - bleedX0, bleedPt + overlapPt],
            [strips.left, bleedX0, bleedY0, bleedPt + overlapPt, bleedY1 - bleedY0],
            [strips.right, trimX1 - overlapPt, bleedY0, bleedPt + overlapPt, bleedY1 - bleedY0],
          ]
          for (const [canvas, x, y, width, height] of placements) {
            const pngBytes = await canvasToPngBytes(canvas)
            const png = await outDoc.embedPng(pngBytes)
            page.drawImage(png, { x, y, width, height })
          }
        }

        const srcPage = srcDoc.getPages()[i]
        const embeddedPage = await outDoc.embedPage(srcPage, artBoxPt ?? undefined)
        page.drawPage(embeddedPage, { x: trimX0, y: trimY0, width: trimWpt, height: trimHpt })
      }

      setPdfBox(page, 'BleedBox', bleedX0, bleedY0, bleedX1, bleedY1)
      setPdfBox(page, 'TrimBox', trimX0, trimY0, trimX1, trimY1)
      setPdfBox(page, 'ArtBox', trimX0, trimY0, trimX1, trimY1)

      drawTrimMarks(page, trimX0, trimY0, trimX1, trimY1)
      const foldAxis = fold.includes('vertical') ? 'vertical' : fold === 'none' ? null : 'horizontal'
      drawRegistrationMarks({ page, mediaW, mediaH, marginPt, foldAxis })
      drawColorBar(page, trimX0, trimX1, marginPt)
      drawFoldMarks(page, mediaW, mediaH, fold)

      const trimWmm = Math.round(ptToMm(trimWpt) * 10) / 10
      const trimHmm = Math.round(ptToMm(trimHpt) * 10) / 10
      const colorLabel = flattenToRaster
        ? converter
          ? `${converter.name} (certified ICC, flattened)`
          : 'DeviceCMYK preview (flattened)'
        : `Vector artwork · ${converter ? converter.name : 'FOGRA39L'} target declared`
      await drawCaption(
        page,
        font,
        `${jobName} · Page ${i + 1}/${pageCount} · ${colorLabel} · Trim ${trimWmm}×${trimHmm}mm · Bleed ${bleedMm}mm`,
      )

      pageRecords.push({ index: i, trimWmm, trimHmm, dpi: Math.round(dpi), ink, qrSource, marginTrimMm, stretchPct })
    }

    progress({ step: 'assemble', pageIndex: pageCount - 1, pageCount, message: 'Embedding output intent & finalising document' })
    setOutputIntent(outDoc, converter ? { name: converter.name, bytes: iccProfile.bytes } : null)

    const bytes = await outDoc.save()

    // pdf.js may transfer/detach the buffer it's given to its worker, so hand
    // it a copy — `bytes` itself is returned below and must stay intact for
    // the download.
    const verifyDoc = await loadPdfJsDoc(bytes.slice(0))
    for (let i = 0; i < pageCount; i++) {
      progress({ step: 'verify', pageIndex: i, pageCount, message: `Re-verifying QR on the finished page ${i + 1}` })
      const record = pageRecords[i]
      const checkDpi = Math.min(record.dpi, VERIFY_DPI_CAP)
      const checkCanvas = await renderPageToCanvas(verifyDoc, i, checkDpi)
      const qrFinal = decodeQrFromCanvas(checkCanvas)

      const warnings = []
      if (record.stretchPct > STRETCH_WARN_PCT) {
        warnings.push(`Artwork shape differs from the ${record.trimWmm}×${record.trimHmm}mm target by ${record.stretchPct.toFixed(1)}%, so it was stretched to fit.`)
      }
      if (record.ink.maxTac > 330) warnings.push(`Ink coverage peaks at ${record.ink.maxTac}% TAC, above the 330% coated ceiling.`)
      if (record.qrSource.found && qrFinal.found && record.qrSource.payload !== qrFinal.payload) {
        warnings.push('QR payload changed between source and finished file — verify manually.')
      }
      if (record.qrSource.found && !qrFinal.found) {
        warnings.push('QR decoded from source but not from the finished file — verify manually.')
      }

      report.pages.push({ ...record, qrFinal, warnings })
    }

    progress({ step: 'done', pageIndex: pageCount - 1, pageCount, message: 'Print-ready file assembled' })
    return { bytes, report }
  } finally {
    if (converter) converter.dispose()
  }
}
