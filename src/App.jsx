import { useEffect, useMemo, useRef, useState } from 'react'
import { Files, Droplet, QrCode } from 'lucide-react'
import GradientBlobs from './components/GradientBlobs'
import Sidebar from './components/Sidebar'
import Topbar from './components/Topbar'
import StatCard from './components/StatCard'
import UploadZone from './components/UploadZone'
import JobCard from './components/JobCard'
import SpecPanel from './components/SpecPanel'
import GuidelinesCard from './components/GuidelinesCard'
import SpecModal from './components/SpecModal'
import SpecContent from './components/SpecContent'
import { inspectPdf, processPdf } from './lib/pdfEngine'
import { saveFinishedJob, deleteFinishedJob, loadFinishedJobs } from './lib/jobStore'
import { loadIccProfile } from './lib/profileStore'
import { loadDefaultIccProfile } from './lib/defaultProfile'
import ColorProfileCard from './components/ColorProfileCard'

const makeJobId = () => `job-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

export default function App() {
  const [active, setActive] = useState('dashboard')
  const [query, setQuery] = useState('')
  const [jobs, setJobs] = useState([])
  const [historyLoaded, setHistoryLoaded] = useState(false)
  const [specOpen, setSpecOpen] = useState(false)
  const [defaults, setDefaults] = useState({ bleedMm: 3, fold: 'none', cmykPreview: true })
  const [iccProfile, setIccProfile] = useState(null)
  const hydrated = useRef(false)

  useEffect(() => {
    if (hydrated.current) return
    hydrated.current = true
    loadIccProfile().then((record) => setIccProfile(record))
    loadFinishedJobs().then((records) => {
      const restored = records
        .sort((a, b) => b.createdAt - a.createdAt)
        .map((record) => {
          const blob = new Blob([record.pdfBytes], { type: 'application/pdf' })
          return {
            id: record.id,
            name: record.name,
            status: 'done',
            sizeInfo: record.sizeInfo,
            sizeOverride: null,
            options: record.options,
            progressStep: 'done',
            progressMessage: '',
            result: { bytes: record.pdfBytes, report: record.report },
            downloadUrl: URL.createObjectURL(blob),
            error: null,
            createdAt: record.createdAt,
          }
        })
      setJobs((prev) => {
        const existingIds = new Set(prev.map((j) => j.id))
        return [...restored.filter((j) => !existingIds.has(j.id)), ...prev]
      })
      setHistoryLoaded(true)
    })
  }, [])

  const patchJob = (id, patch) => {
    setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, ...(typeof patch === 'function' ? patch(j) : patch) } : j)))
  }

  const handleFiles = (files) => {
    files.forEach((file) => {
      const id = makeJobId()
      const job = {
        id,
        file,
        name: file.name.replace(/\.pdf$/i, ''),
        status: 'reading',
        sizeInfo: null,
        sizeOverride: null,
        options: { ...defaults },
        progressStep: null,
        progressMessage: '',
        result: null,
        error: null,
      }
      setJobs((prev) => [job, ...prev])

      inspectPdf(file)
        .then((info) => {
          patchJob(id, {
            sizeInfo: { widthMm: info.widthMm, heightMm: info.heightMm, pageCount: info.pageCount, buffer: info.buffer },
            status: info.suspicious ? 'confirm-size' : 'ready',
          })
        })
        .catch((err) => patchJob(id, { status: 'error', error: `Could not read this PDF: ${err.message}` }))
    })
    setActive('upload')
  }

  const handleConfirmSize = (id, sizeOverride) => {
    patchJob(id, { sizeOverride, status: 'ready' })
  }

  const handleUpdateOptions = (id, patch) => {
    patchJob(id, (j) => ({ options: { ...j.options, ...patch } }))
  }

  const handleProcess = async (id) => {
    const job = jobs.find((j) => j.id === id)
    if (!job) return
    patchJob(id, { status: 'processing', progressStep: 'render', progressMessage: 'Starting…' })
    try {
      let activeProfile = iccProfile
      if (!activeProfile && job.options.cmykPreview) {
        try {
          activeProfile = await loadDefaultIccProfile()
        } catch (err) {
          activeProfile = null // falls back to the formula-based preview inside processPdf
        }
      }

      const { bytes, report } = await processPdf({
        file: job.file,
        buffer: job.sizeInfo.buffer,
        options: {
          jobName: job.name,
          bleedMm: job.options.bleedMm,
          fold: job.options.fold,
          cmykPreview: job.options.cmykPreview,
          sizeOverride: job.sizeOverride,
          iccProfile: job.options.cmykPreview && activeProfile ? { bytes: activeProfile.bytes, name: activeProfile.name } : null,
        },
        onProgress: ({ step, message }) => patchJob(id, { progressStep: step, progressMessage: message }),
      })
      const blob = new Blob([bytes], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const createdAt = Date.now()
      patchJob(id, { status: 'done', result: { bytes, report }, downloadUrl: url, createdAt })
      saveFinishedJob({
        id,
        name: job.name,
        createdAt,
        sizeInfo: {
          pageCount: job.sizeInfo.pageCount,
          widthMm: job.sizeInfo.widthMm,
          heightMm: job.sizeInfo.heightMm,
        },
        options: job.options,
        report,
        pdfBytes: bytes,
      })
    } catch (err) {
      patchJob(id, { status: 'error', error: err.message || 'Processing failed.' })
    }
  }

  const handleDownload = (id) => {
    const job = jobs.find((j) => j.id === id)
    if (!job?.downloadUrl) return
    const a = document.createElement('a')
    a.href = job.downloadUrl
    a.download = `${job.name}_print-ready.pdf`
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  const handleDelete = (id) => {
    setJobs((prev) => {
      const job = prev.find((j) => j.id === id)
      if (job?.downloadUrl) URL.revokeObjectURL(job.downloadUrl)
      return prev.filter((j) => j.id !== id)
    })
    deleteFinishedJob(id)
  }

  const doneJobs = jobs.filter((j) => j.status === 'done').sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))

  const filteredJobHistory = useMemo(
    () => doneJobs.filter((j) => j.name.toLowerCase().includes(query.toLowerCase())),
    [doneJobs, query],
  )
  const allPages = doneJobs.flatMap((j) => j.result.report.pages)
  const avgInk = allPages.length ? Math.round(allPages.reduce((a, p) => a + p.ink.maxTac, 0) / allPages.length) : 0
  const qrVerified = allPages.filter((p) => p.qrFinal.found).length

  return (
    <div className="min-h-screen flex">
      <GradientBlobs />
      <Sidebar active={active} onNavigate={setActive} />

      <div className="flex-1 min-w-0">
        <Topbar active={active} query={query} onQuery={setQuery} />

        <main className="px-6 lg:px-8 pb-12 space-y-6">
          {active === 'dashboard' && (
            <>
              <div className="flex flex-wrap gap-4">
                <StatCard label="Files processed" value={doneJobs.length} icon={Files} accent="blue" />
                <StatCard label="Avg. peak ink (TAC)" value={`${avgInk}%`} icon={Droplet} accent="orange" />
                <StatCard label="QR codes verified" value={qrVerified} icon={QrCode} accent="navy" />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-4">
                  <UploadZone onFiles={handleFiles} />
                  {doneJobs.slice(0, 3).map((job) => (
                    <JobCard
                      key={job.id}
                      job={job}
                      onConfirmSize={handleConfirmSize}
                      onUpdateOptions={handleUpdateOptions}
                      onProcess={handleProcess}
                      onDownload={handleDownload}
                      onDelete={handleDelete}
                    />
                  ))}
                  {historyLoaded && doneJobs.length === 0 && (
                    <p className="text-xs text-zink/40 text-center py-6">
                      No completed jobs yet — drop a PDF above, finish processing it on the Upload page, and it'll show up here.
                    </p>
                  )}
                </div>
                <div className="grid grid-rows-2 gap-6">
                  <SpecPanel onOpenFull={() => setSpecOpen(true)} />
                  <GuidelinesCard onOpenFull={() => setSpecOpen(true)} />
                </div>
              </div>
            </>
          )}

          {active === 'upload' && (
            <div className="max-w-3xl mx-auto space-y-4">
              <UploadZone onFiles={handleFiles} />
              {jobs.map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  onConfirmSize={handleConfirmSize}
                  onUpdateOptions={handleUpdateOptions}
                  onProcess={handleProcess}
                  onDownload={handleDownload}
                  onDelete={handleDelete}
                />
              ))}
              {jobs.length === 0 && (
                <p className="text-xs text-zink/40 text-center py-6">No files yet — drop a PDF above to get started.</p>
              )}
            </div>
          )}

          {active === 'jobs' && (
            <div className="max-w-3xl mx-auto space-y-4">
              {historyLoaded && filteredJobHistory.length === 0 && (
                <p className="text-xs text-zink/40 text-center py-10">
                  {doneJobs.length === 0 ? 'No finished jobs yet — job history only shows files that finished processing into a print-ready PDF.' : 'No jobs match your search.'}
                </p>
              )}
              {filteredJobHistory.map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  onConfirmSize={handleConfirmSize}
                  onUpdateOptions={handleUpdateOptions}
                  onProcess={handleProcess}
                  onDownload={handleDownload}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}

          {active === 'spec' && (
            <div className="max-w-3xl mx-auto glass-card rounded-3xl shadow-card p-7">
              <SpecContent />
            </div>
          )}

          {active === 'settings' && (
            <div className="max-w-md space-y-6">
              <div className="glass-card rounded-3xl shadow-card p-7">
                <ColorProfileCard profile={iccProfile} onChange={setIccProfile} />
              </div>
              <div className="glass-card rounded-3xl shadow-card p-7 space-y-5">
              <p className="font-bold text-zink text-sm">Defaults for new jobs</p>
              <label className="block text-xs text-zink/55">
                Bleed (mm)
                <input
                  type="number"
                  value={defaults.bleedMm}
                  onChange={(e) => setDefaults((d) => ({ ...d, bleedMm: Number(e.target.value) }))}
                  className="mt-1 block w-full rounded-xl border border-zink/10 px-3 py-2 text-sm outline-none focus:border-zblue-400"
                />
              </label>
              <label className="block text-xs text-zink/55">
                Fold
                <select
                  value={defaults.fold}
                  onChange={(e) => setDefaults((d) => ({ ...d, fold: e.target.value }))}
                  className="mt-1 block w-full rounded-xl border border-zink/10 px-3 py-2 text-sm outline-none focus:border-zblue-400 bg-white"
                >
                  <option value="none">No fold</option>
                  <option value="half-vertical">Half-fold (vertical)</option>
                  <option value="half-horizontal">Half-fold (horizontal)</option>
                  <option value="tri-vertical">Tri-fold (vertical)</option>
                </select>
              </label>
              <label className="flex items-center gap-2 text-xs text-zink/55">
                <input
                  type="checkbox"
                  checked={defaults.cmykPreview}
                  onChange={(e) => setDefaults((d) => ({ ...d, cmykPreview: e.target.checked }))}
                  className="h-4 w-4 accent-zblue-500"
                />
                CMYK preview conversion by default
              </label>
              <p className="text-[11px] text-zink/35 leading-relaxed">
                These apply to new uploads only. Each job can still override them before processing.
              </p>
              </div>
            </div>
          )}
        </main>
      </div>

      {specOpen && <SpecModal onClose={() => setSpecOpen(false)} />}
    </div>
  )
}
