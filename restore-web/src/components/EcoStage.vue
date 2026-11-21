<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import * as THREE from 'three'

const emit = defineEmits(['update:active'])

/* ---------- 板块数据：与原 EcoCarousel 的 tabs 完全一致 ---------- */
const slides = [
  {
    tag: '核心产品',
    name: 'SSE Market 软工集市',
    desc: '中山大学软件工程学院的校园集市。需求发布、组队协作、作品交易都在这里发生，是整个技术生态的第一块基石。',
    chips: ['需求发布', '组队协作', '作品交易', '排行榜'],
    stats: [{ label: '注册用户', value: '1000+' }, { label: '稳定运行', value: '3 年' }],
    image: 'dual-phone',
    images: [],
    alt: 'SSE Market 集市主站与工作台界面',
  },
  {
    tag: '知识沉淀',
    name: 'iWiki 知识库',
    desc: '中山大学软件工程学院的知识库。课程笔记、工程文档与项目复盘在这里沉淀，让每一届同学的经验都能被下一届接住。',
    chips: ['课程笔记', '工程文档', '项目复盘', '全文检索'],
    stats: [{ label: '学院共建', value: '持续更新' }, { label: '内容形态', value: '文档 · Wiki' }],
    image: 'single',
    images: [],
    alt: 'iWiki 知识库界面',
  },
  {
    tag: '算力底座',
    name: '集市云',
    desc: '团队自研的服务器资源管理面板，统一调度 GPU 算力与容器资源，为模型服务与各子平台供给底座算力。',
    chips: ['GPU 调度', '容器编排', '资源监控'],
    stats: [{ label: 'GPU 集群', value: '3 × RTX 4090' }, { label: 'AI 超算', value: 'DGX Spark 128GB' }],
    image: 'single',
    images: [],
    alt: '集市云资源管理面板界面',
  },
]

const N_SLIDES = slides.length

const reducedMotion =
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

/* ---------- 滚动驱动进度 ---------- */
const stageEl = ref(null)
const viewportEl = ref(null)
const canvasEl = ref(null)

const progress = ref(0)          // 0 .. N_SLIDES-1 连续值
const active = ref(0)            // round(progress)
const frac = ref(0)              // progress - active

function panelOpacity(i) {
  const f = frac.value
  if (i === active.value) return f >= 0 ? 1 - f : 1 + f
  if (f > 0 && i === active.value + 1) return f
  if (f < 0 && i === active.value - 1) return -f
  return 0
}
function counterText(i) {
  return `${String(i + 1).padStart(2, '0')} / ${String(N_SLIDES).padStart(2, '0')}`
}

function stageTop() {
  const el = stageEl.value
  if (!el) return 0
  return el.getBoundingClientRect().top + window.scrollY
}

function updateFromScroll() {
  const el = stageEl.value
  if (!el) return
  const total = el.offsetHeight - window.innerHeight
  const p = Math.min(1, Math.max(0, (window.scrollY - stageTop()) / Math.max(1, total))) * (N_SLIDES - 1)
  progress.value = p
  const a = Math.round(p)
  if (a !== active.value) {
    active.value = a
    emit('update:active', a)
    startCameraTween()
  }
  frac.value = p - a
}

/* ---------- 6s 自动播放：滚动到下一屏，循环；用户滚动时重置计时 ---------- */
let autoTimer = null
function scheduleAuto() {
  if (reducedMotion) return
  clearTimeout(autoTimer)
  autoTimer = setTimeout(() => {
    let target = active.value + 1
    if (target > N_SLIDES - 1) target = 0
    scrollToIndex(target)
  }, 6000)
}
function scrollToIndex(i) {
  const el = stageEl.value
  if (!el) return
  const total = el.offsetHeight - window.innerHeight
  const top = stageTop() + (i / (N_SLIDES - 1)) * total
  window.scrollTo({ top, behavior: reducedMotion ? 'auto' : 'smooth' })
}

/* ---------- three.js 星团场景 ---------- */
let renderer = null
let scene = null
let camera = null
let pointsObj = null
let uTime = { value: 0 }
let uActive = { value: 0 }
let uMix = { value: 0 }
let dprTarget = 2
let frameTimes = []
let clusterWorld = []       // 3 个星团中心（随自转更新）
let camTween = null          // { t0, fromX, toX, fromYaw, toYaw, dur }
const CLUSTER_ANGLES = [-20, 0, 20].map(d => (d * Math.PI) / 180)
const CLUSTER_R = 0.75
const CLUSTER_BALL_R = 0.22

