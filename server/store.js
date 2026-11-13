const DEFAULT_AUTHOR = '我'

function defaultGenerateId() {
  const cryptoApi = globalThis.crypto
  if (cryptoApi && typeof cryptoApi.randomUUID === 'function') {
    return cryptoApi.randomUUID()
  }
  return `p-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

const PATCHABLE_FLAGS = ['liked', 'favorited']

export function createPostRepository({ now = Date.now, generateId = defaultGenerateId } = {}) {
  let posts = []

  return {
    list() {
      return [...posts]
        .sort((a, b) => b.createdAt - a.createdAt)
        .map((post) => ({ ...post }))
    },

    create(content) {
      const post = {
        id: generateId(),
        content,
        author: DEFAULT_AUTHOR,
        createdAt: now(),
        liked: false,
        likeCount: 0,
        favorited: false
      }
      posts = [post, ...posts]
      return { ...post }
    },

    update(id, patch = {}) {
      const index = posts.findIndex((post) => post.id === id)
      if (index < 0) {
        return null
      }

      const current = posts[index]
      const next = { ...current }
      const source = patch && typeof patch === 'object' ? patch : {}

      for (const field of PATCHABLE_FLAGS) {
        const value = source[field]
        if (typeof value !== 'boolean') {
          continue
        }

        if (field === 'liked') {
          if (value === current.liked) {
            continue
          }
          next.liked = value
          next.likeCount = Math.max(0, current.likeCount + (value ? 1 : -1))
        } else {
          next.favorited = value
        }
      }

      posts = [...posts.slice(0, index), next, ...posts.slice(index + 1)]
      return { ...next }
    },

    remove(id) {
      const index = posts.findIndex((post) => post.id === id)
      if (index < 0) {
        return false
      }
      posts = [...posts.slice(0, index), ...posts.slice(index + 1)]
      return true
    },

    reset() {
      posts = []
    }
  }
}
