import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { usePostsStore } from '@/stores/posts'

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

function stubFetch(impl) {
  const fetchMock = vi.fn(impl)
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function servePosts(posts) {
  return stubFetch(async () => jsonResponse({ data: posts }))
}

function seedPosts(posts) {
  const store = usePostsStore()
  store.items = posts.map((post) => ({ ...post }))
  store.hydrated = true
  return store
}

const older = { id: 'a', content: '旧', author: '我', createdAt: 1000 }
const newer = { id: 'b', content: '新', author: '我', createdAt: 2000 }
const likedPost = { ...older, liked: true, likeCount: 3, favorited: false }

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('usePostsStore.hydrate', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('从服务端拉取列表并标记已加载', async () => {
    const fetchMock = servePosts([older, newer])
    const store = usePostsStore()

    const result = await store.hydrate()

    expect(result).toEqual({ ok: true })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][0]).toBe('/api/posts')
    expect(store.hydrated).toBe(true)
    expect(store.loading).toBe(false)
    expect(store.error).toBeNull()
    expect(store.items).toHaveLength(2)
    expect(store.count).toBe(2)
  })

  it('服务端返回乱序时 sorted 仍按 createdAt 倒序', async () => {
    servePosts([older, newer])
    const store = usePostsStore()

    await store.hydrate()

    expect(store.sorted.map((post) => post.id)).toEqual(['b', 'a'])
  })

  it('服务端无数据时得到空列表', async () => {
    servePosts([])
    const store = usePostsStore()

    await store.hydrate()

    expect(store.items).toEqual([])
    expect(store.count).toBe(0)
    expect(store.hydrated).toBe(true)
  })

  it('并发调用只发起一次请求', async () => {
    let release
    const fetchMock = stubFetch(
      () =>
        new Promise((resolve) => {
          release = resolve
        })
    )
    const store = usePostsStore()

    const first = store.hydrate()
    const second = store.hydrate()

    expect(store.loading).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    release(jsonResponse({ data: [newer] }))
    const results = await Promise.all([first, second])

    expect(results).toEqual([{ ok: true }, { ok: true }])
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(store.loading).toBe(false)
    expect(store.items).toHaveLength(1)
  })

  it('请求失败时标记 network 且不标记 hydrated', async () => {
    stubFetch(async () => {
      throw new TypeError('Failed to fetch')
    })
    const store = usePostsStore()

    const result = await store.hydrate()

    expect(result).toEqual({ ok: false, reason: 'network' })
    expect(store.error).toBe('network')
    expect(store.hydrated).toBe(false)
    expect(store.items).toEqual([])
    expect(store.loading).toBe(false)
  })
})

describe('usePostsStore.add', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('POST 后把返回的 post 置顶', async () => {
    const created = { id: 'c', content: '你好', author: '我', createdAt: 3000 }
    const fetchMock = stubFetch(async () => jsonResponse({ data: created }, 201))
    const store = seedPosts([older])

    const result = await store.add('  你好  ')

    expect(result).toEqual({ ok: true, post: created })
    expect(store.items.map((post) => post.id)).toEqual(['c', 'a'])
    expect(store.items[0].content).toBe('你好')
    expect(store.hydrated).toBe(true)
    expect(store.error).toBeNull()
    expect(store.submitting).toBe(false)

    const [, options] = fetchMock.mock.calls[0]
    expect(options.method).toBe('POST')
    expect(options.headers['Content-Type']).toBe('application/json')
    expect(JSON.parse(options.body)).toEqual({ content: '你好' })
  })

  it('submitting 在请求期间为 true', async () => {
    let release
    stubFetch(
      () =>
        new Promise((resolve) => {
          release = resolve
        })
    )
    const store = seedPosts([])

    const pending = store.add('内容')
    expect(store.submitting).toBe(true)

    release(jsonResponse({ data: { id: 'c', content: '内容', author: '我', createdAt: 1 } }, 201))
    await pending

    expect(store.submitting).toBe(false)
  })

  it('空白内容不发请求也不提示', async () => {
    const fetchMock = stubFetch(async () => jsonResponse({ data: [] }))
    const store = seedPosts([older])

    const result = await store.add('   \n ')

    expect(result).toEqual({ ok: false, reason: 'empty' })
    expect(fetchMock).not.toHaveBeenCalled()
    expect(store.items).toEqual([older])
    expect(store.submitting).toBe(false)
  })

  it('CONTENT_TOO_LONG 映射为 too-long', async () => {
    stubFetch(async () =>
      jsonResponse({ error: { code: 'CONTENT_TOO_LONG', message: '内容超出长度限制' } }, 422)
    )
    const store = seedPosts([older])

    const result = await store.add('超长内容')

    expect(result).toEqual({ ok: false, reason: 'too-long' })
    expect(store.error).toBe('too-long')
    expect(store.items).toEqual([older])
    expect(store.submitting).toBe(false)
  })

  it('请求失败时列表保持不变', async () => {
    stubFetch(async () => {
      throw new TypeError('Failed to fetch')
    })
    const store = seedPosts([older])

    const result = await store.add('无法发布')

    expect(result).toEqual({ ok: false, reason: 'network' })
    expect(store.error).toBe('network')
    expect(store.items).toEqual([older])
  })
})