function gauss() {
  return (Math.random() + Math.random() + Math.random() + Math.random() - 2) / 2
}

function buildScene() {
  const isMobile = window.innerWidth < 640
  const N = isMobile ? 24000 : 60000
  const pos = new Float32Array(N * 3)
  const col = new Float32Array(N * 3)
  const sizes = new Float32Array(N)
  const clusters = new Float32Array(N)
  const seeds = new Float32Array(N)

  const centers = CLUSTER_ANGLES.map(a => new THREE.Vector3(Math.sin(a) * CLUSTER_R, 0, Math.cos(a) * CLUSTER_R))

  // 白色星空（视频 BARE 第一个星空：纯白小星点，顶部一条密集银河带）
  const N_BAND = Math.round(N * 0.25)      // 顶部密集星带（挂在相机上，屏幕固定）
  const N_CLUSTER = Math.round(N * 0.6)    // 三个星团
  const N_SPARSE = N - N_BAND - N_CLUSTER  // 稀疏星野 + 桥接

  let k = 0
  function setStar(x, y, z, sizeMin, sizeMax, cluster) {
    pos[k * 3] = x
    pos[k * 3 + 1] = y
    pos[k * 3 + 2] = z
    const c = 0.7 + Math.random() * 0.3
    col[k * 3] = c
    col[k * 3 + 1] = c
    col[k * 3 + 2] = c
    sizes[k] = sizeMin + Math.random() * (sizeMax - sizeMin)
    clusters[k] = cluster
    seeds[k] = Math.random()
    k++
  }

  // 1) 三个星团：高斯球状白色星群
  for (let i = 0; i < N_CLUSTER; i++) {
    const c = centers[i % 3]
    let dx = gauss(), dy = gauss(), dz = gauss()
    const len = Math.hypot(dx, dy, dz) || 1
    dx /= len; dy /= len; dz /= len
    const r = CLUSTER_BALL_R * Math.pow(Math.random(), 0.45)
    setStar(c.x + dx * r, c.y + dy * r, c.z + dz * r, 1.0, 2.2, i % 3)
  }

  // 2) 稀疏星野，其中每 20 颗放一颗桥接粒子（簇值 0.5/1.5，切换过渡时点亮）
  for (let i = 0; i < N_SPARSE; i++) {
    if (i % 20 === 0) {
      const pair = i % 2
      const a = centers[pair]
      const b = centers[pair + 1]
      const t = Math.random()
      setStar(
        a.x + (b.x - a.x) * t + (Math.random() - 0.5) * 0.05,
        a.y + (b.y - a.y) * t + (Math.random() - 0.5) * 0.05,
        a.z + (b.z - a.z) * t + (Math.random() - 0.5) * 0.05,
        0.9, 1.5, pair + 0.5,
      )
    } else {
      const x = (Math.random() - 0.5) * 5
      const y = -1.2 + Math.random() * 2.6
      const z = -2.5 + Math.random() * 3
      setStar(x, y, z, 0.7, 1.4, -1)
    }
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3))
  geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))
  geo.setAttribute('aCluster', new THREE.BufferAttribute(clusters, 1))
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1))

  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime, uActive, uMix, uPixelRatio: { value: 1 } },
    vertexShader: /* glsl */ `
      attribute vec3 aColor;
      attribute float aSize;
      attribute float aCluster;
      attribute float aSeed;
      uniform float uTime;
      uniform float uActive;
      uniform float uMix;
      uniform float uPixelRatio;
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        float dd = abs(aCluster - uActive);
        float on = 1.0 - clamp(dd, 0.0, 1.0);
        // 白色星空：当前星团亮度×1.8、size×1.3；非当前×0.28；星带/星野（簇<0）恒定亮度
        float isStatic = step(aCluster, -0.5);
        float boost = mix(0.28 + 1.52 * on, 1.0, isStatic);
        vColor = aColor * boost;
        float sizePx = aSize * uPixelRatio * (2.6 / max(0.3, -mv.z));
        sizePx *= mix(1.0 + 0.3 * on, 1.0, isStatic) * (1.0 + 0.05 * sin(uMix * 3.14159));
        gl_PointSize = sizePx;
        vAlpha = 0.8 + 0.1 * sin(uTime * 1.2 + aSeed * 6.2831);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      precision mediump float;
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        vec2 uv = gl_PointCoord - 0.5;
        float d = length(uv);
        float a = smoothstep(0.5, 0.1, d);
        gl_FragColor = vec4(vColor, a * vAlpha);
      }
    `,
  })

  pointsObj = new THREE.Points(geo, mat)
  scene.add(pointsObj)

  // 顶部密集星带（银河带）：挂在相机上，屏幕位置固定，像视频里一样静止在顶部
  const bandGeo = new THREE.BufferGeometry()
  const bpos = new Float32Array(N_BAND * 3)
  const bcol = new Float32Array(N_BAND * 3)
  const bsize = new Float32Array(N_BAND)
  const bcluster = new Float32Array(N_BAND)
  const bseed = new Float32Array(N_BAND)
  for (let i = 0; i < N_BAND; i++) {
    const d = 2.0 + Math.random() * 1.2
    const v = ((22.5 + Math.random() * 2.5) * Math.PI) / 180  // 视轴上方 22.5°-25°，窄带
    const h = ((-32 + Math.random() * 64) * Math.PI) / 180    // 水平 ±32°
    bpos[i * 3] = Math.tan(h) * d
    bpos[i * 3 + 1] = Math.tan(v) * d
    bpos[i * 3 + 2] = -d
    const c = 0.7 + Math.random() * 0.3
    bcol[i * 3] = c
    bcol[i * 3 + 1] = c
    bcol[i * 3 + 2] = c
    bsize[i] = 1.0 + Math.random() * 1.0
    bcluster[i] = -1
    bseed[i] = Math.random()
  }
  bandGeo.setAttribute('position', new THREE.BufferAttribute(bpos, 3))
  bandGeo.setAttribute('aColor', new THREE.BufferAttribute(bcol, 3))
  bandGeo.setAttribute('aSize', new THREE.BufferAttribute(bsize, 1))
  bandGeo.setAttribute('aCluster', new THREE.BufferAttribute(bcluster, 1))
  bandGeo.setAttribute('aSeed', new THREE.BufferAttribute(bseed, 1))
  camera.add(new THREE.Points(bandGeo, mat))
}

