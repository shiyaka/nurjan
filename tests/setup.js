import { afterEach, vi } from 'vitest'

if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false
  })
}

afterEach(() => {
  // 服务端测试使用 node 环境，没有 localStorage
  if (typeof globalThis.localStorage !== 'undefined') {
    globalThis.localStorage.clear()
  }
  vi.useRealTimers()
  vi.restoreAllMocks()
})
