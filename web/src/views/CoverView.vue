<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import FMMirrorHero from '../utils/mirror-hero'
import '../styles/hero.css'

/**
 * 首屏封面。引擎只负责视觉，业务出口只有「进入需求大厅」。
 * mount() 返回的实例必须在离开路由时 destroy()，否则 rAF / resize 监听 / WebGL
 * 上下文会一直留在内存里（单页应用切路由不卸载就是泄漏）。
 */
const router = useRouter()
const hero = ref(null)
let instance = null

const heroImage = `${import.meta.env.BASE_URL}hero-bg.jpg`

function motionOptions() {
  const compact = window.matchMedia('(max-width: 767px)').matches
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  return {
    // 手机 GPU 与电量更紧，粒子密度和速度都降一档；桌面保持原设计
    density: compact ? 0.55 : (reduced ? 0.6 : 1),
    speed: compact ? 0.7 : (reduced ? 0.35 : 1),
  }
}

onMounted(() => {
  const root = hero.value
  if (!root)
    return
  try {
    instance = FMMirrorHero.mount(root, motionOptions())
  }
  catch {
    // canvas 不可用等情况下保留真实标题，不让首屏变空
    instance = null
  }
  if (instance) {
    // 引擎接管视觉后再淡出读屏用的真实标题，避免首帧闪烁
    requestAnimationFrame(() => root.classList.add('is-mounted'))
  }
})

onBeforeUnmount(() => {
  if (instance?.destroy)
    instance.destroy()
  instance = null
})

function enter() {
  router.push({ name: 'home' })
}
</script>

<template>
  <main ref="hero" class="fm-hero" aria-label="沕鉴 Mirror 校园技术服务平台">
    <img class="fm-hero__src" :src="heroImage" alt="">
    <canvas class="fm-hero__gl" aria-hidden="true" />
    <canvas class="fm-hero__fx" aria-hidden="true" />
    <div class="fm-hero__shade" aria-hidden="true" />
    <canvas class="fm-hero__type" aria-hidden="true" />
    <canvas class="fm-hero__grain" aria-hidden="true" />

    <div class="fm-hero__inner">
      <h1 class="fm-hero__title">
        <span class="fm-hero__cn">沕鉴</span><span class="fm-hero__sep">·</span><span class="fm-hero__en">Mirror</span>
      </h1>
      <div class="fm-hero__rule" aria-hidden="true" />
      <p class="fm-hero__sub">校园技术服务平台</p>
      <p class="fm-hero__mini">MIRROR · CAMPUS TECHNOLOGY SERVICE</p>
      <p class="fm-hero__lead">发布需求、接单练手、对接进度，都在一个安静的大厅里完成。</p>
      <a class="fm-hero__cta" href="#/hall" @click.prevent="enter"><span>进入需求大厅</span></a>
    </div>

    <div class="fm-hero__strip"><span>中山大学 软件工程学院</span></div>
  </main>
</template>
