<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { fetchQuestList } from '../api/quest'
import { useUserStore } from '../stores/user'
import QuestCard from '../components/QuestCard.vue'
import QuestDetail from '../components/QuestDetail.vue'

// 顶部分类：对齐京东 / BOSS 直聘的「一行可横滑的分类 tab」
const CATEGORY_TABS = [
  { value: 'all', label: '全部' },
  { value: 'frontend', label: '前端' },
  { value: 'backend', label: '后端' },
  { value: 'design', label: '设计' },
  { value: 'writing', label: '文案' },
  { value: 'data', label: '数据' },
  { value: 'qa', label: '答疑' },
  { value: 'other', label: '其他' },
]

// 真实后端暂时没给分类字段时，用标题/正文关键词兜底归类，保证每个 tab 都是真筛选
const CATEGORY_RULES = [
  ['frontend', /vue|react|html|css|javascript|typescript|网页|页面|前端|切图|小程序|静态页/i],
  ['backend', /java|c\s*语言|链表|python|爬虫|数据库|er图|sql|多线程|编译原理|ll\(1\)|后端|服务器|接口|算法|死锁/i],
  ['design', /figma|设计稿|海报|ui|封面|ps|视觉|配色|切图/i],
  ['writing', /文案|雅思|英语|presentation|口语|翻译|写作|论文|简历/i],
  ['data', /excel|统计|数据分析|报表|数据集|爬虫/i],
  ['qa', /答疑|讲一下|帮我看|陪练|请教|课设|作业|看不懂/i],
]

const KIND_LABEL = { all: '类型', bounty: '悬赏', inquiry: '求助' }
const STATUS_LABELS = { all: '状态', open: '待接单', in_progress: '进行中', completed: '已完成' }

const route = useRoute()
const router = useRouter()
const user = useUserStore()
const category = ref('all')
const tab = ref('all')
const keyword = ref('')
const sortMode = ref('time')
const status = ref('all')
const items = ref([])
const loading = ref(false)
const error = ref('')
const selectedID = ref(route.query.post ? Number(route.query.post) : null)
const isWide = ref(false)
const catScroll = ref(null)
const catOverflow = ref(false)
const catAtEnd = ref(false)
let mediaQuery
let searchTimer
let loadSeq = 0

// 学长指定的空态文案，一字不改
const EMPTY_TEXT = '当前需求均已进入对接状态，暂无待定需求'

const totalCount = computed(() => items.value.length)
const hasFilter = computed(() =>
  keyword.value.trim() !== ''
  || category.value !== 'all'
  || tab.value !== 'all'
  || sortMode.value !== 'time'
  || status.value !== 'all',
)
const priceLabel = computed(() =>
  sortMode.value === 'price_asc' ? '价格 ↑' : sortMode.value === 'price_desc' ? '价格 ↓' : '价格',
)

// 后端有 category 就按它归类；没有就按标题/正文推断，不会变成点不动的假 tab
function categoryOf(post) {
  const own = String(post?.category || '').trim()
  if (own) {
    const hit = CATEGORY_TABS.find(c => c.value === own || c.label === own)
    if (hit)
      return hit.value
  }
  const text = `${post?.title || ''} ${post?.content || ''}`
  for (const [value, re] of CATEGORY_RULES) {
    if (re.test(text))
      return value
  }
  return 'other'
}

function cyclePrice() {
  sortMode.value = sortMode.value === 'time'
    ? 'price_asc'
    : sortMode.value === 'price_asc' ? 'price_desc' : 'time'
}

function cycleKind() {
  tab.value = tab.value === 'all' ? 'bounty' : tab.value === 'bounty' ? 'inquiry' : 'all'
}

function cycleStatus() {
  const order = ['all', 'open', 'in_progress', 'completed']
  status.value = order[(order.indexOf(status.value) + 1) % order.length]
}

