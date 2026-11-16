<script setup>
import { computed, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import AppNav from './components/AppNav.vue'
import TopNav from './components/TopNav.vue'
import BossSidebar from './components/BossSidebar.vue'
import { useUserStore } from './stores/user'
import { startUnreadPolling, stopUnreadPolling } from './stores/unread'

const user = useUserStore()
const route = useRoute()
// 招聘端（需求管理 / 发布需求）用左侧竖栏，不再叠一条顶部导航
const isBoss = computed(() => route.name === 'myposts' || route.name === 'create')
// 封面是沉浸式全屏，顶栏 / 底栏都让位
const isCover = computed(() => route.name === 'cover')
onMounted(() => {
  user.loadFromStorage()
  // 只在这里起一个轮询，手机底部导航和桌面顶部导航共用同一份未读数
  startUnreadPolling()
})
onUnmounted(stopUnreadPolling)
</script>

<template>
  <div class="app-shell" :class="{ 'app-shell--boss': isBoss, 'app-shell--cover': isCover }">
    <TopNav v-if="!isBoss && !isCover" />
    <BossSidebar v-if="isBoss" />
    <div v-if="isBoss" class="boss-main"><router-view /></div>
    <router-view v-else />
    <AppNav v-if="!isCover" />
  </div>
</template>
