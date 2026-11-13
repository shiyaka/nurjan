import { DEFAULT_AUTHOR, MAX_LENGTH } from '@/constants'
import { createId } from '@/utils/id'

function isQuotaError(error) {
  if (!error) return false
  return (
    error.name === 'QuotaExceededError' ||
    error.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    error.code === 22 ||
    error.code === 1014
  )
}

function resolveStorage(explicit) {
  if (explicit) return explicit
  try {
    return globalThis.localStorage
  } catch {
    return null
  }
}

function normalizePost(item) {
  if (!item || typeof item !== 'object') return null
  if (typeof item.content !== 'string') return null

  const content = item.content.slice(0, MAX_LENGTH)
  if (!content.trim()) return null

  const createdAt = Number(item.createdAt)

  return {
    id: typeof item.id === 'string' && item.id ? item.id : createId(),
    content,
    author: typeof item.author === 'string' && item.author ? item.author : DEFAULT_AUTHOR,
    createdAt: Number.isFinite(createdAt) && createdAt > 0 ? createdAt : Date.now()
  }
}

/**
 * localStorage 适配器：所有异常都归一化为返回值，绝不向 UI 抛错。
 */
export function createPostStorage(storage, key) {
  function load() {
    const target = resolveStorage(storage)
    if (!target) return []

    let raw
    try {
      raw = target.getItem(key)
    } catch {
      return []
    }

    if (!raw) return []

    let parsed
    try {
      parsed = JSON.parse(raw)
    } catch {
      return []
    }

    if (!Array.isArray(parsed)) return []

    return parsed
      .map(normalizePost)
      .filter(Boolean)
      .sort((a, b) => b.createdAt - a.createdAt)
  }

  function save(posts) {
    const target = resolveStorage(storage)
    if (!target) return { ok: false, reason: 'unavailable' }

    try {
      target.setItem(key, JSON.stringify(posts))
      return { ok: true }
    } catch (error) {
      return { ok: false, reason: isQuotaError(error) ? 'quota' : 'unavailable' }
    }
  }

  return { load, save }
}
