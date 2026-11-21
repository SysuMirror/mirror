<script>
// 站内导航链接：顶部抽屉与首页 hero 共用同一份数据
export const navLinks = [
  { label: '生态', to: { path: '/', hash: '#eco' } },
  { label: '技术底座', to: { path: '/', hash: '#foundation' } },
  { label: '服务', to: { name: 'site-services' } },
  { label: '关于', to: { name: 'site-about' } },
]
</script>

<script setup>
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { session } from '../store/session'

const route = useRoute()
const router = useRouter()
const scrolled = ref(false)
const drawerOpen = ref(false)

const isHome = computed(() => route.name === 'site-home')

function onScroll() {
  scrolled.value = window.scrollY > 10
}
function go(l) {
  drawerOpen.value = false
  router.push(l.to)
}
function logout() {
  session.logout()
  drawerOpen.value = false
  router.push({ name: 'site-home' })
}

onMounted(() => {
  onScroll()
  window.addEventListener('scroll', onScroll, { passive: true })
})
onBeforeUnmount(() => window.removeEventListener('scroll', onScroll))
</script>

<template>
  <header class="site-nav" :class="{ 'site-nav--solid': scrolled || !isHome || drawerOpen }">
    <div class="site-nav__inner">
      <RouterLink class="site-nav__brand" :to="{ name: 'site-home' }">
        <span class="site-nav__brand-cn">沕鉴</span>
        <span class="site-nav__brand-en">Mirror</span>
      </RouterLink>

      <div class="site-nav__actions">
        <button
          type="button"
          class="site-nav__burger"
          :aria-expanded="drawerOpen"
          aria-label="菜单"
          @click="drawerOpen = !drawerOpen"
        >
          <span></span><span></span><span></span>
        </button>
      </div>
    </div>

    <Transition name="drawer">
      <div v-if="drawerOpen" class="site-nav__drawer">
        <RouterLink class="site-nav__drawer-link" :to="{ name: 'home' }" @click="drawerOpen = false">需求广场</RouterLink>
        <template v-if="session.loggedIn">
          <RouterLink class="site-nav__drawer-link" :to="{ name: 'messages' }" @click="drawerOpen = false">消息</RouterLink>
          <RouterLink class="site-nav__drawer-link" :to="{ name: 'profile' }" @click="drawerOpen = false">我的</RouterLink>
        </template>
        <button v-for="l in navLinks" :key="l.label" type="button" class="site-nav__drawer-link" @click="go(l)">
          {{ l.label }}
        </button>
        <button v-if="session.loggedIn" type="button" class="site-nav__drawer-link" @click="logout">退出登录</button>
        <RouterLink v-else class="site-nav__drawer-link" :to="{ name: 'login' }" @click="drawerOpen = false">登录</RouterLink>
      </div>
    </Transition>
  </header>
</template>
