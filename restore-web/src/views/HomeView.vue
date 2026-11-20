<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'

/* ---------- 生态轮播数据 ---------- */
const slides = [
  {
    tag: '核心产品',
    name: 'SSE Market 软工集市',
    desc: '中山大学软件工程学院的校园集市。需求发布、组队协作、作品交易都在这里发生，是整个技术生态的第一块基石。',
    chips: ['需求发布', '组队协作', '作品交易', '排行榜'],
    stats: [
      { label: '注册用户', value: '1000+' },
      { label: '稳定运行', value: '3 年' },
    ],
    image: 'dual-phone',
    images: ['/assets/market-home-CuuSn1ce.webp', '/assets/market-workbench-C2A2QAxI.webp'],
    alt: 'SSE Market 集市主站与工作台界面',
  },
  {
    tag: '知识沉淀',
    name: 'iWiki 知识库',
    desc: '中山大学软件工程学院的知识库。课程笔记、工程文档与项目复盘在这里沉淀，让每一届同学的经验都能被下一届接住。',
    chips: ['课程笔记', '工程文档', '项目复盘', '全文检索'],
    stats: [
      { label: '学院共建', value: '持续更新' },
      { label: '内容形态', value: '文档 · Wiki' },
    ],
    image: 'single',
    images: ['/assets/iwiki-DSDuSC43.webp'],
    alt: 'iWiki 知识库界面',
  },
  {
    tag: '算力底座',
    name: '集市云',
    desc: '团队自研的服务器资源管理面板，统一调度 GPU 算力与容器资源，为模型服务与各子平台供给底座算力。',
    chips: ['GPU 调度', '容器编排', '资源监控'],
    stats: [
      { label: 'GPU 集群', value: '3 × RTX 4090' },
      { label: 'AI 超算', value: 'DGX Spark 128GB' },
    ],
    image: 'single',
    images: ['/assets/sseinfra-Dc19GTRY.webp'],
    alt: '集市云资源管理面板界面',
  },
]

/* ---------- 技术底座能力 ---------- */
const capabilities = [
  { name: '统一身份鉴权', desc: 'UniSSO 打通全部子平台，一次登录即可使用集市、知识库与云平台。' },
  { name: '部署调度中枢', desc: '自研 Deploy 体系覆盖从代码到上线的全流程，子平台按需部署、灰度发布。' },
  { name: '算力中转', desc: '集市云统一管理 GPU 与容器算力，为模型服务与业务平台提供底座支撑。' },
]

/* ---------- 轮播状态 ---------- */
const current = ref(0)
const playing = ref(true)
let timer = null
const counter = computed(() => `${String(current.value + 1).padStart(2, '0')} / ${String(slides.length).padStart(2, '0')}`)

function go(i) {
  current.value = (i % slides.length + slides.length) % slides.length
}
function next() { go(current.value + 1) }
function prev() { go(current.value - 1) }
function start() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  playing.value = true
  timer = setInterval(next, 6000)
}
function stop() {
  playing.value = false
  clearInterval(timer)
}

onMounted(start)
onBeforeUnmount(() => clearInterval(timer))

/* ---------- 滚动浮现 ---------- */
const revealActive = ref(false)
let observer = null
onMounted(() => {
  observer = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) e.target.classList.add('is-in')
    })
  }, { threshold: 0.12 })
  document.querySelectorAll('.reveal').forEach((el) => observer.observe(el))
})
onBeforeUnmount(() => observer && observer.disconnect())
</script>

