import { route, send, readJsonBody, HttpError } from '../_lib/http.js'
import { authenticate, BUCKET } from '../_lib/auth.js'
import { can } from '../_lib/access.js'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const isNum = (v) => typeof v === 'number' && Number.isFinite(v)
const isPlainObject = (v) => v && typeof v === 'object' && !Array.isArray(v)

export default route(['GET', 'POST'], async (req, res) => {
  const auth = await authenticate(req)
  const { admin } = auth

  if (req.method === 'GET') {
    // Every row in `jobs` is a finished job (rows are only written once a PDF
    // has been generated and uploaded), so there are no drafts to filter out.
    if (!can(auth.role, 'list')) throw new HttpError(403, 'forbidden', 'Not allowed.')
    const { data, error } = await admin.from('jobs').select('*').order('created_at', { ascending: false })
    if (error) throw error
    return send(res, 200, { jobs: data })
  }

  if (!can(auth.role, 'create')) throw new HttpError(403, 'forbidden', 'Your role cannot create jobs.')

  const body = await readJsonBody(req)
  const { id, name, pageCount, widthMm, heightMm, options, report } = body
  if (typeof id !== 'string' || !UUID_RE.test(id)) throw new HttpError(400, 'invalid_id', 'Invalid job id.')
  if (typeof name !== 'string' || !name.trim() || name.length > 300) throw new HttpError(400, 'invalid_name', 'Invalid job name.')
  if (!Number.isInteger(pageCount) || pageCount < 1 || pageCount > 10000) throw new HttpError(400, 'invalid_pages', 'Invalid page count.')
  if (!isNum(widthMm) || !isNum(heightMm) || widthMm <= 0 || heightMm <= 0) throw new HttpError(400, 'invalid_size', 'Invalid size.')
  if (!isPlainObject(options) || !isPlainObject(report)) throw new HttpError(400, 'invalid_payload', 'Invalid job payload.')

  // Ownership and the creator label come from the verified session, never the request.
  const pdfPath = `${auth.user.id}/${id}.pdf`

  const { data: existing } = await admin.from('jobs').select('id').eq('id', id).maybeSingle()
  if (existing) throw new HttpError(409, 'job_exists', 'A job with this id already exists.')

  const { data: stored, error: existsError } = await admin.storage.from(BUCKET).exists(pdfPath)
  if (existsError || !stored) throw new HttpError(400, 'pdf_missing', 'Upload the PDF before saving the job.')

  const { error } = await admin.from('jobs').insert({
    id,
    user_id: auth.user.id,
    created_by_name: auth.name,
    created_by_email: auth.email,
    name: name.trim(),
    page_count: pageCount,
    width_mm: widthMm,
    height_mm: heightMm,
    options,
    report,
    pdf_path: pdfPath,
  })
  if (error) throw error
  send(res, 201, { id, pdfPath })
})
