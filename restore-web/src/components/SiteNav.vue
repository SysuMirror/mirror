<script setup>
import { ref, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'

const router = useRouter()
const route = useRoute()
const solid = ref(false)
const open = ref(false)

const links = [
  { label: '生态', to: { path: '/', hash: '#eco' } },
  { label: '技术底座', to: { path: '/', hash: '#foundation' } },
  { label: '服务', to: { name: 'site-services' } },
  { label: '关于', to: { name: 'site-about' } },
]

const isHome = computed(() => route.name === 'site-home')

function onScroll() {
  solid.value = window.scrollY > 10
}

function go(to) {
  open.value = false
  router.push(to)
}

onScroll()
window.addEventListener('scroll', onScroll, { passive: true })
</script>

<template>
  <header class="site-nav" :class="{ 'site-nav--solid': solid || !isHome || open }">
    <div class="site-nav__inner">
      <router-link class="site-nav__brand" :to="{ name: 'site-home' }">
        <span class="site-nav__brand-cn">沕鉴</span>
        <span class="site-nav__brand-en">Mirror</span>
      </router-link>

      <nav class="site-nav__links" aria-label="站内导航">
        <button
          v-for="l in links"
          :key="l.label"
          type="button"
          class="site-nav__link"
          @click="go(l.to)"
        >
          {{ l.label }}
        </button>
      </nav>

      <div class="site-nav__actions">
        <router-link class="site-nav__cta" :to="{ name: 'home' }">需求广场</router-link>
        <router-link class="site-nav__link site-nav__link--icon" :to="{ name: 'messages' }" title="消息">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
          </svg>
        </router-link>
        <router-link class="site-nav__link site-nav__link--icon" :to="{ name: 'profile' }" title="我的">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">
            <circle cx="12" cy="8" r="4"/>
            <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
          </svg>
        </router-link>
        <button
          type="button"
          class="site-nav__burger"
          :aria-expanded="open"
          aria-label="菜单"
          @click="open = !open"
        >
          <span /><span /><span />
        </button>
      </div>
    </div>

    <Transition name="drawer">
      <div v-if="open" class="site-nav__drawer">
        <router-link class="site-nav__drawer-link" :to="{ name: 'home' }" @click="open = false">需求广场</router-link>
        <router-link class="site-nav__drawer-link" :to="{ name: 'messages' }" @click="open = false">消息</router-link>
        <router-link class="site-nav__drawer-link" :to="{ name: 'profile' }" @click="open = false">我的</router-link>
        <button
          v-for="l in links"
          :key="l.label"
          type="button"
          class="site-nav__drawer-link"
          @click="go(l.to)"
        >
          {{ l.label }}
        </button>
        <router-link class="site-nav__drawer-link" :to="{ name: 'login' }" @click="open = false">登录</router-link>
      </div>
    </Transition>
  </header>
</template>

<style scoped>
.site-nav {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: var(--site-nav-h);
  z-index: 100;
  color: #e8eefb;
  transition: background .3s var(--site-ease), box-shadow .3s var(--site-ease);
}

.site-nav--solid {
  background: var(--ink);
  box-shadow: 0 1px 0 rgba(255, 255, 255, .06);
}

.site-nav__inner {
  max-width: 1180px;
  margin: 0 auto;
  padding: 0 24px;
  height: 100%;
  display: flex;
  align-items: center;
  gap: 28px;
}

.site-nav__brand {
  display: flex;
  align-items: baseline;
  gap: 6px;
  font-weight: 700;
  letter-spacing: .02em;
}

.site-nav__brand-cn { font-size: 17px; }
.site-nav__brand-en { font-size: 12px; opacity: .7; letter-spacing: .06em; }

.site-nav__links {
  display: flex;
  gap: 4px;
  margin-left: 8px;
}

.site-nav__link {
  background: none;
  border: none;
  color: inherit;
  font-size: 14px;
  cursor: pointer;
  padding: 8px 12px;
  border-radius: 8px;
  transition: background .2s var(--site-ease), color .2s var(--site-ease);
}

.site-nav__link:hover {
  background: rgba(255, 255, 255, .08);
}

.site-nav__link--icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 8px;
}

.site-nav__actions {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 4px;
}

.site-nav__cta {
  height: 36px;
  padding: 0 16px;
  display: inline-flex;
  align-items: center;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  background: linear-gradient(135deg, var(--brand), var(--brand-light));
  color: #fff;
}

.site-nav__burger {
  display: none;
  flex-direction: column;
  justify-content: center;
  gap: 4px;
  width: 36px;
  height: 36px;
  padding: 8px;
  background: none;
  border: none;
  cursor: pointer;
}

.site-nav__burger span {
  display: block;
  height: 2px;
  background: currentColor;
  border-radius: 1px;
}

.site-nav__drawer {
  position: fixed;
  top: var(--site-nav-h);
  left: 0;
  right: 0;
  background: var(--ink);
  padding: 12px 24px 24px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.site-nav__drawer-link {
  padding: 12px 0;
  font-size: 15px;
  border-bottom: 1px solid rgba(255, 255, 255, .06);
  color: inherit;
}

@media (max-width: 860px) {
  .site-nav__links { display: none; }
  .site-nav__burger { display: flex; }
  .site-nav__cta { display: none; }
}
</style>
