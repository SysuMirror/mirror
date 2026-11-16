<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { chatWsUrl, getChatHistory, sendChatMessage } from '../api/chat'
import { fetchChatPeers, fetchUserInfo } from '../api/quest'
import { recordPostChat } from '../api/stats'
import { useUserStore } from '../stores/user'
import { markPeerRead, unreadOf, unreadTotal } from '../stores/unread'
import { sameAccountId } from '../utils/author'
import { avatarInitial, avatarTone, chatTimeLabel } from '../utils/display'

const route = useRoute()
const router = useRouter()
const user = useUserStore()
const ws = ref(null)
const messages = ref([])
const draft = ref('')
const peer = ref(null)
const peers = ref([])
const error = ref('')
const loading = ref(true)
const wsHint = ref('')

const HEARTBEAT_MS = 30000
const MAX_RECONNECT = 3

// 所有异步资源都有显式生命周期：切会话 / 卸载时不会残留心跳、重连定时器或旧响应
let heartbeat = null
let reconnectTimer = null
let reconnectTries = 0
let wsGeneration = 0
let initSeq = 0
let localMsgSeq = 0

const peerID = computed(() => {
  const n = Number(route.query.user || 0)
  return Number.isFinite(n) && n > 0 ? n : 0
})
// 从需求详情点「私聊发布者」时带上帖子编号，服务端据此给该帖记一次沟通
const postID = computed(() => {
  const n = Number(route.query.post || 0)
  return Number.isFinite(n) && n > 0 ? n : 0
})
const myID = computed(() => user.me?.userID || 0)
const hasPeer = computed(() => peerID.value > 0)
const headNote = computed(() => postID.value
  ? `私信对话 · 来自需求 #${postID.value}`
  : '私信对话 · 一对一沟通')

async function loadPeers() {
  const list = await fetchChatPeers()
  // 后端没实现 readChat 时，用本地已读基线扣掉点开时看过的那部分；
  // 当前正打开的会话直接归零，保证顶栏总数与列表逐条红点一致。
  peers.value = (Array.isArray(list) ? list : []).map(p => ({
    ...p,
    unread: String(p.userID) === String(peerID.value) ? 0 : unreadOf(p),
  }))
}

async function loadPeer() {
  if (!peerID.value || !user.me?.phone)
    return
  try {
    peer.value = await fetchUserInfo(user.me.phone, peerID.value)
  }
  catch {
    // 资料接口挂了不该连聊天记录都看不到，退回会话列表里的名字
    peer.value = peers.value.find(p => Number(p.userID) === peerID.value) || null
  }
}

async function loadHistory() {
  if (!myID.value || !peerID.value)
    return
  messages.value = await getChatHistory(myID.value, peerID.value)
}

function clearHeartbeat() {
  if (heartbeat) {
    clearInterval(heartbeat)
    heartbeat = null
  }
}

function scheduleReconnect() {
  if (!user.token || !peerID.value || reconnectTries >= MAX_RECONNECT) {
    wsHint.value = '实时连接已断开，重新进入会话可恢复'
    return
  }
  reconnectTries += 1
  wsHint.value = `实时连接已断开，正在重连（${reconnectTries}/${MAX_RECONNECT}）…`
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null
    if (!ws.value)
      connectWs()
  }, 1000 * reconnectTries)
}

function connectWs() {
  if (!user.token || ws.value)
    return
  const gen = ++wsGeneration
  let socket
  try {
    socket = new WebSocket(chatWsUrl())
  }
  catch {
    wsHint.value = '实时连接建立失败，请稍后重试'
    return
  }
  ws.value = socket

  socket.addEventListener('message', (ev) => {
    if (gen !== wsGeneration)
      return
    try {
      const data = JSON.parse(ev.data)
      if (data.content) {
        messages.value.push({
          ...data,
          clientKey: `remote-${++localMsgSeq}`,
          createdAt: data.createdAt || new Date().toISOString(),
        })
      }
    }
    catch { /* 忽略非 JSON 的心跳包 */ }
  })

  socket.addEventListener('open', () => {
    if (gen !== wsGeneration)
      return
    wsHint.value = ''
    reconnectTries = 0
    heartbeat = setInterval(() => {
      if (socket.readyState === WebSocket.OPEN)
        socket.send(JSON.stringify({ userID: myID.value, beat: 1 }))
    }, HEARTBEAT_MS)
  })

  socket.addEventListener('close', () => {
    // 主动关闭 / 切换会话不重连，只有意外断线才重连
    if (gen !== wsGeneration)
      return
    clearHeartbeat()
    ws.value = null
    scheduleReconnect()
  })
}

function send() {
  const text = draft.value.trim()
  if (!text)
    return
  // 手机端常见：WS 还没连上就点了发送。给一句明确提示，不要静默吞掉
  if (!ws.value || ws.value.readyState !== WebSocket.OPEN) {
    wsHint.value = '实时连接未就绪，请稍后再发或重新进入会话'
    return
  }
  wsHint.value = ''
  sendChatMessage(ws.value, {
    senderUserID: myID.value,
    targetUserID: peerID.value,
    content: text,
  })
  messages.value.push({
    chatMsgID: 0,
    clientKey: `local-${++localMsgSeq}`,
    senderUserID: myID.value,
    targetUserID: peerID.value,
    content: text,
    createdAt: new Date().toISOString(),
    pending: true,
  })
  draft.value = ''
}

function openPeer(id) {
  const hit = peers.value.find(p => sameAccountId(p.userID, id))
  if (hit)
    hit.unread = 0
  router.push({ name: 'messages', query: { user: String(id) } })
  window.scrollTo(0, 0)
}