<template>
  <div class="site-page">
    <!-- Hero -->
    <section class="hero">
      <div class="hero-grid" aria-hidden="true">
        <div class="hero-orbits">
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
      </div>

      <div class="site-shell">
        <p class="hero-sub hero-in hero-in--1">沕鉴工作室 · 校园技术服务平台</p>
        <h1 class="wordmark hero-in hero-in--2" data-text="沕鉴·Mirror">沕鉴·Mirror</h1>
        <p class="hero-desc hero-in hero-in--3">
          以自研 SSE Market 软工集市完整技术生态为核心底座，落地统一身份鉴权、任务调度、算力中转等服务基础设施，为学生团队、校内院系与校企合作单位提供定制化系统开发与平台建设服务。
        </p>
        <div class="hero-actions hero-in hero-in--4">
          <router-link class="btn-hero btn-hero--primary" :to="{ name: 'home' }">进入需求广场</router-link>
          <router-link class="btn-hero btn-hero--ghost" :to="{ name: 'site-services' }">了解技术服务</router-link>
        </div>
      </div>
    </section>

    <!-- 生态 -->
    <section id="eco" class="site-section">
      <div class="site-shell">
        <header class="site-section__head reveal">
          <h2 class="site-section__title">一套长出来的生态</h2>
          <p class="site-section__lead">
            集市主站、知识库、云平台与安全监测在同一底座上协同运行——它们不是拼装的开源方案，而是团队从零构建、持续迭代的自研体系。
          </p>
        </header>

        <div class="carousel reveal" @mouseenter="stop" @mouseleave="start" @focusin="stop" @focusout="start">
          <div class="carousel__track" :style="{ transform: `translateX(-${current * 100}%)` }">
            <div
              v-for="(s, i) in slides"
              :key="s.name"
              class="carousel__slide"
              :class="{ 'carousel__slide--active': i === current }"
              :aria-hidden="i !== current"
            >
              <div class="carousel__visual" :class="`carousel__visual--${s.image}`">
                <img
                  v-for="(img, j) in s.images"
                  :key="img"
                  :class="s.image === 'dual-phone' ? ['carousel__shot', 'carousel__shot--phone', { 'carousel__shot--back': j === 0 }] : ['carousel__shot', 'carousel__shot--panel']"
                  :src="img"
                  :alt="s.alt"
                  decoding="async"
                />
              </div>
              <div class="carousel__info">
                <div class="carousel__head">
                  <span class="carousel__tag">{{ s.tag }}</span>
                  <span class="carousel__counter">{{ counter }}</span>
                </div>
                <h3 class="carousel__name">{{ s.name }}</h3>
                <p class="carousel__desc">{{ s.desc }}</p>
                <ul class="carousel__chips">
                  <li v-for="c in s.chips" :key="c">{{ c }}</li>
                </ul>
                <dl class="carousel__stats">
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
                :aria-selected="i === current"
                :class="['carousel__dot', { 'carousel__dot--on': i === current }]"
                :aria-label="`查看 ${s.name}`"
                @click="go(i)"
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

        <figure class="threat reveal">
          <img src="/assets/threat-map-Dv8bby8D.webp" alt="平台实时攻防态势监测大屏" loading="lazy" decoding="async" />
        </figure>
      </div>
    </section>

    <!-- 技术底座 -->
    <section id="foundation" class="site-section" style="background: var(--paper-2, #f5f8fc)">
      <div class="site-shell">
        <header class="site-section__head reveal">
          <h2 class="site-section__title">技术底座</h2>
          <p class="site-section__lead">
            软工集市作为技术验证载体，沉淀出统一鉴权、部署调度与算力供给的基础设施，支撑全部子平台运行，也是对外输出技术能力的来源。
          </p>
        </header>

        <div class="foundation reveal">
          <div class="foundation-panel">
            <img src="/assets/architecture-B0AEyfPV.webp" alt="SSE Market 技术底座架构图：集市主站、UniSSO、Deploy 调度中枢与云基础设施" loading="lazy" decoding="async" />
          </div>
          <div class="capability-row">
            <div v-for="c in capabilities" :key="c.name" class="capability">
              <h3>{{ c.name }}</h3>
              <p>{{ c.desc }}</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- 服务 -->
    <section id="services" class="site-section">
      <div class="site-shell">
        <header class="site-section__head reveal">
          <h2 class="site-section__title">把底座能力交给场景</h2>
          <p class="site-section__lead">
            无论是学生场景的数据可视化与平台工具，还是院系部门、校企合作单位的数字化系统，团队具备从需求分析、架构设计到系统交付的完整工程实践能力，提供可靠的开发支持。
          </p>
        </header>
        <ServiceList class="reveal" />
      </div>
    </section>

    <!-- 关于 -->
    <section class="site-section site-section--dark">
      <div class="site-shell">
        <div class="about-body reveal">
          <h2 class="site-section__title">沕鉴工作室</h2>
          <p>
            沕鉴·Mirror 校园技术服务平台由沕鉴工作室建设运营。我们在建设平台的过程中锻炼形成梯队完整的全栈学生研发团队，让学生技术成果在真实场景中实现价值落地。
          </p>
          <p>
            未来将依托 Blue Hub 枢纽资源拓展合作渠道，打磨标准化服务流程，持续迭代技术底座。
          </p>
          <div class="hero-actions" style="margin-top: 32px">
            <router-link class="btn-hero btn-hero--primary" :to="{ name: 'site-about' }">关于我们</router-link>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script>
import ServiceList from '@/components/ServiceList.vue'
export default { components: { ServiceList } }
</script>

