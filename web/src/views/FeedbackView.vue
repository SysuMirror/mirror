<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { getToken } from '../api/client'

const router = useRouter()
const text = ref('')
const msg = ref('')
const error = ref('')
const sending = ref(false)

async function submit() {
  const body = text.value.trim()
  if (!body)
    return
  sending.value = true
  error.value = ''
  msg.value = ''
  try {
    const base = (import.meta.env.VITE_API_BASE || 'https://ssemarket.cn/api').replace(/\/$/, '')
    const res = await fetch(`${base}/auth/submitFeedback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getToken()}`,
      },
      body: JSON.stringify({ ftext: body }),
    })
    const data = await res.json()
    if (data.code !== 200)
      throw new Error(data.msg || '提交失败')
    text.value = ''
    msg.value = '感谢你的反馈'
  }
  catch (e) {
    error.value = e.message
  }
  finally {
    sending.value = false
  }
}

onMounted(() => {
  msg.value = ''
})
</script>

<template>
  <div class="page">
    <header class="topbar">
      <button type="button" class="btn ghost sm" @click="router.back()">返回</button>
      <h1>反馈</h1>
    </header>

    <div class="panel form">
      <textarea v-model="text" rows="5" class="profile-input" placeholder="遇到问题或建议…" />
      <button class="btn primary block" style="margin-top:12px" :disabled="sending" @click="submit">
        {{ sending ? '提交中…' : '提交' }}
      </button>
      <p v-if="msg" class="success">{{ msg }}</p>
      <p v-if="error" class="error">{{ error }}</p>
    </div>
  </div>
</template>
