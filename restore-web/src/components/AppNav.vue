<script setup>
import { ref, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import MineSheet from './MineSheet.vue'

const router = useRouter()
const route = useRoute()
const sheetOpen = ref(false)

const items = computed(() => {
  const list = [
    { name: 'site-home', label: '首页' },
    { name: 'home', label: '我的需求' },
  ]
  // 静态还原：默认按管理员身份展示全部入口
  list.push({ name: 'admin', label: '管理台' })
  list.push({ name: 'messages', label: '集市消息' })
  list.push({ name: 'mine', label: '我的' })
  return list
})

function onClick(item) {
  if (item.name === 'mine') {
    sheetOpen.value = true
    return
  }
  router.push({ name: item.name })
}

function isActive(item) {
  if (item.name === 'home') return ['home', 'create'].includes(route.name)
  if (item.name === 'site-home') return false
  return route.name === item.name
}

function onSelect(key) {
  sheetOpen.value = false
  if (['profile', 'feedback', 'admin', 'messages'].includes(key)) {
    router.push({ name: key })
  }
}
</script>

<template>
  <nav class="bottom-nav" aria-label="底部导航">
    <button
      v-for="item in items"
      :key="item.name"
      type="button"
      class="bottom-nav__item"
      :class="{ active: isActive(item) }"
      @click="onClick(item)"
    >
      <span class="bottom-nav__icon">
        <svg v-if="item.name === 'site-home'" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
          <circle cx="12" cy="12" r="4" />
          <path d="M3 12h5M16 12h5M12 3v5M12 16v5" />
        </svg>
        <svg v-else-if="item.name === 'home'" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
          <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
          <rect x="9" y="3" width="6" height="4" rx="1" />
        </svg>
        <svg v-else-if="item.name === 'admin'" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
          <rect x="3" y="3" width="7" height="9" rx="1.5" />
          <rect x="14" y="3" width="7" height="5" rx="1.5" />
          <rect x="14" y="12" width="7" height="9" rx="1.5" />
          <rect x="3" y="16" width="7" height="5" rx="1.5" />
        </svg>
        <svg v-else-if="item.name === 'messages'" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
        </svg>
        <svg v-else width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
          <circle cx="12" cy="8" r="4" />
          <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
        </svg>
      </span>
      <span class="bottom-nav__label">{{ item.label }}</span>
    </button>
  </nav>

  <MineSheet :open="sheetOpen" @close="sheetOpen = false" @select="onSelect" />
</template>

<style scoped>
.bottom-nav {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  height: var(--nav-height);
  display: flex;
  background: var(--surface);
  border-top: 1px solid var(--border);
  z-index: 50;
  padding: 0 8px;
  padding-bottom: env(safe-area-inset-bottom, 0);
}

.bottom-nav__item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 11px;
}

.bottom-nav__item.active {
  color: var(--text);
}

.bottom-nav__icon {
  display: flex;
}

.bottom-nav__label {
  line-height: 1;
}
</style>
