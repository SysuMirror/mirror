import { apiRequest } from './client'

// 上传走同一个请求出口（超时、鉴权、错误文案一致），只是 body 改成 FormData
function upload(path, file) {
  const form = new FormData()
  form.append('file', file)
  return apiRequest(path, { method: 'POST', body: form, form: true, raw: true })
}

export async function uploadAvatar(file) {
  const data = await upload('/auth/uploadAvatar', file)
  return data?.data?.avatar_url || data?.avatar_url
}

export async function uploadQuestImage(file) {
  const data = await upload('/auth/uploadPhotos', file)
  return data?.fileURL || data?.data?.fileURL
}
