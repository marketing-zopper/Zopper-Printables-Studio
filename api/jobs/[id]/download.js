import { route, send, HttpError } from '../../_lib/http.js'
import { authenticate, BUCKET } from '../../_lib/auth.js'
import { can } from '../../_lib/access.js'

// Short-lived signed link for a finished job's PDF. Only PDFs that belong to a
// real job row can be fetched — callers can't ask for an arbitrary path.
export default route(['GET'], async (req, res) => {
  const auth = await authenticate(req)
  if (!can(auth.role, 'download')) throw new HttpError(403, 'forbidden', 'Not allowed.')

  const id = String(req.query?.id || '')
  const { data: job, error } = await auth.admin.from('jobs').select('pdf_path').eq('id', id).maybeSingle()
  if (error) throw error
  if (!job?.pdf_path) throw new HttpError(404, 'not_found', 'Job not found.')

  const { data, error: signError } = await auth.admin.storage.from(BUCKET).createSignedUrl(job.pdf_path, 60)
  if (signError) throw signError
  send(res, 200, { url: data.signedUrl })
})