// 只有这排真的放不下时才显示渐隐和箭头；桌面一屏放得下就不留点不动的假按钮
function syncCatState() {
  const box = catScroll.value
  if (!box)
    return
  const max = box.scrollWidth - box.clientWidth
  catOverflow.value = max > 5
  catAtEnd.value = box.scrollLeft >= max - 2
}

function keepActiveVisible() {
  const box = catScroll.value
  const btn = box?.querySelector('.cat-tabs__btn.active')
  if (box && btn) {
    const left = btn.offsetLeft - (box.clientWidth - btn.offsetWidth) / 2
    box.scrollLeft = Math.max(0, left)
  }
  syncCatState()
}

function scrollMore() {
  const box = catScroll.value
  if (!box)
    return
  const max = box.scrollWidth - box.clientWidth
  if (max <= 5)
    return
  box.scrollLeft = box.scrollLeft >= max - 2 ? 0 : Math.min(box.scrollLeft + 160, max)
  catAtEnd.value = box.scrollLeft >= max - 2
}

function pickCategory(v) {
  category.value = v
  nextTick(keepActiveVisible)
}

function syncWidth() {
  isWide.value = mediaQuery?.matches ?? false
}

function ensureSelection() {
  if (!items.value.length) {
    selectedID.value = null
    return
  }
  if (!items.value.some(p => p.postID === selectedID.value))
    selectedID.value = items.value[0].postID
}

async function load() {
  // 多次筛选变更可能并发发请求，只认最后一次的结果，避免旧数据盖掉新数据
  const seq = ++loadSeq
  loading.value = true
  error.value = ''
  try {
    await user.refreshMe()
    const params = {
      kind: tab.value,
      keyword: keyword.value.trim(),
      sort: sortMode.value,
    }
    if (status.value !== 'all')
      params.status = status.value
    const res = await fetchQuestList(params)
    if (seq !== loadSeq)
      return
    let list = Array.isArray(res?.items) ? res.items : []
    if (category.value !== 'all')
      list = list.filter(p => categoryOf(p) === category.value)
    items.value = list
    ensureSelection()
  }
  catch (e) {
    if (seq !== loadSeq)
      return
    items.value = []
    selectedID.value = null
    error.value = e?.message || '需求加载失败，请稍后重试'
  }
  finally {
    if (seq === loadSeq)
      loading.value = false
  }
}

function resetFilters() {
  keyword.value = ''
  category.value = 'all'
  tab.value = 'all'
  sortMode.value = 'time'
  status.value = 'all'
  nextTick(keepActiveVisible)
}

function select(p) {
  if (!isWide.value) {
    router.push({ name: 'detail', params: { id: p.postID } })
    return
  }
  selectedID.value = p.postID
  router.replace({ query: { ...route.query, post: String(p.postID) } })
}

function onDeleted() {
  selectedID.value = null
  router.replace({ query: {} })
  load()
}

watch(keyword, () => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(load, 400)
})

watch([category, tab, sortMode, status], load)

onMounted(() => {
  mediaQuery = window.matchMedia('(min-width: 768px)')
  syncWidth()
  mediaQuery.addEventListener('change', syncWidth)
  load()
  nextTick(() => {
    keepActiveVisible()
    syncCatState()
  })
  window.addEventListener('resize', syncCatState)
})

onUnmounted(() => {
  clearTimeout(searchTimer)
  mediaQuery?.removeEventListener('change', syncWidth)
  window.removeEventListener('resize', syncCatState)
})
</script>

