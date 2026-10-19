import { useState } from 'react'
import {
  PAGE_SIZE_PRESETS,
  MIN_CUSTOM_MM,
  MAX_CUSTOM_MM,
  PX_PER_INCH,
  presetOverride,
  customOverride,
  pxToMm,
  mmToPx,
} from '../lib/pageSizes'
import { formatMm } from '../lib/units'

const UNITS = ['mm', 'px']
const DECIMALS = { mm: 2, px: 1 }
const round = (n, places) => Math.round(n * 10 ** places) / 10 ** places

const inputCls =
  'mt-1 block w-24 rounded-xl border border-zink/10 px-3 py-1.5 text-sm outline-none focus:border-zblue-400 bg-white disabled:opacity-50'

// A4 / A5 / Custom output-size chooser. `value` is a sizeOverride (see pageSizes.js);
// every change is reported back as a complete override, with `invalid` set while a
// custom size is out of range so the caller can hold off processing.
export default function SizePicker({ value, onChange, disabled }) {
  const preset = value?.preset ?? 'custom'
  const [unit, setUnit] = useState('mm')
  const fromMm = (mm, u) => String(round(u === 'mm' ? mm : mmToPx(mm), DECIMALS[u]))
  const toMm = (text, u) => (u === 'mm' ? parseFloat(text) : pxToMm(parseFloat(text)))
  const [wText, setWText] = useState(() => fromMm(value?.widthMm ?? 0, 'mm'))
  const [hText, setHText] = useState(() => fromMm(value?.heightMm ?? 0, 'mm'))

  const handlePreset = (e) => {
    const id = e.target.value
    if (id === 'custom') {
      // Start from whatever size is in effect, so switching never jumps.
      setWText(fromMm(value.widthMm, unit))
      setHText(fromMm(value.heightMm, unit))
      onChange(customOverride(value.widthMm, value.heightMm))
    } else {
      onChange(presetOverride(id))
    }
  }

  const handleUnit = (next) => {
    if (next === unit) return
    // Same physical size, shown in the new unit.
    const w = toMm(wText, unit)
    const h = toMm(hText, unit)
    if (Number.isFinite(w)) setWText(fromMm(w, next))
    if (Number.isFinite(h)) setHText(fromMm(h, next))
    setUnit(next)
  }

  const handleDimension = (axis, text) => {
    const w = axis === 'w' ? text : wText
    const h = axis === 'h' ? text : hText
    if (axis === 'w') setWText(text)
    else setHText(text)
    onChange(customOverride(toMm(w, unit), toMm(h, unit)))
  }

  const sizeLine = () => {
    if (preset !== 'custom') {
      return `${formatMm(value.widthMm)} × ${formatMm(value.heightMm)} · portrait or landscape follows the design`
    }
    if (value.invalid) return `Enter a width and height between ${MIN_CUSTOM_MM} and ${MAX_CUSTOM_MM}mm.`
    return unit === 'px'
      ? `= ${formatMm(value.widthMm)} × ${formatMm(value.heightMm)} (1px = 1/${PX_PER_INCH}in)`
      : `${formatMm(value.widthMm)} × ${formatMm(value.heightMm)}`
  }

  return (
    <div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs text-zink/55">
          Required size
          <select
            value={preset}
            disabled={disabled}
            onChange={handlePreset}
            className="mt-1 block w-32 rounded-xl border border-zink/10 px-3 py-1.5 text-sm outline-none focus:border-zblue-400 bg-white disabled:opacity-50"
          >
            {Object.entries(PAGE_SIZE_PRESETS).map(([id, p]) => (
              <option key={id} value={id}>
                {p.label}
              </option>
            ))}
            <option value="custom">Custom</option>
          </select>
        </label>

        {preset === 'custom' && (
          <>
            <div className="text-xs text-zink/55">
              Unit
              <div className="mt-1 flex rounded-xl border border-zink/10 overflow-hidden bg-white">
                {UNITS.map((u) => (
                  <button
                    key={u}
                    type="button"
                    disabled={disabled}
                    onClick={() => handleUnit(u)}
                    className={`px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50 ${
                      unit === u ? 'bg-zblue-500 text-white' : 'text-zink/60 hover:bg-zink/5'
                    }`}
                  >
                    {u}
                  </button>
                ))}
              </div>
            </div>
            <label className="text-xs text-zink/55">
              Width ({unit})
              <input
                type="number"
                min="0"
                step="any"
                value={wText}
                disabled={disabled}
                onChange={(e) => handleDimension('w', e.target.value)}
                className={inputCls}
              />
            </label>
            <label className="text-xs text-zink/55">
              Height ({unit})
              <input
                type="number"
                min="0"
                step="any"
                value={hText}
                disabled={disabled}
                onChange={(e) => handleDimension('h', e.target.value)}
                className={inputCls}
              />
            </label>
          </>
        )}
      </div>
      <p className={`text-[11px] mt-1.5 ${preset === 'custom' && value.invalid ? 'text-red-600' : 'text-zink/40'}`}>{sizeLine()}</p>
    </div>
  )
}
