<script setup>
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '../stores/user'
import { unreadTotal } from '../stores/unread'
import MineSheet from './MineSheet.vue'

const route = useRoute()
const router = useRouter()
const user = useUserStore()
const unread = unreadTotal
const mineOpen = ref(false)

const tabs = [
  { name: 'home', path: '/hall', label: '大厅' },
  { name: 'create', path: '/create', label: '发帖' },
  { name: 'messages', path: '/messages', label: '消息' },
  { name: 'profile', path: '/profile', label: '我的' },
]

const hideNav = computed(() =>
  route.name === 'login' || route.name === 'detail' || route.name === 'cover',
)

const mineActive = computed(() =>
  route.name === 'profile' || route.name === 'feedback' || mineOpen.value,
)

function onTab(t) {
  if (t.name === 'profile') {
    mineOpen.value = true
    return
  }
  router.push(t.path)
}

function isActive(t) {
  if (t.name === 'messages')
    return route.path.startsWith('/messages')
  if (t.name === 'create')
    return route.name === 'create'
  if (t.name === 'profile')
    return mineActive.value
  return route.path === t.path
}

function onMineSelect(key) {
  if (key === 'myposts')
    router.push({ name: 'myposts' })
  else if (key === 'profile')
    router.push({ name: 'profile' })
  else if (key === 'feedback')
    router.push({ name: 'feedback' })
}
</script>

<template>
  <nav v-if="!hideNav && user.token" class="bottom-nav">
    <button
      v-for="t in tabs"
      :key="t.name"
      type="button"
      class="bottom-nav__item"
      :class="{ active: isActive(t) }"
      @click="onTab(t)"
    >
      <span class="bottom-nav__icon">
        <svg v-if="t.name === 'home'" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
          <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1V9.5z" />
        </svg>
        <svg v-else-if="t.name === 'create'" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
          <path d="M12 5v14M5 12h14" />
        </svg>
        <svg v-else-if="t.name === 'messages'" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
        </svg>
        <svg v-else width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
          <circle cx="12" cy="8" r="4" />
          <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
        </svg>
        <span v-if="t.name === 'messages' && unread > 0" class="badge-dot nav-badge">{{ unread > 99 ? '99+' : unread }}</span>
      </span>
      <span class="bottom-nav__label">{{ t.label }}</span>
    </button>
  </nav>

  <MineSheet :open="mineOpen" @close="mineOpen = false" @select="onMineSelect" />
</template>

<style scoped>
.nav-badge {
  position: absolute;
  top: -4px;
  right: -8px;
}
.bottom-nav__icon {
  position: relative;
}
</style>
