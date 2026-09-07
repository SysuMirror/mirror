import { API_BASE, getToken } from './client'

export async function uploadAvatar(file) {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch(`${API_BASE}/auth/uploadAvatar`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${getToken()}` },
    body: form,
  })
  const data = await res.json()
  if (data.code !== 200)
    throw new Error(data.msg || data.error || '头像上传失败')
  return data.data?.avatar_url || data.avatar_url
}

export async function uploadQuestImage(file) {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch(`${API_BASE}/auth/uploadPhotos`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${getToken()}` },
    body: form,
  })
  const data = await res.json()
  if (!res.ok)
    throw new Error(data.error || data.msg || '图片上传失败')
  return data.fileURL
}
