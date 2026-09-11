import { PDFName, PDFString, rgb } from 'pdf-lib'
import { mmToPt } from './units'
import { COLOR_BAR_PATCHES } from './colorBar'

const BLACK = rgb(0, 0, 0)
const toRgb01 = ({ r, g, b }) => rgb(r / 255, g / 255, b / 255)

export function setPdfBox(page, name, x0, y0, x1, y1) {
  page.node.set(PDFName.of(name), page.doc.context.obj([x0, y0, x1, y1]))
}

export function drawTrimMarks(page, trimX0, trimY0, trimX1, trimY1) {
  const gap = mmToPt(2)
  const len = mmToPt(5)
  const corners = [
    { x: trimX0, y: trimY0, dx: -1, dy: -1 },
    { x: trimX1, y: trimY0, dx: 1, dy: -1 },
    { x: trimX0, y: trimY1, dx: -1, dy: 1 },
    { x: trimX1, y: trimY1, dx: 1, dy: 1 },
  ]
  for (const { x, y, dx, dy } of corners) {
    page.drawLine({
      start: { x: x + dx * gap, y },
      end: { x: x + dx * (gap + len), y },
      thickness: 0.5,
      color: BLACK,
    })
    page.drawLine({
      start: { x, y: y + dy * gap },
      end: { x, y: y + dy * (gap + len) },
      thickness: 0.5,
      color: BLACK,
    })
  }
}

function drawRegistrationTarget(page, cx, cy) {
  const r = mmToPt(1.8)
  page.drawEllipse({ x: cx, y: cy, xScale: r, yScale: r, borderColor: BLACK, borderWidth: 0.6 })
  page.drawEllipse({ x: cx, y: cy, xScale: r * 0.35, yScale: r * 0.35, color: BLACK })
  page.drawLine({ start: { x: cx - r * 1.6, y: cy }, end: { x: cx + r * 1.6, y: cy }, thickness: 0.5, color: BLACK })
  page.drawLine({ start: { x: cx, y: cy - r * 1.6 }, end: { x: cx, y: cy + r * 1.6 }, thickness: 0.5, color: BLACK })
}

// Registration targets default to top-left/top-right/left-mid/right-mid so
// they clear the bottom colour bar, caption, and any dashed spine fold.
export function drawRegistrationMarks({ page, mediaW, mediaH, marginPt, foldAxis }) {
  const inset = marginPt / 2
  const positions = [
    { x: inset, y: mediaH - inset },
    { x: mediaW - inset, y: mediaH - inset },
  ]
  if (foldAxis === 'vertical') {
    positions.push({ x: inset, y: mediaH * 0.5 })
    positions.push({ x: mediaW - inset, y: mediaH * 0.5 })
  } else {
    positions.push({ x: inset, y: mediaH * 0.35 })
    positions.push({ x: mediaW - inset, y: mediaH * 0.65 })
  }
  positions.forEach((p) => drawRegistrationTarget(page, p.x, p.y))
}

export function drawColorBar(page, trimX0, trimX1, marginPt) {
  const patches = COLOR_BAR_PATCHES
  const barHeight = Math.min(mmToPt(4), marginPt * 0.4)
  const barY = (marginPt - barHeight) / 2
  const maxWidth = (trimX1 - trimX0) * 0.7
  const patchW = Math.min(mmToPt(3), maxWidth / patches.length)
  const totalW = patchW * patches.length
  const startX = trimX0 + ((trimX1 - trimX0) - totalW) / 2

  patches.forEach((color, i) => {
    page.drawRectangle({
      x: startX + i * patchW,
      y: barY,
      width: patchW,
      height: barHeight,
      color: toRgb01(color),
      borderColor: rgb(0.6, 0.6, 0.6),
      borderWidth: 0.15,
    })
  })
}

export function drawFoldMarks(page, mediaW, mediaH, fold) {
  const dash = { dashArray: [4, 3], thickness: 0.6, color: rgb(0.3, 0.3, 0.35) }
  if (fold === 'half-vertical') {
    page.drawLine({ start: { x: mediaW / 2, y: 0 }, end: { x: mediaW / 2, y: mediaH }, ...dash })
  } else if (fold === 'half-horizontal') {
    page.drawLine({ start: { x: 0, y: mediaH / 2 }, end: { x: mediaW, y: mediaH / 2 }, ...dash })
  } else if (fold === 'tri-vertical') {
    page.drawLine({ start: { x: mediaW / 3, y: 0 }, end: { x: mediaW / 3, y: mediaH }, ...dash })
    page.drawLine({ start: { x: (mediaW * 2) / 3, y: 0 }, end: { x: (mediaW * 2) / 3, y: mediaH }, ...dash })
  }
}

export async function drawCaption(page, font, text) {
  const size = 6.2
  page.drawText(text, {
    x: mmToPt(6),
    y: mmToPt(2.2),
    size,
    font,
    color: rgb(0.25, 0.25, 0.3),
  })
}

// With no ICC profile supplied, the file only *names* its colour target
// (no embedded profile a RIP could actually load and honour). When a real
// profile is provided, we embed the profile itself as an ICCBased stream —
// this is what a preflight tool actually checks for a certified file.
export function setOutputIntent(pdfDoc, icc = null) {
  const context = pdfDoc.context
  const fields = {
    Type: PDFName.of('OutputIntent'),
    S: PDFName.of('GTS_PDFX'),
    OutputConditionIdentifier: PDFString.of(icc?.name || 'FOGRA39'),
    OutputCondition: PDFString.of(icc ? icc.name : 'Coated FOGRA39 (ISO 12647-2:2004)'),
    RegistryName: PDFString.of('http://www.color.org'),
    Info: PDFString.of(
      icc
        ? `${icc.name} - relative colorimetric, black point compensation, embedded ICC profile`
        : 'FOGRA39L Coated target - relative colorimetric, black point compensation (preview build, no embedded ICC)',
    ),
  }

  if (icc?.bytes) {
    const profileStream = context.flateStream(icc.bytes, { N: 4, Alternate: PDFName.of('DeviceCMYK') })
    fields.DestOutputProfile = context.register(profileStream)
  }

  const intent = context.obj(fields)
  pdfDoc.catalog.set(PDFName.of('OutputIntents'), context.obj([intent]))
}
