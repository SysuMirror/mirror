<script setup>
import ServiceList from '@/components/ServiceList.vue'
</script>

<template>
  <div class="site-page">
    <section class="site-section" style="padding-top: calc(var(--site-nav-h) + 64px)">
      <div class="site-shell">
        <header class="site-section__head">
          <h2 class="site-section__title">技术服务</h2>
          <p class="site-section__lead">
            面向学生团队、校内院系与校企合作单位——如果你有系统开发或平台建设的需求，欢迎了解我们的服务。
          </p>
        </header>

        <ServiceList />

        <div class="service-cta">
          <p style="margin-bottom: 24px">有需求或想进一步了解，可以通过需求广场发布，或直接向我们反馈联系方式。</p>
          <div class="service-cta__actions">
            <router-link class="btn-hero btn-hero--primary" :to="{ name: 'home' }">发布需求</router-link>
            <router-link class="btn-hero btn-hero--ghost" :to="{ name: 'feedback' }">联系我们</router-link>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.service-cta {
  margin-top: 40px;
}
.service-cta p {
  font-size: 14px;
  color: var(--site-muted);
}
.service-cta__actions {
  display: flex;
  gap: 14px;
  flex-wrap: wrap;
}
</style>