function buildRenderer() {
  renderer = new THREE.WebGLRenderer({ canvas: canvasEl.value, alpha: true, antialias: false, powerPreference: 'high-performance' })
  dprTarget = window.innerWidth < 640 ? 1.5 : 2
  renderer.setPixelRatio(dprTarget)
  camera = new THREE.PerspectiveCamera(55, 1, 0.1, 10)
  camera.position.set(0, 0.55, 2.2)
  camera.rotation.y = 0
  scene = new THREE.Scene()
  scene.add(camera) // 星带挂在相机上，需要相机在场景图中
  buildScene()
  resizeRenderer()
}

function resizeRenderer() {
  if (!renderer || !viewportEl.value) return
  const w = viewportEl.value.clientWidth
  const h = viewportEl.value.clientHeight
  renderer.setSize(w, h, false)
  renderer.setPixelRatio(dprTarget)
  if (camera) {
    camera.aspect = w / h
    camera.updateProjectionMatrix()
  }
}

function startCameraTween() {
  const i = active.value
  const target = clusterWorld[i] || { x: 0, y: 0, z: 0 }
  const yawSign = CLUSTER_ANGLES[i] > 0 ? 1 : CLUSTER_ANGLES[i] < 0 ? -1 : 0
  camTween = {
    t0: performance.now(),
    fromX: camera.position.x,
    toX: target.x,
    fromYaw: camera.rotation.y,
    toYaw: yawSign * 0.21, // 12°
    dur: 1100,
  }
}

