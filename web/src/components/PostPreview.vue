<script setup>
import { computed } from 'vue'
import QuestCard from './QuestCard.vue'
import { formatDeadline } from '../utils/display'

const props = defineProps({
  draft: { type: Object, required: true },
})

const cardPost = computed(() => ({
  postKind: props.draft.postKind,
  questStatus: props.draft.postKind === 'bounty' ? 'open' : undefined,
  title: props.draft.title || '标题预览',
  content: props.draft.content || '内容预览…',
  priceType: props.draft.priceType,
  quotePrice: props.draft.quotePrice,
  quotePriceMin: props.draft.quotePriceMin,
  quotePriceMax: props.draft.quotePriceMax,
  authorName: props.draft.authorName || '我',
  authorAvatar: props.draft.authorAvatar,
  authorScore: props.draft.authorScore || 0,
  commentNum: 0,
  postTime: new Date().toISOString(),
}))
</script>

<template>
  <div class="preview">
    <QuestCard :post="cardPost" />
    <ul v-if="draft.deadline || draft.attachments?.length" class="preview-meta">
      <li v-if="draft.deadline">截止：{{ formatDeadline(draft.deadline) }}</li>
      <li v-if="draft.attachments?.length">附件：{{ draft.attachments.length }} 张图片</li>
    </ul>
    <p class="preview-note">平台不托管资金，金额与结算请通过私信自行协商。</p>
  </div>
</template>

<style scoped>
.preview-meta {
  list-style: none;
  padding: 0;
  margin: 12px 0;
  font-size: 13px;
  color: var(--text-muted);
}
.preview-note {
  margin: 12px 0 0;
  font-size: 13px;
  color: var(--text-muted);
  line-height: 1.5;
}
</style>
