import { apiRequest } from './client'

// 所有请求统一走 apiRequest（超时、鉴权、HTTP/业务码、错误文案只在一处维护）。
// raw:true 用于少数仍需要完整响应体的旧接口。

export async function fetchQuestList(params = {}) {
  const data = await apiRequest('/auth/quest/list', { method: 'POST', body: params })
  return { items: data?.items || [], total: data?.total ?? 0 }
}

export async function fetchQuestDetail(postID) {
  const data = await apiRequest('/auth/quest/detail', { method: 'POST', body: { postID } })
  return data?.post
}

export async function createQuestPost(payload) {
  const data = await apiRequest('/auth/quest/create', { method: 'POST', body: payload })
  return data?.post
}

export async function updateQuestStatus(postID, status) {
  await apiRequest('/auth/quest/updateStatus', { method: 'POST', body: { postID, status } })
}

export async function deleteQuestPost(postID) {
  return apiRequest('/auth/deletePost', { method: 'POST', body: { postID }, raw: true })
}

export async function fetchChatPeers() {
  const data = await apiRequest('/auth/quest/chatPeers')
  return data?.peers || []
}

export async function toggleSave(postID, userTelephone) {
  return apiRequest('/auth/updateSave', {
    method: 'POST', body: { postID, userTelephone }, raw: true,
  })
}

export async function submitReport(postID, reason, userTelephone) {
  return apiRequest('/auth/submitReport', {
    method: 'POST',
    body: { targetID: postID, targettype: 'post', reason, userTelephone },
    raw: true,
  })
}

export async function fetchUserInfo(phone, userID) {
  // 取 data 而不是整个响应体：真后端只返回 { code, data }，
  // 之前靠 dev mock 把字段额外摊平到顶层才能用，生产上会拿不到名字。
  return apiRequest('/auth/getInfo', { method: 'POST', body: { phone, userID } })
}

export async function updateUserProfile({ userID, name, avatarURL }) {
  return apiRequest('/auth/updateUserInfo', {
    method: 'POST',
    body: { userID, name, avatarURL, intro: '', hideProfilePosts: false },
    raw: true,
  })
}

export async function acceptQuestOrder(postID) {
  const data = await apiRequest('/auth/quest/order/accept', { method: 'POST', body: { postID } })
  return data?.order
}

export async function submitQuestComplete(postID, submitNote = '') {
  await apiRequest('/auth/quest/order/submitComplete', {
    method: 'POST', body: { postID, submitNote },
  })
}

export async function confirmQuestComplete(postID) {
  await apiRequest('/auth/quest/order/confirmComplete', { method: 'POST', body: { postID } })
}
