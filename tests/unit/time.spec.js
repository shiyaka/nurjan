import { describe, expect, it } from 'vitest'
import { formatRelativeTime } from '@/utils/time'

const NOW = new Date(2026, 10, 13, 12, 0, 0).getTime() // 2026-11-13 12:00 本地时间

describe('formatRelativeTime', () => {
  it('一分钟以内显示「刚刚」', () => {
    expect(formatRelativeTime(NOW - 59_000, NOW)).toBe('刚刚')
    expect(formatRelativeTime(NOW, NOW)).toBe('刚刚')
  })

  it('未来时间也按「刚刚」处理，不出现负数', () => {
    expect(formatRelativeTime(NOW + 30_000, NOW)).toBe('刚刚')
  })

  it('一小时以内按分钟显示', () => {
    expect(formatRelativeTime(NOW - 5 * 60_000, NOW)).toBe('5 分钟前')
    expect(formatRelativeTime(NOW - 59 * 60_000, NOW)).toBe('59 分钟前')
  })

  it('同一天内按小时显示', () => {
    expect(formatRelativeTime(NOW - 3 * 3_600_000, NOW)).toBe('3 小时前')
  })

  it('昨天显示「昨天 HH:mm」', () => {
    const yesterday = new Date(2026, 10, 12, 9, 30).getTime()
    expect(formatRelativeTime(yesterday, NOW)).toBe('昨天 09:30')
  })

  it('今年更早的日期显示「M月D日」', () => {
    const earlier = new Date(2026, 2, 5, 10, 0).getTime()
    expect(formatRelativeTime(earlier, NOW)).toBe('3月5日')
  })

  it('跨年日期补全年份', () => {
    const lastYear = new Date(2024, 11, 31, 10, 0).getTime()
    expect(formatRelativeTime(lastYear, NOW)).toBe('2024年12月31日')
  })
})
