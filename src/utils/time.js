const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE

function pad(value) {
  return value < 10 ? `0${value}` : String(value)
}

function isSameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

/**
 * 相对时间：刚刚 / n 分钟前 / n 小时前 / 昨天 HH:mm / M月D日（跨年补年份）
 * 时间只与渲染时刻有关，无需定时器刷新。
 */
export function formatRelativeTime(timestamp, now = Date.now()) {
  const date = new Date(timestamp)
  const current = new Date(now)
  const diff = Math.max(0, now - timestamp)

  if (diff < MINUTE) return '刚刚'
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)} 分钟前`

  if (isSameDay(date, current)) {
    return `${Math.floor(diff / HOUR)} 小时前`
  }

  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  if (isSameDay(date, yesterday)) {
    return `昨天 ${pad(date.getHours())}:${pad(date.getMinutes())}`
  }

  const monthDay = `${date.getMonth() + 1}月${date.getDate()}日`
  return date.getFullYear() === current.getFullYear()
    ? monthDay
    : `${date.getFullYear()}年${monthDay}`
}
