<script setup>
import { RouterLink } from 'vue-router'

const platforms = [
  { label: '集市主站', href: 'https://ssemarket.cn' },
  { label: 'iWiki 知识库', href: 'https://iwiki.ssemarket.cn' },
  { label: '集市云', href: 'https://cloud.ssemarket.cn' },
  { label: '需求广场', to: { name: 'home' } },
]

const site = [
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
        <a
          v-for="p in platforms.filter(x => x.href)"
          :key="p.label"
          :href="p.href"
          target="_blank"
          rel="noopener"
        >{{ p.label }}</a>
        <RouterLink
          v-for="p in platforms.filter(x => x.to)"
          :key="p.label"
          :to="p.to"
        >{{ p.label }}</RouterLink>
      </nav>

      <nav class="site-footer__col" aria-label="站内页面">
        <h3>站内</h3>
        <RouterLink v-for="s in site" :key="s.label" :to="s.to">{{ s.label }}</RouterLink>
        <RouterLink :to="{ name: 'login' }">登录</RouterLink>
      </nav>
    </div>

    <div class="site-footer__base">
      <span>© 2026 沕鉴工作室</span>
      <span>以自研技术底座，服务校园场景</span>
    </div>
  </footer>
</template>

<style scoped>
.site-footer {
  background: var(--ink);
  color: #e8eefb;
  padding: 56px 24px 28px;
}

.site-footer__inner {
  max-width: 1180px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: 1.4fr 1fr 1fr;
  gap: 40px;
}

.site-footer__logo {
  display: flex;
  align-items: baseline;
  gap: 6px;
  font-weight: 700;
  font-size: 18px;
  margin-bottom: 12px;
}

.site-footer__logo-en {
  font-size: 12px;
  opacity: .7;
  letter-spacing: .06em;
}

.site-footer__tagline {
  font-size: 13px;
  color: #d4e2fab8;
  margin: 0;
}

.site-footer__col {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.site-footer__col h3 {
  font-size: 13px;
  font-weight: 600;
  color: #8fa3c8;
  margin-bottom: 6px;
}

.site-footer__col a {
  font-size: 14px;
  color: #d4e2fad9;
  transition: color .2s var(--site-ease);
}

.site-footer__col a:hover {
  color: #fff;
}

.site-footer__base {
  max-width: 1180px;
  margin: 48px auto 0;
  padding-top: 20px;
  border-top: 1px solid rgba(255, 255, 255, .08);
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-size: 12px;
  color: #8fa3c8;
}

@media (max-width: 720px) {
  .site-footer__inner {
    grid-template-columns: 1fr;
    gap: 32px;
  }
  .site-footer__base {
    flex-direction: column;
  }
}
</style>
