const API_BASE = (import.meta.env.VITE_API_BASE || 'https://ssemarket.cn/api').replace(/\/$/, '')

export function getToken() {
  return localStorage.getItem('quest_token') || ''
}

export function setToken(token) {
  if (token)
    localStorage.setItem('quest_token', token)
  else
    localStorage.removeItem('quest_token')
}

export async function apiRequest(path, { method = 'GET', body, auth = true } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (auth) {
    const token = getToken()
    if (token)
      headers.Authorization = `Bearer ${token}`
  }
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok)
    throw new Error(data.msg || `HTTP ${res.status}`)
  if (data.code !== undefined && data.code !== 200)
    throw new Error(data.msg || '请求失败')
  return data.data ?? data
}

export { API_BASE }
