<script setup>
import { ref, shallowRef, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { siteLinks } from '../router/siteLinks'
import ParticleField from '../components/ParticleField.vue'
import EcoPrism from '../components/EcoPrism.vue'
import EcoStarField from '../components/EcoStarField.vue'
import ServiceList from '../components/ServiceList.vue'

const router = useRouter()
const galaxy = ref(null)
const ecoStars = ref(null)
const heroCopy = ref(null)
const heroSequence = ref(null)
const heroStage = ref(null)
const galaxyMap = ref(null)
const revealCenter = shallowRef({ x: 0.5, y: 0.5 })
const scrollProgress = ref(0)
const heroTransitionStyle = computed(() => ({
  '--hero-veil-opacity': 1 - revealEase(scrollProgress.value, 0.86, 0.98),
  '--hero-glow-opacity': 1 - revealEase(scrollProgress.value, 0.21, 0.69),
  '--hero-copy-opacity': 1 - Math.min(1, scrollProgress.value * 2.5),
  '--hero-node-opacity': 1 - Math.min(1, scrollProgress.value * 3.2),
}))
const hoveredRegion = ref(null)
const hoveredNode = shallowRef(null)
const focusedNode = shallowRef(null)
const destination = shallowRef(null)
const activeNode = computed(() => destination.value || hoveredNode.value || focusedNode.value)
const positions = [
  { x: 0.27, y: 0.30 },
  { x: 0.72, y: 0.23 },
  { x: 0.78, y: 0.67 },
  { x: 0.31, y: 0.76 },
]
const galaxyNodes = siteLinks.map((link, index) => ({ ...link, ...positions[index] }))
const revealOutline = Array.from({ length: 44 }, (_, index) => {
  const angle = index / 44 * Math.PI * 2
  const roughness = 1 + Math.sin(angle * 3 + 0.6) * 0.13
    + Math.cos(angle * 7 - 0.8) * 0.075 + Math.sin(angle * 11) * 0.032
  return { x: Math.cos(angle) * roughness, y: Math.sin(angle) * roughness }
})
const heroRevealPath = computed(() => {
  const { x, y } = revealCenter.value
  const opening = revealEase(scrollProgress.value, 0.21, 0.94)
  const farthestCorner = Math.hypot(Math.max(x, 1 - x) / 0.91, Math.max(y, 1 - y) / 1.10)
  const radius = opening * farthestCorner * 1.42
  const points = revealOutline.map(point =>
    (x + point.x * radius * 0.91).toFixed(4) + ' ' + (y + point.y * radius * 1.10).toFixed(4),
  )
  return 'M ' + points.join(' L ') + ' Z'
})
const flightDuration = 900
let flightTimer
let scrollFrame = 0

function resetFlight() {
  window.clearTimeout(flightTimer)
  destination.value = null
  galaxy.value?.resetFlight()
}

function revealEase(progress, start, end) {
  const value = Math.max(0, Math.min(1, (progress - start) / (end - start)))
  return value * value * (3 - 2 * value)
}

function updateHeroScroll() {
  scrollFrame = 0
  const sequence = heroSequence.value
  const stage = heroStage.value
  const map = galaxyMap.value
  if (!sequence || !stage || !map) return
  const distance = Math.max(0, sequence.clientHeight - stage.offsetHeight)
  const covered = Math.min(distance, Math.max(0, -sequence.getBoundingClientRect().top))
  scrollProgress.value = distance ? covered / distance : 0
  if (!distance) return

  const viewport = stage.getBoundingClientRect()
  const field = map.getBoundingClientRect()
  const x = (field.left + field.width / 2 - viewport.left) / viewport.width
  const y = (field.top + field.height / 2 - viewport.top) / viewport.height
  if (revealCenter.value.x !== x || revealCenter.value.y !== y) revealCenter.value = { x, y }
}

function queueHeroScroll() {
  if (!scrollFrame) scrollFrame = requestAnimationFrame(updateHeroScroll)
}

function trackHeroRegion(event) {
  if (event.pointerType !== 'mouse' || !heroCopy.value) return
  const column = heroCopy.value.getBoundingClientRect()
  hoveredRegion.value = window.innerWidth <= 820 || event.clientX >= column.right ? 'galaxy' : 'copy'
}

function focusNode(event, node) {
  if (event.target.matches(':focus-visible')) focusedNode.value = node
}

function enterNode(event, node) {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
  event.preventDefault()
  if (destination.value) return
  if (!galaxy.value?.startFlight(node, flightDuration)) return router.push(node.to)

  destination.value = node
  if (node.to.hash === '#eco') ecoStars.value?.scatterFrom(galaxy.value.sampleNodeSparks(node), flightDuration)
  flightTimer = window.setTimeout(() => {
    router.push(node.to).finally(resetFlight)
  }, flightDuration)
}

watch(() => router.currentRoute.value.fullPath, () => {
  resetFlight()
  if (router.currentRoute.value.hash !== '#eco') ecoStars.value?.stop()
})
onMounted(() => {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
  window.addEventListener('scroll', queueHeroScroll, { passive: true })
  window.addEventListener('resize', queueHeroScroll)
  reducedMotion.addEventListener('change', queueHeroScroll)
  queueHeroScroll()
})
onBeforeUnmount(() => {
  resetFlight()
  cancelAnimationFrame(scrollFrame)
  window.removeEventListener('scroll', queueHeroScroll)
  window.removeEventListener('resize', queueHeroScroll)
  window.matchMedia('(prefers-reduced-motion: reduce)').removeEventListener('change', queueHeroScroll)
})

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

const productEntries = ref(null)
const frontProduct = ref(0)
const hoveredProductText = ref(null)
const hoveredProductImage = ref(null)
const focusedProduct = ref(null)
const selectedProduct = ref(null)
let mouseSelectedProduct = false
const previewProduct = computed(() =>
  hoveredProductText.value ?? hoveredProductImage.value ?? focusedProduct.value ?? selectedProduct.value,
)
const currentProduct = computed(() => previewProduct.value ?? frontProduct.value)

function focusProduct(event, index) {
  if (event.target.matches(':focus-visible')) focusedProduct.value = index
}

function selectProduct(index, event) {
  mouseSelectedProduct = event.pointerType === 'mouse'
  selectedProduct.value = selectedProduct.value === index ? null : index
}

function releaseMouseProduct(event) {
  if (event.pointerType === 'mouse' && mouseSelectedProduct) {
    selectedProduct.value = null
    mouseSelectedProduct = false
  }
}

function stepProduct(direction, event) {
  const index = currentProduct.value
  hoveredProductText.value = null
  hoveredProductImage.value = null
  focusedProduct.value = null
  mouseSelectedProduct = event.pointerType === 'mouse'
  selectedProduct.value = (index + direction + slides.length) % slides.length
}

function clearProductPreview() {
  mouseSelectedProduct = false
  hoveredProductText.value = null
  hoveredProductImage.value = null
  focusedProduct.value = null
  selectedProduct.value = null
}

let entriesVisible = false
let entriesHovered = false
let entriesFocused = false
let entriesFrame = 0
let entriesDirection = 1
let entriesPosition = 0
let entriesPreviousTime = 0
let entriesHoldUntil = 0
let entriesObserver
let entriesMotion

function animateProductEntries(time) {
  entriesFrame = 0
  const list = productEntries.value
  if (!list) return

  const bottom = list.scrollHeight - list.clientHeight
  if (bottom <= 1) return

  const elapsed = Math.min(36, Math.max(0, time - entriesPreviousTime))
  entriesPreviousTime = time
  if (time >= entriesHoldUntil) {
    entriesPosition = Math.max(0, Math.min(bottom, entriesPosition + entriesDirection * elapsed * 0.032))
    list.scrollTop = entriesPosition
    if (entriesPosition <= 0 || entriesPosition >= bottom) {
      entriesDirection = entriesPosition <= 0 ? 1 : -1
      entriesHoldUntil = time + 1400
    }
  }
  entriesFrame = requestAnimationFrame(animateProductEntries)
}

function refreshProductEntries() {
  cancelAnimationFrame(entriesFrame)
  entriesFrame = 0
  const list = productEntries.value
  if (!list || !entriesMotion?.matches || !entriesVisible || document.hidden
    || entriesHovered || entriesFocused || previewProduct.value !== null || scrollProgress.value < 0.85) return

  entriesPreviousTime = performance.now()
  entriesHoldUntil = entriesPreviousTime + 1200
  entriesPosition = list.scrollTop
  entriesFrame = requestAnimationFrame(animateProductEntries)
}

function setEntriesHovered(event, hovered) {
  if (event.pointerType !== 'mouse') return
  entriesHovered = hovered
  refreshProductEntries()
}

function trackEntriesFocus(event) {
  entriesFocused = event.type === 'focusin' || event.currentTarget.contains(event.relatedTarget)
  refreshProductEntries()
}

watch([previewProduct, () => scrollProgress.value >= 0.85], refreshProductEntries)

onMounted(() => {
  entriesMotion = window.matchMedia('(min-width: 821px) and (prefers-reduced-motion: no-preference)')
  entriesMotion.addEventListener('change', refreshProductEntries)
  document.addEventListener('visibilitychange', refreshProductEntries)
  window.addEventListener('resize', refreshProductEntries)
  entriesObserver = new IntersectionObserver(([entry]) => {
    entriesVisible = entry.intersectionRatio >= 0.35
    refreshProductEntries()
  }, { threshold: 0.35 })
  entriesObserver.observe(productEntries.value)
})
onBeforeUnmount(() => {
  cancelAnimationFrame(entriesFrame)
  entriesObserver?.disconnect()
  entriesMotion?.removeEventListener('change', refreshProductEntries)
  document.removeEventListener('visibilitychange', refreshProductEntries)
  window.removeEventListener('resize', refreshProductEntries)
})

const reducedMotion =
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

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
  <div class="site-page" :style="heroTransitionStyle">
    <!-- 门户首屏 -->
    <div ref="heroSequence" class="hero-sequence">
      <section
        ref="heroStage"
        class="hero hero--galaxy"
        :class="{
          'hero--flying': destination,
          'hero--copy-hovered': hoveredRegion === 'copy',
          'hero--clearing': scrollProgress > 0.55,
        }"
        @pointermove="trackHeroRegion"
        @pointerleave="hoveredRegion = null"
      >
        <svg class="hero-reveal-defs" width="0" height="0" aria-hidden="true">
          <defs>
            <filter
              id="mirror-reveal-feather"
              filterUnits="objectBoundingBox"
              primitiveUnits="userSpaceOnUse"
              x="-30%" y="-30%" width="160%" height="160%"
            >
              <feGaussianBlur stdDeviation="0.010 0.015" />
            </filter>
            <mask
              id="mirror-scroll-reveal"
              maskUnits="objectBoundingBox"
              maskContentUnits="objectBoundingBox"
              x="0" y="0" width="1" height="1"
              mask-type="luminance"
            >
              <rect width="1" height="1" fill="white" />
              <path
                v-if="scrollProgress > 0.21"
                :d="heroRevealPath"
                fill="black"
                filter="url(#mirror-reveal-feather)"
              />
            </mask>
          </defs>
        </svg>
        <div class="hero-veil" aria-hidden="true"></div>
        <div class="site-shell hero-layout">
          <div ref="heroCopy" class="hero-copy">
            <div class="hero-copy__content">
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
          </div>

          <nav ref="galaxyMap" class="galaxy-map" :class="{ 'galaxy-map--flying': destination }" aria-label="星图导航">
            <ParticleField
              ref="galaxy"
              :nodes="galaxyNodes"
              :active-node="activeNode"
              :region-hovered="hoveredRegion === 'galaxy'"
              :scroll-progress="scrollProgress"
            />
            <RouterLink v-for="node in galaxyNodes" :key="node.label" :to="node.to" custom v-slot="{ href }">
              <a
                :href="href"
                class="galaxy-node"
                :class="{
                  'is-active': activeNode === node,
                  'is-dimmed': activeNode && activeNode !== node,
                }"
                :style="{ left: node.x * 100 + '%', top: node.y * 100 + '%' }"
                @pointerenter="event => { if (event.pointerType === 'mouse') hoveredNode = node }"
                @pointerleave="hoveredNode = null"
                @focus="focusNode($event, node)"
                @blur="focusedNode = null"
                @click="enterNode($event, node)"
              >{{ node.label }}</a>
            </RouterLink>
          </nav>
        </div>
      </section>
    </div>

    <!-- 生态 -->
    <section id="eco" class="site-section site-section--dark eco-section">
      <EcoStarField ref="ecoStars" />
      <div class="site-shell">
        <header class="site-section__head" v-reveal>
          <h2 class="site-section__title">一套长出来的生态</h2>
          <p class="site-section__lead">
            集市主站、知识库、云平台与安全监测在同一底座上协同运行——它们不是拼装的开源方案， 而是团队从零构建、持续迭代的自研体系。
          </p>
        </header>

        <div
          v-reveal="80"
          class="eco-products"
          @keydown.left.prevent="stepProduct(-1, $event)"
          @keydown.right.prevent="stepProduct(1, $event)"
          @keydown.esc="clearProductPreview"
        >
          <div class="eco-products__visual" @pointerleave="releaseMouseProduct">
            <EcoPrism
              :slides="slides"
              :active-index="previewProduct"
              @preview="hoveredProductImage = $event"
              @select="selectProduct"
              @front-change="frontProduct = $event"
            />

            <div class="eco-products__controls">
              <div class="carousel__dots" aria-label="平台切换">
                <button
                  v-for="(slide, index) in slides"
                  :key="slide.name"
                  type="button"
                  class="carousel__dot"
                  :class="{ 'carousel__dot--on': index === currentProduct }"
                  :aria-pressed="index === currentProduct"
                  :aria-label="'查看 ' + slide.name"
                  @click="selectProduct(index, $event)"
                />
              </div>
              <div class="carousel__arrows">
                <button type="button" class="carousel__arrow" aria-label="上一个" @click="stepProduct(-1, $event)">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6" /></svg>
                </button>
                <button type="button" class="carousel__arrow" aria-label="下一个" @click="stepProduct(1, $event)">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 6l6 6-6 6" /></svg>
                </button>
              </div>
            </div>
          </div>

          <div
            ref="productEntries"
            class="eco-products__entries"
            role="region"
            aria-label="产品文案"
            tabindex="0"
            @pointerenter="setEntriesHovered($event, true)"
            @pointerleave="setEntriesHovered($event, false)"
            @focusin="trackEntriesFocus"
            @focusout="trackEntriesFocus"
          >
            <article
              v-for="(slide, index) in slides"
              :key="slide.name"
              class="carousel__info eco-entry"
              :class="{ 'eco-entry--preview': index === previewProduct }"
              @pointerenter="event => { if (event.pointerType === 'mouse') hoveredProductText = index }"
              @pointerleave="event => { hoveredProductText = null; releaseMouseProduct(event) }"
            >
              <div class="carousel__head">
                <span class="carousel__tag">{{ slide.tag }}</span>
                <span class="carousel__counter">{{ String(index + 1).padStart(2, '0') }} / {{ String(slides.length).padStart(2, '0') }}</span>
              </div>
              <h3 class="carousel__name">
                <button
                  type="button"
                  class="eco-entry__select"
                  :aria-pressed="index === selectedProduct"
                  @focus="focusProduct($event, index)"
                  @blur="focusedProduct = null"
                  @click="selectProduct(index, $event)"
                >{{ slide.name }}</button>
              </h3>
              <p class="carousel__desc">{{ slide.desc }}</p>
              <ul class="carousel__chips">
                <li v-for="chip in slide.chips" :key="chip">{{ chip }}</li>
              </ul>
              <dl class="carousel__stats">
                <div v-for="stat in slide.stats" :key="stat.label" class="carousel__stat">
                  <dt>{{ stat.label }}</dt>
                  <dd>{{ stat.value }}</dd>
                </div>
              </dl>
            </article>
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

