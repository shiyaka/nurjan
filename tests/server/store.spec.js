// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { createPostRepository } from '../../server/store.js'

function fixedClock(values) {
  let index = 0
  return () => values[Math.min(index++, values.length - 1)]
}

describe('createPostRepository', () => {
  it('starts empty', () => {
    const repository = createPostRepository()
    expect(repository.list()).toEqual([])
  })

  it('creates a post with generated id, author and createdAt', () => {
    const repository = createPostRepository({
      now: () => 1700000000000,
      generateId: () => 'id-1'
    })

    const post = repository.create('hello')

    expect(post).toEqual({
      id: 'id-1',
      content: 'hello',
      author: '我',
      createdAt: 1700000000000
    })
    expect(repository.list()).toEqual([post])
  })

  it('lists posts by createdAt descending', () => {
    const repository = createPostRepository({
      now: fixedClock([1000, 2000, 3000]),
      generateId: (() => {
        let n = 0
        return () => `id-${++n}`
      })()
    })

    repository.create('first')
    repository.create('second')
    repository.create('third')

    expect(repository.list().map((post) => post.content)).toEqual(['third', 'second', 'first'])
  })

  it('returns a copy so external mutations do not leak into the store', () => {
    const repository = createPostRepository({ now: () => 1, generateId: () => 'id-1' })
    repository.create('hello')

    const snapshot = repository.list()
    snapshot.push({ id: 'hacked', content: 'x', author: '我', createdAt: 0 })
    snapshot[0].content = 'mutated'

    expect(repository.list()).toHaveLength(1)
    expect(repository.list()[0].content).toBe('hello')
  })

  it('removes an existing post and reports the result', () => {
    const repository = createPostRepository({ now: fixedClock([1, 2]), generateId: fixedId() })
    const first = repository.create('first')
    const second = repository.create('second')

    expect(repository.remove(first.id)).toBe(true)
    expect(repository.list().map((post) => post.id)).toEqual([second.id])
    expect(repository.remove(first.id)).toBe(false)
  })

  it('resets every stored post', () => {
    const repository = createPostRepository()
    repository.create('first')
    repository.create('second')

    repository.reset()

    expect(repository.list()).toEqual([])
  })

  it('generates unique string ids by default', () => {
    const repository = createPostRepository()
    const first = repository.create('first')
    const second = repository.create('second')

    expect(typeof first.id).toBe('string')
    expect(first.id.length).toBeGreaterThan(0)
    expect(second.id).not.toBe(first.id)
  })
})

function fixedId() {
  let n = 0
  return () => `id-${++n}`
}
