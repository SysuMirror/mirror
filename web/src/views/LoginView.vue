<script setup>
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { login } from '../api/auth'
import { useUserStore } from '../stores/user'

const router = useRouter()
const route = useRoute()
const user = useUserStore()
const email = ref('')
const password = ref('')
const loading = ref(false)
const error = ref('')

async function submit() {
  error.value = ''
  loading.value = true
  try {
    const token = await login(email.value.trim(), password.value)
    user.setToken(token)
    await user.refreshMe()
    router.replace(route.query.redirect || '/')
  }
  catch (e) {
    error.value = e.message || '登录失败'
  }
  finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login-page">
    <div class="login-card">
      <h1>沕鉴·Mirror</h1>
      <p class="muted" style="margin:0 0 20px">使用软工集市邮箱登录</p>
      <label>邮箱</label>
      <input v-model="email" type="email" placeholder="邮箱" autocomplete="username">
      <label>密码</label>
      <input
        v-model="password"
        type="password"
        placeholder="密码"
        autocomplete="current-password"
        @keydown.enter="submit"
      >
      <p v-if="error" class="error">{{ error }}</p>
      <button class="btn primary" :disabled="loading" @click="submit">
        {{ loading ? '登录中…' : '登录' }}
      </button>
    </div>
  </div>
</template>
