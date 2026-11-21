<script setup>
import { session } from '../store/session'

const platforms = [
  { label: '集市主站', href: 'https://ssemarket.cn' },
  { label: 'iWiki 知识库', href: 'https://iwiki.ssemarket.cn' },
  { label: '集市云', href: 'https://cloud.ssemarket.cn' },
  { label: '需求广场', to: { name: 'home' } },
]

const pages = [
  { label: '技术服务', to: { name: 'site-services' } },
  { label: '关于工作室', to: { name: 'site-about' } },
  { label: '意见反馈', to: { name: 'feedback' } },
]
</script>

<template>
  <footer class="site-footer">
    <div class="site-footer__inner">
      <div class="site-footer__brand">
        <div class="site-footer__logo">
          <span class="site-footer__logo-cn">沕鉴</span>
          <span class="site-footer__logo-en">Mirror</span>
        </div>
        <p class="site-footer__tagline">沕鉴工作室 · 校园技术服务平台</p>
      </div>

      <nav class="site-footer__col" aria-label="平台入口">
        <h3>平台入口</h3>
        <a v-for="p in platforms.filter(x => x.href)" :key="p.label" :href="p.href" target="_blank" rel="noopener">
          {{ p.label }}
        </a>
        <RouterLink v-for="p in platforms.filter(x => x.to)" :key="p.label" :to="p.to">{{ p.label }}</RouterLink>
      </nav>

      <nav class="site-footer__col" aria-label="站内页面">
        <h3>站内</h3>
        <RouterLink v-for="p in pages" :key="p.label" :to="p.to">{{ p.label }}</RouterLink>
        <RouterLink v-if="!session.loggedIn" :to="{ name: 'login' }">登录</RouterLink>
      </nav>
    </div>

    <div class="site-footer__base">
      <span>© 2026 沕鉴工作室</span>
      <span>以自研技术底座，服务校园场景</span>
    </div>
  </footer>
</template>
