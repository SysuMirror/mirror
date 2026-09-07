<script setup>
import { onMounted } from 'vue'
import AppNav from './components/AppNav.vue'
import { useUserStore } from './stores/user'

const user = useUserStore()
onMounted(() => user.loadFromStorage())
</script>

<template>
  <div class="app-shell">
    <router-view />
    <AppNav />
  </div>
</template>
