import { api } from './api.js'
import { app, ALLOWED, isGuest, peerById, postById } from './state.svelte.js'

let toastTimer = 0
export function toast(msg) {
  app.toast = msg
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { app.toast = '' }, 2400)
}

export function applyBoot(data) {
  app.posts = Array.isArray(data.posts) ? data.posts : []
  app.peers = Array.isArray(data.peers) ? data.peers : []
  app.me = data.me || null
  app.applied = Array.isArray(data.applied) ? data.applied : []
  app.favorites = Array.isArray(data.favorites) ? data.favorites : []
}

export async function refresh() {
  applyBoot(await api('/bootstrap'))
}

export function scrollTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

export function goTab(tab) {
  if (isGuest()) {
    if (tab !== 'hall') { requireLogin({ type: 'tab', tab }); return }
    app.tab = 'hall'; app.stack = [{ name: 'list' }]; scrollTop(); return
  }
  if (!ALLOWED.includes(tab)) tab = 'hall'
  app.tab = tab; app.stack = [{ name: 'list' }]; app.userMenuOpen = false; scrollTop()
}

export function back() {
  if (app.stack.length > 1) { app.stack = app.stack.slice(0, -1); scrollTop(); return }
  app.tab = 'hall'; app.stack = [{ name: 'list' }]; scrollTop()
}

export function openPost(id) {
  app.stack = [...app.stack, { name: 'post', id: Number(id) }]
  scrollTop()
  if (!isGuest() && !app.viewed[id]) {
    app.viewed = { ...app.viewed, [id]: 1 }
    api(`/posts/${id}/view`, { method: 'POST', body: {} })
      .then((r) => { const p = postById(id); if (p && r.views != null) p.views = r.views })
      .catch(() => {})
  }
}

export function openThread(id) {
  app.peer = Number(id)
  markRead(id)
  app.stack = [...app.stack, { name: 'thread', id: Number(id) }]
  scrollTop()
}

export function openPublish() {
  if (isGuest()) { requireLogin({ type: 'publish' }); return }
  goTab('publish')
}

export async function chatWith(whoId) {
  if (isGuest()) { requireLogin({ type: 'chatwith', id: whoId }); return }
  try {
    await api('/threads/open', { method: 'POST', body: { peerId: whoId } })
    await refresh()
    if (!peerById(whoId)) { toast('会话创建失败，请刷新后重试'); return }
    app.tab = 'chat'; app.stack = [{ name: 'list' }]
    openThread(whoId)
  } catch (e) { toast(e.message || '无法发起会话') }
}

export function markRead(id) {
  const p = peerById(id); if (p) p.unread = 0
  if (!isGuest()) api(`/threads/${id}/read`, { method: 'POST', body: {} }).catch(() => {})
}
export function markAllRead() {
  app.peers.forEach((p) => { p.unread = 0 })
  if (!isGuest()) api('/threads/read-all', { method: 'POST', body: {} }).catch(() => {})
  toast('已全部标为已读')
}

export async function applyPost(id) {
  if (isGuest()) { requireLogin({ type: 'apply', id }); return }
  if (app.applied.includes(id)) { toast('你已经报名过这条需求'); return }
  try {
    await api(`/posts/${id}/apply`, { method: 'POST', body: {} })
    app.applied = [...app.applied, id]
    toast('报名成功，去私信确认细节')
    await refresh()
  } catch (e) { toast(e.message || '报名失败') }
}

export async function toggleFav(id) {
  if (isGuest()) { requireLogin({ type: 'fav', id }); return }
  try {
    const r = await api(`/posts/${id}/favorite`, { method: 'POST', body: {} })
    toast(r.favorite ? '已收藏' : '已取消收藏')
    await refresh()
  } catch (e) { toast(e.message || '操作失败') }
}

export async function sendMessage() {
  const text = (app.draftMsg || '').trim()
  if (!text) { toast('先写点内容吧'); return }
  if (isGuest()) { requireLogin(null); return }
  const peerId = app.peer
  app.draftMsg = ''
  try {
    await api(`/threads/${peerId}/messages`, { method: 'POST', body: { text } })
    await refresh()
  } catch (e) {
    app.draftMsg = text
    toast(e.message || '发送失败')
  }
}

