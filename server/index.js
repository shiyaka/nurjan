import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import { createApp } from './app.js'

const parsedPort = Number.parseInt(process.env.PORT ?? '', 10)
const port = Number.isInteger(parsedPort) && parsedPort > 0 ? parsedPort : 8787

const distDir = fileURLToPath(new URL('../dist/', import.meta.url))
const spaEntry = fileURLToPath(new URL('../dist/index.html', import.meta.url))

const app = new Hono()

app.route('/', createApp())

app.all('/api/*', (c) => c.json({ error: { code: 'NOT_FOUND', message: '接口不存在' } }, 404))

if (existsSync(spaEntry)) {
  app.use('*', serveStatic({ root: distDir }))

  // SPA 回退：仅对无扩展名的页面路由返回 index.html，
  // 缺失的静态资源（含 . 或 /assets/ 前缀）应保持 404，避免 MIME 错误。
  app.get('*', (c, next) => {
    const path = c.req.path
    if (path.includes('.') || path.startsWith('/assets/')) {
      return next()
    }
    return serveStatic({ path: spaEntry })(c, next)
  })
} else {
  app.get('/', (c) =>
    c.json({
      ok: true,
      message: 'API server is running. Run `npm run build` to serve the frontend from dist.',
      endpoints: ['GET /api/posts', 'POST /api/posts', 'DELETE /api/posts/:id']
    })
  )
}

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`[server] listening on http://localhost:${info.port}`)
  console.log(`[server] static hosting: ${existsSync(spaEntry) ? distDir : 'disabled (dist/index.html not found)'}`)
})
