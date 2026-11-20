<script setup>
import { ref, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import ParticleField from '@/components/ParticleField.vue'

const router = useRouter()
const route = useRoute()

const mode = ref('login')
const email = ref('')
const password = ref('')
const username = ref('')
const code = ref('')
const notice = ref('')
const error = ref('')
const pendingId = ref('')
const loading = ref(false)
const resendCooldown = ref(0)

const isRegister = computed(() => mode.value !== 'login')

function submit() {
  // 静态还原：不做真实接口调用，仅演示路由跳转
  if (!email.value.trim() || !password.value) {
    error.value = '请填写邮箱和密码'
    return
  }
  router.replace(route.query.redirect || { name: 'home' })
}

function resend() {}
function setMode(m) {
  mode.value = m
  error.value = ''
  notice.value = ''
}
</script>

<template>
  <div class="login-page">
    <ParticleField :max="40" :density="18000" />
    <div class="login-card">
      <div class="login-brand">
        <span class="login-brand__cn">沕鉴</span>
        <span class="login-brand__en">Mirror</span>
      </div>

      <div class="login-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          :aria-selected="!isRegister"
          :class="{ on: !isRegister }"
          @click="setMode('login')"
        >登录</button>
        <button
          type="button"
          role="tab"
          :aria-selected="isRegister"
          :class="{ on: isRegister }"
          @click="setMode('register')"
        >注册</button>
      </div>

      <p class="login-hint">使用 Mirror 账号登录需求广场；新用户请先在 UniSSO 或集市注册，再用同一邮箱登录</p>

      <label>邮箱</label>
      <input v-model="email" type="email" placeholder="邮箱" autocomplete="username" />

      <label v-if="isRegister">用户名（可选）</label>
      <input v-if="isRegister" v-model="username" placeholder="用户名" autocomplete="nickname" />

      <label>密码</label>
      <input
        v-model="password"
        type="password"
        placeholder="密码"
        :autocomplete="isRegister ? 'new-password' : 'current-password'"
        @keydown.enter="submit"
      />

      <p v-if="error" class="error">{{ error }}</p>

      <button class="btn primary login-submit" :disabled="loading" @click="submit">
        {{ loading ? '请稍候…' : (isRegister ? '发送验证码' : '登录') }}
      </button>

      <p class="login-footnote">Mirror 账号由 UniSSO 统一身份认证；平台不再提供独立注册，新用户请先到 UniSSO 或软工集市注册。</p>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  position: relative;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: linear-gradient(180deg, var(--ink) 0%, #0d1728 100%);
  overflow: hidden;
}

.login-card {
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 380px;
  background: var(--surface);
  border-radius: var(--radius-lg);
  padding: 28px;
  box-shadow: 0 24px 64px rgba(0, 0, 0, .4);
}

.login-brand {
  display: flex;
  align-items: baseline;
  gap: 6px;
  margin-bottom: 20px;
}

.login-brand__cn { font-size: 20px; font-weight: 700; }
.login-brand__en { font-size: 13px; opacity: .5; letter-spacing: .06em; }

.login-tabs {
  display: flex;
  gap: 4px;
  margin-bottom: 12px;
}

.login-tabs button {
  flex: 1;
  padding: 8px;
  background: none;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
  color: var(--text-muted);
}

.login-tabs button.on {
  background: var(--accent-soft);
  color: var(--text);
  font-weight: 600;
}

.login-hint {
  font-size: 12px;
  line-height: 1.6;
  color: var(--text-muted);
  margin: 0 0 16px;
}

.login-card label {
  display: block;
  font-size: 13px;
  margin-bottom: 6px;
}

.login-card input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--input-border);
  border-radius: var(--radius);
  font: inherit;
  font-size: 14px;
  margin-bottom: 14px;
}

.login-card input:focus {
  outline: none;
  border-color: var(--brand);
}

.login-submit {
  margin-top: 4px;
}

.login-footnote {
  font-size: 11.5px;
  line-height: 1.7;
  color: var(--text-muted);
  margin: 16px 0 0;
}
</style>
