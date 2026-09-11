// Real ICC-based colour conversion, powered by Little CMS (the same engine
// behind Photoshop/most prepress software) compiled to WebAssembly. This
// replaces the RGB->CMYK formula approximation with an actual relative-
// colorimetric transform through a user-supplied ICC profile (e.g. a real
// FOGRA39L.icc), with black point compensation — the same class of
// conversion a print shop's own RIP would do.
import instantiate, {
  TYPE_RGB_8,
  TYPE_CMYK_8,
  INTENT_RELATIVE_COLORIMETRIC,
  cmsFLAGS_BLACKPOINTCOMPENSATION,
  cmsInfoDescription,
} from 'lcms-wasm'
import wasmUrl from 'lcms-wasm/dist/lcms.wasm?url'

let lcmsPromise = null
function getLcms() {
  if (!lcmsPromise) lcmsPromise = instantiate({ locateFile: () => wasmUrl })
  return lcmsPromise
}

export async function readIccProfileInfo(iccBytes) {
  const lcms = await getLcms()
  const bytes = new Uint8Array(iccBytes)
  const profile = lcms.cmsOpenProfileFromMem(bytes, bytes.byteLength)
  if (!profile) throw new Error('This file is not a readable ICC profile.')
  const name = lcms.cmsGetProfileInfoASCII(profile, cmsInfoDescription, 'en', 'US')
  const colorSpace = lcms.cmsGetColorSpaceASCII(profile)
  lcms.cmsCloseProfile(profile)
  return { name, colorSpace }
}

// Opens a CMYK output profile and builds the two transforms we need:
// sRGB -> profile (the real conversion) and profile -> sRGB (a soft-proof
// round trip, so the embedded page image shows what the CMYK will actually
// look like rather than the raw screen colours).
export async function createCmykConverter(iccBytes) {
  const lcms = await getLcms()
  const bytes = new Uint8Array(iccBytes)
  const target = lcms.cmsOpenProfileFromMem(bytes, bytes.byteLength)
  if (!target) throw new Error('This file is not a readable ICC profile.')

  const colorSpace = lcms.cmsGetColorSpaceASCII(target)
  if (colorSpace !== 'CMYK') {
    lcms.cmsCloseProfile(target)
    throw new Error(`This is a ${colorSpace || 'non-CMYK'} profile — a CMYK output/press profile is required.`)
  }

  const name = lcms.cmsGetProfileInfoASCII(target, cmsInfoDescription, 'en', 'US')
  const srgb = lcms.cmsCreate_sRGBProfile()
  const flags = cmsFLAGS_BLACKPOINTCOMPENSATION
  const toCmyk = lcms.cmsCreateTransform(srgb, TYPE_RGB_8, target, TYPE_CMYK_8, INTENT_RELATIVE_COLORIMETRIC, flags)
  const toRgb = lcms.cmsCreateTransform(target, TYPE_CMYK_8, srgb, TYPE_RGB_8, INTENT_RELATIVE_COLORIMETRIC, flags)

  return {
    name,

    // Converts every pixel of a canvas through the real ICC transform and
    // writes the soft-proofed RGB appearance back into the canvas in place.
    applyToCanvas(canvas) {
      const ctx = canvas.getContext('2d')
      const { width, height } = canvas
      const imageData = ctx.getImageData(0, 0, width, height)
      const src = imageData.data
      const pixelCount = width * height
      const rgbIn = new Uint8Array(pixelCount * 3)
      for (let i = 0, j = 0; i < src.length; i += 4, j += 3) {
        rgbIn[j] = src[i]
        rgbIn[j + 1] = src[i + 1]
        rgbIn[j + 2] = src[i + 2]
      }
      const rgbOut = lcms.cmsDoTransform(toRgb, lcms.cmsDoTransform(toCmyk, rgbIn, pixelCount), pixelCount)
      for (let i = 0, j = 0; i < src.length; i += 4, j += 3) {
        src[i] = rgbOut[j]
        src[i + 1] = rgbOut[j + 1]
        src[i + 2] = rgbOut[j + 2]
      }
      ctx.putImageData(imageData, 0, 0)
      return canvas
    },

    // Samples a canvas at a stride and returns real ink-coverage (TAC) stats
    // computed from the actual CMYK numbers this profile would produce.
    sampleInkCoverage(canvas, stride = 4) {
      const ctx = canvas.getContext('2d')
      const { width, height } = canvas
      const imageData = ctx.getImageData(0, 0, width, height)
      const src = imageData.data
      const cols = Math.ceil(width / stride)
      const rows = Math.ceil(height / stride)
      const sampleCount = cols * rows
      const rgbIn = new Uint8Array(sampleCount * 3)
      let s = 0
      for (let y = 0; y < height; y += stride) {
        for (let x = 0; x < width; x += stride) {
          const i = (y * width + x) * 4
          rgbIn[s] = src[i]
          rgbIn[s + 1] = src[i + 1]
          rgbIn[s + 2] = src[i + 2]
          s += 3
        }
      }
      const cmyk = lcms.cmsDoTransform(toCmyk, rgbIn, sampleCount)
      let maxTac = 0
      let sumTac = 0
      let overLimit = 0
      for (let i = 0; i < sampleCount; i++) {
        const o = i * 4
        const tac = ((cmyk[o] + cmyk[o + 1] + cmyk[o + 2] + cmyk[o + 3]) / 255) * 100
        maxTac = Math.max(maxTac, tac)
        sumTac += tac
        if (tac > 330) overLimit++
      }
      return {
        maxTac: Math.round(maxTac),
        avgTac: Math.round(sumTac / Math.max(sampleCount, 1)),
        overLimitPct: Math.round((overLimit / Math.max(sampleCount, 1)) * 1000) / 10,
      }
    },

    dispose() {
      lcms.cmsDeleteTransform(toCmyk)
      lcms.cmsDeleteTransform(toRgb)
      lcms.cmsCloseProfile(target)
      lcms.cmsCloseProfile(srgb)
    },
  }
}
