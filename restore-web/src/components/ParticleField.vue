<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import nebulaUrl from '@/assets/nebula-hero.webp'

const props = defineProps({
  max: { type: Number, default: 96 },
  density: { type: Number, default: 15000 },
  mouseLink: { type: Boolean, default: true },
  active: { type: Number, default: 0 },
  sectors: { type: Number, default: 3 },
})

// CSS 里用不了 import，在 setup 里拼成 style 对象绑定
const nebulaStyle = { backgroundImage: `url(${nebulaUrl})` }

const rootEl = ref(null)
const canvasEl = ref(null)

const reducedMotion =
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

let raf = 0
let running = false
let inView = true
let io = null
let cleanup = null

onMounted(() => {
  const canvas = canvasEl.value
  const host = rootEl.value?.parentElement
  const ctx = canvas.getContext('2d')

  let w = 0, h = 0, dpr = 1
  let pos = new Float32Array(0)   // x,y 成对
  let phase = new Float32Array(0) // 闪烁相位
  let speed = new Float32Array(0) // 闪烁速度
  let n0 = 0, n1 = 0, n2 = 0       // 三组的分界：暗星 / 常规 / 亮星闪烁
  const startT = performance.now()

  function resize() {
    const box = host.getBoundingClientRect()
    if (box.width < 4 || box.height < 4) return
    dpr = Math.min(window.devicePixelRatio || 1, 2)
    w = box.width
    h = box.height
    canvas.width = w * dpr
    canvas.height = h * dpr
    canvas.style.width = `${w}px`
    canvas.style.height = `${h}px`
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    // 3000 星点（移动端 1400），位置一次性随机，按亮度分成三组连续区间
    const N = w < 640 ? 1400 : 3000
    n0 = Math.round(N * 0.3)
    n1 = Math.round(N * 0.5)
    n2 = N - n0 - n1
    pos = new Float32Array(N * 2)
    phase = new Float32Array(N)
    speed = new Float32Array(N)
    for (let i = 0; i < N; i++) {
      pos[i * 2] = Math.random() * w
      pos[i * 2 + 1] = Math.random() * h
      phase[i] = Math.random() * Math.PI * 2
      speed[i] = 0.5 + Math.random() * 1.2
    }
    if (reducedMotion) paint(0)
  }

  // 每帧只做：clearRect → 按亮度分 3 组、每组设一次 fillStyle → 批量 fillRect
  function paint(t) {
    ctx.clearRect(0, 0, w, h)
    ctx.globalAlpha = 1

    ctx.fillStyle = 'rgba(158, 197, 255, 0.42)' // 暗星
    for (let i = 0; i < n0; i++) ctx.fillRect(pos[i * 2], pos[i * 2 + 1], 1, 1)

    ctx.fillStyle = 'rgba(158, 197, 255, 0.72)' // 常规
    for (let i = n0; i < n0 + n1; i++) ctx.fillRect(pos[i * 2], pos[i * 2 + 1], 1, 1)

    // 亮星（20%）用 sin(t*speed+phase) 调透明度；只在这组内逐点设 globalAlpha，
    // 不进前面两组，保证 80% 的点是纯批量画
    ctx.fillStyle = 'rgba(127, 212, 255, 0.95)'
    for (let i = n0 + n1; i < n0 + n1 + n2; i++) {
      const tw = 0.55 + 0.45 * Math.sin(t * speed[i] + phase[i])
      ctx.globalAlpha = tw
      ctx.fillRect(pos[i * 2], pos[i * 2 + 1], 1, 1)
    }
    ctx.globalAlpha = 1
  }

  function frame(now) {
    if (!running) return
    paint((now - startT) / 1000)
    raf = requestAnimationFrame(frame)
  }

  function play() {
    if (!reducedMotion && !running && inView && !document.hidden) {
      running = true
      raf = requestAnimationFrame(frame)
    }
  }
  function pause() {
    running = false
    cancelAnimationFrame(raf)
  }
  function onVisibility() {
    document.hidden ? pause() : play()
  }

  // 鼠标视差：不重算坐标，只给 canvas 加 transform，80ms 过渡由 CSS 完成
  function onPointerMove(e) {
    if (!props.mouseLink || reducedMotion) return
    const r = canvas.getBoundingClientRect()
    const mx = ((e.clientX - r.left) / r.width) * 2 - 1
    const my = ((e.clientY - r.top) / r.height) * 2 - 1
    canvas.style.transform = `translate3d(${(mx * 6).toFixed(2)}px, ${(my * 4).toFixed(2)}px, 0)`
  }
  function onPointerLeave() {
    canvas.style.transform = 'translate3d(0, 0, 0)'
  }

  resize()
  window.addEventListener('resize', resize)
  document.addEventListener('visibilitychange', onVisibility)
  if (host && typeof IntersectionObserver === 'function') {
    io = new IntersectionObserver(entries => {
      inView = entries[0]?.isIntersecting ?? true
      inView ? play() : pause()
    })
    io.observe(host)
  }
  if (typeof window.PointerEvent === 'function') {
    host?.addEventListener('pointermove', onPointerMove, { passive: true })
    host?.addEventListener('pointerleave', onPointerLeave)
  }
  play()

  cleanup = () => {
    pause()
    window.removeEventListener('resize', resize)
    document.removeEventListener('visibilitychange', onVisibility)
    io?.disconnect()
    host?.removeEventListener('pointermove', onPointerMove)
    host?.removeEventListener('pointerleave', onPointerLeave)
  }
})

