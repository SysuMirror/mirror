import { apiRequest } from './client'

/**
 * 帖子浏览数 / 沟通数走镜像站同源 /mirror-api，实现与生产后端共用
 * contracts/post_stats.py。计数只在服务端按会话身份累加并持久去重：
 * 前端不传「加了多少」，也不传用户 ID。
 */
const STATS_BASE = (import.meta.env.VITE_NOTES_API_BASE || '/mirror-api').replace(/\/$/, '')

/** 进入别人的需求详情时调用；作者自浏览与重复浏览由服务端去重。 */
export function recordPostView(postID) {
  return apiRequest('/stats/view', {
    method: 'POST', body: { postID }, base: STATS_BASE,
  })
}

/** 从某条需求发起私聊时调用；同一帖同一对话只计一次。 */
export function recordPostChat(postID, peerID) {
  return apiRequest('/stats/chat', {
    method: 'POST', body: { postID, peerID }, base: STATS_BASE,
  })
}
