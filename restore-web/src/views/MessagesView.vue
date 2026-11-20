<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

const peers = [
  { userID: 101, name: '李同学', avatarURL: '', lastMessagePreview: '小程序大概什么时候能好？' },
  { userID: 102, name: '王同学', avatarURL: '', lastMessagePreview: '好的，就按这个方案' },
]

const activePeer = ref(101)
const messages = ref([
  { chatMsgID: 1, senderUserID: 1, content: '你好，看到你发的需求了' },
  { chatMsgID: 2, senderUserID: 101, content: '你好，小程序大概什么时候能好？' },
])
const input = ref('')

function send() {
  const text = input.value.trim()
  if (!text) return
  messages.value.push({ chatMsgID: Date.now(), senderUserID: 1, content: text })
  input.value = ''
}
</script>

<template>
  <div class="page">
    <header class="topbar">
      <h1>私信</h1>
    </header>

    <div class="messages-layout">
      <div class="peer-panel">
        <div class="peer-list">
          <div
            v-for="p in peers"
            :key="p.userID"
            class="peer-item"
            :class="{ active: p.userID === activePeer }"
            @click="activePeer = p.userID"
          >
            <div class="peer-item__avatar">{{ (p.name || '用户')[0] }}</div>
            <div class="peer-item__body">
              <div class="peer-item__name">{{ p.name || '用户' }}</div>
              <div class="peer-item__preview">{{ p.lastMessagePreview || '暂无消息' }}</div>
            </div>
          </div>
        </div>
      </div>

      <div class="chat-panel">
        <div class="panel" style="margin-bottom: 10px; padding: 12px">
          <strong>对话</strong>
        </div>
        <div class="chat-thread panel">
          <div
            v-for="m in messages"
            :key="m.chatMsgID"
            class="bubble-row"
            :class="{ mine: m.senderUserID === 1 }"
          >
            <div class="bubble">{{ m.content }}</div>
          </div>
        </div>
        <div class="chat-input panel">
          <input v-model="input" placeholder="输入消息…" @keydown.enter="send" />
          <button class="btn primary" @click="send">发送</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.messages-layout {
  display: grid;
  grid-template-columns: 260px 1fr;
  gap: 16px;
  min-height: 60vh;
}

.peer-panel {
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-md);
  background: var(--surface);
  overflow: hidden;
}

.peer-item {
  display: flex;
  gap: 12px;
  padding: 12px 14px;
  cursor: pointer;
  border-bottom: 1px solid var(--border);
}

.peer-item.active {
  background: var(--accent-soft);
}

.peer-item__avatar {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: var(--accent-soft);
  color: var(--accent);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  flex-shrink: 0;
}

.peer-item__name {
  font-size: 14px;
  font-weight: 500;
}

.peer-item__preview {
  font-size: 12.5px;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.chat-panel {
  display: flex;
  flex-direction: column;
}

.chat-thread {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 320px;
}

.bubble-row {
  display: flex;
}

.bubble-row.mine {
  justify-content: flex-end;
}

.bubble {
  max-width: 75%;
  padding: 10px 14px;
  border-radius: 14px;
  font-size: 14px;
  line-height: 1.6;
  background: var(--accent-soft);
}

.bubble-row.mine .bubble {
  background: var(--primary);
  color: var(--primary-fg);
}

.chat-input {
  display: flex;
  gap: 10px;
  align-items: center;
}

.chat-input input {
  flex: 1;
  padding: 10px 12px;
  border: 1px solid var(--input-border);
  border-radius: var(--radius);
  font: inherit;
  font-size: 14px;
}

.chat-input input:focus {
  outline: none;
  border-color: var(--brand);
}

@media (max-width: 720px) {
  .messages-layout {
    grid-template-columns: 1fr;
  }
  .peer-panel {
    display: none;
  }
}
</style>
