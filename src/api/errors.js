export class ApiError extends Error {
  constructor(message, { status = 0, code = 'UNKNOWN' } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}
