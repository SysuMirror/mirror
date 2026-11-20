<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

const text = ref('')
const success = ref('')
const error = ref('')
const loading = ref(false)

function submit() {
  const t = text.value.trim()
  if (!t) return
  loading.value = true
  // 静态还原：不接真实接口
  setTimeout(() => {
    loading.value = false
    text.value = ''
    success.value = '感谢你的反馈'
  }, 400)
}
</script>

<template>
  <div class="page">
    <header class="topbar">
      <button class="btn ghost sm" @click="router.back()">返回</button>
      <h1>反馈</h1>
    </header>

    <div class="panel form">
      <textarea v-model="text" rows="5" class="profile-input" placeholder="遇到问题或建议…"></textarea>
      <button class="btn primary block" style="margin-top: 12px" :disabled="loading" @click="submit">
        {{ loading ? '提交中…' : '提交' }}
      </button>
      <p v-if="success" class="success">{{ success }}</p>
      <p v-if="error" class="error">{{ error }}</p>
    </div>
  </div>
</template>

<style scoped>
.profile-input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--input-border);
  border-radius: var(--radius);
  font: inherit;
  font-size: 14px;
  resize: vertical;
}

.profile-input:focus {
  outline: none;
  border-color: var(--brand);
}

.success {
  margin-top: 12px;
  font-size: 13px;
  color: var(--success);
}
</style>
