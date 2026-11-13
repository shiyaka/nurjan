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

  it('exposes liked, likeCount and favorited on every post', async () => {
    await postJson({ content: 'first' })
    await postJson({ content: 'second' })

    const response = await app.request('/api/posts')
    const payload = await response.json()

    expect(payload.data).toHaveLength(2)
    for (const post of payload.data) {
      expect(post).toMatchObject({ liked: false, likeCount: 0, favorited: false })
      expect(typeof post.liked).toBe('boolean')
      expect(typeof post.likeCount).toBe('number')
      expect(typeof post.favorited).toBe('boolean')
    }
  })
})

describe('POST /api/posts', () => {
  it('creates a post and returns 201 with the created entity', async () => {
    const response = await postJson({ content: 'hello world' })

    expect(response.status).toBe(201)
    expect(response.headers.get('content-type')).toContain('application/json')

    const payload = await response.json()
    expect(payload.data).toMatchObject({
      content: 'hello world',
      author: '我',
      liked: false,
      likeCount: 0,
      favorited: false
    })
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

describe('PATCH /api/posts/:id', () => {
  async function createPost(content = 'hello') {
    const response = await postJson({ content })
    return (await response.json()).data
  }

  async function patchJson(id, body, raw) {
    return app.request(`/api/posts/${id}`, {
      method: 'PATCH',
      headers: JSON_HEADERS,
      body: raw === undefined ? JSON.stringify(body) : raw
    })
  }

  it('likes a post and returns the updated entity', async () => {
    const created = await createPost()

    const response = await patchJson(created.id, { liked: true })

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('application/json')
    expect(await response.json()).toEqual({
      data: { ...created, liked: true, likeCount: 1 }
    })

    const listResponse = await app.request('/api/posts')
    const payload = await listResponse.json()
    expect(payload.data[0]).toMatchObject({ liked: true, likeCount: 1 })
  })

  it('unlikes a post and keeps likeCount at zero for repeated unlikes', async () => {
    const created = await createPost()

    await patchJson(created.id, { liked: true })
    const unliked = await patchJson(created.id, { liked: false })
    expect((await unliked.json()).data).toMatchObject({ liked: false, likeCount: 0 })

    const unlikedAgain = await patchJson(created.id, { liked: false })
    expect((await unlikedAgain.json()).data).toMatchObject({ liked: false, likeCount: 0 })
  })

  it('is idempotent when liking twice', async () => {
    const created = await createPost()

    await patchJson(created.id, { liked: true })
    const response = await patchJson(created.id, { liked: true })

    expect(response.status).toBe(200)
    expect((await response.json()).data).toMatchObject({ liked: true, likeCount: 1 })
  })

  it('favorites a post without touching the like state', async () => {
    const created = await createPost()

    const response = await patchJson(created.id, { favorited: true })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      data: { ...created, favorited: true }
    })
  })

  it('applies liked and favorited together', async () => {
    const created = await createPost()

    const response = await patchJson(created.id, { liked: true, favorited: true })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      data: { ...created, liked: true, likeCount: 1, favorited: true }
    })
  })

  it('responds 404 NOT_FOUND for unknown ids', async () => {
    const response = await patchJson('missing-id', { liked: true })

    expect(response.status).toBe(404)
    const payload = await response.json()
    expect(payload.error.code).toBe('NOT_FOUND')
    expect(typeof payload.error.message).toBe('string')
    expect(payload.error.message.length).toBeGreaterThan(0)
  })

  it('rejects malformed JSON with INVALID_JSON', async () => {
    const created = await createPost()

    const response = await patchJson(created.id, undefined, '{ not json')

    expect(response.status).toBe(400)
    expect((await response.json()).error.code).toBe('INVALID_JSON')
  })

  it('rejects an empty body with INVALID_JSON', async () => {
    const created = await createPost()

    const response = await patchJson(created.id, undefined, '')

    expect(response.status).toBe(400)
    expect((await response.json()).error.code).toBe('INVALID_JSON')
  })

  it('rejects non object bodies with INVALID_PATCH', async () => {
    const created = await createPost()

    for (const raw of ['null', '"text"', '42', '[]', '[{"liked":true}]', 'true']) {
      const response = await patchJson(created.id, undefined, raw)
      expect(response.status).toBe(422)
      const payload = await response.json()
      expect(payload.error.code).toBe('INVALID_PATCH')
      expect(typeof payload.error.message).toBe('string')
      expect(payload.error.message.length).toBeGreaterThan(0)
    }
  })

  it('rejects patches without any known field with INVALID_PATCH', async () => {
    const created = await createPost()

    for (const body of [{}, { content: 'hacked' }, { likeCount: 5 }]) {
      const response = await patchJson(created.id, body)
      expect(response.status).toBe(422)
      expect((await response.json()).error.code).toBe('INVALID_PATCH')
    }

    const listResponse = await app.request('/api/posts')
    expect((await listResponse.json()).data[0]).toEqual(created)
  })

  it('rejects non boolean field values with INVALID_PATCH', async () => {
    const created = await createPost()

    const bodies = [
      { liked: 'true' },
      { liked: 1 },
      { liked: null },
      { favorited: 'yes' },
      { favorited: 0 },
      { liked: true, favorited: 'yes' },
      { liked: 'yes', favorited: true }
    ]

    for (const body of bodies) {
      const response = await patchJson(created.id, body)
      expect(response.status).toBe(422)
      expect((await response.json()).error.code).toBe('INVALID_PATCH')
    }

    const listResponse = await app.request('/api/posts')
    expect((await listResponse.json()).data[0]).toEqual(created)
  })

  it('does not affect other posts', async () => {
    const first = await createPost('first')
    const second = await createPost('second')

    await patchJson(first.id, { liked: true, favorited: true })

    const listResponse = await app.request('/api/posts')
    const payload = await listResponse.json()
    expect(payload.data.find((post) => post.id === second.id)).toEqual(second)
  })

  it('ignores unknown keys when a known flag is present', async () => {
    const created = await createPost()

    const response = await patchJson(created.id, {
      liked: true,
      content: 'hacked',
      likeCount: 99,
      author: 'someone'
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      data: { ...created, liked: true, likeCount: 1 }
    })
  })

  it('returns the unchanged entity for a no-op flag', async () => {
    const created = await createPost()

    const response = await patchJson(created.id, { liked: false, favorited: false })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ data: created })
  })

  it('responds 404 NOT_FOUND after the post has been deleted', async () => {
    const created = await createPost()
    await app.request(`/api/posts/${created.id}`, { method: 'DELETE' })

    const response = await patchJson(created.id, { liked: true })

    expect(response.status).toBe(404)
    expect((await response.json()).error.code).toBe('NOT_FOUND')
  })

  it('does not create a post as a side effect of an invalid patch', async () => {
    const created = await createPost()

    await patchJson(created.id, { liked: 'yes' })

    const listResponse = await app.request('/api/posts')
    const payload = await listResponse.json()
    expect(payload.data).toHaveLength(1)
    expect(payload.data[0]).toEqual(created)
  })
})

