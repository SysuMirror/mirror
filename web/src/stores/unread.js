import { ref } from 'vue'
import { markChatRead } from '../api/chat'
import { fetchChatPeers } from '../api/quest'
import { getToken } from '../api/client'

/**
 * 全站共用一份未读数：手机底部导航和桌面顶部导航都读 unreadTotal，不会各算各的。
 * 主数据是会话列表每条的 unread，后端在点开会话时落盘清零。
 * 真后端若没有 readChat 接口，用本地「已读基线」兜底：只扣掉点开时看过的部分，
 * 新消息到来时红点依然能重新亮起（不会永久屏蔽）。
 */
export const unreadTotal = ref(0)

const STORAGE_KEY = 'mirror_read_baseline'
const POLL_MS = 30000

let peersCache = []
let timer = null
let pollRefs = 0
let inflight = null
let scope = 'anon'
let baseline = {}

function storage() {
  try {
    return window.localStorage
  }
  catch {
    return null
  }
}

function loadBaseline() {
  try {
    const raw = JSON.parse(storage()?.getItem(STORAGE_KEY) || '{}')
    if (!raw || typeof raw !== 'object' || Array.isArray(raw))
      return {}
    const own = raw[scope]
    return own && typeof own === 'object' && !Array.isArray(own) ? own : {}
  }
  catch {
    return {}
  }
}

function saveBaseline() {
  try {
    const store = storage()
    if (!store)
      return
    let all = {}
    try {
      const parsed = JSON.parse(store.getItem(STORAGE_KEY) || '{}')
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed))
        all = parsed
    }
    catch { /* 存坏了就覆盖重建 */ }
    all[scope] = baseline
    store.setItem(STORAGE_KEY, JSON.stringify(all))
  }
  catch { /* 隐私模式下写不进去也不影响本次会话 */ }
}

// 切换账号时调用：不同账号的已读基线互不串扰
export function setUnreadScope(userID) {
  const next = String(userID || 'anon')
  if (next === scope)
    return
  scope = next
  baseline = loadBaseline()
}

function safeCount(v) {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
}

/** 一条会话实际该显示的未读数：后端总数减去这次会话已经看过的部分。 */
export function unreadOf(peer) {
  if (!peer)
    return 0
  const seen = safeCount(baseline[String(peer.userID)])
  return Math.max(0, safeCount(peer.unread) - seen)
}

function recompute(peers) {
  unreadTotal.value = (peers || []).reduce((sum, p) => sum + unreadOf(p), 0)
}

/** 防重入的刷新：多个组件同时触发也只发一个请求；失败保留上一次结果，红点不闪烁。 */
export function refreshUnread() {
  if (inflight)
    return inflight
  if (!getToken()) {
    peersCache = []
    unreadTotal.value = 0
    return Promise.resolve(0)
  }
  inflight = fetchChatPeers()
    .then((peers) => {
      peersCache = Array.isArray(peers) ? peers : []
      recompute(peersCache)
    })
    .catch(() => { /* 保留上一次结果 */ })
    .finally(() => { inflight = null })
    .then(() => unreadTotal.value)
  return inflight
}

function onVisibility() {
  if (document.hidden)
    return
  refreshUnread()
}

export function startUnreadPolling() {
  pollRefs += 1
  if (timer)
    return
  baseline = loadBaseline()
  refreshUnread()
  timer = setInterval(refreshUnread, POLL_MS)
  document.addEventListener('visibilitychange', onVisibility)
}

export function stopUnreadPolling() {
  pollRefs = Math.max(0, pollRefs - 1)
  if (pollRefs > 0)
    return
  clearInterval(timer)
  timer = null
  document.removeEventListener('visibilitychange', onVisibility)
}

/** 点开会话：先本地乐观清零，再让后端落盘，最后刷新全站红点。 */
export async function markPeerRead(targetUserID) {
  const key = String(targetUserID)
  const hit = peersCache.find(p => String(p.userID) === key)
  baseline[key] = safeCount(hit?.unread)
  saveBaseline()
  if (hit)
    hit.unread = 0
  recompute(peersCache)
  try {
    await markChatRead(targetUserID)
    // 后端已落盘清零，撤掉基线，此后完全信任后端数据（新消息能正常亮红点）
    delete baseline[key]
    saveBaseline()
  }
  catch { /* 真后端没有 readChat：保留基线作为兜底 */ }
  return refreshUnread()
}
