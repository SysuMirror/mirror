<script setup>
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { session } from '../store/session'
import { siteLinks as links } from '../router/siteLinks'

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

      <nav v-if="!isHome" class="site-nav__links" aria-label="站内导航">
        <button v-for="l in links" :key="l.label" type="button" class="site-nav__link" @click="go(l)">
          {{ l.label }}
        </button>
      </nav>

      <div class="site-nav__actions">
        <RouterLink class="site-nav__cta" :to="{ name: 'home' }">需求广场</RouterLink>

        <template v-if="session.loggedIn">
          <RouterLink class="site-nav__link site-nav__link--icon" :to="{ name: 'messages' }" title="消息">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">
              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
            </svg>
          </RouterLink>
          <RouterLink class="site-nav__link site-nav__link--icon" :to="{ name: 'profile' }" title="我的">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
            </svg>
          </RouterLink>
        </template>
        <RouterLink v-else class="site-nav__link" :to="{ name: 'login' }">登录</RouterLink>

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
        <button v-for="l in links" :key="l.label" type="button" class="site-nav__drawer-link" @click="go(l)">
          {{ l.label }}
        </button>
        <button v-if="session.loggedIn" type="button" class="site-nav__drawer-link" @click="logout">退出登录</button>
        <RouterLink v-else class="site-nav__drawer-link" :to="{ name: 'login' }" @click="drawerOpen = false">登录</RouterLink>
      </div>
    </Transition>
  </header>
</template>

<style scoped>
.site-nav__brand + .site-nav__actions {
  margin-left: auto;
}
</style>
