import { Hono } from 'hono'
import { createPostRepository } from './store.js'

export const MAX_CONTENT_LENGTH = 280

function fail(c, status, code, message) {
  return c.json({ error: { code, message } }, status)
}

export function createApp({ repository = createPostRepository() } = {}) {
  const app = new Hono()

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
