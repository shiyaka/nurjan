import { beforeEach, describe, expect, it } from 'vitest'

import { ApiError } from '@/api/errors'
import { createBrowserPostsApi, STORAGE_KEY } from '@/api/browserPosts'

function createMemoryStorage() {
  const map = new Map()
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key)
  }
}

async function catchOf(promise) {
  return promise.then(
    () => null,
    (error) => error
  )
}

describe('createBrowserPostsApi', () => {
  let storage
  let api

  beforeEach(() => {
    storage = createMemoryStorage()
    let sequence = 0
    let clock = 1700000000000
    api = createBrowserPostsApi({
      storage,
      now: () => clock++,
      generateId: () => `local-${++sequence}`
    })
  })

  it('starts with an empty list', async () => {
    await expect(api.list()).resolves.toEqual([])
  })

  it('creates posts with default like/favorite fields and trimmed content', async () => {
    const post = await api.create('  第一条  ')

    expect(post).toEqual({
      id: 'local-1',
      content: '第一条',
      author: '我',
      createdAt: 1700000000000,
      liked: false,
      likeCount: 0,
      favorited: false
    })
  })

  it('lists newest posts first, matching the server ordering', async () => {
    await api.create('第一条')
    await api.create('第二条')

    const posts = await api.list()
    expect(posts.map((post) => post.content)).toEqual(['第二条', '第一条'])
  })

  it('rejects empty content with EMPTY_CONTENT', async () => {
    const error = await catchOf(api.create('   '))

    expect(error).toBeInstanceOf(ApiError)
    expect(error.status).toBe(422)
    expect(error.code).toBe('EMPTY_CONTENT')
  })

  it('rejects over-long content with CONTENT_TOO_LONG', async () => {
    const error = await catchOf(api.create('字'.repeat(281)))

    expect(error).toBeInstanceOf(ApiError)
    expect(error.status).toBe(422)
    expect(error.code).toBe('CONTENT_TOO_LONG')
  })

  it('increments likeCount once per like and stays idempotent', async () => {
    const { id } = await api.create('点赞')

    const liked = await api.update(id, { liked: true })
    expect(liked).toMatchObject({ liked: true, likeCount: 1 })

    const again = await api.update(id, { liked: true })
    expect(again.likeCount).toBe(1)

    const unliked = await api.update(id, { liked: false })
    expect(unliked).toMatchObject({ liked: false, likeCount: 0 })

    const repeat = await api.update(id, { liked: false })
    expect(repeat.likeCount).toBe(0)
  })

  it('toggles favorited without touching likeCount', async () => {
    const { id } = await api.create('收藏')

    const favorited = await api.update(id, { favorited: true })
    expect(favorited).toMatchObject({ favorited: true, liked: false, likeCount: 0 })

    const unfavorited = await api.update(id, { favorited: false })
    expect(unfavorited.favorited).toBe(false)
  })

  it('keeps untouched fields stable and returns a copy', async () => {
    const post = await api.create('原文')

    const updated = await api.update(post.id, { liked: true, favorited: true })
    expect(updated).toMatchObject({
      id: post.id,
      content: '原文',
      author: post.author,
      createdAt: post.createdAt
    })

    updated.content = '被篡改'
    const stored = (await api.list())[0]
    expect(stored.content).toBe('原文')
  })

  it('rejects updates of unknown ids with NOT_FOUND', async () => {
    const error = await catchOf(api.update('missing', { liked: true }))

    expect(error).toBeInstanceOf(ApiError)
    expect(error.status).toBe(404)
    expect(error.code).toBe('NOT_FOUND')
  })

  it('removes posts and reports NOT_FOUND for unknown ids', async () => {
    const { id } = await api.create('待删除')

    await expect(api.remove(id)).resolves.toBeNull()
    await expect(api.list()).resolves.toEqual([])

    const error = await catchOf(api.remove(id))
    expect(error.status).toBe(404)
    expect(error.code).toBe('NOT_FOUND')
  })

  it('persists data across api instances sharing the same storage', async () => {
    const { id } = await api.create('持久化')
    await api.update(id, { favorited: true })

    const nextApi = createBrowserPostsApi({ storage })
    const posts = await nextApi.list()
    expect(posts).toHaveLength(1)
    expect(posts[0]).toMatchObject({ id, content: '持久化', favorited: true })
  })

  it('treats corrupted storage as an empty list instead of throwing', async () => {
    storage.setItem(STORAGE_KEY, '{not json')

    await expect(api.list()).resolves.toEqual([])

    await api.create('恢复写入')
    expect(JSON.parse(storage.getItem(STORAGE_KEY))).toHaveLength(1)
  })

  it('surfaces storage write failures as ApiError without mutating state', async () => {
    await api.create('保留')

    const broken = {
      getItem: storage.getItem,
      setItem: () => {
        throw new Error('QuotaExceededError')
      }
    }
    const failing = createBrowserPostsApi({ storage: broken })

    const error = await catchOf(failing.create('写不进去'))
    expect(error).toBeInstanceOf(ApiError)
    expect(error.code).toBe('STORAGE_ERROR')

    const posts = await failing.list()
    expect(posts.map((post) => post.content)).toEqual(['保留'])
  })
})
