// The built-in default CMYK output profile: Coated FOGRA39L, sourced
// unmodified from the official ICC (International Color Consortium) profile
// registry. Licensing: Fogra's characterisation data may be freely used and
// redistributed, including embedded in commercial/non-commercial software,
// provided it is unmodified and Fogra is identified as the source (fogra.org
// -> Downloads -> Characterisation data). This specific build is credited to
// VIGC / X-Rite, Inc. via the ICC registry entry, which states the profile
// "may be used, embedded, exchanged, and shared without restriction" (not to
// be altered or sold). Source: https://registry.color.org/profile-registry/Coated_Fogra39L_VIGC_300
export const DEFAULT_PROFILE_URL = '/profiles/Coated_Fogra39L_VIGC_300.icc'
export const DEFAULT_PROFILE_NAME = 'Coated FOGRA39L (built-in)'
export const DEFAULT_PROFILE_FILENAME = 'Coated_Fogra39L_VIGC_300.icc'

let cached = null

export async function loadDefaultIccProfile() {
  if (cached) return cached
  const res = await fetch(DEFAULT_PROFILE_URL)
  if (!res.ok) throw new Error('Could not load the built-in FOGRA39L profile')
  const bytes = new Uint8Array(await res.arrayBuffer())
  cached = { bytes, name: DEFAULT_PROFILE_NAME, fileName: DEFAULT_PROFILE_FILENAME, builtin: true }
  return cached
}
