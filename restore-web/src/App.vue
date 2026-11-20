<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import SiteNav from '@/components/SiteNav.vue'
import AppNav from '@/components/AppNav.vue'
import SiteFooter from '@/components/SiteFooter.vue'

const route = useRoute()
const isSite = computed(() => ['site-home', 'site-about', 'site-services'].includes(route.name))
const showFooter = computed(() => isSite.value || route.name === 'feedback')
const showAppNav = computed(() => !isSite.value && route.name !== 'login')
const showSiteNav = computed(() => route.name !== 'login')
const shellClass = computed(() => (isSite.value || route.name === 'login' ? '' : 'app-shell--offset'))
</script>

<template>
  <SiteNav v-if="showSiteNav" />
  <div class="app-shell" :class="shellClass">
    <router-view />
  </div>
  <SiteFooter v-if="showFooter" />
  <AppNav v-if="showAppNav" />
</template>
