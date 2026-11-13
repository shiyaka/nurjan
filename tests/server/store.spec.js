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
      createdAt: 1700000000000,
      liked: false,
      likeCount: 0,
      favorited: false
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

describe('createPostRepository update', () => {
  function setup() {
    const repository = createPostRepository({ now: () => 1700000000000, generateId: fixedId() })
    const post = repository.create('hello')
    return { repository, post }
  }

  it('returns null for an unknown id without touching the store', () => {
    const { repository, post } = setup()

    expect(repository.update('missing-id', { liked: true })).toBeNull()
    expect(repository.list()).toEqual([post])
  })

  it('likes a post and increments likeCount', () => {
    const { repository, post } = setup()

    const updated = repository.update(post.id, { liked: true })

    expect(updated).toEqual({ ...post, liked: true, likeCount: 1 })
    expect(repository.list()).toEqual([updated])
  })

  it('does not increment likeCount twice when liking an already liked post', () => {
    const { repository, post } = setup()

    repository.update(post.id, { liked: true })
    const updated = repository.update(post.id, { liked: true })

    expect(updated.liked).toBe(true)
    expect(updated.likeCount).toBe(1)
  })

  it('unlikes a post and never lets likeCount go below zero', () => {
    const { repository, post } = setup()

    const unliked = repository.update(post.id, { liked: false })

    expect(unliked.liked).toBe(false)
    expect(unliked.likeCount).toBe(0)

    const liked = repository.update(post.id, { liked: true })
    expect(liked.likeCount).toBe(1)

    const toggledOff = repository.update(post.id, { liked: false })
    expect(toggledOff.liked).toBe(false)
    expect(toggledOff.likeCount).toBe(0)
  })

  it('sets favorited directly and keeps it independent from liked', () => {
    const { repository, post } = setup()

    const favorited = repository.update(post.id, { favorited: true })
    expect(favorited).toEqual({ ...post, favorited: true })
    expect(favorited.liked).toBe(false)
    expect(favorited.likeCount).toBe(0)

    const unfavorited = repository.update(post.id, { favorited: false })
    expect(unfavorited.favorited).toBe(false)
    expect(unfavorited.liked).toBe(false)
    expect(unfavorited.likeCount).toBe(0)
  })

  it('applies both flags in a single patch and preserves unrelated fields', () => {
    const { repository, post } = setup()

    const updated = repository.update(post.id, { liked: true, favorited: true })

    expect(updated).toEqual({
      id: post.id,
      content: 'hello',
      author: '我',
      createdAt: post.createdAt,
      liked: true,
      likeCount: 1,
      favorited: true
    })
  })

  it('keeps the current state for omitted fields', () => {
    const { repository, post } = setup()
    repository.update(post.id, { liked: true })

    const updated = repository.update(post.id, { favorited: true })

    expect(updated).toMatchObject({ liked: true, likeCount: 1, favorited: true })
  })

  it('ignores unknown keys and non boolean values', () => {
    const { repository, post } = setup()

    const afterUnknownKey = repository.update(post.id, { content: 'hacked', likeCount: 99 })
    expect(afterUnknownKey).toEqual(post)

    const afterWrongTypes = repository.update(post.id, { liked: 'yes', favorited: 1 })
    expect(afterWrongTypes).toEqual(post)

    expect(repository.list()).toEqual([post])
  })

  it('returns a copy so external mutations do not leak into the store', () => {
    const { repository, post } = setup()

    const updated = repository.update(post.id, { liked: true })
    updated.likeCount = 999
    updated.content = 'mutated'

    expect(repository.list()[0]).toMatchObject({ content: 'hello', likeCount: 1, liked: true })
  })

  it('keeps the post unchanged when no patchable field is provided', () => {
    const { repository, post } = setup()

    for (const patch of [undefined, null, {}, 'liked', 42, ['liked']]) {
      const updated = repository.update(post.id, patch)
      expect(updated).toEqual(post)
      expect(updated).not.toBe(post)
    }

    expect(repository.list()).toEqual([post])
  })

  it('keeps likeCount stable across repeated toggles', () => {
    const { repository, post } = setup()
    const counts = []

    for (const liked of [true, false, true, true, false, false, true]) {
      counts.push(repository.update(post.id, { liked }).likeCount)
    }

    expect(counts).toEqual([1, 0, 1, 1, 0, 0, 1])
    expect(repository.list()[0]).toMatchObject({ liked: true, likeCount: 1 })
  })

  it('preserves id, content, author and createdAt when patching flags', () => {
    const { repository, post } = setup()

    const updated = repository.update(post.id, { liked: true, favorited: true })

    expect(updated.id).toBe(post.id)
    expect(updated.content).toBe(post.content)
    expect(updated.author).toBe(post.author)
    expect(updated.createdAt).toBe(post.createdAt)
    expect(repository.list()).toEqual([updated])
  })

  it('only touches the targeted post', () => {
    const repository = createPostRepository({ now: fixedClock([1, 2]), generateId: fixedId() })
    const first = repository.create('first')
    const second = repository.create('second')

    repository.update(first.id, { liked: true, favorited: true })

    const byId = (id) => repository.list().find((post) => post.id === id)
    expect(byId(first.id)).toMatchObject({ liked: true, likeCount: 1, favorited: true })
    expect(byId(second.id)).toEqual(second)
  })
})

function fixedId() {
  let n = 0
  return () => `id-${++n}`
}