function updateCamera(now, dt) {
  // 星群整体缓慢自转
  pointsObj.rotation.y += 0.02 * dt
  const rotY = pointsObj.rotation.y
  for (let i = 0; i < 3; i++) {
    const a = CLUSTER_ANGLES[i]
    const x = Math.sin(a) * CLUSTER_R
    const z = Math.cos(a) * CLUSTER_R
    clusterWorld[i] = {
      x: x * Math.cos(rotY) + z * Math.sin(rotY),
      y: 0,
      z: -x * Math.sin(rotY) + z * Math.cos(rotY),
    }
  }
  // 相机 1.1s cubic 插值
  if (camTween) {
    const t = Math.min(1, (now - camTween.t0) / camTween.dur)
    const e = t * t * (3 - 2 * t)
    camera.position.x = camTween.fromX + (camTween.toX - camTween.fromX) * e
    camera.rotation.y = camTween.fromYaw + (camTween.toYaw - camTween.fromYaw) * e
    if (t >= 1) camTween = null
  }
  const look = clusterWorld[active.value] || { x: 0, y: 0, z: 0 }
  camera.lookAt(look.x, look.y, look.z)
}

let raf = 0
let running = false
let inView = true
let io = null
let lastNow = performance.now()

function loop(now) {
  if (!running) return
  const dt = Math.min(0.1, (now - lastNow) / 1000)
  lastNow = now
  uTime.value = now / 1000
  uActive.value = progress.value
  uMix.value = frac.value
  updateCamera(now, dt)
  renderer.render(scene, camera)
  // 自适应 DPR：连续 30 帧均值 >20ms 降 0.25 档
  frameTimes.push(now)
  if (frameTimes.length >= 30) {
    const avg = (now - frameTimes[0]) / (frameTimes.length - 1)
    if (avg > 20) {
      dprTarget = Math.max(1.0, dprTarget - 0.25)
      renderer.setPixelRatio(dprTarget)
      resizeRenderer()
    }
    frameTimes.shift()
  }
  raf = requestAnimationFrame(loop)
}

function play() {
  if (!running && inView && !document.hidden && !reducedMotion) {
    running = true
    lastNow = performance.now()
    raf = requestAnimationFrame(loop)
  }
}
function pause() {
  running = false
  cancelAnimationFrame(raf)
}
function renderStaticFrame() {
  // reduced-motion：只画一帧静态
  uTime.value = 0
  uActive.value = progress.value
  uMix.value = frac.value
  updateCamera(performance.now(), 0)
  renderer.render(scene, camera)
}

function onVisibility() {
  document.hidden ? pause() : play()
}

let scrollTicking = false
function onScroll() {
  if (scrollTicking) return
  scrollTicking = true
  requestAnimationFrame(() => {
    scrollTicking = false
    updateFromScroll()
    if (reducedMotion) renderStaticFrame()
    scheduleAuto() // 滚动时重置 6s 计时
  })
}

onMounted(() => {
  buildRenderer()
  updateFromScroll()
  renderStaticFrame()
  window.addEventListener('resize', () => {
    resizeRenderer()
    updateFromScroll()
  })
  window.addEventListener('scroll', onScroll, { passive: true })
  document.addEventListener('visibilitychange', onVisibility)
  if (typeof IntersectionObserver === 'function' && stageEl.value) {
    io = new IntersectionObserver(entries => {
      inView = entries[0]?.isIntersecting ?? true
      inView ? play() : pause()
    }, { threshold: 0 })
    io.observe(stageEl.value)
  }
  if (!reducedMotion) {
    scheduleAuto()
    play()
  }
})

onBeforeUnmount(() => {
  pause()
  clearTimeout(autoTimer)
  window.removeEventListener('scroll', onScroll)
  window.removeEventListener('resize', () => {})
  document.removeEventListener('visibilitychange', onVisibility)
  io?.disconnect()
  if (renderer) {
    renderer.dispose()
    scene?.traverse(o => {
      if (o.geometry) o.geometry.dispose()
      if (o.material) o.material.dispose()
    })
  }
})
</script>

