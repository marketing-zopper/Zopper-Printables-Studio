// 1 point = 1/72 inch. 1 inch = 25.4 mm.
export const PT_PER_MM = 72 / 25.4

export const mmToPt = (mm) => mm * PT_PER_MM
export const ptToMm = (pt) => pt / PT_PER_MM

export function formatMm(mm) {
  return `${Math.round(mm * 10) / 10}mm`
}
