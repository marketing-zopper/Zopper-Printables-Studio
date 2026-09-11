// Job history now lives in Supabase, shared across everyone signed in: the
// QA report is a small JSON row, the PDF itself is a file in Storage. Only
// the row/file's owner (per RLS) can delete it; anyone signed in can list
// and download.
import { supabase } from './supabaseClient'

const BUCKET = 'job-pdfs'

function pdfPathFor(userId, jobId) {
  return `${userId}/${jobId}.pdf`
}

export async function saveFinishedJob({ id, userId, createdByName, createdByEmail, name, sizeInfo, options, report, pdfBytes }) {
  const pdfPath = pdfPathFor(userId, id)
  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(pdfPath, pdfBytes, {
    contentType: 'application/pdf',
    upsert: true,
  })
  if (uploadError) throw uploadError

  const { error: insertError } = await supabase.from('jobs').insert({
    id,
    user_id: userId,
    created_by_name: createdByName,
    created_by_email: createdByEmail,
    name,
    page_count: sizeInfo.pageCount,
    width_mm: sizeInfo.widthMm,
    height_mm: sizeInfo.heightMm,
    options,
    report,
    pdf_path: pdfPath,
  })
  if (insertError) throw insertError

  return pdfPath
}

export async function deleteFinishedJob(id, pdfPath) {
  if (pdfPath) await supabase.storage.from(BUCKET).remove([pdfPath])
  const { error } = await supabase.from('jobs').delete().eq('id', id)
  if (error) throw error
}

export async function loadFinishedJobs() {
  const { data, error } = await supabase.from('jobs').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function downloadJobPdf(pdfPath) {
  const { data, error } = await supabase.storage.from(BUCKET).download(pdfPath)
  if (error) throw error
  return new Uint8Array(await data.arrayBuffer())
}

// Live updates so a shared job list reflects what teammates are doing
// without needing a manual refresh.
export function subscribeToJobs({ onInsert, onDelete }) {
  const channel = supabase
    .channel('jobs-changes')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'jobs' }, (payload) => onInsert?.(payload.new))
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'jobs' }, (payload) => onDelete?.(payload.old))
    .subscribe()

  return () => supabase.removeChannel(channel)
}