<template>
  <section id="eco" ref="stageEl" class="stage">
    <div ref="viewportEl" class="stage__viewport">
      <canvas ref="canvasEl" class="stage__canvas" aria-hidden="true"></canvas>

      <div class="stage__overlay">
        <header class="stage__head">
          <h2>一套长出来的生态</h2>
          <p>
            集市主站、知识库、云平台与安全监测在同一底座上协同运行——它们不是拼装的开源方案，而是团队从零构建、持续迭代的自研体系。
          </p>
        </header>

        <div class="stage__panels">
          <div
            v-for="(s, i) in slides"
            :key="s.name"
            class="stage__panel"
            :style="{ opacity: panelOpacity(i) }"
            :aria-hidden="i !== active"
          >
            <div class="carousel__head">
              <span class="carousel__tag">{{ s.tag }}</span>
              <span class="carousel__counter">{{ counterText(i) }}</span>
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

      <nav class="stage__nav" aria-label="平台切换">
        <button
          v-for="(s, i) in slides"
          :key="s.name"
          type="button"
          role="tab"
          class="stage__nav-btn"
          :class="{ 'stage__nav-btn--on': i === active }"
          :aria-selected="i === active"
          :aria-label="`查看 ${s.name}`"
          @click="scrollToIndex(i)"
        >{{ counterText(i).slice(0, 2) }}</button>
      </nav>
    </div>
  </section>
</template>

<style scoped>
.stage {
  height: calc(100dvh * 3);
  position: relative;
  background: linear-gradient(180deg, #0d1728 0%, var(--ink) 140px);
}

.stage__viewport {
  position: sticky;
  top: 0;
  height: 100dvh;
  overflow: hidden;
}

.stage__canvas {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: block;
}

/* 浮层：居中偏左，最大宽 560px */
.stage__overlay {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-62%, -50%);
  width: min(560px, calc(100vw - 48px));
  pointer-events: none;
  z-index: 2;
}

.stage__head h2 {
  font-size: clamp(24px, 3.4vw, 34px);
  font-weight: 700;
  letter-spacing: 0.01em;
  margin: 0 0 14px;
  color: #e8eefb;
}

.stage__head p {
  font-size: 15px;
  line-height: 1.9;
  color: rgba(168, 185, 225, 0.78);
  margin: 0 0 26px;
  max-width: 520px;
}

.stage__panels {
  position: relative;
}

.stage__panel {
  transition: opacity 0.28s var(--site-ease);
}

.stage__panel:not(:first-child) {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
}

/* 内容块样式复用原 carousel__* 的暗色风格，微调留白 */
.stage__panel .carousel__head {
  margin-bottom: 12px;
}

.stage__panel .carousel__name {
  font-size: clamp(22px, 2.7vw, 30px);
  margin-bottom: 12px;
  padding-left: 0;
}

.stage__panel .carousel__name:before {
  content: none;
}

.stage__panel .carousel__desc {
  margin-bottom: 16px;
}

.stage__panel .carousel__chips {
  margin-bottom: 18px;
}

/* 圆形序号导航 */
.stage__nav {
  position: absolute;
  bottom: 40px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 20px;
  z-index: 3;
}

.stage__nav-btn {
  width: 46px;
  height: 46px;
  border-radius: 50%;
  border: 1px solid rgba(126, 170, 255, 0.28);
  background: rgba(16, 28, 48, 0.55);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  color: rgba(220, 232, 252, 0.85);
  font-family: var(--site-font);
  font-size: 12px;
  letter-spacing: 0.08em;
  cursor: pointer;
  transition:
    border-color 0.3s var(--site-ease),
    background-color 0.3s var(--site-ease),
    color 0.3s var(--site-ease),
    box-shadow 0.3s var(--site-ease),
    transform 0.3s var(--site-ease);
}

.stage__nav-btn:hover {
  border-color: rgba(168, 85, 247, 0.7);
  transform: translateY(-2px);
}

.stage__nav-btn--on {
  border-color: rgba(168, 85, 247, 0.85);
  background: rgba(168, 85, 247, 0.16);
  color: #fff;
  box-shadow:
    0 0 18px rgba(168, 85, 247, 0.45),
    inset 0 0 12px rgba(168, 85, 247, 0.2);
  text-shadow: 0 0 10px rgba(168, 85, 247, 0.9);
}

.stage__nav-btn:focus-visible {
  outline: 2px solid var(--glow);
  outline-offset: 2px;
}

@media (max-width: 640px) {
  .stage__overlay {
    transform: translate(-50%, -50%);
    top: 46%;
  }
  .stage__head p {
    font-size: 13.5px;
  }
  .stage__nav {
    bottom: 28px;
    gap: 14px;
  }
  .stage__nav-btn {
    width: 40px;
    height: 40px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .stage__panel,
  .stage__nav-btn {
    transition: none;
  }
}
</style>
