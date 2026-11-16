<script setup>
import { useRouter } from 'vue-router'
import QuestDetail from '../components/QuestDetail.vue'

defineProps({ id: { type: [String, Number], required: true } })
const router = useRouter()
</script>

<template>
  <div class="page page--no-nav">
    <header class="topbar">
      <button type="button" class="btn ghost sm" @click="router.back()">← 返回大厅</button>
      <h1>需求详情</h1>
    </header>
    <QuestDetail :id="id" @deleted="router.replace({ name: 'home' })" />
  </div>
</template>
