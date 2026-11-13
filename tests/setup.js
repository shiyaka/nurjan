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
  localStorage.clear()
  vi.useRealTimers()
  vi.restoreAllMocks()
})
