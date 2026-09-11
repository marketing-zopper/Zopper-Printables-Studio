import { useEffect, useRef, useState } from 'react'
import {
  FileText,
  CheckCircle2,
  Loader2,
  Circle,
  AlertTriangle,
  Download,
  ChevronDown,
  ChevronUp,
  QrCode,
  Droplet,
  ZoomIn,
  MoreVertical,
  Trash2,
} from 'lucide-react'
import { formatMm } from '../lib/units'

const STEP_DEFS = [
  { key: 'render', label: 'Rendering pages' },
  { key: 'qr-source', label: 'Scanning QR codes (source)' },
  { key: 'bleed', label: 'Synthesising bleed (edge extrusion)' },
  { key: 'cmyk', label: 'Flattening & converting to CMYK' },
  { key: 'ink', label: 'Estimating ink coverage' },
  { key: 'marks', label: 'Placing artwork, marks & boxes' },
  { key: 'assemble', label: 'Embedding output intent & assembling' },
  { key: 'verify', label: 'Re-verifying QR on the finished file' },
]

function StepRow({ label, state, detail }) {
  return (
    <div className="flex items-start gap-2.5 py-1">
      {state === 'done' && <CheckCircle2 size={16} className="text-zblue-500 mt-0.5 shrink-0" />}
      {state === 'active' && <Loader2 size={16} className="text-zorange-500 mt-0.5 shrink-0 animate-spin" />}
      {state === 'pending' && <Circle size={16} className="text-zink/20 mt-0.5 shrink-0" />}
      <div>
        <p className={`text-xs font-medium ${state === 'pending' ? 'text-zink/35' : 'text-zink/80'}`}>{label}</p>
        {state === 'active' && detail && <p className="text-[11px] text-zink/40 mt-0.5">{detail}</p>}
      </div>
    </div>
  )
}