export async function submitPost() {
  const d = app.draft
  const title = (d.title || '').trim()
  if (!title) { toast('请填写需求标题'); return }
  let priceType = 'fixed', price = null
  if (d.negotiable) priceType = 'negotiable'
  else {
    price = Math.round(Number(d.price) * 100) / 100
    if (!(price >= 1 && price <= 1000) || Math.round(price * 100) !== price * 100) {
      toast('金额需为 1–1000，最多两位小数，或选面议/互助'); return
    }
  }
  try {
    const r = await api('/posts', {
      method: 'POST',
      body: {
        title, desc: (d.desc || '').trim(), cat: d.cat,
        skills: [...app.draftSkills], price, priceType, deadline: d.deadline || '',
      },
    })
    app.draft = { title: '', price: '', negotiable: false, cat: '前端', deadline: '', desc: '' }
    app.draftSkills = []
    app.tab = 'manage'; app.stack = [{ name: 'list' }]
    await refresh()
    openPost(r.post.id)
    toast('发布成功')
  } catch (e) { toast(e.message || '发布失败') }
}

/* ---------------- 登录 ---------------- */
export function requireLogin(action) {
  app.pending = action || null
  let title = '登录进入社区', sub = '使用统一身份认证账号登录后即可发布需求、报名与私聊。'
  if (action) {
    if (action.type === 'publish') { title = '登录后发布需求'; sub = '发布需求需要先登录。' }
    else if (['apply', 'chatwith', 'fav'].includes(action.type)) { title = '登录后继续'; sub = '报名、私聊、收藏需要先登录。' }
    else if (action.type === 'tab') { title = '登录后继续'; sub = '该页面需要登录后使用。' }
  }
  app.authTitle = title; app.authSub = sub; app.authOpen = true
}
export function closeAuth() { app.authOpen = false; app.pending = null }

async function onLoggedIn(action) {
  app.tab = 'hall'; app.stack = [{ name: 'list' }]
  if (action?.type === 'chatwith') {
    app.tab = 'chat'
    try {
      await api('/threads/open', { method: 'POST', body: { peerId: action.id } })
      await refresh()
      if (peerById(action.id)) openThread(action.id)
      toast('登录成功')
    } catch (e) { toast(e.message || '会话创建失败') }
    return
  }
  if (action?.type === 'publish') app.tab = 'publish'
  else if (action?.type === 'tab' && ALLOWED.includes(action.tab)) app.tab = action.tab
  else if (action && ['apply', 'fav'].includes(action.type))
    app.stack = [...app.stack, { name: 'post', id: action.id || app.posts[0]?.id }]
  scrollTop(); toast('登录成功')
  if (action && ['apply', 'fav'].includes(action.type)) toast('已登录，点「立即报名」即可报名这单')
}

export async function submitAuth(email, password, agree) {
  if (!agree) { toast('请先同意用户协议与隐私政策'); return }
  if (!email || !password) { toast('请输入统一认证邮箱和密码'); return }
  if (app.authBusy) return
  app.authBusy = true
  const action = app.pending
  try {
    await api('/auth/login', { method: 'POST', body: { email, password } })
    closeAuth()
    await refresh()
    await onLoggedIn(action)
  } catch (e) { toast(e.message || '登录失败') }
  finally { app.authBusy = false }
}

export async function logout() {
  try { await api('/auth/logout', { method: 'POST', body: {} }) } catch {}
  app.me = null; app.applied = []; app.favorites = []; app.peers = []; app.viewed = {}
  app.filterOpen = false; app.searchOpen = false; app.authOpen = false; app.userMenuOpen = false
  app.tab = 'hall'; app.stack = [{ name: 'list' }]
  await refresh().catch(() => {})
  scrollTop(); toast('已退出，回到游客浏览')
}

export function toggleSkill(s) {
  app.draftSkills = app.draftSkills.includes(s)
    ? app.draftSkills.filter((x) => x !== s)
    : [...app.draftSkills, s]
}
export function setCat(c) { app.cat = c; app.skill = '' }
export function toggleSkillFilter(s) { app.skill = app.skill === s ? '' : s }
export const filterCount = () => (app.cat !== '全部' ? 1 : 0) + (app.skill ? 1 : 0)