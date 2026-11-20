<script setup>
const services = [
  {
    name: '数据可视化与平台服务',
    desc: '面向课程展示、社团活动、校园调研等场景，提供数据可视化平台、网站与小程序等工具类技术服务。',
  },
  {
    name: '定制化系统开发',
    desc: '面向校内院系与职能部门的中小型数字化需求，从需求分析到系统交付完整落地。',
  },
  {
    name: '平台建设与合作',
    desc: '依托可复用的自研技术体系搭建业务平台；经 Blue Hub 枢纽拓展校企合作渠道。',
  },
]
</script>

<template>
  <div class="service-list">
    <div v-for="(s, i) in services" :key="s.name" class="service-row">
      <span class="service-row__index">{{ String(i + 1).padStart(2, '0') }}</span>
      <h3 class="service-row__name">{{ s.name }}</h3>
      <p class="service-row__desc">{{ s.desc }}</p>
    </div>
  </div>
</template>

<style scoped>
.service-row {
  display: grid;
  grid-template-columns: 56px 240px 1fr;
  gap: 20px;
  align-items: baseline;
  padding: 28px 0;
  border-top: 1px solid var(--border);
}

.service-row__index {
  font-size: 13px;
  font-weight: 600;
  color: var(--brand);
  font-variant-numeric: tabular-nums;
}

.service-row__name {
  font-size: 19px;
  font-weight: 650;
  margin: 0;
}

.service-row__desc {
  font-size: 14px;
  line-height: 1.8;
  color: var(--site-muted);
  margin: 0;
}

@media (max-width: 720px) {
  .service-row {
    grid-template-columns: 40px 1fr;
    gap: 12px 16px;
  }
  .service-row__desc {
    grid-column: 2;
  }
}
</style>
