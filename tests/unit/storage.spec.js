import { describe, expect, it, vi } from 'vitest'
import { createPostStorage } from '@/utils/storage'
import { MAX_LENGTH, STORAGE_KEY } from '@/constants'

function createMockStorage(initialValue = null) {
  let value = initialValue
  return {
    getItem: vi.fn(() => value),
    setItem: vi.fn((key, next) => {
      value = next
    }),
    removeItem: vi.fn(() => {
      value = null
    }),
    read: () => value
  }
}

function quotaError() {
  const error = new Error('quota exceeded')
  error.name = 'QuotaExceededError'
  return error
}

describe('createPostStorage.load', () => {
  it('没有数据时返回空数组', () => {
    const storage = createMockStorage(null)
    expect(createPostStorage(storage, STORAGE_KEY).load()).toEqual([])
  })

  it('非法 JSON 返回空数组而不抛错', () => {
    const storage = createMockStorage('{broken json')
    expect(createPostStorage(storage, STORAGE_KEY).load()).toEqual([])
  })

  it('非数组结构返回空数组', () => {
    const storage = createMockStorage(JSON.stringify({ content: 'hi' }))
    expect(createPostStorage(storage, STORAGE_KEY).load()).toEqual([])
  })

  it('过滤脏数据、补默认字段、截断超长正文并按时间倒序', () => {
    const storage = createMockStorage(
      JSON.stringify([
        { id: 'old', content: '旧内容', author: '我', createdAt: 1000 },
        { id: 'new', content: '新内容', createdAt: 2000 },
        { id: 'long', content: '字'.repeat(MAX_LENGTH + 40), author: '我', createdAt: 3000 },
        { id: 'blank', content: '   ', createdAt: 4000 },
        { id: 'bad-content', content: 123, createdAt: 5000 },
        null,
        'not-an-object'
      ])
    )

    const posts = createPostStorage(storage, STORAGE_KEY).load()

    expect(posts).toHaveLength(3)
    expect(posts.map((post) => post.id)).toEqual(['long', 'new', 'old'])
    expect(posts[0].content).toHaveLength(MAX_LENGTH)
    expect(posts[1].author).toBe('我')
    expect(typeof posts[1].createdAt).toBe('number')
  })

  it('localStorage 访问异常时返回空数组', () => {
    const storage = {
      getItem: vi.fn(() => {
        throw new Error('blocked')
      }),
      setItem: vi.fn()
    }
    expect(createPostStorage(storage, STORAGE_KEY).load()).toEqual([])
  })
})

describe('createPostStorage.save', () => {
  it('写入成功返回 ok 并序列化到指定 key', () => {
    const storage = createMockStorage()
    const posts = [{ id: 'a', content: 'hi', author: '我', createdAt: 1 }]

    expect(createPostStorage(storage, STORAGE_KEY).save(posts)).toEqual({ ok: true })
    expect(storage.setItem).toHaveBeenCalledWith(STORAGE_KEY, JSON.stringify(posts))
  })

  it('配额超限返回 quota', () => {
    const storage = createMockStorage()
    storage.setItem.mockImplementation(() => {
      throw quotaError()
    })

    expect(createPostStorage(storage, STORAGE_KEY).save([])).toEqual({
      ok: false,
      reason: 'quota'
    })
  })

  it('其他写入异常返回 unavailable', () => {
    const storage = createMockStorage()
    storage.setItem.mockImplementation(() => {
      throw new Error('denied')
    })

    expect(createPostStorage(storage, STORAGE_KEY).save([])).toEqual({
      ok: false,
      reason: 'unavailable'
    })
  })
})
