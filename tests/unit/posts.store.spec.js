import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { usePostsStore } from '@/stores/posts'
import { MAX_LENGTH, STORAGE_KEY } from '@/constants'

function seed(posts) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(posts))
}

function readStored() {
  return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
}

function failNextWrite() {
  const error = new Error('quota exceeded')
  error.name = 'QuotaExceededError'
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw error
  })
}

describe('usePostsStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('hydrate 读取本地数据并标记已加载', () => {
    seed([
      { id: 'a', content: '旧', author: '我', createdAt: 1000 },
      { id: 'b', content: '新', author: '我', createdAt: 2000 }
    ])
    const store = usePostsStore()

    store.hydrate()

    expect(store.hydrated).toBe(true)
    expect(store.items).toHaveLength(2)
    expect(store.sorted[0].id).toBe('b')
    expect(store.count).toBe(2)
  })

  it('本地无数据时 hydrate 得到空列表', () => {
    const store = usePostsStore()
    store.hydrate()

    expect(store.items).toEqual([])
    expect(store.count).toBe(0)
  })

  it('add 会 trim、置顶并写入本地存储', () => {
    const store = usePostsStore()
    store.hydrate()

    const result = store.add('  你好  ')

    expect(result.ok).toBe(true)
    expect(store.items[0].content).toBe('你好')
    expect(store.items[0].author).toBe('我')
    expect(store.items[0].id).toEqual(expect.any(String))
    expect(store.items[0].createdAt).toEqual(expect.any(Number))
    expect(readStored()[0].content).toBe('你好')
    expect(store.error).toBeNull()
  })

  it('add 拒绝空白内容', () => {
    const store = usePostsStore()
    store.hydrate()

    const result = store.add('   \n ')

    expect(result).toEqual({ ok: false, reason: 'empty' })
    expect(store.items).toHaveLength(0)
    expect(store.error).toBe('empty')
    expect(readStored()).toEqual([])
  })

  it('add 会把超长正文截断到上限', () => {
    const store = usePostsStore()
    store.hydrate()

    store.add('字'.repeat(MAX_LENGTH + 30))

    expect(store.items[0].content).toHaveLength(MAX_LENGTH)
  })

  it('remove 删除指定内容并同步存储', () => {
    seed([
      { id: 'a', content: 'A', author: '我', createdAt: 1000 },
      { id: 'b', content: 'B', author: '我', createdAt: 2000 }
    ])
    const store = usePostsStore()
    store.hydrate()

    const result = store.remove('b')

    expect(result).toEqual({ ok: true })
    expect(store.items).toHaveLength(1)
    expect(store.items[0].id).toBe('a')
    expect(readStored()).toHaveLength(1)
  })

  it('remove 不存在的 id 返回 not-found', () => {
    const store = usePostsStore()
    store.hydrate()

    expect(store.remove('missing')).toEqual({ ok: false, reason: 'not-found' })
  })

  it('写入失败时 add 回滚并返回 quota', () => {
    const store = usePostsStore()
    store.hydrate()
    failNextWrite()

    const result = store.add('无法保存')

    expect(result).toEqual({ ok: false, reason: 'quota' })
    expect(store.items).toHaveLength(0)
    expect(store.error).toBe('quota')
  })

  it('写入失败时 remove 恢复原列表', () => {
    seed([
      { id: 'a', content: 'A', author: '我', createdAt: 1000 },
      { id: 'b', content: 'B', author: '我', createdAt: 2000 }
    ])
    const store = usePostsStore()
    store.hydrate()
    failNextWrite()

    const result = store.remove('a')

    expect(result).toEqual({ ok: false, reason: 'quota' })
    expect(store.items.map((post) => post.id).sort()).toEqual(['a', 'b'])
    expect(store.error).toBe('quota')
  })
})
