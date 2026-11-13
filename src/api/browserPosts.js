import { MAX_LENGTH } from '@/constants'
import { ApiError } from './errors'

export const STORAGE_KEY = 'nurjan.posts.v1'

const AUTHOR = '我'

function defaultGenerateId() {
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function normalizePatch(patch) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
    throw new ApiError('更新内容必须是对象', { status: 422, code: 'INVALID_PATCH' })
  }

  const provided = ['liked', 'favorited'].filter((field) =>
    Object.prototype.hasOwnProperty.call(patch, field)
  )

  if (provided.length === 0) {
    throw new ApiError('至少需要提供 liked 或 favorited 字段', {
      status: 422,
      code: 'INVALID_PATCH'
    })
  }

  const normalized = {}
  for (const field of provided) {
    if (typeof patch[field] !== 'boolean') {
      throw new ApiError(`${field} 必须是布尔值`, { status: 422, code: 'INVALID_PATCH' })
    }
    normalized[field] = patch[field]
  }

  return normalized
}

/**
 * GitHub Pages 等纯静态托管场景下的本地适配器：
 * 与 HTTP API（createPostsApi）保持完全相同的返回结构与错误码，
 * 数据保存在浏览器 localStorage，不依赖任何后端服务。
 */
export function createBrowserPostsApi({
  storage = globalThis.localStorage,
  now = Date.now,
  generateId = defaultGenerateId
} = {}) {
  function read() {
    try {
      const raw = storage.getItem(STORAGE_KEY)
      const posts = raw ? JSON.parse(raw) : []
      return Array.isArray(posts) ? posts : []
    } catch {
      return []
    }
  }

  function write(posts) {
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(posts))
    } catch {
      throw new ApiError('浏览器存储不可用或已满', { status: 0, code: 'STORAGE_ERROR' })
    }
  }

  function findIndex(posts, id) {
    const index = posts.findIndex((post) => post.id === id)
    if (index < 0) {
      throw new ApiError('未找到对应的记录', { status: 404, code: 'NOT_FOUND' })
    }
    return index
  }

  return {
    async list() {
      return read().map((post) => ({ ...post }))
    },

    async create(content) {
      const text = String(content ?? '').trim()

      if (!text) {
        throw new ApiError('内容不能为空', { status: 422, code: 'EMPTY_CONTENT' })
      }
      if (text.length > MAX_LENGTH) {
        throw new ApiError(`内容长度不能超过 ${MAX_LENGTH} 个字符`, {
          status: 422,
          code: 'CONTENT_TOO_LONG'
        })
      }

      const post = {
        id: generateId(),
        content: text,
        author: AUTHOR,
        createdAt: now(),
        liked: false,
        likeCount: 0,
        favorited: false
      }

      write([post, ...read()])
      return { ...post }
    },

    async update(id, patch) {
      const normalized = normalizePatch(patch)
      const posts = read()
      const index = findIndex(posts, id)
      const current = posts[index]
      const next = { ...current }

      if (typeof normalized.liked === 'boolean' && normalized.liked !== current.liked) {
        next.liked = normalized.liked
        next.likeCount = Math.max(0, (current.likeCount || 0) + (normalized.liked ? 1 : -1))
      }
      if (typeof normalized.favorited === 'boolean') {
        next.favorited = normalized.favorited
      }

      posts[index] = next
      write(posts)
      return { ...next }
    },

    async remove(id) {
      const posts = read()
      const index = findIndex(posts, id)
      posts.splice(index, 1)
      write(posts)
      return null
    }
  }
}
