// Job history lives in Supabase, shared across everyone allowed into the tool:
// the QA report is a small JSON row, the PDF itself is a file in Storage.
// All access goes through /api, which enforces the caller's role (Viewer /
// Editor / Admin) from the central employee store — the browser has no direct
// table or bucket access.
import { supabase } from './supabaseClient'
import { apiFetch } from './api'

const BUCKET = 'job-pdfs'

export async function saveFinishedJob({ id, name, sizeInfo, options, report, pdfBytes }) {
  // 1. Ask the server for a one-off upload slot (it checks the role and fixes
  //    the path to the caller's own folder).
  const { path, token } = await apiFetch('/jobs/upload-url', { method: 'POST', body: { id } })

  // 2. Send the PDF straight to Storage — it's too large to pass through a function.
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .uploadToSignedUrl(path, token, new Blob([pdfBytes], { type: 'application/pdf' }), { contentType: 'application/pdf', upsert: true })
  if (uploadError) throw uploadError

  // 3. Record the job. Owner and creator name/email are set by the server.
  const { pdfPath } = await apiFetch('/jobs', {
    method: 'POST',
    body: {
      id,
      name,
      pageCount: sizeInfo.pageCount,
      widthMm: sizeInfo.widthMm,
      heightMm: sizeInfo.heightMm,
      options,
      report,
    },
  })
  return pdfPath
}

export async function deleteFinishedJob(id) {
  await apiFetch(`/jobs/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export async function loadFinishedJobs() {
  const { jobs } = await apiFetch('/jobs')
  return jobs
}

export async function downloadJobPdf(id) {
  const { url } = await apiFetch(`/jobs/${encodeURIComponent(id)}/download`)
  const res = await fetch(url)
  if (!res.ok) throw new Error('Could not download this PDF.')
  return new Uint8Array(await res.arrayBuffer())
}

// The shared list is refreshed on a timer (and when the tab regains focus) so
// teammates' jobs appear without a manual refresh.
export function pollJobs(onRows, intervalMs = 20000) {
  let stopped = false
  const tick = () => {
    if (stopped || document.hidden) return
    loadFinishedJobs().then((rows) => !stopped && onRows(rows)).catch(() => {})
  }
  const timer = setInterval(tick, intervalMs)
  document.addEventListener('visibilitychange', tick)
  return () => {
    stopped = true
    clearInterval(timer)
    document.removeEventListener('visibilitychange', tick)
  }
}
