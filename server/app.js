import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { createPostRepository } from './store.js'

export const MAX_CONTENT_LENGTH = 280

// PATCH 允许修改的布尔开关字段，其余键一律忽略。
const PATCHABLE_FLAGS = ['liked', 'favorited']

function fail(c, status, code, message) {
  return c.json({ error: { code, message } }, status)
}

export function createApp({ repository = createPostRepository() } = {}) {
  const app = new Hono()

  // 前端可能部署在 GitHub Pages 等独立静态域名，需要跨域访问 API。
  app.use(
    '/api/*',
    cors({
      origin: '*',
      allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'Accept'],
      maxAge: 600
    })
  )

  app.get('/api/posts', (c) => c.json({ data: repository.list() }))

  app.post('/api/posts', async (c) => {
    let body
    try {
      body = await c.req.json()
    } catch {
      return fail(c, 400, 'INVALID_JSON', '请求体不是合法的 JSON')
    }

    const raw = body && typeof body === 'object' ? body.content : undefined

    if (typeof raw !== 'string' || raw.trim() === '') {
      return fail(c, 422, 'EMPTY_CONTENT', '内容不能为空')
    }

    const content = raw.trim()

    if (content.length > MAX_CONTENT_LENGTH) {
      return fail(c, 422, 'CONTENT_TOO_LONG', `内容长度不能超过 ${MAX_CONTENT_LENGTH} 个字符`)
    }

    return c.json({ data: repository.create(content) }, 201)
  })

  app.patch('/api/posts/:id', async (c) => {
    let body
    try {
      body = await c.req.json()
    } catch {
      return fail(c, 400, 'INVALID_JSON', '请求体不是合法的 JSON')
    }

    if (body === null || typeof body !== 'object' || Array.isArray(body)) {
      return fail(c, 422, 'INVALID_PATCH', '请求体必须是一个 JSON 对象')
    }

    const provided = PATCHABLE_FLAGS.filter((field) =>
      Object.prototype.hasOwnProperty.call(body, field)
    )

    if (provided.length === 0) {
      return fail(c, 422, 'INVALID_PATCH', '至少需要提供 liked 或 favorited 字段')
    }

    const patch = {}
    for (const field of provided) {
      if (typeof body[field] !== 'boolean') {
        return fail(c, 422, 'INVALID_PATCH', `${field} 必须是布尔值`)
      }
      patch[field] = body[field]
    }

    const updated = repository.update(c.req.param('id'), patch)

    if (!updated) {
      return fail(c, 404, 'NOT_FOUND', '未找到对应的记录')
    }

    return c.json({ data: updated })
  })

  app.delete('/api/posts/:id', (c) => {
    const removed = repository.remove(c.req.param('id'))

    if (!removed) {
      return fail(c, 404, 'NOT_FOUND', '未找到对应的记录')
    }

    return c.body(null, 204)
  })

  app.all('/api/*', (c) => fail(c, 404, 'NOT_FOUND', '接口不存在'))

  app.notFound((c) => {
    if (c.req.path === '/api' || c.req.path.startsWith('/api/')) {
      return fail(c, 404, 'NOT_FOUND', '接口不存在')
    }
    return c.text('Not Found', 404)
  })

  return app
}
