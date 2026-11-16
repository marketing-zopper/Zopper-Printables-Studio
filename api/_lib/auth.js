// Every protected endpoint starts with authenticate(): verify the Supabase
// session server-side, take the *verified* email, look the employee up in the
// central Redis store, and resolve their Printables Studio role. The browser
// is never trusted to say who it is or what role it has.
import { createClient } from '@supabase/supabase-js'
import { HttpError } from './http.js'
import { getEmployeeRecord } from './redis.js'
import { resolveAccess, SUPER_ADMIN_EMAIL } from './access.js'

export const BUCKET = 'job-pdfs'
const ZOPPER_EMAIL_RE = /^[a-zA-Z0-9._%+-]+@zopper\.com$/i

let adminClient
export function getAdmin() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new HttpError(503, 'verification_unavailable', 'Server is not configured.')
  if (!adminClient) {
    adminClient = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  }
  return adminClient
}

function bearerToken(req) {
  const header = req.headers?.authorization || req.headers?.Authorization || ''
  const match = /^Bearer\s+(.+)$/i.exec(header)
  return match ? match[1].trim() : null
}

// Authentication methods of this session, read from the (already verified) JWT.
function sessionMethods(token) {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'))
    return (Array.isArray(payload.amr) ? payload.amr : []).map((a) => a?.method)
  } catch {
    return []
  }
}

export async function authenticate(req) {
  const token = bearerToken(req)
  if (!token) throw new HttpError(401, 'unauthenticated', 'Sign in to continue.')

  const admin = getAdmin()
  const { data, error } = await admin.auth.getUser(token)
  if (error || !data?.user) {
    // A network failure talking to Supabase is "can't verify", not "bad token".
    if (error && (error.status === undefined || error.status >= 500)) {
      throw new HttpError(503, 'verification_unavailable', 'Could not verify your session right now. Please try again.')
    }
    throw new HttpError(401, 'unauthenticated', 'Your session has expired. Sign in again.')
  }
  const user = data.user

  const email = (user.email || '').trim().toLowerCase()
  if (!ZOPPER_EMAIL_RE.test(email) || !user.email_confirmed_at) {
    throw new HttpError(403, 'domain_not_allowed', 'Only verified @zopper.com accounts can use Printables Studio.')
  }

  // Super Admin needs a real Google sign-in on this exact session, so a
  // password account registered under that address can never inherit it.
  const hasGoogleIdentity = (user.identities || []).some(
    (i) => i.provider === 'google' && i.identity_data?.email_verified !== false,
  )
  const isVerifiedSuperAdmin =
    email === SUPER_ADMIN_EMAIL && hasGoogleIdentity && sessionMethods(token).includes('oauth')

  const record = email === SUPER_ADMIN_EMAIL ? null : await getEmployeeRecord(email)
  const access = resolveAccess({ email, record, isVerifiedSuperAdmin })
  if (access.denied) {
    throw new HttpError(403, access.denied, 'You do not have access to Printables Studio.')
  }

  const { data: profile } = await admin.from('profiles').select('full_name').eq('id', user.id).maybeSingle()
  const name =
    profile?.full_name || user.user_metadata?.full_name || user.user_metadata?.name || email.split('@')[0]

  return { admin, user, email, name, role: access.role, employeeName: record?.name || null }
}
