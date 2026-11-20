import { createRouter, createWebHashHistory } from 'vue-router'

const routes = [
  { path: '/login', name: 'login', component: () => import('@/views/LoginView.vue'), meta: { guest: true } },
  { path: '/', name: 'site-home', component: () => import('@/views/HomeView.vue') },
  { path: '/about', name: 'site-about', component: () => import('@/views/AboutView.vue') },
  { path: '/services', name: 'site-services', component: () => import('@/views/ServicesView.vue') },
  { path: '/quests', name: 'home', component: () => import('@/views/ListView.vue') },
  { path: '/quests/create', name: 'create', component: () => import('@/views/CreateView.vue') },
  { path: '/quests/:id', name: 'detail', component: () => import('@/views/DetailView.vue'), props: true },
  { path: '/admin', name: 'admin', component: () => import('@/views/AdminView.vue'), meta: { auth: true, admin: true } },
  { path: '/messages', name: 'messages', component: () => import('@/views/MessagesView.vue'), meta: { auth: true, admin: true } },
  { path: '/profile', name: 'profile', component: () => import('@/views/ProfileView.vue'), meta: { auth: true } },
  { path: '/feedback', name: 'feedback', component: () => import('@/views/FeedbackView.vue') },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

export default router
