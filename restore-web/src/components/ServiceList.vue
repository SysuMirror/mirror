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
