<script setup>
import { onBeforeUnmount, ref, shallowRef } from 'vue'

const backdrop = ref(null)
const canvas = ref(null)
const flying = ref(false)
const landedColors = shallowRef([])
const colors = ['#adcaff', '#c9b6f5', '#dbe9ff', '#91baff']
const landingCount = 58
const firstBand = 0.51
let animation = 0

function fraction(value) {
  const result = Math.sin(value * 91.175 + 4.61) * 17389.871
  return result - Math.floor(result)
}

const stars = Array.from({ length: 146 }, (_, index) => ({
  x: 0.014 + fraction(index + 1) * 0.972,
  y: index < landingCount
    ? 0.019 + fraction(index + 201) * firstBand
    : firstBand + fraction(index + 201) * 0.48,
  size: 1.08 + fraction(index + 401) ** 2 * 1.4,
  opacity: 0.22 + fraction(index + 601) * 0.36,
  color: colors[index % colors.length],
}))

function stop() {
  cancelAnimationFrame(animation)
  animation = 0
  flying.value = false
}

function scatterFrom(sparks, duration) {
  if (!canvas.value || !backdrop.value || sparks.length === 0
    || matchMedia('(prefers-reduced-motion: reduce)').matches) return

  stop()
  const layer = canvas.value
  const ctx = layer.getContext('2d')
  if (!ctx) return

  const launch = performance.now()
  const arrivals = Math.min(landingCount, sparks.length)
  const particles = stars.slice(0, arrivals).map((star, index) => {
    const source = sparks[index]
    const direction = fraction(index + 810) * 2 * Math.PI
    const speed = 38 + fraction(index + 910) * 180
    return {
      star,
      source,
      burstX: Math.cos(direction) * speed,
      burstY: Math.sin(direction) * speed * 0.72,
      delay: fraction(index + 1010) * 105,
    }
  })
  landedColors.value = particles.map(({ source }) => source.color)
  flying.value = true

  function paint(time) {
    animation = 0
    if (time >= launch + duration + 340) {
      stop()
      return
    }

    const scale = Math.min(1.6, devicePixelRatio || 1)
    const width = layer.clientWidth
    const height = layer.clientHeight
    if (layer.width !== Math.round(width * scale) || layer.height !== Math.round(height * scale)) {
      layer.width = Math.round(width * scale)
      layer.height = Math.round(height * scale)
    }
    ctx.setTransform(scale, 0, 0, scale, 0, 0)
    ctx.clearRect(0, 0, width, height)
    const bounds = backdrop.value.getBoundingClientRect()
    const anchored = Math.abs(bounds.top) < height * 0.65
    const landingTop = anchored ? bounds.top : 0

    for (const { star, source, burstX, burstY, delay } of particles) {
      const depart = duration * 0.34 + delay
      const progress = Math.max(0, Math.min(1, (time - launch - depart) / (duration + 310 - depart)))
      if (!progress) continue

      const settle = progress * progress * (3 - 2 * progress)
      const arc = Math.sin(Math.PI * progress) ** 1.2
      const x = source.x + (bounds.left + star.x * bounds.width - source.x) * settle + burstX * arc
      const y = source.y + (landingTop + star.y * bounds.height - source.y) * settle + burstY * arc
      const radius = star.size * 0.5 + arc * (0.52 + source.size * 0.22)
      const opacity = Math.min(1, progress * 9) * (star.opacity + arc * 0.51)
      ctx.fillStyle = source.color

      if (arc > 0.22) {
        ctx.globalAlpha = opacity * 0.23
        ctx.beginPath()
        ctx.arc(x, y, radius * 2.05, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = opacity
      ctx.beginPath()
      ctx.arc(x, y, radius, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
    animation = requestAnimationFrame(paint)
  }

  animation = requestAnimationFrame(paint)
}

defineExpose({ scatterFrom, stop })
onBeforeUnmount(stop)
</script>

<template>
  <div ref="backdrop" class="eco-stars" aria-hidden="true">
    <i
      v-for="(star, index) in stars"
      :key="index"
      class="eco-stars__dot"
      :style="{
        left: star.x * 100 + '%',
        top: star.y * 100 + '%',
        width: star.size + 'px',
        height: star.size + 'px',
        backgroundColor: landedColors[index] ?? star.color,
        opacity: flying && index < landedColors.length ? 0 : star.opacity,
      }"
    />
  </div>
  <Teleport to="body">
    <canvas v-show="flying" ref="canvas" class="eco-stars__flight" aria-hidden="true"></canvas>
  </Teleport>
</template>

<style scoped>
.eco-stars {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
}

.eco-stars__dot {
  position: absolute;
  display: block;
  border-radius: 50%;
  transform: translate(-50%, -50%);
}

.eco-stars__flight {
  position: fixed;
  inset: 0;
  z-index: 48;
  width: 100%;
  height: 100%;
  pointer-events: none;
}
</style>
