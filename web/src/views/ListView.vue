<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { fetchQuestList } from '../api/quest'
import { useUserStore } from '../stores/user'
import QuestCard from '../components/QuestCard.vue'

const STATUS_CHIPS = [
  { value: 'all', label: '全部' },
  { value: 'open', label: '待接单' },
  { value: 'in_progress', label: '进行中' },
  { value: 'completed', label: '已完成' },
]

const SORT_OPTIONS = [
  { value: 'time', label: '最新发布' },
  { value: 'price_desc', label: '金额从高到低' },
  { value: 'price_asc', label: '金额从低到高' },
]

const router = useRouter()
const user = useUserStore()
const tab = ref('all')
const keyword = ref('')
const sort = ref('time')
const status = ref('all')
const showStatus = ref(false)
const items = ref([])
const loading = ref(false)
const error = ref('')

const bountyOnly = computed(() => tab.value === 'bounty')
const sortLabel = computed(() =>
  SORT_OPTIONS.find(o => o.value === sort.value)?.label || '最新发布',
)

async function load() {
  loading.value = true
  error.value = ''
  try {
    await user.refreshMe()
    const params = {
      kind: tab.value,
      keyword: keyword.value.trim(),
      sort: sort.value,
    }
    if (bountyOnly.value)
      params.status = status.value
    const res = await fetchQuestList(params)
    items.value = res.items
  }
  catch (e) {
    error.value = e.message
  }
  finally {
    loading.value = false
  }
}

let searchTimer
watch(keyword, () => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(load, 400)
})

watch(tab, (v) => {
  if (v !== 'bounty') {
    status.value = 'all'
    showStatus.value = false
  }
  load()
})

watch([sort, status], load)
onMounted(load)

function cycleSort() {
  const i = SORT_OPTIONS.findIndex(o => o.value === sort.value)
  sort.value = SORT_OPTIONS[(i + 1) % SORT_OPTIONS.length].value
}

function openPost(id) {
  router.push({ name: 'detail', params: { id } })
}
</script>

<template>
  <div class="page list-page">
    <div class="tabs">
      <button type="button" :class="{ active: tab === 'all' }" @click="tab = 'all'">全部</button>
      <button type="button" :class="{ active: tab === 'bounty' }" @click="tab = 'bounty'">悬赏</button>
      <button type="button" :class="{ active: tab === 'inquiry' }" @click="tab = 'inquiry'">求助</button>
    </div>

    <div class="filter-bar">
      <div class="search-wrap">
        <input
          v-model="keyword"
          class="search-input"
          type="search"
          placeholder="搜索课程、语言、技能…"
        >
      </div>
      <div class="filter-row">
        <button type="button" class="sort-text" @click="cycleSort">
          {{ sortLabel }}
          <span class="sort-text__arrow" aria-hidden="true">▾</span>
        </button>
        <button
          v-if="bountyOnly"
          type="button"
          class="sort-text"
          @click="showStatus = !showStatus"
        >
          {{ showStatus ? '收起' : '状态' }}
        </button>
      </div>
      <div v-if="bountyOnly && showStatus" class="chip-row">
        <button
          v-for="c in STATUS_CHIPS"
          :key="c.value"
          type="button"
          class="chip"
          :class="{ active: status === c.value }"
          @click="status = c.value"
        >
          {{ c.label }}
        </button>
      </div>
    </div>

    <p v-if="loading" class="status">加载中…</p>
    <p v-else-if="error" class="error">{{ error }}</p>
    <div v-else-if="!items.length" class="empty-state empty-state--list">
      <h3>还没有需求</h3>
      <p>换个关键词，或直接发布第一条</p>
      <button type="button" class="btn primary" @click="router.push({ name: 'create' })">
        发布需求
      </button>
    </div>
    <div v-else class="card-list">
      <div v-for="p in items" :key="p.postID" class="card-wrap" @click="openPost(p.postID)">
        <QuestCard :post="p" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.filter-row {
  justify-content: flex-end;
  gap: 16px;
}
.sort-text {
  border: none;
  background: none;
  padding: 0;
  font: inherit;
  font-size: 12px;
  color: var(--text-muted);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.sort-text__arrow {
  font-size: 10px;
  line-height: 1;
}
.empty-state--list {
  padding: 72px 16px 64px;
  text-align: center;
}
.empty-state--list h3 {
  font-size: 14.5px;
  font-weight: 500;
  color: var(--text);
  margin: 0 0 8px;
}
.empty-state--list p {
  font-size: 12px;
  color: var(--text-muted);
  margin: 0 0 20px;
}
</style>
