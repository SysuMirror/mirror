import { apiRequest } from './client'

/**
 * 发布者补充说明走镜像站同源 /mirror-api：
 * - 生产：server.py 用会话鉴权并核实主站帖子归属后写入 SQLite；
 * - dev / 本地试玩：同一路径由各自服务用演示账号应答，实现共用 contracts/notes.py。
 * 前端不需要知道当前跑在哪一套服务上，也不需要传用户 ID（身份由服务端决定）。
 */
const NOTES_BASE = (import.meta.env.VITE_NOTES_API_BASE || '/mirror-api').replace(/\/$/, '')

export async function fetchNotes(postID) {
  const data = await apiRequest(`/notes/list?postID=${encodeURIComponent(postID)}`, {
    base: NOTES_BASE,
  })
  return {
    notes: Array.isArray(data?.notes) ? data.notes : [],
    total: Number(data?.total) || 0,
    maxPerPost: Number(data?.maxPerPost) || 0,
  }
}

export async function addNote(postID, content) {
  const data = await apiRequest('/notes/add', {
    method: 'POST',
    body: { postID, content },
    base: NOTES_BASE,
  })
  return data?.note || null
}
