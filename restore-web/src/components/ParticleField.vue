<script setup>
import { onMounted, onBeforeUnmount, ref } from 'vue'

const props = defineProps({
  max: { type: Number, default: 40 },
  density: { type: Number, default: 18000 },
})

const canvas = ref(null)
let raf = 0
let particles = []
let ctx = null

function resize() {
  const el = canvas.value
  if (!el) return
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  el.width = el.offsetWidth * dpr
  el.height = el.offsetHeight * dpr
  ctx = el.getContext('2d')
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  seed()
}

function seed() {
  const el = canvas.value
  if (!el) return
  const w = el.offsetWidth
  const h = el.offsetHeight
  const count = Math.min(props.max, Math.round((w * h) / props.density))
  particles = Array.from({ length: count }, () => ({
    x: Math.random() * w,
    y: Math.random() * h,
    r: Math.random() * 1.6 + 0.4,
    vx: (Math.random() - 0.5) * 0.25,
    vy: (Math.random() - 0.5) * 0.25,
  }))
}

function tick() {
  if (!ctx || !canvas.value) return
  const w = canvas.value.offsetWidth
  const h = canvas.value.offsetHeight
  ctx.clearRect(0, 0, w, h)
  ctx.fillStyle = 'rgba(160, 195, 245, 0.35)'
  for (const p of particles) {
    p.x += p.vx
    p.y += p.vy
    if (p.x < 0 || p.x > w) p.vx *= -1
    if (p.y < 0 || p.y > h) p.vy *= -1
    ctx.beginPath()
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
    ctx.fill()
  }
  raf = requestAnimationFrame(tick)
}

onMounted(() => {
  resize()
  window.addEventListener('resize', resize)
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (!reduce) raf = requestAnimationFrame(tick)
})

onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  window.removeEventListener('resize', resize)
})
</script>

<template>
  <canvas ref="canvas" class="particle-field" aria-hidden="true" />
</template>

<style scoped>
.particle-field {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}
</style>
