<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

const tabs = [
  { value: '', label: '全部' },
  { value: 'pending', label: '待受理' },
  { value: 'accepted', label: '已受理' },
  { value: 'in_progress', label: '处理中' },
  { value: 'done', label: '已完成' },
  { value: 'closed', label: '已关闭' },
]

const activeTab = ref('')
const onlyForwarded = ref(false)

const orders = [
  {
    id: 'o-demo-0001', title: '课程设计前端页面改成响应式',
    budgetType: 'fixed', budgetMin: 300, budgetMax: null,
    status: 'in_progress', statusLabel: '处理中',
    contactName: '张同学', contactMethod: '13800000000',
    createdAt: '2026-11-18T10:24:00', marketPostId: '',
  },
  {
    id: 'o-demo-0002', title: '学院活动报名小程序',
    budgetType: 'negotiable', budgetMin: null, budgetMax: null,
    status: 'pending', statusLabel: '待受理',
    contactName: '李同学', contactMethod: 'li@example.com',
    createdAt: '2026-11-19T15:02:00', marketPostId: 'mkt-9f2a',
  },
]

const filtered = computed(() => {
  let list = orders
  if (activeTab.value) list = list.filter(o => o.status === activeTab.value)
  if (onlyForwarded.value) list = list.filter(o => o.marketPostId)
  return list
})

function budgetText(o) {
  if (o.budgetType === 'negotiable' || !o.budgetMin) return '面议'
  if (o.budgetType === 'fixed') return `¥${o.budgetMin}`
  return `¥${o.budgetMin}-${o.budgetMax}`
}
</script>

<template>
  <div class="page">
    <header class="topbar">
      <h1>管理台</h1>
      <button class="btn ghost sm">刷新</button>
    </header>

    <div class="tabs admin-tabs">
      <button
        v-for="t in tabs"
        :key="t.value"
        type="button"
        :class="{ active: activeTab === t.value }"
        @click="activeTab = t.value"
      >{{ t.label }}</button>
      <button
        type="button"
        class="fwd-toggle"
        :class="{ active: onlyForwarded }"
        @click="onlyForwarded = !onlyForwarded"
      >已转发集市</button>
    </div>

    <div v-if="filtered.length" class="card-list">
      <div
        v-for="o in filtered"
        :key="o.id"
        class="admin-row-card panel"
        @click="router.push({ name: 'detail', params: { id: o.id } })"
      >
        <div class="arc__top">
          <span class="order-status" :class="`st-${o.status}`">{{ o.statusLabel }}</span>
          <span class="arc__budget">{{ budgetText(o) }}</span>
          <span v-if="o.marketPostId" class="arc__fwd">集市 {{ o.marketPostId.slice(0, 8) }}</span>
        </div>
        <h3 class="arc__title">{{ o.title }}</h3>
        <div class="arc__meta">
          <span>{{ o.contactName }}</span>
          <span>{{ o.contactMethod }}</span>
          <span>{{ (o.createdAt || '').slice(0, 10) }}</span>
        </div>
      </div>
    </div>

    <div v-else class="empty-state empty-state--list">
      <h3>没有符合条件的订单</h3>
    </div>
  </div>
</template>

<style scoped>
.tabs {
  display: flex;
  gap: 6px;
  margin-bottom: 16px;
  overflow-x: auto;
  align-items: center;
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

.admin-row-card {
  cursor: pointer;
}

.arc__top {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}

.arc__budget {
  font-size: 15px;
  font-weight: 600;
}

.arc__fwd {
  font-size: 11.5px;
  color: var(--success);
}

.arc__title {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 8px;
}

.arc__meta {
  display: flex;
  gap: 16px;
  font-size: 12.5px;
  color: var(--text-muted);
}
</style>
