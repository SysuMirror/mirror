import { apiRequest, getToken } from './client'

export async function fetchQuestList(params = {}) {
  const data = await apiRequest('/auth/quest/list', {
    method: 'POST',
    body: params,
  })
  return { items: data.items || [], total: data.total ?? 0 }
}

export async function fetchQuestDetail(postID) {
  const data = await apiRequest('/auth/quest/detail', {
    method: 'POST',
    body: { postID },
  })
  return data.post
}

export async function createQuestPost(payload) {
  const data = await apiRequest('/auth/quest/create', {
    method: 'POST',
    body: payload,
  })
  return data.post
}

export async function updateQuestStatus(postID, status) {
  await apiRequest('/auth/quest/updateStatus', {
    method: 'POST',
    body: { postID, status },
  })
}

export async function deleteQuestPost(postID) {
  const res = await fetch(`${(import.meta.env.VITE_API_BASE || 'https://ssemarket.cn/api').replace(/\/$/, '')}/auth/deletePost`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify({ postID }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok)
    throw new Error(data.msg || data.message || '删除失败')
  return data
}

export async function fetchChatPeers() {
  const data = await apiRequest('/auth/quest/chatPeers')
  return data.peers || []
}

export async function fetchComments(postID, userTelephone) {
  const base = (import.meta.env.VITE_API_BASE || 'https://ssemarket.cn/api').replace(/\/$/, '')
  const res = await fetch(`${base}/auth/showPcomments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify({ postID, postType: 'post', userTelephone }),
  })
  if (!res.ok) throw new Error('加载评论失败')
  return res.json()
}

export async function postComment(postID, content, userTelephone) {
  const base = (import.meta.env.VITE_API_BASE || 'https://ssemarket.cn/api').replace(/\/$/, '')
  const res = await fetch(`${base}/auth/postPcomment`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify({ postID, content, userTelephone }),
  })
  const data = await res.json()
  if (data.code !== 200) throw new Error(data.msg || '评论失败')
  return data
}

export async function toggleSave(postID, userTelephone) {
  const base = (import.meta.env.VITE_API_BASE || 'https://ssemarket.cn/api').replace(/\/$/, '')
  const res = await fetch(`${base}/auth/updateSave`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify({ postID, userTelephone }),
  })
  const data = await res.json()
  if (data.code !== 200) throw new Error(data.msg || '操作失败')
  return data
}

export async function submitReport(postID, reason, userTelephone) {
  const base = (import.meta.env.VITE_API_BASE || 'https://ssemarket.cn/api').replace(/\/$/, '')
  const res = await fetch(`${base}/auth/submitReport`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify({
      targetID: postID,
      targettype: 'post',
      reason,
      userTelephone,
    }),
  })
  const data = await res.json()
  if (data.code !== 200) throw new Error(data.msg || '举报失败')
  return data
}

export async function fetchUserInfo(phone, userID) {
  const base = (import.meta.env.VITE_API_BASE || 'https://ssemarket.cn/api').replace(/\/$/, '')
  const res = await fetch(`${base}/auth/getInfo`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${localStorage.getItem('quest_token')}`,
    },
    body: JSON.stringify({ phone, userID }),
  })
  if (!res.ok) throw new Error('获取用户信息失败')
  return res.json()
}

export async function updateUserProfile({ userID, name, avatarURL, phone }) {
  const base = (import.meta.env.VITE_API_BASE || 'https://ssemarket.cn/api').replace(/\/$/, '')
  const res = await fetch(`${base}/auth/updateUserInfo`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${localStorage.getItem('quest_token')}`,
    },
    body: JSON.stringify({ userID, name, avatarURL, intro: '', hideProfilePosts: false }),
  })
  const data = await res.json()
  if (data.code !== 200) throw new Error(data.msg || '更新失败')
  return data
}

export async function fetchLevelRules() {
  const data = await apiRequest('/auth/quest/levelRules')
  return data.level
}

export async function acceptQuestOrder(postID) {
  const data = await apiRequest('/auth/quest/order/accept', {
    method: 'POST',
    body: { postID },
  })
  return data.order
}

export async function submitQuestComplete(postID, submitNote = '') {
  await apiRequest('/auth/quest/order/submitComplete', {
    method: 'POST',
    body: { postID, submitNote },
  })
}

export async function confirmQuestComplete(postID) {
  await apiRequest('/auth/quest/order/confirmComplete', {
    method: 'POST',
    body: { postID },
  })
}
