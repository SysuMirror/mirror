import { API_BASE, apiRequest, getToken } from './client'

export function chatWsUrl() {
  // API_BASE 是绝对地址时沿用它的 host；dev 用同源相对路径 /api，
  // 此时 new URL(path, '/api') 会抛 Invalid URL，必须回落到当前站点。
  const base = /^https?:\/\//.test(API_BASE)
    ? API_BASE.replace(/\/api\/?$/, '')
    : window.location.origin
  const url = new URL('/websocket/auth/chat', base)
  url.searchParams.set('token', getToken())
  url.protocol = url.protocol.replace('http', 'ws')
  return url.toString()
}

export async function getChatHistory(senderUserID, targetUserID) {
  const q = new URLSearchParams({
    senderUserID: String(senderUserID),
    targetUserID: String(targetUserID),
    threadAnonymous: 'false',
  })
  const data = await apiRequest(`/auth/getChatHistory?${q}`)
  if (Array.isArray(data))
    return data
  return data?.chatHistoryList || data?.list || []
}

// 点开某个会话后告诉后端「这条已读」。全站未读数统一由 stores/unread.js
// 从会话列表汇总；真后端没有这个接口时由本地「已读基线」兜底，允许失败。
export async function markChatRead(targetUserID) {
  return apiRequest('/auth/quest/readChat', {
    method: 'POST',
    body: { targetUserID },
  })
}

export function sendChatMessage(ws, { senderUserID, targetUserID, content }) {
  ws.send(JSON.stringify({
    chatMsgID: 0,
    senderUserID,
    targetUserID,
    content,
    isAnonymous: false,
    threadAnonymous: false,
  }))
}
