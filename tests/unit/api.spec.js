import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, createPostsApi, postsApi } from '@/api/posts'

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body
  }
}

function noContentResponse() {
  return {
    ok: true,
    status: 204,
    json: async () => {
      throw new SyntaxError('Unexpected end of JSON input')
    }
  }
}

function brokenJsonResponse(status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => {
      throw new SyntaxError('Unexpected token < in JSON')
    }
  }
}

function stubFetch(impl) {
  const fetchMock = vi.fn(impl)
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

const samplePost = { id: 'p1', content: '你好', author: '我', createdAt: 1000 }

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('postsApi.list', () => {
  it('GET /api/posts 并返回 data 数组', async () => {
    const fetchMock = stubFetch(async () => jsonResponse({ data: [samplePost] }))

    const posts = await postsApi.list()

    expect(posts).toEqual([samplePost])
    expect(fetchMock).toHaveBeenCalledTimes(1)

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/posts')
    expect(options.method ?? 'GET').toBe('GET')
    expect(options.headers['Content-Type']).toBe('application/json')
  })

  it('缺少 data 字段时返回空数组', async () => {
    stubFetch(async () => jsonResponse({}))

    await expect(postsApi.list()).resolves.toEqual([])
  })
})

describe('createPostsApi', () => {
  it('使用注入的 API base 拼接绝对地址并去除末尾斜杠', async () => {
    const fetchMock = stubFetch(async () => jsonResponse({ data: [] }))
    const api = createPostsApi('https://api.example.com/')

    await api.list()

    expect(fetchMock.mock.calls[0][0]).toBe('https://api.example.com/api/posts')
  })

  it('DELETE 也使用注入的 base', async () => {
    const fetchMock = stubFetch(async () => noContentResponse())
    const api = createPostsApi('https://api.example.com')

    await api.remove('p/1')

    expect(fetchMock.mock.calls[0][0]).toBe('https://api.example.com/api/posts/p%2F1')
  })
})

describe('postsApi.create', () => {
  it('POST JSON body 并返回新建的 post', async () => {
    const fetchMock = stubFetch(async () => jsonResponse({ data: samplePost }, 201))

    const post = await postsApi.create('你好')

    expect(post).toEqual(samplePost)

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/posts')
    expect(options.method).toBe('POST')
    expect(options.headers['Content-Type']).toBe('application/json')
    expect(JSON.parse(options.body)).toEqual({ content: '你好' })
  })

  it('422 EMPTY_CONTENT 抛出 ApiError', async () => {
    stubFetch(async () =>
      jsonResponse(
        { error: { code: 'EMPTY_CONTENT', message: '内容不能为空' } },
        422
      )
    )

    const error = await postsApi.create('').catch((e) => e)

    expect(error).toBeInstanceOf(ApiError)
    expect(error.name).toBe('ApiError')
    expect(error.status).toBe(422)
    expect(error.code).toBe('EMPTY_CONTENT')
    expect(error.message).toBe('内容不能为空')
  })

  it('422 CONTENT_TOO_LONG 保留 code', async () => {
    stubFetch(async () =>
      jsonResponse(
        { error: { code: 'CONTENT_TOO_LONG', message: '内容超出长度限制' } },
        422
      )
    )

    const error = await postsApi.create('x'.repeat(300)).catch((e) => e)

    expect(error).toBeInstanceOf(ApiError)
    expect(error.code).toBe('CONTENT_TOO_LONG')
    expect(error.status).toBe(422)
  })

  it('201 缺少 data 字段时抛 INVALID_RESPONSE', async () => {
    stubFetch(async () => jsonResponse({}, 201))

    const error = await postsApi.create('你好').catch((e) => e)

    expect(error).toBeInstanceOf(ApiError)
    expect(error.code).toBe('INVALID_RESPONSE')
  })

  it('400 INVALID_JSON 保留 code', async () => {
    stubFetch(async () =>
      jsonResponse({ error: { code: 'INVALID_JSON', message: '请求体不是合法 JSON' } }, 400)
    )

    const error = await postsApi.create('hi').catch((e) => e)

    expect(error).toBeInstanceOf(ApiError)
    expect(error.code).toBe('INVALID_JSON')
    expect(error.status).toBe(400)
  })
})

describe('postsApi.remove', () => {
  it('DELETE /api/posts/:id，204 返回 null', async () => {
    const fetchMock = stubFetch(async () => noContentResponse())

    await expect(postsApi.remove('p1')).resolves.toBeNull()

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/posts/p1')
    expect(options.method).toBe('DELETE')
  })

  it('404 NOT_FOUND 抛出 ApiError', async () => {
    stubFetch(async () =>
      jsonResponse({ error: { code: 'NOT_FOUND', message: '内容不存在' } }, 404)
    )

    const error = await postsApi.remove('missing').catch((e) => e)

    expect(error).toBeInstanceOf(ApiError)
    expect(error.status).toBe(404)
    expect(error.code).toBe('NOT_FOUND')
  })
})

describe('postsApi 错误归一化', () => {
  it('网络异常包装为 status 0 / NETWORK_ERROR', async () => {
    stubFetch(async () => {
      throw new TypeError('Failed to fetch')
    })

    const error = await postsApi.list().catch((e) => e)

    expect(error).toBeInstanceOf(ApiError)
    expect(error.status).toBe(0)
    expect(error.code).toBe('NETWORK_ERROR')
  })

  it('响应不是合法 JSON 时按 INVALID_RESPONSE 处理', async () => {
    stubFetch(async () => brokenJsonResponse(200))

    const error = await postsApi.list().catch((e) => e)

    expect(error).toBeInstanceOf(ApiError)
    expect(error.code).toBe('INVALID_RESPONSE')
  })

  it('非 2xx 且响应体不是 JSON 时也抛 ApiError', async () => {
    stubFetch(async () => brokenJsonResponse(500))

    const error = await postsApi.list().catch((e) => e)

    expect(error).toBeInstanceOf(ApiError)
    expect(error.status).toBe(500)
  })
})
