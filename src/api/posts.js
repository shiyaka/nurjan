const BASE_PATH = '/api/posts'
const JSON_HEADERS = {
  'Content-Type': 'application/json',
  Accept: 'application/json'
}

export class ApiError extends Error {
  constructor(message, { status = 0, code = 'UNKNOWN' } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

async function request(path, options = {}) {
  let response

  try {
    response = await fetch(path, {
      ...options,
      headers: { ...JSON_HEADERS, ...(options.headers || {}) }
    })
  } catch {
    throw new ApiError('网络连接失败', { status: 0, code: 'NETWORK_ERROR' })
  }

  if (response.status === 204) {
    return null
  }

  let payload = null
  try {
    payload = await response.json()
  } catch {
    throw new ApiError(
      response.ok ? '响应格式不正确' : `请求失败（${response.status}）`,
      { status: response.status, code: 'INVALID_RESPONSE' }
    )
  }

  if (!response.ok) {
    const detail = (payload && payload.error) || {}
    throw new ApiError(detail.message || `请求失败（${response.status}）`, {
      status: response.status,
      code: detail.code || 'HTTP_ERROR'
    })
  }

  return payload
}

export const postsApi = {
  async list() {
    const payload = await request(BASE_PATH)
    return Array.isArray(payload?.data) ? payload.data : []
  },

  async create(content) {
    const payload = await request(BASE_PATH, {
      method: 'POST',
      body: JSON.stringify({ content })
    })

    const post = payload?.data
    if (!post || typeof post !== 'object') {
      throw new ApiError('响应格式不正确', { status: 201, code: 'INVALID_RESPONSE' })
    }

    return post
  },

  async remove(id) {
    await request(`${BASE_PATH}/${encodeURIComponent(id)}`, { method: 'DELETE' })
    return null
  }
}
