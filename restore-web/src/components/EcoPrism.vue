<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import EcoSlideMedia from './EcoSlideMedia.vue'

const props = defineProps({
  slides: { type: Array, required: true },
  activeIndex: { type: Number, default: null },
})

const emit = defineEmits(['preview', 'select', 'front-change'])
const stage = ref(null)
const prism = ref(null)
const faceAngle = 120
let angle = -24
let frontIndex = 0
let visible = false
let previousTime = 0
let frame = 0
let observer
let motion

function paintAngle() {
  prism.value?.style.setProperty('--eco-rotation', angle + 'deg')
  const index = (Math.round(-angle / faceAngle) % props.slides.length + props.slides.length) % props.slides.length
  if (index !== frontIndex) {
    frontIndex = index
    emit('front-change', index)
  }
}

function animate(time) {
  frame = 0
  const elapsed = Math.min(40, Math.max(0, time - previousTime))
  previousTime = time

  if (props.activeIndex === null) {
    angle -= elapsed * 0.023
    if (angle <= -360) angle += 360
  } else {
    const target = -props.activeIndex * faceAngle
    const nearest = target + 360 * Math.round((angle - target) / 360)
    const distance = nearest - angle
    angle = Math.abs(distance) < 0.05 ? nearest : angle + distance * (1 - Math.exp(-elapsed / 120))
  }
  paintAngle()

  if (props.activeIndex === null || Math.abs(angle / faceAngle - Math.round(angle / faceAngle)) > 0.0001) {
    frame = requestAnimationFrame(animate)
  }
}

function refreshRotation() {
  cancelAnimationFrame(frame)
  frame = 0
  if (motion?.matches) {
    angle = -(props.activeIndex ?? frontIndex) * faceAngle
    paintAngle()
    return
  }
  if (!visible || document.hidden) return
  previousTime = performance.now()
  frame = requestAnimationFrame(animate)
}

function previewFace(event, index) {
  if (event.pointerType === 'mouse' && props.activeIndex === null) emit('preview', index)
}

watch(() => props.activeIndex, refreshRotation)

onMounted(() => {
  motion = window.matchMedia('(prefers-reduced-motion: reduce)')
  motion.addEventListener('change', refreshRotation)
  document.addEventListener('visibilitychange', refreshRotation)
  observer = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting
    refreshRotation()
  })
  observer.observe(stage.value)
})
onBeforeUnmount(() => {
  cancelAnimationFrame(frame)
  observer?.disconnect()
  motion?.removeEventListener('change', refreshRotation)
  document.removeEventListener('visibilitychange', refreshRotation)
})
</script>

<template>
  <div
    ref="stage"
    class="eco-prism"
    :class="{ 'eco-prism--preview': activeIndex !== null }"
    @pointerleave="emit('preview', null)"
  >
    <div class="eco-prism__scene">
      <div ref="prism" class="eco-prism__solid">
        <button
          v-for="(slide, index) in slides"
          :key="slide.name"
          type="button"
          tabindex="-1"
          class="eco-prism__face"
          :style="{ '--eco-face-angle': index * faceAngle + 'deg' }"
          :aria-label="'查看 ' + slide.name"
          @pointerenter="previewFace($event, index)"
          @click="emit('select', index, $event)"
        >
          <EcoSlideMedia :slide="slide" />
        </button>
      </div>
    </div>

    <Transition name="eco-image">
      <button
        v-if="activeIndex !== null"
        :key="slides[activeIndex].name"
        type="button"
        tabindex="-1"
        class="eco-prism__expanded"
        :aria-label="'查看 ' + slides[activeIndex].name"
        @click="emit('select', activeIndex, $event)"
      >
        <EcoSlideMedia :slide="slides[activeIndex]" />
      </button>
    </Transition>
  </div>
</template>

<style scoped>
.eco-prism {
  --eco-face-width: 53cqw;
  --eco-prism-radius: calc(var(--eco-face-width) * 0.288675);
  position: relative;
  isolation: isolate;
  display: grid;
  align-items: center;
  min-width: 0;
  height: var(--eco-visual-height, 500px);
  container-type: inline-size;
  background: radial-gradient(ellipse 56% 60% at 50% 53%, #6a314237, transparent 85%);
}

.eco-prism__scene {
  position: absolute;
  inset: 0;
  perspective: 1080px;
  perspective-origin: 50% 43%;
  transition: opacity .32s var(--site-ease);
}

.eco-prism__solid {
  position: absolute;
  inset: 0;
  margin: auto;
  width: var(--eco-face-width);
  height: 63%;
  transform-style: preserve-3d;
  transform: rotateX(-23deg) rotateY(var(--eco-rotation, -24deg));
}

.eco-prism__face,
.eco-prism__expanded {
  display: block;
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  color: inherit;
  cursor: pointer;
}

.eco-prism__face {
  border: 0;
  padding: 13px;
  background: transparent;
  /* The same face reads in reverse when seen from inside the prism. */
  backface-visibility: visible;
  pointer-events: none;
  transform: rotateY(var(--eco-face-angle)) translateZ(var(--eco-prism-radius));
}

.eco-prism:not(.eco-prism--preview) .eco-prism__face :deep(img) {
  pointer-events: auto;
}

.eco-prism__face :deep(.eco-media:not(.eco-media--paired) img) {
  width: auto;
  height: auto;
  max-width: 100%;
  max-height: 100%;
}

.eco-prism__expanded {
  --eco-preview-gutter: clamp(16px, 2.25vw, 32px);
  inset: -28px calc(-1 * var(--eco-preview-gutter));
  width: auto;
  height: auto;
  padding: 0;
  border: none;
  background: transparent;
}

.eco-prism--preview .eco-prism__scene {
  opacity: .07;
  pointer-events: none;
}

.eco-image-enter-active,
.eco-image-leave-active {
  transition: opacity .35s var(--site-ease), transform .42s var(--site-ease);
}

.eco-image-leave-active {
  pointer-events: none;
}

.eco-image-enter-from,
.eco-image-leave-to {
  opacity: 0;
  transform: scale(.81);
}

@media (max-width: 820px) {
  .eco-prism {
    --eco-face-width: 60cqw;
    height: clamp(285px, 68vw, 440px);
  }

  .eco-prism__face {
    padding: 9px;
  }

  .eco-prism__expanded {
    inset: -12px -6px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .eco-prism__scene,
  .eco-image-enter-active,
  .eco-image-leave-active {
    transition: none;
  }
}
</style>
