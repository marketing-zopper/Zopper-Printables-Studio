import { PDFDocument, StandardFonts } from 'pdf-lib'
import {
  loadPdfJsDoc,
  computeRenderDpi,
  renderPageToCanvas,
  getBasePageGeometry,
  extrudeBleed,
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

const MARGIN_MM = 15
const SUSPICIOUS_SIZE_MM = 400

export async function inspectPdf(file) {
  const buffer = await file.arrayBuffer()
  const pdfJsDoc = await loadPdfJsDoc(buffer.slice(0))
  const firstPage = await pdfJsDoc.getPage(1)
  const { widthPt, heightPt } = getBasePageGeometry(firstPage)
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
  }
}

export async function processPdf({ file, buffer, options, onProgress }) {
  const {
    jobName,
    bleedMm = 3,
    fold = 'none',
    cmykPreview = true,
    sizeOverride = null, // { widthMm, heightMm } applied uniformly to every page
  } = options

  const report = { jobName, bleedMm, fold, cmykPreview, pages: [], warnings: [] }
  const progress = (payload) => onProgress && onProgress(payload)

  const srcBuffer = buffer || (await file.arrayBuffer())
  const pdfJsDoc = await loadPdfJsDoc(srcBuffer.slice(0))
  const pageCount = pdfJsDoc.numPages
  report.pageCount = pageCount

  const outDoc = await PDFDocument.create()
  outDoc.setTitle(jobName)
  outDoc.setProducer('Zopper Printables Studio')
  outDoc.setCreator('Zopper Printables Studio')
  outDoc.setSubject('Print-ready export (FOGRA39L target, 3mm bleed synthesised)')
  const font = await outDoc.embedFont(StandardFonts.Helvetica)

  const marginPt = mmToPt(MARGIN_MM)
  const bleedPt = mmToPt(bleedMm)

  for (let i = 0; i < pageCount; i++) {
    progress({ step: 'render', pageIndex: i, pageCount, message: `Rendering page ${i + 1} of ${pageCount}` })

    const pdfJsPage = await pdfJsDoc.getPage(i + 1)
    const baseGeom = getBasePageGeometry(pdfJsPage)
    let trimWpt = baseGeom.widthPt
    let trimHpt = baseGeom.heightPt

    if (sizeOverride) {
      trimWpt = mmToPt(sizeOverride.widthMm)
      trimHpt = mmToPt(sizeOverride.heightMm)
    }

    const dpi = computeRenderDpi(baseGeom.widthPt, baseGeom.heightPt)
    const sourceCanvas = await renderPageToCanvas(pdfJsDoc, i, dpi)

    progress({ step: 'qr-source', pageIndex: i, pageCount, message: `Scanning page ${i + 1} for QR codes` })
    const qrSource = decodeQrFromCanvas(sourceCanvas)

    progress({ step: 'bleed', pageIndex: i, pageCount, message: `Synthesising ${bleedMm}mm bleed on page ${i + 1}` })
    const pxPerMm = dpi / 25.4
    const bleedPx = Math.round(bleedMm * pxPerMm)
    let finalCanvas = extrudeBleed(sourceCanvas, bleedPx)

    if (cmykPreview) {
      progress({ step: 'cmyk', pageIndex: i, pageCount, message: `Applying CMYK preview to page ${i + 1}` })
      finalCanvas = applyCmykPreview(finalCanvas)
    }

    progress({ step: 'ink', pageIndex: i, pageCount, message: `Estimating ink coverage on page ${i + 1}` })
    const ink = estimateInkCoverage(sourceCanvas)

    progress({ step: 'qr-final', pageIndex: i, pageCount, message: `Re-verifying QR on finished page ${i + 1}` })
    const qrFinal = decodeQrFromCanvas(finalCanvas)

    progress({ step: 'marks', pageIndex: i, pageCount, message: `Placing marks & boxes on page ${i + 1}` })
    const pngBytes = await canvasToPngBytes(finalCanvas)
    const png = await outDoc.embedPng(pngBytes)

    const mediaW = trimWpt + bleedPt * 2 + marginPt * 2
    const mediaH = trimHpt + bleedPt * 2 + marginPt * 2
    const page = outDoc.addPage([mediaW, mediaH])

    const imgW = trimWpt + bleedPt * 2
    const imgH = trimHpt + bleedPt * 2
    page.drawImage(png, { x: marginPt, y: marginPt, width: imgW, height: imgH })

    const bleedX0 = marginPt
    const bleedY0 = marginPt
    const bleedX1 = mediaW - marginPt
    const bleedY1 = mediaH - marginPt
    const trimX0 = bleedX0 + bleedPt
    const trimY0 = bleedY0 + bleedPt
    const trimX1 = bleedX1 - bleedPt
    const trimY1 = bleedY1 - bleedPt

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
    await drawCaption(
      page,
      font,
      `${jobName} · Page ${i + 1}/${pageCount} · DeviceCMYK preview (FOGRA39L target) · Trim ${trimWmm}×${trimHmm}mm · Bleed ${bleedMm}mm`,
    )

    const warnings = []
    if (ink.maxTac > 330) warnings.push(`Ink coverage peaks at ${ink.maxTac}% TAC, above the 330% coated ceiling.`)
    if (qrSource.found && qrFinal.found && qrSource.payload !== qrFinal.payload) {
      warnings.push('QR payload changed between source and finished render — verify manually.')
    }
    if (qrSource.found && !qrFinal.found) {
      warnings.push('QR decoded from source but not from the finished page — verify manually.')
    }

    report.pages.push({
      index: i,
      trimWmm,
      trimHmm,
      dpi: Math.round(dpi),
      ink,
      qrSource,
      qrFinal,
      warnings,
    })
  }

  progress({ step: 'assemble', pageIndex: pageCount - 1, pageCount, message: 'Embedding output intent & finalising document' })
  setOutputIntent(outDoc)

  const bytes = await outDoc.save()
  progress({ step: 'done', pageIndex: pageCount - 1, pageCount, message: 'Print-ready file assembled' })

  return { bytes, report }
}
