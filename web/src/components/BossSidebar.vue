<script setup>
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '../stores/user'

const route = useRoute()
const router = useRouter()
const user = useUserStore()

// 对齐 BOSS 直聘企业后台的左侧竖栏：一行一项，图标 + 文案，选中项高亮
const ICONS = {
  list: 'M4 5h16M4 10h16M4 15h10M4 20h10',
  plus: 'M12 4v16M4 12h16',
  chat: 'M4 5h16v11H9l-5 4V5z',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 20c0-4 3.6-7 8-7s8 3 8 7',
  home: 'M3 10l9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1V10z',
}

const items = [
  { name: 'myposts', label: '需求管理', path: '/myposts', icon: 'list' },
  { name: 'create', label: '发布需求', path: '/create', icon: 'plus' },
  { name: 'messages', label: '沟通', path: '/messages', icon: 'chat' },
  { name: 'profile', label: '我的', path: '/profile', icon: 'user' },
  { name: 'home', label: '需求大厅', path: '/hall', icon: 'home' },
]

function isActive(i) {
  if (i.name === 'myposts' || i.name === 'create')
    return route.name === i.name
  return false
}
</script>

<template>
  <aside class="boss-side">
    <button type="button" class="boss-side__brand" @click="router.push('/')">
      <span class="boss-side__logo">沕鉴<em>·</em>Mirror</span>
      <span class="boss-side__tag">招聘端</span>
    </button>

    <nav class="boss-side__menu" aria-label="招聘端导航">
      <button
        v-for="i in items"
        :key="i.name"
        type="button"
        class="boss-side__item"
        :class="{ active: isActive(i) }"
        @click="router.push(i.path)"
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
          <path :d="ICONS[i.icon]" />
        </svg>
        <span>{{ i.label }}</span>
      </button>
    </nav>

    <div class="boss-side__foot">
      <span class="boss-side__user">{{ user.me?.name || '同学' }}</span>
      <button type="button" @click="router.push('/hall')">← 返回需求大厅</button>
    </div>
  </aside>
</template>
