/**
 * 生成唯一 ID：优先 crypto.randomUUID，旧环境回退到时间戳 + 随机串。
 */
export function createId(cryptoObject) {
  const source = cryptoObject === undefined ? globalThis.crypto : cryptoObject

  if (source && typeof source.randomUUID === 'function') {
    return source.randomUUID()
  }

  return `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}
