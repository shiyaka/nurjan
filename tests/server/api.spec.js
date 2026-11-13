// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../../server/app.js'
import { createPostRepository } from '../../server/store.js'

const JSON_HEADERS = { 'content-type': 'application/json' }

let repository
let app

beforeEach(() => {
  repository = createPostRepository()
  app = createApp({ repository })
})

async function postJson(body, raw) {
  return app.request('/api/posts', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: raw === undefined ? JSON.stringify(body) : raw
  })
}

describe('GET /api/posts', () => {
  it('returns an empty list with JSON content type', async () => {
    const response = await app.request('/api/posts')

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('application/json')
    expect(await response.json()).toEqual({ data: [] })
  })

  it('returns posts ordered by createdAt descending', async () => {
    await postJson({ content: 'first' })
    await postJson({ content: 'second' })
    await postJson({ content: 'third' })

    const response = await app.request('/api/posts')
    const payload = await response.json()

    expect(payload.data.map((post) => post.content)).toEqual(['third', 'second', 'first'])
  })
})

describe('POST /api/posts', () => {
  it('creates a post and returns 201 with the created entity', async () => {
    const response = await postJson({ content: 'hello world' })

    expect(response.status).toBe(201)
    expect(response.headers.get('content-type')).toContain('application/json')

    const payload = await response.json()
    expect(payload.data).toMatchObject({ content: 'hello world', author: '我' })
    expect(typeof payload.data.id).toBe('string')
    expect(payload.data.id.length).toBeGreaterThan(0)
    expect(typeof payload.data.createdAt).toBe('number')

    const listResponse = await app.request('/api/posts')
    expect(await listResponse.json()).toEqual({ data: [payload.data] })
  })

  it('stores the trimmed content', async () => {
    const response = await postJson({ content: '   hello   ' })
    const payload = await response.json()

    expect(response.status).toBe(201)
    expect(payload.data.content).toBe('hello')
  })

  it('rejects blank content with EMPTY_CONTENT', async () => {
    for (const body of [{ content: '' }, { content: '    ' }, {}]) {
      const response = await postJson(body)
      expect(response.status).toBe(422)
      const payload = await response.json()
      expect(payload.error.code).toBe('EMPTY_CONTENT')
      expect(typeof payload.error.message).toBe('string')
      expect(payload.error.message.length).toBeGreaterThan(0)
    }
  })

  it('rejects non string content with EMPTY_CONTENT', async () => {
    for (const content of [null, 42, true, ['a'], { text: 'a' }]) {
      const response = await postJson({ content })
      expect(response.status).toBe(422)
      expect((await response.json()).error.code).toBe('EMPTY_CONTENT')
    }
  })

  it('accepts content of exactly 280 trimmed characters', async () => {
    const response = await postJson({ content: `  ${'a'.repeat(280)}  ` })
    const payload = await response.json()

    expect(response.status).toBe(201)
    expect(payload.data.content).toHaveLength(280)
  })

  it('rejects content longer than 280 trimmed characters with CONTENT_TOO_LONG', async () => {
    const response = await postJson({ content: 'a'.repeat(281) })

    expect(response.status).toBe(422)
    const payload = await response.json()
    expect(payload.error.code).toBe('CONTENT_TOO_LONG')
    expect(typeof payload.error.message).toBe('string')
    expect(payload.error.message.length).toBeGreaterThan(0)
  })

  it('measures length after trimming', async () => {
    const response = await postJson({ content: `${' '.repeat(20)}${'a'.repeat(281)}${' '.repeat(20)}` })

    expect(response.status).toBe(422)
    expect((await response.json()).error.code).toBe('CONTENT_TOO_LONG')
  })

  it('rejects malformed JSON with INVALID_JSON', async () => {
    const response = await postJson(undefined, '{ not json')

    expect(response.status).toBe(400)
    const payload = await response.json()
    expect(payload.error.code).toBe('INVALID_JSON')
    expect(typeof payload.error.message).toBe('string')
    expect(payload.error.message.length).toBeGreaterThan(0)
  })

  it('rejects an empty body with INVALID_JSON', async () => {
    const response = await postJson(undefined, '')

    expect(response.status).toBe(400)
    expect((await response.json()).error.code).toBe('INVALID_JSON')
  })
})

describe('DELETE /api/posts/:id', () => {
  it('removes a post and responds 204 without a body', async () => {
    const created = await (await postJson({ content: 'to delete' })).json()

    const response = await app.request(`/api/posts/${created.data.id}`, { method: 'DELETE' })

    expect(response.status).toBe(204)
    expect(await response.text()).toBe('')

    const listResponse = await app.request('/api/posts')
    expect(await listResponse.json()).toEqual({ data: [] })
  })

  it('responds 404 NOT_FOUND for unknown ids', async () => {
    const response = await app.request('/api/posts/missing', { method: 'DELETE' })

    expect(response.status).toBe(404)
    const payload = await response.json()
    expect(payload.error.code).toBe('NOT_FOUND')
    expect(typeof payload.error.message).toBe('string')
    expect(payload.error.message.length).toBeGreaterThan(0)
  })
})

describe('unknown routes', () => {
  it('responds 404 NOT_FOUND for unknown /api routes', async () => {
    for (const path of ['/api/unknown', '/api/posts/extra/path']) {
      const response = await app.request(path)
      expect(response.status).toBe(404)
      expect(response.headers.get('content-type')).toContain('application/json')
      expect((await response.json()).error.code).toBe('NOT_FOUND')
    }
  })

  it('responds 404 NOT_FOUND for unsupported methods on /api/posts', async () => {
    const response = await app.request('/api/posts', { method: 'PUT' })

    expect(response.status).toBe(404)
    expect((await response.json()).error.code).toBe('NOT_FOUND')
  })
})
