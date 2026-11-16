<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { apiRequest } from '../api/client'

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
    await apiRequest('/auth/submitFeedback', {
      method: 'POST',
      body: { ftext: body },
    })
    text.value = ''
    msg.value = '感谢你的反馈'
  }
  catch (e) {
    error.value = e?.message || '提交失败，请稍后重试'
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
