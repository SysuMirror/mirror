<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { fetchQuestList } from '../api/quest'
import { useUserStore } from '../stores/user'
import { formatPrice, relativeTime, statCount, STATUS_LABEL } from '../utils/display'

// 对齐 BOSS 直聘「职位管理」：状态 tab + 职位卡列表 + 右侧两列数据
const STATUS_TABS = [
  { value: 'all', label: '全部需求' },
  { value: 'open', label: '开放中' },
  { value: 'in_progress', label: '进行中' },
  { value: 'completed', label: '已完成' },
  { value: 'cancelled', label: '已关闭' },
]

const router = useRouter()
const user = useUserStore()
const tab = ref('all')
const items = ref([])
const loading = ref(false)
const error = ref('')
let loadSeq = 0

const shown = computed(() => {
  if (tab.value === 'all')
    return items.value
  if (tab.value === 'in_progress')
    return items.value.filter(p => p.questStatus === 'in_progress' || p.questStatus === 'pending_confirm')
  return items.value.filter(p => p.questStatus === tab.value)
})

function countOf(value) {
  if (value === 'all')
    return items.value.length
  if (value === 'in_progress')
    return items.value.filter(p => p.questStatus === 'in_progress' || p.questStatus === 'pending_confirm').length
  return items.value.filter(p => p.questStatus === value).length
}

async function load() {
  const seq = ++loadSeq
  loading.value = true
  error.value = ''
  try {
    await user.refreshMe()
    const res = await fetchQuestList({ myPosts: true })
    if (seq !== loadSeq)
      return
    const all = Array.isArray(res?.items) ? res.items : []
    // 双保险：后端不认 myPosts 时，前端按发布者再过滤一次，不会把别人的帖子显示进来
    const myID = user.me?.userID
    items.value = myID == null
      ? all
      : all.filter(p => String(p.authorID) === String(myID))
  }
  catch (e) {
    if (seq !== loadSeq)
      return
    items.value = []
    error.value = e?.message || '需求列表加载失败，请稍后重试'
  }
  finally {
    if (seq === loadSeq)
      loading.value = false
  }
}

function openDetail(p) {
  router.push({ name: 'detail', params: { id: p.postID } })
}

onMounted(load)
</script>

<template>
  <div class="boss-page">
    <header class="boss-page__head">
      <div>
        <h1>需求管理</h1>
        <p>你发布的需求都在这里，能看到每条被浏览和沟通的情况。</p>
      </div>
      <button type="button" class="boss-refresh" title="刷新" @click="load">↻ 刷新</button>
    </header>

    <div class="boss-actions">
      <button type="button" class="boss-publish" @click="router.push('/create')">＋ 发布需求</button>
      <span class="boss-actions__count">共 {{ items.length }} 条</span>
    </div>

    <nav class="boss-tabs" aria-label="需求状态">
      <button
        v-for="t in STATUS_TABS"
        :key="t.value"
        type="button"
        :class="{ active: tab === t.value }"
        @click="tab = t.value"
      >{{ t.label }}<em v-if="countOf(t.value)">{{ countOf(t.value) }}</em></button>
    </nav>

    <p v-if="loading" class="boss-status">正在加载你发布的需求…</p>
    <div v-else-if="error" class="boss-notice">
      <p class="error">{{ error }}</p>
      <button type="button" class="btn ghost sm" @click="load">重新加载</button>
    </div>
    <div v-else-if="!shown.length" class="boss-empty">
      <template v-if="tab === 'all'">
        <strong>你还没有发布过需求</strong>
        <p>点上面的「＋ 发布需求」发第一条，发布后这里就能看到浏览和沟通数据。</p>
        <button type="button" class="boss-publish" @click="router.push('/create')">＋ 发布需求</button>
      </template>
      <template v-else>
        <strong>当前状态下没有需求</strong>
        <p>切到「全部需求」看看其它状态，或者发布一条新需求。</p>
        <button type="button" class="btn ghost sm" @click="tab = 'all'">看全部需求</button>
      </template>
    </div>

    <div v-else class="boss-joblist">
      <article
        v-for="p in shown"
        :key="p.postID"
        class="boss-job"
        @click="openDetail(p)"
      >
        <div class="boss-job__main">
          <div class="boss-job__titleline">
            <h3>{{ p.title || '未命名需求' }}</h3>
            <span class="boss-job__kind" :class="p.postKind">{{ p.postKind === 'bounty' ? '赏' : '助' }}</span>
          </div>
          <div class="boss-job__tags">
            <span>{{ p.postKind === 'bounty' ? '悬赏任务' : '纯求助' }}</span>
            <i />
            <span>{{ p.postKind === 'bounty' ? formatPrice(p) : '无悬赏' }}</span>
            <i />
            <span>{{ STATUS_LABEL[p.questStatus] || '待接单' }}</span>
            <i />
            <span>{{ relativeTime(p.postTime) }}发布</span>
          </div>
        </div>
        <div class="boss-job__stats">
          <div class="boss-job__stat">
            <strong>{{ statCount(p.viewCount) }}</strong>
            <span>浏览</span>
          </div>
          <div class="boss-job__stat">
            <strong>{{ statCount(p.chatCount) }}</strong>
            <span>沟通</span>
          </div>
        </div>
      </article>
    </div>

    <p class="boss-footnote">浏览数在点开别人需求详情后累加，沟通数在从需求发起私聊后累加；同一账号不会重复计数，回到本页刷新即可看到最新值。</p>
  </div>
</template>
