<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import ParticleField from '../components/ParticleField.vue'
import ServiceList from '../components/ServiceList.vue'

const marketHome = '/assets/market-home.webp'
const marketWorkbench = '/assets/market-workbench.webp'
const iwiki = '/assets/iwiki.webp'
const sseinfra = '/assets/sseinfra.webp'
const threatMap = '/assets/threat-map.webp'
const architecture = '/assets/architecture.webp'

/* ---------- 生态轮播 ---------- */
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

/* ---------- 攻防态势带：滚动视差 ---------- */
const threatEl = ref(null)
let raf = 0
let ticking = false
let cleanup = null

onMounted(() => {
  if (reducedMotion) return
  function onScroll() {
    if (ticking || !threatEl.value) return
    ticking = true
    raf = requestAnimationFrame(() => {
      ticking = false
      const r = threatEl.value.getBoundingClientRect()
      const vh = window.innerHeight
      const y = Math.min(1, Math.max(0, (vh - r.top) / (vh + r.height)))
      threatEl.value.style.transform = `translateY(${(y - 0.5) * -32}px) scale(1.06)`
    })
  }
  window.addEventListener('scroll', onScroll, { passive: true })
  onScroll()
  cleanup = () => {
    window.removeEventListener('scroll', onScroll)
    cancelAnimationFrame(raf)
  }
})
onBeforeUnmount(() => cleanup?.())

/* ---------- 技术底座三能力 ---------- */
const capabilities = [
  { name: '统一身份鉴权', desc: 'UniSSO 打通全部子平台，一次登录即可使用集市、知识库与云平台。' },
  { name: '部署调度中枢', desc: '自研 Deploy 体系覆盖从代码到上线的全流程，子平台按需部署、灰度发布。' },
  { name: '算力中转', desc: '集市云统一管理 GPU 与容器算力，为模型服务与业务平台提供底座支撑。' },
]
</script>

<template>
  <div class="site-page">
    <!-- 门户首屏 -->
    <section class="hero">
      <div class="hero-grid" aria-hidden="true"></div>
      <ParticleField />
      <div class="site-shell">
        <div class="orbit-corner" aria-hidden="true">
          <svg viewBox="0 0 1000 1000" fill="none">
            <circle class="oc__ring oc__ring--dashed" cx="500" cy="500" r="492" />
            <circle class="oc__ring" cx="500" cy="500" r="420" />
            <circle class="oc__ring oc__ring--faint" cx="500" cy="500" r="330" />
            <circle class="oc__arc" cx="500" cy="500" r="420" pathLength="100" stroke-dasharray="11 89" />
            <circle class="oc__arc oc__arc--reverse" cx="500" cy="500" r="330" pathLength="100" stroke-dasharray="8 92" stroke-dashoffset="40" />
            <g class="oc__spin oc__spin--main"><circle class="oc__node oc__node--accent" cx="500" cy="80" r="4" /></g>
            <g class="oc__spin oc__spin--inner">
              <circle class="oc__node" cx="500" cy="170" r="2.5" />
              <circle class="oc__node oc__node--tiny" cx="830" cy="500" r="2" />
            </g>
          </svg>
        </div>

        <p class="hero-sub hero-in hero-in--1">沕鉴工作室 · 校园技术服务平台</p>
        <h1 class="wordmark hero-in hero-in--2" data-text="沕鉴·Mirror">沕鉴·Mirror</h1>
        <p class="hero-desc hero-in hero-in--3">
          以自研 SSE Market 软工集市完整技术生态为核心底座，落地统一身份鉴权、任务调度、 算力中转等服务基础设施，为学生团队、校内院系与校企合作单位提供定制化系统开发与平台建设服务。
        </p>
        <div class="hero-actions hero-in hero-in--4">
          <RouterLink class="btn-hero btn-hero--primary" :to="{ name: 'home' }">进入需求广场</RouterLink>
          <RouterLink class="btn-hero btn-hero--ghost" :to="{ name: 'site-services' }">了解技术服务</RouterLink>
        </div>
      </div>
    </section>

    <!-- 生态 -->
    <section id="eco" class="site-section">
      <div class="site-shell">
        <header class="site-section__head" v-reveal>
          <h2 class="site-section__title">一套长出来的生态</h2>
          <p class="site-section__lead">
            集市主站、知识库、云平台与安全监测在同一底座上协同运行——它们不是拼装的开源方案， 而是团队从零构建、持续迭代的自研体系。
          </p>
        </header>

        <div v-reveal="80">
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
        </div>

        <div v-reveal="140">
          <figure class="threat">
            <img ref="threatEl" :src="threatMap" alt="平台实时攻防态势监测大屏" loading="lazy" decoding="async" />
          </figure>
        </div>
      </div>
    </section>

    <!-- 技术底座 -->
    <section id="foundation" class="site-section" style="background:var(--paper-2)">
      <div class="site-shell">
        <header class="site-section__head" v-reveal>
          <h2 class="site-section__title">技术底座</h2>
          <p class="site-section__lead">
            软工集市作为技术验证载体，沉淀出统一鉴权、部署调度与算力供给的基础设施， 支撑全部子平台运行，也是对外输出技术能力的来源。
          </p>
        </header>
        <div v-reveal="80">
          <div>
            <div class="foundation-panel">
              <img :src="architecture" alt="SSE Market 技术底座架构图：集市主站、UniSSO、Deploy 调度中枢与云基础设施" loading="lazy" decoding="async" />
            </div>
            <div class="capability-row">
              <div v-for="c in capabilities" :key="c.name" class="capability">
                <h3>{{ c.name }}</h3>
                <p>{{ c.desc }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- 服务 -->
    <section id="services" class="site-section">
      <div class="site-shell">
        <header class="site-section__head" v-reveal>
          <h2 class="site-section__title">把底座能力交给场景</h2>
          <p class="site-section__lead">
            无论是学生场景的数据可视化与平台工具，还是院系部门、校企合作单位的数字化系统， 团队具备从需求分析、架构设计到系统交付的完整工程实践能力，提供可靠的开发支持。
          </p>
        </header>
        <div v-reveal="80"><ServiceList /></div>
      </div>
    </section>

    <!-- 工作室 -->
    <section class="site-section site-section--dark">
      <div class="site-shell">
        <div class="about-body" v-reveal>
          <h2 class="site-section__title">沕鉴工作室</h2>
          <p>
            沕鉴·Mirror 校园技术服务平台由沕鉴工作室建设运营。我们在建设平台的过程中 锻炼形成梯队完整的全栈学生研发团队，让学生技术成果在真实场景中实现价值落地。
          </p>
          <p>
            未来将依托 Blue Hub 枢纽资源拓展合作渠道，打磨标准化服务流程， 持续迭代技术底座。
          </p>
          <div class="hero-actions" style="margin-top:32px">
            <RouterLink class="btn-hero btn-hero--primary" :to="{ name: 'site-about' }">关于我们</RouterLink>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
