<script setup>
import { ref, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'

const props = defineProps({ id: { type: String, required: true } })
const router = useRouter()
const route = useRoute()

// 静态还原：演示数据
const order = {
  id: props.id,
  title: '课程设计前端页面改成响应式',
  content: '用 Vue 写的课程设计，手机上排版全乱了。希望有人帮我改造成响应式布局，要求适配常见的手机尺寸，保留原有功能。',
  budgetType: 'fixed',
  budgetMin: 300,
  budgetMax: null,
  contactName: '张同学',
  contactMethod: '13800000000',
  expectDate: '2026-12-10',
  ownerEmail: 'zhang@example.com',
  ownerName: '张同学',
  status: 'in_progress',
  statusLabel: '处理中',
  marketPostId: '',
  marketPostBy: '',
  createdAt: '2026-11-18T10:24:00',
}

const events = [
  { id: 1, type: 'create', status: 'pending', statusLabel: '待受理', note: '需求已提交', actorAdmin: false, created: '2026-11-18T10:24:00' },
  { id: 2, type: 'status', status: 'accepted', statusLabel: '已受理', note: '已受理', actorAdmin: true, created: '2026-11-18T14:30:00' },
  { id: 3, type: 'status', status: 'in_progress', statusLabel: '处理中', note: '开发同学已开始处理', actorAdmin: true, created: '2026-11-19T09:12:00' },
]

const statusOptions = [
  { value: 'pending', label: '待受理' },
  { value: 'accepted', label: '已受理' },
  { value: 'in_progress', label: '处理中' },
  { value: 'done', label: '已完成' },
  { value: 'closed', label: '已关闭' },
]

const viewerIsAdmin = ref(true)
const selectedStatus = ref(order.status)
const note = ref('')

const budgetText = computed(() => {
  if (order.budgetType === 'negotiable' || !order.budgetMin) return '面议'
  if (order.budgetType === 'fixed') return `¥${order.budgetMin}`
  return `¥${order.budgetMin} - ${order.budgetMax}`
})

function eventIcon(type) {
  if (type === 'forward') return '⇗'
  if (type === 'status') return '✓'
  return '＋'
}

function eventLabel(e) {
  if (e.type === 'create') return '需求提交'
  if (e.type === 'forward') return '转发集市'
  return e.statusLabel || '状态更新'
}
</script>

<template>
  <div class="page">
    <header class="topbar">
      <h1>需求详情</h1>
      <button class="btn ghost sm" @click="router.back()">返回</button>
    </header>

    <div class="panel order-head">
      <div class="order-head__row">
        <span class="order-status" :class="`st-${order.status}`">{{ order.statusLabel }}</span>
        <span class="order-head__budget">{{ budgetText }}</span>
      </div>
      <h2>{{ order.title }}</h2>
      <div class="order-head__meta">
        <span>单号 {{ order.id }}</span>
        <span>提交于 {{ (order.createdAt || '').replace('T', ' ').slice(0, 16) }}</span>
      </div>
    </div>

    <div class="panel">
      <h3 class="sec-title">需求描述</h3>
      <p class="order-content">{{ order.content }}</p>

      <h3 class="sec-title">联系信息</h3>
      <div class="meta-grid">
        <div>
          <span>称呼</span>
          <b>{{ order.contactName }}</b>
        </div>
        <div>
          <span>联系方式</span>
          <b>{{ order.contactMethod }}</b>
        </div>
        <div v-if="order.expectDate">
          <span>期望完成</span>
          <b>{{ order.expectDate }}</b>
        </div>
        <div v-if="viewerIsAdmin">
          <span>甲方</span>
          <b>{{ order.ownerName || order.ownerEmail }}</b>
        </div>
      </div>

      <div v-if="order.marketPostId" class="fwd-box">
        已转发软工集市 · 帖子 {{ order.marketPostId }}
        <a :href="`https://ssemarket.cn/#/post/${order.marketPostId}`" target="_blank" rel="noopener">查看帖子</a>
      </div>
    </div>

    <div v-if="viewerIsAdmin" class="panel admin-panel">
      <h3 class="sec-title">处理订单</h3>
      <div class="admin-row">
        <select v-model="selectedStatus" class="admin-select">
          <option v-for="s in statusOptions" :key="s.value" :value="s.value">{{ s.label }}</option>
        </select>
        <button class="btn primary sm">更新状态</button>
      </div>
      <textarea v-model="note" rows="2" class="admin-note" placeholder="处理备注（甲方可见，可留空）"></textarea>
      <div class="fwd-actions">
        <button class="btn ghost sm">转发集市（官方账号）</button>
        <button class="btn ghost sm">转发集市（我的账号）</button>
      </div>
    </div>

    <div class="panel">
      <h3 class="sec-title">处理进度</h3>
      <ol class="timeline">
        <li
          v-for="e in events"
          :key="e.id"
          class="timeline__item"
          :class="{ admin: e.actorAdmin }"
        >
          <span class="timeline__dot">{{ eventIcon(e.type) }}</span>
          <div class="timeline__body">
            <p class="timeline__label">
              {{ eventLabel(e) }}
              <span v-if="e.actorAdmin" class="timeline__who">工作室</span>
            </p>
            <p v-if="e.note" class="timeline__note">{{ e.note }}</p>
            <p class="timeline__time">{{ (e.created || '').replace('T', ' ').slice(0, 16) }}</p>
          </div>
        </li>
      </ol>
    </div>
  </div>
</template>

<style scoped>
.order-head h2 {
  font-size: 20px;
  font-weight: 700;
  margin: 10px 0;
}

.order-head__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.order-head__budget {
  font-size: 18px;
  font-weight: 600;
}

.order-head__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  font-size: 12.5px;
  color: var(--text-muted);
}

.sec-title {
  font-size: 14px;
  font-weight: 600;
  margin: 0 0 12px;
}

.sec-title:not(:first-child) {
  margin-top: 24px;
}

.order-content {
  font-size: 14px;
  line-height: 1.8;
  white-space: pre-wrap;
}

.meta-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.meta-grid div {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.meta-grid span {
  font-size: 12px;
  color: var(--text-muted);
}

.meta-grid b {
  font-size: 14px;
  font-weight: 500;
}

.fwd-box {
  margin-top: 20px;
  padding: 12px 14px;
  border-radius: var(--radius);
  background: #eef4ff;
  color: var(--brand);
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.fwd-box a {
  text-decoration: underline;
}

.admin-row {
  display: flex;
  gap: 10px;
  margin-bottom: 10px;
}

.admin-note {
  width: 100%;
  margin-bottom: 14px;
}

.fwd-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.timeline {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.timeline__item {
  display: flex;
  gap: 12px;
}

.timeline__dot {
  flex-shrink: 0;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--accent-soft);
  color: var(--accent);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
}

.timeline__item.admin .timeline__dot {
  background: #eef4ff;
  color: var(--brand);
}

.timeline__label {
  font-size: 14px;
  font-weight: 500;
}

.timeline__who {
  font-size: 11.5px;
  color: var(--brand);
  margin-left: 6px;
}

.timeline__note {
  font-size: 13px;
  color: var(--text-muted);
  margin-top: 4px;
}

.timeline__time {
  font-size: 11.5px;
  color: var(--text-muted);
  margin-top: 4px;
}

@media (max-width: 560px) {
  .meta-grid {
    grid-template-columns: 1fr;
  }
}
</style>
