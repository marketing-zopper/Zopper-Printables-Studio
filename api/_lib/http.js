// Tiny helpers shared by every /api function: JSON responses, typed errors,
// and a wrapper that enforces the HTTP method and turns thrown errors into
// responses (anything unexpected becomes a generic 500 — never a stack trace).
export class HttpError extends Error {
  constructor(status, code, message) {
    super(message || code)
    this.status = status
    this.code = code
  }
}

export function send(res, status, body) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(body))
}

export function route(methods, fn) {
  return async function handler(req, res) {
    try {
      if (!methods.includes(req.method)) {
        res.setHeader('Allow', methods.join(', '))
        throw new HttpError(405, 'method_not_allowed', 'Method not allowed.')
      }
      await fn(req, res)
    } catch (err) {
      if (err instanceof HttpError) return send(res, err.status, { error: err.code, message: err.message })
      console.error('Unhandled API error:', err)
      send(res, 500, { error: 'internal_error', message: 'Something went wrong.' })
    }
  }
}

export async function readJsonBody(req, maxBytes = 1_000_000) {
  let body = req.body
  if (body === undefined || body === null || body === '') {
    const chunks = []
    let size = 0
    for await (const chunk of req) {
      size += chunk.length
      if (size > maxBytes) throw new HttpError(413, 'payload_too_large', 'Request body is too large.')
      chunks.push(chunk)
    }
    body = Buffer.concat(chunks).toString('utf8')
  }
  if (typeof body === 'string') {
    if (body.length > maxBytes) throw new HttpError(413, 'payload_too_large', 'Request body is too large.')
    try {
      body = JSON.parse(body || '{}')
    } catch {
      throw new HttpError(400, 'invalid_json', 'Request body is not valid JSON.')
    }
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new HttpError(400, 'invalid_body', 'Request body must be a JSON object.')
  }
  if (JSON.stringify(body).length > maxBytes) throw new HttpError(413, 'payload_too_large', 'Request body is too large.')
  return body
}
