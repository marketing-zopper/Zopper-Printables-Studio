import { useRef, useState } from 'react'
import { UploadCloud, CheckCircle2, X, Loader2, AlertTriangle, ShieldCheck } from 'lucide-react'
import { readIccProfileInfo } from '../lib/colorEngine'
import { saveIccProfile, clearIccProfile } from '../lib/profileStore'
import { DEFAULT_PROFILE_NAME, DEFAULT_PROFILE_FILENAME } from '../lib/defaultProfile'

export default function ColorProfileCard({ profile, onChange }) {
  const inputRef = useRef(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const handleFile = async (file) => {
    if (!file) return
    setBusy(true)
    setError(null)
    try {
      const bytes = new Uint8Array(await file.arrayBuffer())
      const info = await readIccProfileInfo(bytes)
      if (info.colorSpace !== 'CMYK') {
        throw new Error(`This is a ${info.colorSpace || 'non-CMYK'} profile — a CMYK output/press profile is required.`)
      }
      const record = { fileName: file.name, name: info.name, colorSpace: info.colorSpace, bytes }
      await saveIccProfile(record)
      onChange(record)
    } catch (err) {
      setError(err.message || 'Could not read this ICC profile.')
    } finally {
      setBusy(false)
    }
  }

  const handleRemove = async () => {
    await clearIccProfile()
    onChange(null)
  }

  return (
    <div>
      <p className="font-bold text-zink text-sm">Colour profile</p>
      <p className="text-[11px] text-zink/45 mt-1 leading-relaxed">
        Every job converts through a real, certified ICC transform via Little CMS — Coated FOGRA39L ships built in, or
        upload your own press's CMYK output profile to use that instead. Any custom profile is stored only in this
        browser — never uploaded anywhere.
      </p>

      {profile ? (
        <div className="mt-3 flex items-center gap-3 rounded-2xl bg-emerald-50 border border-emerald-100 px-4 py-3">
          <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-emerald-800 truncate">{profile.name}</p>
            <p className="text-[11px] text-emerald-700/70 truncate">{profile.fileName}</p>
          </div>
          <button onClick={handleRemove} className="text-emerald-700/50 hover:text-emerald-700 shrink-0" title="Remove and use built-in FOGRA39L instead">
            <X size={16} />
          </button>
        </div>
      ) : (
        <div className="mt-3 flex items-center gap-3 rounded-2xl bg-zblue-50 border border-zblue-100 px-4 py-3">
          <ShieldCheck size={18} className="text-zblue-600 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-zblue-800">{DEFAULT_PROFILE_NAME}</p>
            <p className="text-[11px] text-zblue-700/70 truncate">{DEFAULT_PROFILE_FILENAME} · default, in use</p>
          </div>
        </div>
      )}

      <button
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="mt-3 w-full flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-zblue-300/60 bg-white/50 hover:bg-white/70 hover:border-zblue-400 px-4 py-3 text-xs font-medium text-zink/60 transition-colors disabled:opacity-60"
      >
        {busy ? <Loader2 size={15} className="animate-spin" /> : <UploadCloud size={15} />}
        {busy ? 'Reading profile…' : profile ? 'Upload a different profile' : 'Upload your own .icc / .icm instead'}
      </button>

      <input
        ref={inputRef}
        type="file"
        accept=".icc,.icm"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />

      {error && (
        <p className="mt-2 flex items-start gap-1.5 text-[11px] text-red-600">
          <AlertTriangle size={13} className="mt-0.5 shrink-0" /> {error}
        </p>
      )}

      <p className="text-[11px] text-zink/35 mt-2 leading-relaxed">
        Coated FOGRA39L (ISO 12647-2:2004) ships unmodified from the official ICC profile registry, credited to Fogra /
        VIGC / X-Rite, Inc.
      </p>
    </div>
  )
}
