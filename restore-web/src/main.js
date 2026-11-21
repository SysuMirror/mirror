import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import './styles/base.css'

// v-reveal：进入视口时加 is-in 触发过渡，可选参数是延迟毫秒数
let observer = null
function getObserver() {
  if (observer || typeof IntersectionObserver === 'undefined') return observer
  observer = new IntersectionObserver(entries => {
    for (const e of entries) {
      if (e.isIntersecting) {
        e.target.classList.add('is-in')
        observer.unobserve(e.target)
      }
    }
  }, { threshold: 0.12 })
  return observer
}

const reveal = {
  mounted(el, binding) {
    el.classList.add('reveal')
    if (binding.value) el.style.transitionDelay = `${binding.value}ms`
    const io = getObserver()
    io ? io.observe(el) : el.classList.add('is-in')
  },
  unmounted(el) {
    observer?.unobserve(el)
  },
}

// 旧版 hash 路由 → 现在的路由，保留历史链接可用
;(function legacyHash() {
  const h = window.location.hash
  if (!h.startsWith('#/') || h.length < 3) return
  const map = {
    '#/': '/quests',
    '#/create': '/quests/create',
    '#/messages': '/messages',
    '#/profile': '/profile',
    '#/feedback': '/feedback',
    '#/login': '/login',
  }
  const post = h.match(/^#\/post\/(.+)$/)
  const target = post ? `/quests/${post[1]}` : map[h] || null
  if (target) window.history.replaceState(null, '', target)
})()

createApp(App).use(router).directive('reveal', reveal).mount('#app')