onBeforeUnmount(() => cleanup?.())
</script>

<template>
  <div ref="rootEl" class="particle-field" aria-hidden="true">
    <!-- 1) 星云底图：缓慢漂移，mask 融边 -->
    <div class="pf-nebula" :style="nebulaStyle"></div>
    <!-- 2) 星点 canvas -->
    <canvas ref="canvasEl" class="pf-stars"></canvas>
    <!-- 3) 板块高亮：300% 宽渐变层，随 active 平移 -->
    <div class="pf-sect" :style="{ '--k': props.active }"></div>
  </div>
</template>

<style scoped>
.pf-nebula {
  position: absolute;
  inset: -8%;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  opacity: 0.8;
  animation: pf-drift 84s ease-in-out infinite alternate;
  will-change: transform;
  -webkit-mask-image: radial-gradient(125% 95% at 50% 42%, #000 38%, transparent 100%);
  mask-image: radial-gradient(125% 95% at 50% 42%, #000 38%, transparent 100%);
}

@keyframes pf-drift {
  from {
    transform: scale(1.05) translate3d(-1.2%, 0.8%, 0);
  }
  to {
    transform: scale(1.13) translate3d(1.2%, -0.8%, 0);
  }
}

.pf-stars {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: block;
  transition: transform 80ms linear;
  will-change: transform;
}

.pf-sect {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  width: 300%;
  background-image:
    radial-gradient(28% 62% at 16.6% 50%, rgba(168, 85, 247, 0.4), rgba(79, 139, 255, 0.1) 52%, transparent 74%),
    radial-gradient(28% 62% at 50% 50%, rgba(168, 85, 247, 0.4), rgba(79, 139, 255, 0.1) 52%, transparent 74%),
    radial-gradient(28% 62% at 83.3% 50%, rgba(168, 85, 247, 0.4), rgba(79, 139, 255, 0.1) 52%, transparent 74%);
  transform: translateX(calc(var(--k, 0) * -33.333%));
  transition: transform 1s ease;
  mix-blend-mode: screen;
  opacity: 0.85;
}

@media (prefers-reduced-motion: reduce) {
  .pf-nebula {
    animation: none;
  }
  .pf-stars {
    transition: none;
  }
  .pf-sect {
    transition: none;
  }
}
</style>
