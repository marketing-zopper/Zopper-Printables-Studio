// Every read and write of job data goes through our own /api, which checks the
// caller's role against the central employee store on each request. The
// browser only ever sends its Supabase session token.
import { supabase } from './supabaseClient'

export class ApiError extends Error {
  constructor(status, code, message) {
    super(message)
    this.status = status
    this.code = code
  }
}

export async function apiFetch(path, { method = 'GET', body } = {}) {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token

  let res
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new ApiError(0, 'network_error', 'Could not reach the server. Check your connection and try again.')
  }

  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(res.status, json.error || 'error', json.message || `Request failed (${res.status}).`)
  return json
}
