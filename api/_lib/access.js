// Pure role logic — no I/O, so it is easy to test. The role itself is never
// stored here: it comes from the Master App's Redis record on every request.
export const TOOL_KEY = 'printables-studio'

// Global Super Admin belongs to exactly this verified Google account. It is
// deliberately a constant, not something that can be assigned in Redis.
export const SUPER_ADMIN_EMAIL = 'marketingext@zopper.com'

export const ROLES = ['viewer', 'editor', 'admin']

const ACTIONS = {
  list: ['viewer', 'editor', 'admin', 'super_admin'],
  download: ['viewer', 'editor', 'admin', 'super_admin'],
  create: ['editor', 'admin', 'super_admin'],
  deleteOwn: ['editor', 'admin', 'super_admin'],
  deleteAny: ['admin', 'super_admin'],
}

export function can(role, action) {
  return Boolean(ACTIONS[action]?.includes(role))
}

export function permissionsFor(role) {
  return Object.fromEntries(Object.keys(ACTIONS).map((a) => [a, can(role, a)]))
}

// Decide the caller's access from their verified email and their Redis
// record. Returns { role } or { denied: <reason> }. Anything ambiguous denies.
export function resolveAccess({ email, record, isVerifiedSuperAdmin }) {
  const normalized = String(email || '').trim().toLowerCase()
  if (normalized === SUPER_ADMIN_EMAIL) {
    return isVerifiedSuperAdmin ? { role: 'super_admin' } : { denied: 'super_admin_requires_google' }
  }
  if (!record) return { denied: 'not_registered' }
  if (record.active !== true) return { denied: 'inactive' }
  if (record.permissions?.[TOOL_KEY] !== true) return { denied: 'no_access' }
  const role = record.roles?.[TOOL_KEY]
  if (!ROLES.includes(role)) return { denied: 'no_access' }
  return { role }
}
