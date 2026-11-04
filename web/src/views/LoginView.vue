<script setup>
import { computed, ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import {
  login,
  registerResend,
  registerStart,
  registerVerify,
  unissoLogin,
} from '../api/auth'
import { useUserStore } from '../stores/user'

const router = useRouter()
const route = useRoute()
const user = useUserStore()
const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const fullName = ref('')
const mode = ref('login')
const pendingId = ref('')
const verificationCode = ref('')
const resendCooldown = ref(0)
const loading = ref(false)
const error = ref('')

const isRegisterMode = computed(() => mode.value === 'register')

function validateRegistrationPasswords() {
  if (password.value.length < 8)
    throw new Error('密码至少需要 8 位')
  if (password.value.length > 128)
    throw new Error('密码不能超过 128 位')
  const categories = [
    /[A-Z]/.test(password.value),
    /[a-z]/.test(password.value),
    /\d/.test(password.value),
    /[^A-Za-z0-9\s]/.test(password.value),
  ].filter(Boolean).length
  if (categories < 2)
    throw new Error('密码至少 8 位，需包含大小写字母、数字或符号中的两类')
  if (['password', '123456', '12345678', 'qwerty', 'abc123', 'monkey', 'letmein', 'dragon', '111111', 'baseball', 'iloveyou', 'trustno1', 'sunshine', 'princess', 'admin', 'welcome', 'shadow', 'ashley', 'football', 'jesus', 'michael', 'ninja', 'mustang', 'password1', '123456789', 'adobe123', 'admin123', 'letmein1', 'photoshop', '1234567'].includes(password.value.toLowerCase()))
    throw new Error('密码过于常见，请更换')
  if (/(.)\1{3,}/.test(password.value))
    throw new Error('密码不能包含连续 4 个相同字符')
  if (/0123|1234|2345|3456|4567|5678|6789|9876|8765|7654|6543|5432|4321|3210/.test(password.value))
    throw new Error('密码不能包含连续数字序列')
  if (password.value !== confirmPassword.value)
    throw new Error('两次输入的密码不一致')
}

async function finishSession(token) {
  user.setToken(token)
  await user.refreshMe()
  router.replace(route.query.redirect || '/')
}

async function submitLogin() {
  try {
    let token
    try {
      token = (await unissoLogin(email.value.trim(), password.value)).token
    }
    catch {
      token = await login(email.value.trim(), password.value)
    }
    await finishSession(token)
  }
  catch (e) {
    error.value = e.message || '登录失败'
  }
}

async function submitRegistration() {
  validateRegistrationPasswords()
  const data = await registerStart(
    email.value.trim(),
    password.value,
    email.value.split('@')[0],
    fullName.value.trim(),
  )
  pendingId.value = data.pendingId
  resendCooldown.value = 60
  startResendTimer()
}

function startResendTimer() {
  const timer = setInterval(() => {
    resendCooldown.value -= 1
    if (resendCooldown.value <= 0)
      clearInterval(timer)
  }, 1000)
}

function resetRegistration() {
  mode.value = 'register'
  pendingId.value = ''
  verificationCode.value = ''
  confirmPassword.value = ''
  error.value = ''
}

async function submitVerification() {
  validateRegistrationPasswords()
  const userData = await registerVerify(
    pendingId.value,
    verificationCode.value.trim(),
    password.value,
    confirmPassword.value,
  )
  if (!userData?.userID)
    throw new Error('集市账号创建失败')
}

async function resend() {
  if (resendCooldown.value > 0)
    return
  await registerResend(pendingId.value)
  resendCooldown.value = 60
  startResendTimer()
}

async function submit() {
  error.value = ''
  loading.value = true
  try {
    if (!isRegisterMode.value) {
      await submitLogin()
    }
    else if (!pendingId.value) {
      await submitRegistration()
    }
    else {
      await submitVerification()
      await finishSession(localStorage.getItem('quest_token'))
    }
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
      <div class="mode-switch" role="tablist">
        <button type="button" :class="{ active: !isRegisterMode }" @click="mode = 'login'">登录</button>
        <button type="button" :class="{ active: isRegisterMode }" @click="resetRegistration">注册</button>
      </div>
      <label v-if="isRegisterMode && !pendingId">昵称（可选）</label>
      <input v-if="isRegisterMode && !pendingId" v-model="fullName" type="text" placeholder="昵称">
      <label>{{ pendingId ? '邮箱' : 'UniSSO 邮箱' }}</label>
      <input
        v-model="email"
        type="email"
        placeholder="邮箱"
        autocomplete="username"
        :disabled="!!pendingId"
      >
      <label>{{ isRegisterMode ? '输入密码' : 'UniSSO 密码' }}</label>
      <input
        v-model="password"
        type="password"
        :placeholder="isRegisterMode ? '至少 8 位，含两类字符' : '密码'"
        :autocomplete="isRegisterMode ? 'new-password' : 'current-password'"
        @keydown.enter="submit"
      >
      <template v-if="isRegisterMode">
        <label>再次输入密码</label>
        <input
          v-model="confirmPassword"
          type="password"
          placeholder="再次输入密码"
          autocomplete="new-password"
          @keydown.enter="submit"
        >
      </template>
      <template v-if="pendingId">
        <label>验证码</label>
        <input
          v-model="verificationCode"
          type="text"
          inputmode="numeric"
          maxlength="6"
          placeholder="6 位邮箱验证码"
          autocomplete="one-time-code"
          @keydown.enter="submit"
        >
      </template>
      <p v-if="error" class="error">{{ error }}</p>
      <button class="btn primary" :disabled="loading" @click="submit">
        {{ loading ? '处理中…' : (!isRegisterMode ? '登录' : (pendingId ? '完成注册' : '发送验证码')) }}
      </button>
      <button
        v-if="pendingId"
        class="btn ghost resend"
        type="button"
        :disabled="loading || resendCooldown > 0"
        @click="resend"
      >
        {{ resendCooldown > 0 ? `${resendCooldown}s 后可重发` : '重新发送验证码' }}
      </button>
    </div>
  </div>
</template>
