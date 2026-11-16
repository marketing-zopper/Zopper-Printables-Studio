import fs from 'fs'
import path from 'path'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// Local dev only: serves the files in /api the way Vercel does in production,
// so `npm run dev` works end to end without the Vercel CLI. Supports the
// [param] file names and nested folders used under api/.
function apiDevServer() {
  const resolveHandler = (urlPath) => {
    const parts = urlPath.replace(/^\/api\/?/, '').split('/').filter(Boolean)
    const walk = (dir, i, params) => {
      if (i === parts.length) {
        const index = path.join(dir, 'index.js')
        return fs.existsSync(index) ? { file: index, params } : null
      }
      const seg = parts[i]
      if (seg.startsWith('_')) return null // _lib is private, as on Vercel
      const last = i === parts.length - 1
      const exact = path.join(dir, seg + '.js')
      if (last && fs.existsSync(exact)) return { file: exact, params }
      const sub = path.join(dir, seg)
      if (fs.existsSync(sub) && fs.statSync(sub).isDirectory()) {
        const hit = walk(sub, i + 1, params)
        if (hit) return hit
      }
      for (const entry of fs.readdirSync(dir)) {
        const m = /^\[(.+?)\](\.js)?$/.exec(entry)
        if (!m) continue
        const full = path.join(dir, entry)
        if (m[2] && last) return { file: full, params: { ...params, [m[1]]: decodeURIComponent(seg) } }
        if (!m[2] && fs.statSync(full).isDirectory()) {
          const hit = walk(full, i + 1, { ...params, [m[1]]: decodeURIComponent(seg) })
          if (hit) return hit
        }
      }
      return null
    }
    return walk(path.resolve('api'), 0, {})
  }

  return {
    name: 'api-dev-server',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/')) return next()
        const url = new URL(req.url, 'http://localhost')
        const hit = resolveHandler(url.pathname)
        if (!hit) {
          res.statusCode = 404
          res.setHeader('Content-Type', 'application/json')
          return res.end(JSON.stringify({ error: 'not_found' }))
        }
        req.query = { ...Object.fromEntries(url.searchParams), ...hit.params }
        const mod = await server.ssrLoadModule(hit.file)
        await mod.default(req, res)
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  // Make .env.local values (including server-only ones) visible to /api in dev.
  Object.assign(process.env, loadEnv(mode, process.cwd(), ''))
  return { plugins: [react(), apiDevServer()] }
})
