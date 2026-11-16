// Read-only client for the central Master App employee store (Upstash).
// Printables Studio must never modify employee records, so the only commands
// this module will send are on the allow-list below — anything else throws
// before a request is made. If Redis can't be reached, callers get a 503 and
// access is denied (fail closed).
import { HttpError } from './http.js'

const READ_ONLY_COMMANDS = new Set(['HGET'])
const EMPLOYEES_HASH = 'zms:employees'
const TIMEOUT_MS = 4000

async function redisRead(command) {
  if (!READ_ONLY_COMMANDS.has(String(command[0]).toUpperCase())) {
    throw new Error(`Redis command ${command[0]} is not permitted: this client is read-only.`)
  }
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) throw new HttpError(503, 'verification_unavailable', 'Access verification is not configured.')

  let res
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(command),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch {
    throw new HttpError(503, 'verification_unavailable', 'Could not verify access right now. Please try again.')
  }
  if (!res.ok) throw new HttpError(503, 'verification_unavailable', 'Could not verify access right now. Please try again.')
  const json = await res.json().catch(() => null)
  if (!json || json.error) throw new HttpError(503, 'verification_unavailable', 'Could not verify access right now. Please try again.')
  return json.result
}

// Returns the parsed employee record, or null when there is no such employee.
export async function getEmployeeRecord(email) {
  const raw = await redisRead(['HGET', EMPLOYEES_HASH, String(email).trim().toLowerCase()])
  if (raw === null || raw === undefined) return null
  try {
    const record = typeof raw === 'string' ? JSON.parse(raw) : raw
    return record && typeof record === 'object' ? record : null
  } catch {
    // A record we can't parse is treated as unverifiable, not as "no access".
    throw new HttpError(503, 'verification_unavailable', 'Could not verify access right now. Please try again.')
  }
}
