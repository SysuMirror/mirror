// 唯一网络出口：同源 /api/*，统一超时与错误文案。身份由 Cookie 携带，前端不传用户 ID。
const TIMEOUT = 15000

export async function api(path, { method = 'GET', body } = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT)
  let res
  try {
    res = await fetch('/api' + path, {
      method,
      credentials: 'same-origin',
      headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    })
  } catch (err) {
    if (err?.name === 'AbortError') throw new Error('请求超时，请检查网络后重试')
    throw new Error('网络连接失败，请稍后重试')
  } finally {
    clearTimeout(timer)
  }
  const text = await res.text()
  let data = {}
  try { data = text ? JSON.parse(text) : {} } catch { data = {} }
  if (!res.ok) {
    const error = new Error(data.error || 'HTTP ' + res.status)
    error.status = res.status
    throw error
  }
  return data
}