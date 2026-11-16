<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '../stores/user'
import { unreadTotal } from '../stores/unread'

const route = useRoute()
const router = useRouter()
const user = useUserStore()

const menus = [
  { name: 'home', label: '需求大厅', path: '/hall' },
  { name: 'myposts', label: '我的发布', path: '/myposts' },
  { name: 'create', label: '发布需求', path: '/create' },
  { name: 'messages', label: '私信', path: '/messages' },
  { name: 'profile', label: '我的', path: '/profile' },
]

const hidden = computed(() => route.name === 'login' || route.name === 'cover' || !user.token)

function isActive(m) {
  if (m.name === 'home')
    return route.name === 'home' || route.name === 'detail'
  if (m.name === 'myposts')
    return route.name === 'myposts' || route.name === 'create'
  if (m.name === 'messages')
    return route.path.startsWith('/messages')
  if (m.name === 'profile')
    return route.name === 'profile' || route.name === 'feedback'
  return route.name === m.name
}
</script>

<template>
  <header v-if="!hidden" class="top-nav">
    <div class="top-nav__inner">
      <a class="top-nav__brand" href="#/" @click.prevent="router.push('/')">沕鉴<em>·</em>Mirror</a>
      <nav class="top-nav__menu">
        <button
          v-for="m in menus"
          :key="m.name"
          type="button"
          :class="{ active: isActive(m) }"
          @click="router.push(m.path)"
        >{{ m.label }}<span
            v-if="m.name === 'messages' && unreadTotal > 0"
            class="top-nav__dot"
            :aria-label="`${unreadTotal} 条未读私信`"
          >{{ unreadTotal > 99 ? '99+' : unreadTotal }}</span></button>
      </nav>
      <div class="top-nav__side">
        <span class="top-nav__user">{{ user.me?.name || '同学' }}</span>
        <button type="button" class="top-nav__publish" @click="router.push('/create')">+ 发布需求</button>
      </div>
    </div>
  </header>
</template>

<style scoped>
.top-nav__dot {
  position: absolute;
  top: 7px;
  right: 2px;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 8px;
  background: #f04b4b;
  color: #fff;
  font-size: 10px;
  font-weight: 600;
  line-height: 16px;
  text-align: center;
}
</style>
