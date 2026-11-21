<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'

const emit = defineEmits(['update:active'])

const marketHome = '/assets/market-home.webp'
const marketWorkbench = '/assets/market-workbench.webp'
const iwiki = '/assets/iwiki.webp'
const sseinfra = '/assets/sseinfra.webp'

const slides = [
  {
    tag: '核心产品',
    name: 'SSE Market 软工集市',
    desc: '中山大学软件工程学院的校园集市。需求发布、组队协作、作品交易都在这里发生，是整个技术生态的第一块基石。',
    chips: ['需求发布', '组队协作', '作品交易', '排行榜'],
    stats: [{ label: '注册用户', value: '1000+' }, { label: '稳定运行', value: '3 年' }],
    image: 'dual-phone',
    images: [marketHome, marketWorkbench],
    alt: 'SSE Market 集市主站与工作台界面',
  },
  {
    tag: '知识沉淀',
    name: 'iWiki 知识库',
    desc: '中山大学软件工程学院的知识库。课程笔记、工程文档与项目复盘在这里沉淀，让每一届同学的经验都能被下一届接住。',
    chips: ['课程笔记', '工程文档', '项目复盘', '全文检索'],
    stats: [{ label: '学院共建', value: '持续更新' }, { label: '内容形态', value: '文档 · Wiki' }],
    image: 'single',
    images: [iwiki],
    alt: 'iWiki 知识库界面',
  },
  {
    tag: '算力底座',
    name: '集市云',
    desc: '团队自研的服务器资源管理面板，统一调度 GPU 算力与容器资源，为模型服务与各子平台供给底座算力。',
    chips: ['GPU 调度', '容器编排', '资源监控'],
    stats: [{ label: 'GPU 集群', value: '3 × RTX 4090' }, { label: 'AI 超算', value: 'DGX Spark 128GB' }],
    image: 'single',
    images: [sseinfra],
    alt: '集市云资源管理面板界面',
  },
]

const idx = ref(0)
const playing = ref(true)
let timer = null

const counter = computed(
  () => `${String(idx.value + 1).padStart(2, '0')} / ${String(slides.length).padStart(2, '0')}`,
)

const reducedMotion =
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

function goTo(n) {
  idx.value = ((n % slides.length) + slides.length) % slides.length
}
function next() { goTo(idx.value + 1) }
function prev() { goTo(idx.value - 1) }
function start() {
  if (reducedMotion) return
  playing.value = true
  stop()
  timer = setInterval(next, 6000)
}
function stop() {
  playing.value = false
  clearInterval(timer)
}
onMounted(start)
onBeforeUnmount(() => clearInterval(timer))

// 板块切换驱动背景高亮：内部 index 变化时对外 emit
watch(idx, v => emit('update:active', v), { immediate: true })
</script>

<template>
  <div
    class="carousel"
    @mouseenter="stop"
    @mouseleave="start"
    @focusin="stop"
    @focusout="start"
    @keydown.left.prevent="prev"
    @keydown.right.prevent="next"
  >
    <div class="carousel__track" :style="{ transform: `translateX(-${idx * 100}%)` }">
      <div
        v-for="(s, i) in slides"
        :key="s.name"
        class="carousel__slide"
        :class="{ 'carousel__slide--active': i === idx }"
        :aria-hidden="i !== idx"
      >
        <div class="carousel__visual" :class="`carousel__visual--${s.image}`">
          <template v-if="s.image === 'dual-phone'">
            <img
              v-for="(src, k) in s.images"
              :key="k"
              class="carousel__shot carousel__shot--phone"
              :class="{ 'carousel__shot--back': k === 0 }"
              :src="src"
              :alt="s.alt"
              decoding="async"
            />
          </template>
          <img v-else class="carousel__shot carousel__shot--panel" :src="s.images[0]" :alt="s.alt" decoding="async" />
        </div>

        <div class="carousel__info">
          <div class="carousel__head fx" style="--d:0.04s">
            <span class="carousel__tag">{{ s.tag }}</span>
            <span class="carousel__counter">{{ counter }}</span>
          </div>
          <h3 class="carousel__name fx" style="--d:0.12s">{{ s.name }}</h3>
          <p class="carousel__desc fx" style="--d:0.2s">{{ s.desc }}</p>
          <ul class="carousel__chips fx" style="--d:0.28s">
            <li v-for="c in s.chips" :key="c">{{ c }}</li>
          </ul>
          <dl class="carousel__stats fx" style="--d:0.36s">
            <div v-for="st in s.stats" :key="st.label" class="carousel__stat">
              <dt>{{ st.label }}</dt>
              <dd>{{ st.value }}</dd>
            </div>
          </dl>
        </div>
      </div>
    </div>

    <div class="carousel__controls">
      <div class="carousel__dots" role="tablist" aria-label="平台切换">
        <button
          v-for="(s, i) in slides"
          :key="s.name"
          type="button"
          role="tab"
          class="carousel__dot"
          :class="{ 'carousel__dot--on': i === idx }"
          :aria-selected="i === idx"
          :aria-label="`查看 ${s.name}`"
          @click="goTo(i)"
        />
      </div>
      <div class="carousel__arrows">
        <button type="button" class="carousel__arrow" aria-label="上一个" @click="prev">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6" /></svg>
        </button>
        <button type="button" class="carousel__arrow" aria-label="下一个" @click="next">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 6l6 6-6 6" /></svg>
        </button>
      </div>
    </div>
  </div>
</template>
