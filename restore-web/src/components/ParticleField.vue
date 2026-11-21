<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'

const props = defineProps({
  max: { type: Number, default: 96 },
  density: { type: Number, default: 15000 },
  mouseLink: { type: Boolean, default: true },
})

const canvasEl = ref(null)

let raf = 0
let running = false
let inView = true
let io = null
let cleanup = null

onMounted(() => {
  if (typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

  const canvas = canvasEl.value
  const host = canvas.parentElement
  const ctx = canvas.getContext('2d')

  let w = 0, h = 0, dpr = 1
  let dots = []
  const mouse = { x: -1e4, y: -1e4 }

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
    const want = Math.min(props.max, Math.max(22, Math.round((w * h) / props.density)))
    while (dots.length < want) {
      dots.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.24,
        vy: (Math.random() - 0.5) * 0.24,
        r: Math.random() * 1.8 + 0.9,
        accent: Math.random() < 0.22,
      })
    }
    dots.length = want
  }

  function frame() {
    if (!running) return
    ctx.clearRect(0, 0, w, h)
    const linkDist = w < 640 ? 100 : 132
    const mouseDist = 160

    for (const d of dots) {
      d.x += d.vx
      d.y += d.vy
      if (d.x < -12) d.x = w + 12
      if (d.x > w + 12) d.x = -12
      if (d.y < -12) d.y = h + 12
      if (d.y > h + 12) d.y = -12
      const dx = d.x - mouse.x
      const dy = d.y - mouse.y
      const dist2 = dx * dx + dy * dy
      if (dist2 < 14400 && dist2 > 0.01) {
        const dist = Math.sqrt(dist2)
        d.x += (dx / dist) * 0.28
        d.y += (dy / dist) * 0.28
      }
    }

    ctx.lineWidth = 1
    for (let i = 0; i < dots.length; i++) {
      const a = dots[i]
      for (let j = i + 1; j < dots.length; j++) {
        const b = dots[j]
        const dist = Math.hypot(a.x - b.x, a.y - b.y)
        if (dist < linkDist) {
          const alpha = (1 - dist / linkDist) * 0.3
          ctx.strokeStyle = `rgba(126, 170, 255, ${alpha})`
          ctx.beginPath()
          ctx.moveTo(a.x, a.y)
          ctx.lineTo(b.x, b.y)
          ctx.stroke()
        }
      }
    }

    if (props.mouseLink && mouse.x > -1e3) {
      for (const d of dots) {
        const dist = Math.hypot(d.x - mouse.x, d.y - mouse.y)
        if (dist < mouseDist) {
          const alpha = (1 - dist / mouseDist) * 0.42
          ctx.strokeStyle = `rgba(76, 195, 255, ${alpha})`
          ctx.beginPath()
          ctx.moveTo(d.x, d.y)
          ctx.lineTo(mouse.x, mouse.y)
          ctx.stroke()
        }
      }
    }

    for (const d of dots) {
      ctx.fillStyle = d.accent ? 'rgba(127, 212, 255, 0.95)' : 'rgba(158, 197, 255, 0.75)'
      ctx.beginPath()
      ctx.arc(d.x, d.y, d.accent ? d.r + 0.7 : d.r, 0, Math.PI * 2)
      ctx.fill()
    }

    raf = requestAnimationFrame(frame)
  }

  function play() {
    if (!running && inView && !document.hidden) {
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
  function onPointerMove(e) {
    const r = canvas.getBoundingClientRect()
    mouse.x = e.clientX - r.left
    mouse.y = e.clientY - r.top
  }
  function onPointerLeave() {
    mouse.x = -1e4
    mouse.y = -1e4
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
  <canvas ref="canvasEl" class="particle-field" aria-hidden="true" />
</template>