<template>
  <div class="page list-page">
    <div class="list-toolbar">
      <div class="search-wrap">
        <input
          v-model="keyword"
          class="search-input"
          type="search"
          placeholder="搜索课程、语言、技能…"
        >
      </div>
      <!-- 排序条：京东式一行；价格是单键循环切换 综合 → 低到高 → 高到低 -->
      <div class="sort-bar">
        <button
          type="button"
          class="sort-bar__btn"
          :class="{ active: sortMode === 'time' }"
          @click="sortMode = 'time'"
        >综合</button>
        <button
          type="button"
          class="sort-bar__btn"
          :class="{ active: sortMode !== 'time' }"
          :title="priceLabel"
          @click="cyclePrice"
        >{{ priceLabel }}</button>
        <button
          type="button"
          class="sort-bar__btn"
          :class="{ active: tab !== 'all' }"
          @click="cycleKind"
        >{{ KIND_LABEL[tab] }}</button>
        <button
          type="button"
          class="sort-bar__btn"
          :class="{ active: status !== 'all' }"
          @click="cycleStatus"
        >{{ STATUS_LABELS[status] }}</button>
      </div>
    </div>

    <!-- 分类 tab：单行横向可滑，右侧渐隐 + 箭头是「还能往右看」的可见提示 -->
    <div class="cat-tabs">
      <div ref="catScroll" class="cat-tabs__scroll" @scroll="syncCatState">
        <button
          v-for="c in CATEGORY_TABS"
          :key="c.value"
          type="button"
          class="cat-tabs__btn"
          :class="{ active: category === c.value }"
          @click="pickCategory(c.value)"
        >{{ c.label }}</button>
      </div>
      <div v-if="catOverflow" class="cat-tabs__fade">
        <button
          type="button"
          class="cat-tabs__more"
          :aria-label="catAtEnd ? '回到分类开头' : '查看更多分类'"
          @click="scrollMore"
        >{{ catAtEnd ? '‹' : '›' }}</button>
      </div>
    </div>

    <div class="board">
      <aside class="board__left">
        <div class="board__head">
          <strong>需求列表</strong>
          <span>共 {{ totalCount }} 条</span>
        </div>

        <p v-if="loading" class="status">正在加载需求…</p>
        <div v-else-if="error" class="list-notice">
          <p class="error">{{ error }}</p>
          <button type="button" class="btn ghost sm" @click="load">重新加载</button>
        </div>
        <div v-else-if="!items.length" class="empty-state empty-state--list">
          <p class="empty-state__lead">{{ EMPTY_TEXT }}</p>
          <p v-if="hasFilter" class="empty-state__hint">当前筛选条件下没有匹配结果。</p>
          <div class="empty-state__actions">
            <button v-if="hasFilter" type="button" class="btn ghost sm" @click="resetFilters">清空筛选</button>
            <button type="button" class="btn primary sm" @click="router.push({ name: 'create' })">
              发布需求
            </button>
          </div>
        </div>
        <div v-else class="card-list">
          <div
            v-for="p in items"
            :key="p.postID"
            class="card-wrap"
            :class="{ selected: isWide && p.postID === selectedID }"
            @click="select(p)"
          >
            <QuestCard :post="p" />
          </div>
        </div>
      </aside>

      <section v-if="isWide" class="board__right">
        <QuestDetail
          v-if="selectedID"
          :id="selectedID"
          @updated="load"
          @deleted="onDeleted"
        />
        <div v-else class="board__placeholder">
          <template v-if="error">
            <strong>需求列表没能加载出来</strong>
            <p>{{ error }}，点左侧「重新加载」再试一次。</p>
          </template>
          <template v-else-if="loading">
            <strong>正在加载需求</strong>
            <p>加载完成后，这里会显示第一条需求的完整详情。</p>
          </template>
          <template v-else>
            <strong>{{ EMPTY_TEXT }}</strong>
            <p>可以发布一条新需求，或清空筛选条件再看看。</p>
          </template>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.empty-state--list {
  padding: 44px 14px;
  text-align: left;
}
.empty-state--list .empty-state__lead {
  margin: 0 0 8px;
  font-size: 15px;
  font-weight: 600;
  line-height: 1.7;
  color: var(--text);
}
.empty-state--list .empty-state__hint {
  margin: 0 0 16px;
  font-size: 13px;
  color: var(--text-muted);
}
.empty-state__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.list-notice {
  padding: 28px 14px;
}
.list-notice .error {
  margin: 0 0 12px;
}
</style>
