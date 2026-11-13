import { describe, expect, it, vi } from 'vitest'
import { createId } from '@/utils/id'

describe('createId', () => {
  it('优先使用 crypto.randomUUID', () => {
    const randomUUID = vi.fn(() => 'uuid-from-crypto')
    expect(createId({ randomUUID })).toBe('uuid-from-crypto')
    expect(randomUUID).toHaveBeenCalledTimes(1)
  })

  it('没有 randomUUID 时回退到时间戳 + 随机串', () => {
    const id = createId({})
    expect(id).toMatch(/^p-[a-z0-9]+-[a-z0-9]+$/)
  })

  it('回退实现生成的 ID 不重复', () => {
    const ids = new Set()
    for (let i = 0; i < 500; i += 1) {
      ids.add(createId(undefined))
    }
    expect(ids.size).toBe(500)
  })
})