function backToList() {
  router.push({ name: 'messages' })
  window.scrollTo(0, 0)
}

function gotoPost() {
  if (postID.value)
    router.push({ name: 'detail', params: { id: String(postID.value) } })
}

// 头像挂了就退回稳定的首字母色块，不要留一个裂图或灰色占位小人
function onPeerAvatarError(p) {
  p.avatarURL = ''
}

function closeWs() {
  ++wsGeneration
  clearTimeout(reconnectTimer)
  reconnectTimer = null
  reconnectTries = 0
  clearHeartbeat()
  if (ws.value) {
    const socket = ws.value
    ws.value = null
    socket.close()
  }
}

async function init() {
  // 快速切换会话时，丢弃过期请求的响应，避免旧数据覆盖新会话
  const seq = ++initSeq
  loading.value = true
  error.value = ''
  messages.value = []
  peer.value = null
  closeWs()
  try {
    try {
      await user.refreshMe()
    }
    catch { /* 登录态异常时仍尽量把会话列表显示出来 */ }
    if (seq !== initSeq)
      return
    await loadPeers()
    if (seq !== initSeq)
      return
    if (peerID.value) {
      void markPeerRead(peerID.value)
      // 统计服务不可用不该影响聊天；同一帖同一对话由服务端去重
      if (postID.value)
        void recordPostChat(postID.value, peerID.value).catch(() => {})
    }
    if (!peerID.value)
      return
    await Promise.all([loadPeer(), loadHistory()])
    if (seq !== initSeq)
      return
    connectWs()
  }
  catch (e) {
    if (seq === initSeq)
      error.value = e?.message || '加载失败，请稍后重试'
  }
  finally {
    if (seq === initSeq)
      loading.value = false
  }
}

watch(() => route.query.user, init)
onMounted(init)
onUnmounted(closeWs)
</script>

<template>
  <div class="page">
    <header class="topbar" :class="{ 'topbar--chat': hasPeer }">
      <h1>私信</h1>
      <button v-if="hasPeer" class="btn ghost sm" @click="backToList">返回会话</button>
    </header>

    <p v-if="loading" class="status">加载中…</p>
    <div v-else-if="error" class="status">
      <p class="error">{{ error }}</p>
      <button type="button" class="btn ghost sm" @click="init">重新加载</button>
    </div>

    <div v-else class="messages-layout" :class="{ 'has-peer': hasPeer }">
      <div class="peer-panel panel">
        <div v-if="peers.length" class="peer-panel__head">
          <strong>全部会话 <span class="peer-panel__count">{{ peers.length }}</span></strong>
          <span v-if="unreadTotal > 0" class="peer-panel__badge">{{ unreadTotal }} 条未读</span>
        </div>
        <div v-if="!peers.length && !hasPeer" class="empty-state">
          <h3>还没有私信</h3>
          <p>去帖子里找人聊聊吧</p>
          <button class="btn primary" style="margin-top:16px" @click="router.push({ name: 'home' })">去大厅</button>
        </div>
        <div v-else class="peer-list">
          <div
            v-for="p in peers"
            :key="p.userID"
            class="peer-item"
            :class="{ active: sameAccountId(p.userID, peerID) }"
            @click="openPeer(p.userID)"
          >
            <div class="peer-item__avatar" :style="{ background: avatarTone(p.name) }">
              <img v-if="p.avatarURL" :src="p.avatarURL" alt="" @error="onPeerAvatarError(p)">
              <span v-else>{{ avatarInitial(p.name) }}</span>
            </div>
            <div class="peer-item__body">
              <div class="peer-item__name">{{ p.name || '用户' }}</div>
              <div class="peer-item__preview">{{ p.lastMessagePreview || '暂无消息' }}</div>
            </div>
            <div class="peer-item__side">
              <span v-if="p.lastMessageTime" class="peer-item__time">{{ chatTimeLabel(p.lastMessageTime) }}</span>
              <span v-if="p.unread" class="peer-item__unread">{{ p.unread > 99 ? '99+' : p.unread }}</span>
            </div>
          </div>
        </div>
      </div>

      <div v-if="hasPeer" class="chat-panel">
        <!-- 手机端进入聊天后，会话列表整块让位，顶部只留返回与对方名字 -->
        <div class="chat-backbar">
          <button type="button" class="chat-backbar__back" @click="backToList">‹ 返回</button>
          <strong>{{ peer?.name || '对话' }}</strong>
        </div>
        <div class="panel chat-peerhead">
          <div class="chat-peerhead__avatar" :style="{ background: avatarTone(peer?.name) }">
            {{ avatarInitial(peer?.name) }}
          </div>
          <div class="chat-peerhead__info">
            <strong>{{ peer?.name || '对话' }}</strong>
            <span>{{ headNote }}</span>
          </div>
          <button v-if="postID" type="button" class="chat-peerhead__from" @click="gotoPost">查看需求</button>
        </div>
        <div class="chat-thread panel">
          <p v-if="messages.length" class="chat-thread__start">以上是会话开始</p>
          <div
            v-for="(m, i) in messages"
            :key="m.clientKey || m.chatMsgID || i"
            class="bubble-row"
            :class="{ mine: m.senderUserID === myID }"
          >
            <div class="bubble">{{ m.content }}</div>
          </div>
          <p v-if="!messages.length" class="muted status">暂无消息，发一句打个招呼吧</p>
          <p v-if="wsHint" class="muted status">{{ wsHint }}</p>
        </div>
        <div class="chat-input panel">
          <input v-model="draft" placeholder="输入消息…" @keydown.enter.prevent="send">
          <button class="btn primary" @click="send">发送</button>
        </div>
      </div>
    </div>
  </div>
</template>