describe('usePostsStore.remove', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('DELETE 成功后从列表移除', async () => {
    const fetchMock = stubFetch(async () => noContentResponse())
    const store = seedPosts([newer, older])

    const result = await store.remove('b')

    expect(result).toEqual({ ok: true })
    expect(store.items.map((post) => post.id)).toEqual(['a'])
    expect(store.error).toBeNull()

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/posts/b')
    expect(options.method).toBe('DELETE')
  })

  it('404 映射为 not-found', async () => {
    stubFetch(async () =>
      jsonResponse({ error: { code: 'NOT_FOUND', message: '内容不存在' } }, 404)
    )
    const store = seedPosts([older])

    const result = await store.remove('missing')

    expect(result).toEqual({ ok: false, reason: 'not-found' })
    expect(store.error).toBe('not-found')
    expect(store.items).toEqual([older])
  })

  it('网络失败时列表保持不变', async () => {
    stubFetch(async () => {
      throw new TypeError('Failed to fetch')
    })
    const store = seedPosts([newer, older])

    const result = await store.remove('a')

    expect(result).toEqual({ ok: false, reason: 'network' })
    expect(store.error).toBe('network')
    expect(store.items.map((post) => post.id)).toEqual(['b', 'a'])
  })
})

describe('usePostsStore.toggleLike', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('未点赞时取反为 true，并用返回的 post 替换列表项', async () => {
    const fetchMock = stubFetch(async () => jsonResponse({ data: likedPost }))
    const store = seedPosts([{ ...older, liked: false, likeCount: 2, favorited: false }, newer])

    const result = await store.toggleLike('a')

    expect(result.ok).toBe(true)
    expect(store.items[0]).toEqual(likedPost)
    expect(store.items[1]).toEqual(newer)
    expect(store.error).toBeNull()

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/posts/a')
    expect(options.method).toBe('PATCH')
    expect(JSON.parse(options.body)).toEqual({ liked: true })
  })

  it('已点赞时取反为 false', async () => {
    const fetchMock = stubFetch(async () =>
      jsonResponse({ data: { ...likedPost, liked: false, likeCount: 2 } })
    )
    const store = seedPosts([likedPost])

    const result = await store.toggleLike('a')

    expect(result.ok).toBe(true)
    expect(store.items[0].liked).toBe(false)
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ liked: false })
  })

  it('请求期间 isPending 为 true，结束后清理', async () => {
    let release
    stubFetch(
      () =>
        new Promise((resolve) => {
          release = resolve
        })
    )
    const store = seedPosts([{ ...older, liked: false, likeCount: 0, favorited: false }])

    const pending = store.toggleLike('a')

    expect(store.isPending('a')).toBe(true)
    expect(store.isPending('b')).toBe(false)

    release(jsonResponse({ data: likedPost }))
    await pending

    expect(store.isPending('a')).toBe(false)
  })

  it('同一 id 已有请求时返回 pending 且不再发请求', async () => {
    let release
    const fetchMock = stubFetch(
      () =>
        new Promise((resolve) => {
          release = resolve
        })
    )
    const store = seedPosts([{ ...older, liked: false, likeCount: 0, favorited: false }])

    const first = store.toggleLike('a')
    const second = await store.toggleLike('a')

    expect(second).toEqual({ ok: false, reason: 'pending' })
    expect(fetchMock).toHaveBeenCalledTimes(1)

    release(jsonResponse({ data: likedPost }))
    await expect(first).resolves.toMatchObject({ ok: true })
  })

  it('失败时列表保持不变、映射 network 并清理 pending', async () => {
    stubFetch(async () => jsonResponse({ error: { code: 'BOOM' } }, 500))
    const store = seedPosts([{ ...older, liked: false, likeCount: 0, favorited: false }])

    const result = await store.toggleLike('a')

    expect(result).toEqual({ ok: false, reason: 'network' })
    expect(store.error).toBe('network')
    expect(store.items[0]).toEqual({ ...older, liked: false, likeCount: 0, favorited: false })
    expect(store.isPending('a')).toBe(false)
  })

  it('404 映射为 not-found', async () => {
    stubFetch(async () =>
      jsonResponse({ error: { code: 'NOT_FOUND', message: '内容不存在' } }, 404)
    )
    const store = seedPosts([{ ...older, liked: false, likeCount: 0, favorited: false }])

    const result = await store.toggleLike('a')

    expect(result).toEqual({ ok: false, reason: 'not-found' })
    expect(store.items[0].liked).toBe(false)
  })
})

describe('usePostsStore.toggleFavorite', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('未收藏时取反为 true 并替换列表项', async () => {
    const favorited = { ...older, liked: false, likeCount: 0, favorited: true }
    const fetchMock = stubFetch(async () => jsonResponse({ data: favorited }))
    const store = seedPosts([{ ...older, liked: false, likeCount: 0, favorited: false }])

    const result = await store.toggleFavorite('a')

    expect(result.ok).toBe(true)
    expect(store.items[0]).toEqual(favorited)
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ favorited: true })
    expect(fetchMock.mock.calls[0][1].method).toBe('PATCH')
  })

  it('已收藏时取反为 false', async () => {
    const fetchMock = stubFetch(async () =>
      jsonResponse({ data: { ...older, liked: false, likeCount: 0, favorited: false } })
    )
    const store = seedPosts([{ ...older, liked: false, likeCount: 0, favorited: true }])

    await store.toggleFavorite('a')

    expect(store.items[0].favorited).toBe(false)
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ favorited: false })
  })

  it('失败时返回 network 且列表保持不变', async () => {
    stubFetch(async () => {
      throw new TypeError('Failed to fetch')
    })
    const store = seedPosts([{ ...older, liked: false, likeCount: 0, favorited: false }])

    const result = await store.toggleFavorite('a')

    expect(result).toEqual({ ok: false, reason: 'network' })
    expect(store.items[0].favorited).toBe(false)
    expect(store.isPending('a')).toBe(false)
  })
})
