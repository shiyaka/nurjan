import { defineStore } from 'pinia'
import { ApiError, postsApi } from '@/api/posts'

let inflight = null

export const usePostsStore = defineStore('posts', {
  state: () => ({
    items: [],
    loading: false,
    submitting: false,
    hydrated: false,
    error: null
  }),

  getters: {
    count: (state) => state.items.length,
    sorted: (state) => [...state.items].sort((a, b) => b.createdAt - a.createdAt)
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