<style scoped>
/* 轨道装饰 */
.hero-grid {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
}
.hero-orbits {
  position: absolute;
  right: -10%;
  top: 50%;
  transform: translateY(-50%);
  width: 640px;
  opacity: .5;
}
.oc__ring { stroke: rgba(126, 170, 255, .14); stroke-width: 1; }
.oc__ring--dashed { stroke-dasharray: 3 6; }
.oc__ring--faint { opacity: .5; }
.oc__arc { stroke: rgba(76, 195, 255, .5); stroke-width: 1.5; }
.oc__node { fill: #a0c3f5; }
.oc__node--accent { fill: var(--glow); }
.oc__node--tiny { fill: #7fb0ef; }
.oc__spin { transform-origin: 500px 500px; animation: oc-rotate 24s linear infinite; }
.oc__spin--inner { animation-direction: reverse; animation-duration: 16s; }
@keyframes oc-rotate { to { transform: rotate(360deg); } }

/* 轮播 */
.carousel { position: relative; }
.carousel__track {
  display: flex;
  transition: transform .6s var(--site-ease);
}
.carousel__slide {
  flex: 0 0 100%;
  display: grid;
  grid-template-columns: 1.1fr 1fr;
  gap: 48px;
  align-items: center;
  padding: 8px 4px;
}
.carousel__visual {
  border-radius: var(--site-radius);
  overflow: hidden;
  background: linear-gradient(180deg, #eef3fc, #e4ecf9);
  aspect-ratio: 4 / 3;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}
.carousel__visual--dual-phone { position: relative; }
.carousel__shot--phone { max-height: 100%; border-radius: 14px; box-shadow: 0 12px 32px rgba(16, 28, 48, .18); }
.carousel__shot--phone.carousel__shot--back { position: absolute; left: 40%; transform: translateX(-40%) scale(.92); opacity: .85; }
.carousel__shot--panel { max-width: 100%; border-radius: 10px; box-shadow: 0 12px 32px rgba(16, 28, 48, .18); }
.carousel__head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.carousel__tag { font-size: 12px; letter-spacing: .2em; color: var(--brand); font-weight: 600; }
.carousel__counter { font-size: 13px; color: var(--site-muted); font-variant-numeric: tabular-nums; }
.carousel__name { font-size: clamp(23px, 2.7vw, 31px); font-weight: 700; margin: 0 0 14px; }
.carousel__desc { font-size: 14px; line-height: 1.85; color: var(--site-muted); margin: 0 0 18px; }
.carousel__chips { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 22px; }
.carousel__chips li {
  font-size: 12.5px;
  padding: 5px 12px;
  border-radius: 999px;
  border: 1px solid rgba(29, 62, 120, .2);
  color: var(--site-text);
}
.carousel__stats { display: flex; gap: 40px; }
.carousel__stat dt { font-size: 12px; color: var(--site-muted); margin-bottom: 4px; }
.carousel__stat dd { font-size: 17px; font-weight: 600; color: var(--site-text); }
.carousel__controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 28px;
}
.carousel__dots { display: flex; gap: 8px; }
.carousel__dot {
  width: 8px; height: 8px; border-radius: 50%;
  border: none; cursor: pointer; padding: 0;
  background: rgba(29, 62, 120, .2);
}
.carousel__dot--on { background: var(--brand); width: 22px; border-radius: 999px; }
.carousel__arrows { display: flex; gap: 8px; }
.carousel__arrow {
  width: 36px; height: 36px;
  display: flex; align-items: center; justify-content: center;
  border-radius: 50%;
  border: 1px solid rgba(29, 62, 120, .25);
  background: transparent;
  color: var(--site-text);
  cursor: pointer;
}
.carousel__arrow:hover { border-color: var(--brand); color: var(--brand); }

/* 攻防大屏 */
.threat { margin: 56px 0 0; }
.threat img { width: 100%; border-radius: var(--site-radius); box-shadow: 0 20px 48px rgba(16, 28, 48, .18); }

/* 技术底座 */
.foundation { display: grid; grid-template-columns: 1fr 1fr; gap: 48px; align-items: center; }
.foundation-panel img { width: 100%; border-radius: var(--site-radius); }
.capability-row { display: flex; flex-direction: column; gap: 24px; }
.capability h3 { font-size: 17px; font-weight: 600; margin: 0 0 8px; }
.capability p { font-size: 14px; line-height: 1.8; color: var(--site-muted); margin: 0; }

@media (max-width: 860px) {
  .carousel__slide { grid-template-columns: 1fr; gap: 28px; }
  .foundation { grid-template-columns: 1fr; gap: 32px; }
  .hero-orbits { width: 480px; right: -30%; opacity: .35; }
}

@media (prefers-reduced-motion: reduce) {
  .oc__spin { animation: none; }
  .carousel__track { transition: none; }
}
</style>
