import { createRouter, createWebHashHistory } from 'vue-router'
import { useUserStore } from '../stores/user'

const routes = [
  { path: '/login', name: 'login', component: () => import('../views/LoginView.vue'), meta: { guest: true } },
  { path: '/', name: 'home', component: () => import('../views/ListView.vue') },
  { path: '/create', name: 'create', component: () => import('../views/CreateView.vue') },
  { path: '/post/:id', name: 'detail', component: () => import('../views/DetailView.vue'), props: true },
  { path: '/messages', name: 'messages', component: () => import('../views/MessagesView.vue') },
  { path: '/profile', name: 'profile', component: () => import('../views/ProfileView.vue') },
  { path: '/feedback', name: 'feedback', component: () => import('../views/FeedbackView.vue') },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

router.beforeEach((to) => {
  const user = useUserStore()
  if (!to.meta.guest && !user.token)
    return { name: 'login', query: { redirect: to.fullPath } }
  if (to.name === 'login' && user.token)
    return { name: 'home' }
  return true
})

export default router
