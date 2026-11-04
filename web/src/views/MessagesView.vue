<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { chatWsUrl, getChatHistory, sendChatMessage } from '../api/chat'
import { fetchChatPeers, fetchUserInfo } from '../api/quest'
import { useUserStore } from '../stores/user'
import { avatarUrl } from '../utils/display'

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

const peerID = computed(() => Number(route.query.user || 0))
const myID = computed(() => user.me?.userID || 0)
const hasPeer = computed(() => peerID.value > 0)

async function loadPeers() {
  peers.value = await fetchChatPeers()
}

async function loadPeer() {
  if (!peerID.value || !user.me?.phone)
    return
  peer.value = await fetchUserInfo(user.me.phone, peerID.value)
}

async function loadHistory() {
  if (!myID.value || !peerID.value)
    return
  messages.value = await getChatHistory(myID.value, peerID.value)
}

function connectWs() {
  if (!user.token || ws.value)
    return
  const socket = new WebSocket(chatWsUrl())
  ws.value = socket
  socket.addEventListener('message', (ev) => {
    try {
      const data = JSON.parse(ev.data)
      if (data.chatMsgID && data.content) {
        messages.value.push({ ...data, createdAt: data.createdAt || new Date().toISOString() })
      }
    }
    catch { /* ignore */ }
  })
  socket.addEventListener('open', () => {
    const beat = setInterval(() => {
      if (socket.readyState === WebSocket.OPEN)
        socket.send(JSON.stringify({ userID: myID.value, beat: 1 }))
    }, 30000)
    socket._beat = beat
  })
  socket.addEventListener('close', () => {
    if (socket._beat)
      clearInterval(socket._beat)
    ws.value = null
  })
}

function send() {
  const text = draft.value.trim()
  if (!text || !ws.value || ws.value.readyState !== WebSocket.OPEN)
    return
  sendChatMessage(ws.value, {
    senderUserID: myID.value,
    targetUserID: peerID.value,
    content: text,
  })
  messages.value.push({
    chatMsgID: 0,
    senderUserID: myID.value,
    targetUserID: peerID.value,
    content: text,
    createdAt: new Date().toISOString(),
    pending: true,
  })
  draft.value = ''
}

function openPeer(id) {
  router.push({ name: 'messages', query: { user: String(id) } })
}

function closeWs() {
  if (ws.value) {
    ws.value.close()
    ws.value = null
  }
}

async function init() {
  loading.value = true
  error.value = ''
  closeWs()
  try {
    await user.refreshMe()
    await loadPeers()
    if (!peerID.value) {
      loading.value = false
      return
    }
    await loadPeer()
    await loadHistory()
    connectWs()
  }
  catch (e) {
    error.value = e.message
  }
  finally {
    loading.value = false
  }
}

watch(() => route.query.user, init)
onMounted(init)
onUnmounted(closeWs)
</script>

<template>
  <div class="page">
    <header class="topbar">
      <h1>私信</h1>
      <button v-if="hasPeer" class="btn ghost sm" @click="router.push({ name: 'messages' })">会话列表</button>
    </header>

    <p v-if="loading" class="status">加载中…</p>
    <p v-else-if="error" class="error">{{ error }}</p>

    <div v-else class="messages-layout" :class="{ 'has-peer': hasPeer }">
      <div class="peer-panel">
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
            :class="{ active: p.userID === peerID }"
            @click="openPeer(p.userID)"
          >
            <img class="peer-item__avatar" :src="avatarUrl(p.avatarURL)" alt="">
            <div class="peer-item__body">
              <div class="peer-item__name">{{ p.name || '用户' }}</div>
              <div class="peer-item__preview">{{ p.lastMessagePreview || '暂无消息' }}</div>
            </div>
          </div>
        </div>
      </div>

      <div v-if="hasPeer" class="chat-panel">
        <div class="panel" style="margin-bottom:10px;padding:12px">
          <strong>{{ peer?.name || '对话' }}</strong>
        </div>
        <div class="chat-thread panel">
          <div
            v-for="(m, i) in messages"
            :key="m.chatMsgID || i"
            class="bubble-row"
            :class="{ mine: m.senderUserID === myID }"
          >
            <div class="bubble">{{ m.content }}</div>
          </div>
          <p v-if="!messages.length" class="muted status">暂无消息，发一句打个招呼吧</p>
        </div>
        <div class="chat-input panel">
          <input v-model="draft" placeholder="输入消息…" @keydown.enter.prevent="send">
          <button class="btn primary" @click="send">发送</button>
        </div>
      </div>
    </div>
  </div>
</template>