describe('CORS', () => {
  it('OPTIONS 预检请求返回允许跨域的头', async () => {
    const response = await app.request('/api/posts', {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://shiyaka.github.io',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type'
      }
    })

    expect(response.status).toBe(204)
    expect(response.headers.get('access-control-allow-origin')).toBeTruthy()
    expect(response.headers.get('access-control-allow-methods')).toContain('POST')
    expect(response.headers.get('access-control-allow-headers')?.toLowerCase()).toContain('content-type')
  })

  it('OPTIONS 预检请求允许 PATCH 方法', async () => {
    const response = await app.request('/api/posts/id-1', {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://shiyaka.github.io',
        'Access-Control-Request-Method': 'PATCH',
        'Access-Control-Request-Headers': 'content-type'
      }
    })

    expect(response.status).toBe(204)
    expect(response.headers.get('access-control-allow-origin')).toBeTruthy()
    expect(response.headers.get('access-control-allow-methods')).toContain('PATCH')
    expect(response.headers.get('access-control-allow-methods')).toContain('GET')
    expect(response.headers.get('access-control-allow-headers')?.toLowerCase()).toContain('content-type')
  })

  it('普通请求也返回跨域响应头', async () => {
    const response = await app.request('/api/posts', {
      headers: { Origin: 'https://shiyaka.github.io' }
    })

    expect(response.status).toBe(200)
    expect(response.headers.get('access-control-allow-origin')).toBeTruthy()
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
