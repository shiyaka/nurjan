import { defineStore } from 'pinia'
import { ApiError, postsApi } from '@/api/posts'

let inflight = null

/**
 * 点赞 / 收藏共用一条 PATCH 流程：取反 → 请求 → 用返回的 post 替换，
 * 失败时列表保持不变，并保证 pending 一定被清理。
 */
async function patchPost(store, id, buildPatch) {
  if (store.pending[id]) {
    return { ok: false, reason: 'pending' }
  }

  const current = store.items.find((post) => post.id === id)
  if (!current) {
    return { ok: false, reason: 'not-found' }
  }

  store.pending = { ...store.pending, [id]: true }

  try {
    const post = await postsApi.update(id, buildPatch(current))
    store.items = store.items.map((item) => (item.id === id ? post : item))
    store.error = null
    return { ok: true, post }
  } catch (error) {
    const notFound =
      error instanceof ApiError && (error.status === 404 || error.code === 'NOT_FOUND')
    store.error = notFound ? 'not-found' : 'network'
    return { ok: false, reason: store.error }
  } finally {
    const pending = { ...store.pending }
    delete pending[id]
    store.pending = pending
  }
}

export const usePostsStore = defineStore('posts', {
  state: () => ({
    items: [],
    loading: false,
    submitting: false,
    hydrated: false,
    error: null,
    pending: {}
  }),

  getters: {
    count: (state) => state.items.length,
    sorted: (state) => [...state.items].sort((a, b) => b.createdAt - a.createdAt),
    isPending: (state) => (id) => Boolean(state.pending[id])
  },

  actions: {
    hydrate() {
      if (inflight) {
        return inflight
      }

      this.loading = true

      inflight = (async () => {
        try {
          const posts = await postsApi.list()
          this.items = posts
          this.hydrated = true
          this.error = null
          return { ok: true }
        } catch {
          this.error = 'network'
          return { ok: false, reason: 'network' }
        } finally {
          this.loading = false
          inflight = null
        }
      })()

      return inflight
    },

    async add(content) {
      const text = String(content ?? '').trim()

      if (!text) {
        return { ok: false, reason: 'empty' }
      }

      this.submitting = true

      try {
        const post = await postsApi.create(text)
        this.items = [post, ...this.items]
        this.hydrated = true
        this.error = null
        return { ok: true, post }
      } catch (error) {
        const tooLong = error instanceof ApiError && error.code === 'CONTENT_TOO_LONG'
        this.error = tooLong ? 'too-long' : 'network'
        return { ok: false, reason: this.error }
      } finally {
        this.submitting = false
      }
    },

    toggleLike(id) {
      return patchPost(this, id, (post) => ({ liked: !post.liked }))
    },

    toggleFavorite(id) {
      return patchPost(this, id, (post) => ({ favorited: !post.favorited }))
    },

    async remove(id) {
      try {
        await postsApi.remove(id)
        this.items = this.items.filter((post) => post.id !== id)
        this.error = null
        return { ok: true }
      } catch (error) {
        const notFound =
          error instanceof ApiError &&
          (error.status === 404 || error.code === 'NOT_FOUND')
        this.error = notFound ? 'not-found' : 'network'
        return { ok: false, reason: this.error }
      }
    }
  }
})
