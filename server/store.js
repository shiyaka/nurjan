const DEFAULT_AUTHOR = '我'

function defaultGenerateId() {
  const cryptoApi = globalThis.crypto
  if (cryptoApi && typeof cryptoApi.randomUUID === 'function') {
    return cryptoApi.randomUUID()
  }
  return `p-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

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
        createdAt: now()
      }
      posts = [post, ...posts]
      return { ...post }
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
