<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

const me = {
  name: 'Mirror 用户',
  email: 'user@example.com',
}

const isAdmin = true

function logout() {
  router.replace({ name: 'login' })
}
</script>

<template>
  <div class="page">
    <header class="topbar">
      <h1>账号信息</h1>
    </header>

    <div class="panel profile-panel">
      <div class="profile-row">
        <span>称呼</span>
        <b>{{ me.name || '未设置' }}</b>
      </div>
      <div class="profile-row">
        <span>邮箱（Mirror 账号）</span>
        <b>{{ me.email }}</b>
      </div>
      <div class="profile-row">
        <span>身份</span>
        <b>{{ isAdmin ? '管理员' : '甲方' }}</b>
      </div>
      <p class="profile-tip">账号由 UniSSO 统一身份认证，资料修改请前往统一认证中心。</p>
      <button class="btn ghost block" @click="logout">退出登录</button>
    </div>
  </div>
</template>

<style scoped>
.profile-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 0;
  border-bottom: 1px solid var(--border);
}

.profile-row span {
  font-size: 13px;
  color: var(--text-muted);
}

.profile-row b {
  font-size: 14px;
  font-weight: 500;
}

.profile-tip {
  font-size: 12px;
  line-height: 1.7;
  color: var(--text-muted);
  margin: 16px 0;
}
</style>
