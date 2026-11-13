import { defineStore } from 'pinia'
import { DEFAULT_AUTHOR, MAX_LENGTH, STORAGE_KEY } from '@/constants'
import { createPostStorage } from '@/utils/storage'
import { createId } from '@/utils/id'

function getStorage() {
  return createPostStorage(undefined, STORAGE_KEY)
}

export const usePostsStore = defineStore('posts', {
  state: () => ({
    items: [],
    hydrated: false,
    error: null
  }),

  getters: {
    count: (state) => state.items.length,
    sorted: (state) => [...state.items].sort((a, b) => b.createdAt - a.createdAt)
  },

  actions: {
    hydrate() {
      this.items = getStorage().load()
      this.hydrated = true
      this.error = null
      return this.items
    },

    add(content) {
      const text = String(content ?? '').trim()

      if (!text) {
        this.error = 'empty'
        return { ok: false, reason: 'empty' }
      }

      const post = {
        id: createId(),
        content: text.slice(0, MAX_LENGTH),
        author: DEFAULT_AUTHOR,
        createdAt: Date.now()
      }

      const previous = this.items
      this.items = [post, ...previous]

      const result = getStorage().save(this.items)
      if (!result.ok) {
        this.items = previous
        this.error = result.reason
        return { ok: false, reason: result.reason }
      }

      this.error = null
      return { ok: true, post }
    },

    remove(id) {
      const index = this.items.findIndex((post) => post.id === id)
      if (index < 0) {
        this.error = 'not-found'
        return { ok: false, reason: 'not-found' }
      }

      const previous = this.items
      const next = previous.slice()
      next.splice(index, 1)
      this.items = next

      const result = getStorage().save(this.items)
      if (!result.ok) {
        this.items = previous
        this.error = result.reason
        return { ok: false, reason: result.reason }
      }

      this.error = null
      return { ok: true }
    }
  }
})
