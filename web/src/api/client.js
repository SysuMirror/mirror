const API_BASE = (import.meta.env.VITE_API_BASE || 'https://ssemarket.cn/api').replace(/\/$/, '')
export const REQUEST_TIMEOUT_MS = 15000

/** 统一的接口错误类型：UI 只需要读 message，排查时可以读 status / code。 */
export class ApiError extends Error {
  constructor(message, { status = 0, code } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

function storage() {
  try {
    return window.localStorage
  }
  catch {
    // 隐私模式 / 禁用存储时降级为「本次会话内无 token」，不要整页崩掉
    return null
  }
}

export function getToken() {
  return storage()?.getItem('quest_token') || ''
}

export function setToken(token) {
  const store = storage()
  if (!store)
    return
  if (token)
    store.setItem('quest_token', token)
  else
    store.removeItem('quest_token')
}

/**
 * 所有 /api 请求的唯一出口。
 * - 统一超时与网络错误，避免请求挂起时页面永远转圈
 * - 统一 HTTP 状态与业务 code 判定（后端返回字符串 "200" 也能正确识别）
 * - raw=true 时返回完整响应体，用于少数需要 code/msg 的旧接口
 */
export async function apiRequest(path, {
  method = 'GET',
  body,
  auth = true,
  raw = false,
  timeout = REQUEST_TIMEOUT_MS,
  base = API_BASE,
  form = false,
} = {}) {
  // form=true 时不能设 Content-Type，浏览器要自己生成 multipart boundary
  const headers = form ? {} : { 'Content-Type': 'application/json' }
  if (auth) {
    const token = getToken()
    if (token)
      headers.Authorization = `Bearer ${token}`
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)
  let res
  try {
    res = await fetch(`${base}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : (form ? body : JSON.stringify(body)),
      signal: controller.signal,
    })
  }
  catch (err) {
    if (err?.name === 'AbortError')
      throw new ApiError('请求超时，请检查网络后重试', { status: 408 })
    throw new ApiError('网络连接失败，请稍后重试')
  }
  finally {
    clearTimeout(timer)
  }

  const data = await res.json().catch(() => ({}))
  const code = data?.code == null ? undefined : Number(data.code)
  if (!res.ok || (code !== undefined && code !== 200)) {
    // 主站用 msg，镜像站 /mirror-api 用 error，两者都要能显示给用户
    const reason = [data?.msg, data?.message, data?.error]
      .find(v => typeof v === 'string' && v) || `HTTP ${res.status}`
    throw new ApiError(reason, { status: res.status, code })
  }
  return raw ? data : (data?.data ?? data)
}

export { API_BASE }
