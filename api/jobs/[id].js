import { route, send, HttpError } from '../_lib/http.js'
import { authenticate, BUCKET } from '../_lib/auth.js'
import { can } from '../_lib/access.js'

// Editors may delete only their own jobs; Admin / Super Admin may delete any.
// Viewers can't delete. The check is against the row's real owner in the
// database, not anything the browser sends.
export default route(['DELETE'], async (req, res) => {
  const auth = await authenticate(req)
  const id = String(req.query?.id || '')

  const { data: job, error } = await auth.admin.from('jobs').select('id, user_id, pdf_path').eq('id', id).maybeSingle()
  if (error) throw error
  if (!job) throw new HttpError(404, 'not_found', 'Job not found.')

  const allowed = can(auth.role, 'deleteAny') || (can(auth.role, 'deleteOwn') && job.user_id === auth.user.id)
  if (!allowed) throw new HttpError(403, 'forbidden', 'You can only delete jobs you created.')

  // Row first: if file removal then fails, the job is simply gone from the
  // list rather than left in the list pointing at a missing file.
  const { error: deleteError } = await auth.admin.from('jobs').delete().eq('id', id)
  if (deleteError) throw deleteError
  if (job.pdf_path) await auth.admin.storage.from(BUCKET).remove([job.pdf_path])

  send(res, 200, { deleted: id })
})
