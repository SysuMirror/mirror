<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

const tabs = [
  { value: '', label: '全部' },
  { value: 'pending', label: '待受理' },
  { value: 'in_progress', label: '进行中' },
  { value: 'done', label: '已完成' },
]

const activeTab = ref('')

// 静态还原：用演示数据撑起列表形态
const orders = [
  {
    id: 'o-demo-0001',
    title: '课程设计前端页面改成响应式',
    content: '用 Vue 写的课程设计，手机上排版全乱了。希望有人帮我改造成响应式布局。',
    budgetType: 'fixed',
    budgetMin: 300,
    budgetMax: null,
    status: 'in_progress',
    statusLabel: '处理中',
    createdAt: '2026-11-18T10:24:00',
    marketPostId: '',
  },
  {
    id: 'o-demo-0002',
    title: '学院活动报名小程序',
    content: '需要一个简单的报名小程序，收集姓名、学号、联系方式，支持导出。',
    budgetType: 'negotiable',
    budgetMin: null,
    budgetMax: null,
    status: 'pending',
    statusLabel: '待受理',
    createdAt: '2026-11-19T15:02:00',
    marketPostId: '',
  },
]

const filtered = computed(() => {
  if (!activeTab.value) return orders
  return orders.filter(o => o.status === activeTab.value)
})

function budgetText(o) {
  if (o.budgetType === 'negotiable' || !o.budgetMin) return '面议'
  if (o.budgetType === 'fixed') return `¥${o.budgetMin}`
  return `¥${o.budgetMin} - ${o.budgetMax}`
}
</script>

<template>
  <div class="page list-page">
    <header class="topbar">
      <h1>我的需求</h1>
      <button class="btn primary sm" @click="router.push({ name: 'create' })">发布需求</button>
    </header>

    <div class="cta-card panel">
      <div>
        <h2>有想做的系统？交给我们</h2>
        <p>学生团队、院系部门、校企伙伴都欢迎 —— 网站 · 小程序 · 数据平台 · 数字化工具</p>
      </div>
      <button class="btn primary" @click="router.push({ name: 'create' })">立即下单</button>
    </div>

    <div class="tabs">
      <button
        v-for="t in tabs"
        :key="t.value"
        type="button"
        :class="{ active: activeTab === t.value }"
        @click="activeTab = t.value"
      >{{ t.label }}</button>
    </div>

    <div v-if="filtered.length" class="card-list">
      <div
        v-for="o in filtered"
        :key="o.id"
        class="order-card panel"
        @click="router.push({ name: 'detail', params: { id: o.id } })"
      >
        <div class="order-card__top">
          <span class="order-status" :class="`st-${o.status}`">{{ o.statusLabel }}</span>
          <span class="order-budget">{{ budgetText(o) }}</span>
        </div>
        <h3 class="order-card__title">{{ o.title }}</h3>
        <p class="order-card__desc">{{ o.content }}</p>
        <div class="order-card__foot">
          <span>{{ (o.createdAt || '').slice(0, 10) }}</span>
          <span v-if="o.marketPostId" class="order-card__fwd">已转发集市</span>
          <span class="order-card__arrow">›</span>
        </div>
      </div>
    </div>

    <div v-else class="empty-state empty-state--list">
      <h3>还没有需求</h3>
      <p>提交第一条需求，让我们开始</p>
      <button type="button" class="btn primary" @click="router.push({ name: 'create' })">发布需求</button>
    </div>
  </div>
</template>

<style scoped>
.cta-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.cta-card h2 {
  font-size: 16px;
  margin-bottom: 4px;
}

.cta-card p {
  font-size: 13px;
  color: var(--text-muted);
}

.tabs {
  display: flex;
  gap: 6px;
  margin-bottom: 16px;
  overflow-x: auto;
}

.tabs button {
  flex-shrink: 0;
  padding: 6px 12px;
  border-radius: 999px;
  border: 1px solid var(--input-border);
  background: var(--surface);
  color: var(--text-muted);
  font-size: 13px;
  cursor: pointer;
}

.tabs button.active {
  background: var(--primary);
  color: var(--primary-fg);
  border-color: var(--primary);
}

.order-card {
  cursor: pointer;
  transition: transform .1s var(--ease), border-color .15s var(--ease);
}

.order-card:hover {
  border-color: var(--brand);
}

.order-card__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.order-budget {
  font-size: 15px;
  font-weight: 600;
}

.order-card__title {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 6px;
}

.order-card__desc {
  font-size: 13.5px;
  color: var(--text-muted);
  line-height: 1.7;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.order-card__foot {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 12px;
  font-size: 12px;
  color: var(--text-muted);
}

.order-card__fwd {
  color: var(--success);
}

.order-card__arrow {
  margin-left: auto;
  font-size: 18px;
  color: var(--text-muted);
}
</style>