export default function JobCard({ job, isOwner, onConfirmSize, onUpdateOptions, onProcess, onDownload, onDelete }) {
  const [expanded, setExpanded] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [sizeW, setSizeW] = useState(job.sizeInfo ? Math.round(job.sizeInfo.widthMm) : 0)
  const [sizeH, setSizeH] = useState(job.sizeInfo ? Math.round(job.sizeInfo.heightMm) : 0)
  const menuRef = useRef(null)

  const handleDownload = async () => {
    setDownloading(true)
    try {
      await onDownload(job.id)
    } finally {
      setDownloading(false)
    }
  }

  useEffect(() => {
    if (!menuOpen) return
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [menuOpen])

  const activeStepIdx = STEP_DEFS.findIndex((s) => s.key === job.progressStep)
  const totalWarnings = job.result?.report?.pages?.reduce((a, p) => a + p.warnings.length, 0) || 0

  return (
    <div className="glass-card rounded-3xl shadow-card p-5">
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-2xl bg-zblue-50 grid place-items-center shrink-0">
          <FileText size={19} className="text-zblue-600" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-zink truncate">{job.name}</p>
          <p className="text-[11px] text-zink/40">
            {job.sizeInfo ? `${job.sizeInfo.pageCount} page${job.sizeInfo.pageCount > 1 ? 's' : ''} · ${formatMm(job.sizeInfo.widthMm)} × ${formatMm(job.sizeInfo.heightMm)}` : 'Reading…'}
            {job.createdByName && ` · by ${job.createdByName}`}
          </p>
        </div>
        <StatusPill status={job.status} />
        <button onClick={() => setExpanded((v) => !v)} className="text-zink/30 hover:text-zink/60">
          {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>
        {(isOwner === undefined || isOwner) && (
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="text-zink/30 hover:text-zink/60 h-7 w-7 grid place-items-center rounded-lg hover:bg-zink/5"
            >
              <MoreVertical size={17} />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-9 z-10 w-36 rounded-xl bg-white shadow-soft border border-zink/5 py-1.5 overflow-hidden">
                <button
                  onClick={() => {
                    setMenuOpen(false)
                    onDelete(job.id)
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors"
                >
                  <Trash2 size={14} /> Delete
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {job.status === 'confirm-size' && (
        <div className="mt-4 rounded-2xl bg-zorange-50 border border-zorange-100 p-4">
          <p className="text-xs font-semibold text-zorange-700 flex items-center gap-1.5">
            <AlertTriangle size={14} /> Confirm the physical size before we process this
          </p>
          <p className="text-[11px] text-zorange-700/70 mt-1 leading-relaxed">
            This page is {formatMm(job.sizeInfo.widthMm)} × {formatMm(job.sizeInfo.heightMm)} — larger than usual. Figma
            exports often mistake pixels for points. Confirm the intended trim size, or correct it below.
          </p>
          <div className="flex items-end gap-3 mt-3">
            <label className="text-xs text-zink/60">
              Width (mm)
              <input
                type="number"
                value={sizeW}
                onChange={(e) => setSizeW(Number(e.target.value))}
                className="mt-1 block w-24 rounded-xl border border-zink/10 px-3 py-1.5 text-sm outline-none focus:border-zblue-400"
              />
            </label>
            <label className="text-xs text-zink/60">
              Height (mm)
              <input
                type="number"
                value={sizeH}
                onChange={(e) => setSizeH(Number(e.target.value))}
                className="mt-1 block w-24 rounded-xl border border-zink/10 px-3 py-1.5 text-sm outline-none focus:border-zblue-400"
              />
            </label>
            <button
              onClick={() => onConfirmSize(job.id, { widthMm: sizeW, heightMm: sizeH })}
              className="rounded-xl bg-zorange-500 hover:bg-zorange-600 text-white text-sm font-semibold px-4 py-2 transition-colors"
            >
              Confirm & continue
            </button>
          </div>
        </div>
      )}

      {(job.status === 'ready' || expanded) && job.status !== 'confirm-size' && (
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
          <label className="text-xs text-zink/55">
            Fold
            <select
              value={job.options.fold}
              disabled={job.status !== 'ready'}
              onChange={(e) => onUpdateOptions(job.id, { fold: e.target.value })}
              className="mt-1 block w-full rounded-xl border border-zink/10 px-3 py-1.5 text-sm outline-none focus:border-zblue-400 bg-white disabled:opacity-50"
            >
              <option value="none">No fold</option>
              <option value="half-vertical">Half-fold (vertical)</option>
              <option value="half-horizontal">Half-fold (horizontal)</option>
              <option value="tri-vertical">Tri-fold (vertical)</option>
            </select>
          </label>
          <label className="text-xs text-zink/55">
            Bleed (mm)
            <input
              type="number"
              value={job.options.bleedMm}
              disabled={job.status !== 'ready'}
              onChange={(e) => onUpdateOptions(job.id, { bleedMm: Number(e.target.value) })}
              className="mt-1 block w-full rounded-xl border border-zink/10 px-3 py-1.5 text-sm outline-none focus:border-zblue-400 bg-white disabled:opacity-50"
            />
          </label>
          <label className="text-xs text-zink/55 flex flex-col justify-end">
            <span className="flex items-center gap-2 mt-1 py-1.5">
              <input
                type="checkbox"
                checked={job.options.flattenToRaster}
                disabled={job.status !== 'ready'}
                onChange={(e) => onUpdateOptions(job.id, { flattenToRaster: e.target.checked })}
                className="h-4 w-4 accent-zblue-500"
              />
              Flatten & convert
            </span>
          </label>
        </div>
      )}

      {job.status === 'ready' && (
        <button
          onClick={() => onProcess(job.id)}
          className="mt-4 w-full rounded-2xl bg-gradient-to-r from-znavy-600 to-zblue-600 text-white text-sm font-semibold py-2.5 shadow-soft hover:opacity-95 transition-opacity"
        >
          Process for print
        </button>
      )}

      {(job.status === 'processing' || (expanded && job.status === 'done')) && (
        <div className="mt-4 rounded-2xl bg-white/60 border border-zink/5 px-4 py-3">
          {STEP_DEFS.filter((s) => s.key !== 'cmyk' || job.options.flattenToRaster).map((s) => {
            const idx = STEP_DEFS.findIndex((d) => d.key === s.key)
            const state = job.status === 'done' ? 'done' : idx < activeStepIdx ? 'done' : idx === activeStepIdx ? 'active' : 'pending'
            return <StepRow key={s.key} label={s.label} state={state} detail={job.progressMessage} />
          })}
        </div>
      )}

      {job.status === 'error' && (
        <div className="mt-4 rounded-2xl bg-red-50 border border-red-100 px-4 py-3 text-xs text-red-600">
          {job.error || 'Something went wrong while processing this file.'}
        </div>
      )}

      {job.status === 'done' && job.result && (
        <div className="mt-4">
          <div className="flex flex-wrap items-center gap-2">
            {!job.result.report.flattenToRaster && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-zblue-50 text-zblue-700 text-[11px] font-medium px-3 py-1.5">
                <ZoomIn size={12} /> Vector (sharp)
              </span>
            )}
            {job.result.report.colorEngine === 'icc' && (
              <span
                className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-medium px-3 py-1.5"
                title={job.result.report.iccProfileName}
              >
                <CheckCircle2 size={12} /> Certified ICC
              </span>
            )}
            <span className="inline-flex items-center gap-1.5 rounded-full bg-zblue-50 text-zblue-700 text-[11px] font-medium px-3 py-1.5">
              <Droplet size={12} /> Max ink {Math.max(...job.result.report.pages.map((p) => p.ink.maxTac))}% TAC
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-zorange-50 text-zorange-700 text-[11px] font-medium px-3 py-1.5">
              <QrCode size={12} /> {job.result.report.pages.filter((p) => p.qrFinal.found).length} QR verified
            </span>
            {totalWarnings > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 text-amber-700 text-[11px] font-medium px-3 py-1.5">
                <AlertTriangle size={12} /> {totalWarnings} flagged
              </span>
            )}
          </div>

          {expanded && (
            <div className="mt-3 space-y-1.5 max-h-56 overflow-y-auto pr-1">
              {job.result.report.pages.map((p) => (
                <div key={p.index} className="flex items-center justify-between text-[11px] text-zink/55 bg-white/50 rounded-xl px-3 py-2">
                  <span>Page {p.index + 1} · {p.trimWmm}×{p.trimHmm}mm · {p.dpi}dpi</span>
                  <span className={p.ink.maxTac > 330 ? 'text-red-600 font-semibold' : ''}>{p.ink.maxTac}% TAC</span>
                  <span>{p.qrFinal.found ? `QR: ${p.qrFinal.payload.slice(0, 24)}${p.qrFinal.payload.length > 24 ? '…' : ''}` : 'No QR'}</span>
                </div>
              ))}
              {job.result.report.pages.flatMap((p) => p.warnings.map((w, wi) => (
                <p key={`${p.index}-${wi}`} className="text-[11px] text-amber-700 px-1">⚠ Page {p.index + 1}: {w}</p>
              )))}
            </div>
          )}

          <button
            onClick={handleDownload}
            disabled={downloading}
            className="mt-3 w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-zorange-500 to-zorange-600 text-white text-sm font-semibold py-2.5 shadow-soft hover:opacity-95 transition-opacity disabled:opacity-70"
          >
            {downloading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            {downloading ? 'Fetching…' : 'Download print-ready PDF'}
          </button>
        </div>
      )}
    </div>
  )
}

function StatusPill({ status }) {
  const map = {
    'reading': { label: 'Reading…', cls: 'bg-zink/5 text-zink/50' },
    'confirm-size': { label: 'Needs size check', cls: 'bg-zorange-50 text-zorange-600' },
    'ready': { label: 'Ready', cls: 'bg-zblue-50 text-zblue-600' },
    'processing': { label: 'Processing', cls: 'bg-zorange-50 text-zorange-600' },
    'done': { label: 'Print-ready', cls: 'bg-emerald-50 text-emerald-600' },
    'error': { label: 'Error', cls: 'bg-red-50 text-red-600' },
  }
  const s = map[status] || map.reading
  return <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full shrink-0 ${s.cls}`}>{s.label}</span>
}
