import { API_BASE, getToken } from './client'

export function chatWsUrl() {
  const base = API_BASE.replace(/\/api$/, '')
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
  const res = await fetch(`${API_BASE}/auth/getChatHistory?${q}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  })
  const data = await res.json()
  if (data.code !== 200)
    throw new Error(data.msg || '加载聊天记录失败')
  return data.data?.chatHistoryList || []
}

export async function getNoticeUnread() {
  const res = await fetch(`${API_BASE}/auth/getNoticeNum`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  })
  const data = await res.json()
  return data.unreadTotalNum ?? 0
}

export async function getChatNotice(userID) {
  const q = new URLSearchParams({ userID: String(userID) })
  const res = await fetch(`${API_BASE}/auth/getChatNotice?${q}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  })
  const data = await res.json()
  return data.data?.noticeNum ?? 0
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