<style scoped>
.site-page {
  background: #0a1425;
}

#services {
  background: var(--paper);
}

.eco-section {
  position: relative;
  background:
    radial-gradient(ellipse at 82% 40%, #581e373d, transparent 58%),
    linear-gradient(156deg, #0a1425 1%, #121728 49%, #211522);
}

.eco-section > .site-shell {
  position: relative;
  max-width: 1320px;
}

.eco-products {
  --eco-visual-height: clamp(380px, 44vw, 580px);
  display: grid;
  grid-template-columns: minmax(0, 1.618fr) minmax(0, 1fr);
  align-items: start;
  gap: clamp(28px, 4vw, 60px);
}

.eco-products__visual {
  position: sticky;
  top: calc(var(--site-nav-h) + 18px);
  min-width: 0;
}

.eco-products__controls {
  position: relative;
  z-index: 1;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 14px;
  padding: 6px 2px 0;
}

.eco-products__entries {
  display: grid;
  gap: 22px;
  min-width: 0;
}

@media (min-width: 821px) {
  .eco-products__entries {
    max-height: calc(var(--eco-visual-height) + 42px);
    overflow-y: auto;
    padding: 0 21px 2px 5px;
    scrollbar-width: thin;
    scrollbar-color: #92a9cf5e transparent;
  }

  .eco-products__entries:focus-visible {
    outline: 2px solid #acdbff;
    outline-offset: 4px;
  }
}

.eco-entry {
  padding: 16px 0 22px;
  border: 0;
  border-bottom: 1px solid #a8c8f827;
  background: transparent;
  transform-origin: left center;
  transition: transform .32s var(--site-ease), filter .32s var(--site-ease), text-shadow .32s;
}

.eco-entry:last-child {
  border-bottom-color: transparent;
}

.eco-entry--preview {
  z-index: 1;
  transform: scale(1.04);
  filter: brightness(1.18);
  text-shadow: 0 0 18px #8fc7ff53;
}

.eco-entry--preview .carousel__name {
  text-shadow: 0 0 15px #94caff88, 0 0 28px #669aff55;
}

.eco-entry .carousel__head {
  margin-bottom: 9px;
}

.eco-entry .carousel__name {
  margin-bottom: 8px;
}

.eco-entry .carousel__desc,
.eco-entry .carousel__chips {
  margin-bottom: 12px;
}

.eco-entry .carousel__stat {
  padding: 9px 12px;
}

.eco-entry__select {
  display: block;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: start;
  text-shadow: inherit;
  cursor: pointer;
}

.eco-entry__select:focus-visible {
  outline: 2px solid #acdbff;
  outline-offset: 4px;
  border-radius: 3px;
}

@media (max-width: 820px) {
  .eco-products {
    grid-template-columns: minmax(0, 1fr);
    gap: 18px;
  }

  .eco-products__visual {
    position: relative;
    top: auto;
  }

  .eco-entry--preview {
    transform: scale(1.015);
  }
}

@media (prefers-reduced-motion: reduce) {
  .eco-entry,
  .eco-entry--preview {
    transition: none;
    transform: none;
  }
}

@media (min-width: 821px) and (prefers-reduced-motion: no-preference) {
  .hero-sequence {
    --hero-reveal-distance: clamp(570px, 88svh, 780px);
    position: relative;
    z-index: 1;
    margin-bottom: calc(-1 * var(--hero-reveal-distance));
    pointer-events: none;
  }

  .hero-sequence::after {
    content: "";
    display: block;
    height: var(--hero-reveal-distance);
  }

  .hero-sequence .hero--galaxy {
    position: sticky;
    top: 0;
    pointer-events: auto;
  }

  .hero-sequence .hero--clearing {
    pointer-events: none;
  }

  .hero-sequence .hero-veil {
    mask-image: url(#mirror-scroll-reveal);
    opacity: var(--hero-veil-opacity);
  }
}

.hero--galaxy {
  display: grid;
  align-items: center;
  min-height: min(780px, 100svh);
  padding: calc(var(--site-nav-h) + 34px) 0 54px;
  background: transparent;
}

.hero-reveal-defs,
.hero-veil {
  position: absolute;
  pointer-events: none;
}

.hero-veil {
  inset: 0;
  z-index: -2;
  background: linear-gradient(160deg, #070b15 15%, #0a1425 100%);
}

.hero--galaxy::before,
.hero--galaxy::after {
  display: none;
}

.hero-layout {
  display: grid;
  grid-template-columns: minmax(330px, 0.72fr) minmax(0, 1.28fr);
  align-items: center;
  width: 100%;
  max-width: 1320px;
}

.hero-copy {
  position: relative;
  z-index: 1;
  display: grid;
  align-self: stretch;
  align-items: center;
  opacity: var(--hero-copy-opacity);
}

.hero-copy__content {
  transform-origin: left center;
  transition: transform .35s var(--site-ease), filter .35s var(--site-ease);
}

@media (min-width: 821px) and (hover: hover) and (pointer: fine) {
  .hero--copy-hovered .hero-copy__content {
    filter: brightness(1.24);
    transform: scale(1.042);
  }
}

@media (prefers-reduced-motion: reduce) {
  .hero--copy-hovered .hero-copy__content {
    transform: none;
  }
}

.hero--flying .hero-copy {
  opacity: .28;
  transition: opacity .35s var(--site-ease);
}

.hero-copy .wordmark {
  font-size: clamp(44px, 5.1vw, 74px);
}

.hero-copy .hero-desc {
  max-width: 31em;
}

.galaxy-map {
  position: relative;
  isolation: isolate;
  min-width: 0;
  height: clamp(410px, 49vw, 620px);
  margin-inline: -32px;
}

.galaxy-map::before {
  content: "";
  position: absolute;
  inset: 0;
  z-index: -2;
  opacity: var(--hero-glow-opacity);
  background: radial-gradient(ellipse at center, #0d1b34 0%, transparent 66%);
  pointer-events: none;
}

.galaxy-map :deep(.particle-field--galaxy) {
  display: block;
  width: 100%;
  height: 100%;
  mask-image:
    radial-gradient(ellipse closest-side, black 80%, transparent 144%),
    linear-gradient(90deg, transparent, black 7%, black 93%, transparent),
    linear-gradient(transparent, black 8%, black 92%, transparent);
  mask-composite: intersect;
  transform-origin: 72% 50%;
  transition: transform .85s ease-in;
}

.galaxy-map--flying :deep(.particle-field--galaxy) {
  transform: scale(1.18);
}

.galaxy-node {
  position: absolute;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  min-height: 58px;
  min-width: 60px;
  padding: 34px 12px 5px;
  transform: translate(-50%, -20px);
  transform-origin: 50% 20px;
  color: #eef7ff;
  opacity: var(--hero-node-opacity);
  font-size: 14px;
  line-height: 1.15;
  font-weight: 650;
  white-space: nowrap;
  text-decoration: none;
  text-shadow: 0 1px 5px #070b15, 0 0 9px #070b15, 0 0 12px #070b15;
  transition: opacity .24s, color .24s, transform .24s var(--site-ease);
}

.galaxy-node.is-active {
  color: #d7f3ff;
}

@media (prefers-reduced-motion: no-preference) {
  .galaxy-map:not(.galaxy-map--flying) .galaxy-node.is-active {
    transform: translate(-50%, -20px) scale(1.10);
  }
}

.galaxy-node.is-dimmed {
  opacity: calc(.72 * var(--hero-node-opacity));
}

.hero--clearing .hero-copy,
.hero--clearing .galaxy-node {
  visibility: hidden;
}

.galaxy-node:focus-visible {
  outline: 2px solid #c5e6fe;
  outline-offset: 2px;
  border-radius: 4px;
}

.galaxy-map--flying .galaxy-node {
  opacity: 0;
}

@media (max-width: 820px) {
  .hero--galaxy {
    min-height: auto;
    padding: calc(var(--site-nav-h) + 38px) 0 10px;
  }

  .hero-layout {
    grid-template-columns: minmax(0, 1fr);
  }

  .hero-copy .hero-desc {
    margin-bottom: 22px;
  }

  .galaxy-map {
    height: clamp(300px, 68vw, 430px);
    margin-inline: -10px;
  }
}

@media (max-width: 380px) {
  .hero-copy .wordmark {
    font-size: clamp(34px, 11.5vw, 44px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .hero-copy,
  .hero-copy__content,
  .galaxy-map :deep(.particle-field--galaxy),
  .galaxy-node {
    transition: none;
  }
}
</style>
