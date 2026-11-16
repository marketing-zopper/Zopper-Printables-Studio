import { route, send, readJsonBody, HttpError } from '../_lib/http.js'
import { authenticate, BUCKET } from '../_lib/auth.js'
import { can } from '../_lib/access.js'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Hands an Editor/Admin a short-lived signed URL to upload the PDF straight to
// Storage (it is too big to pass through a serverless function). The path is
// fixed server-side to the caller's own folder.
export default route(['POST'], async (req, res) => {
  const auth = await authenticate(req)
  if (!can(auth.role, 'create')) throw new HttpError(403, 'forbidden', 'Your role cannot create jobs.')

  const { id } = await readJsonBody(req)
  if (typeof id !== 'string' || !UUID_RE.test(id)) throw new HttpError(400, 'invalid_id', 'Invalid job id.')

  const { data: existing } = await auth.admin.from('jobs').select('id').eq('id', id).maybeSingle()
  if (existing) throw new HttpError(409, 'job_exists', 'A job with this id already exists.')

  const path = `${auth.user.id}/${id}.pdf`
  const { data, error } = await auth.admin.storage.from(BUCKET).createSignedUploadUrl(path, { upsert: true })
  if (error) throw error
  send(res, 200, { path, token: data.token })
})
