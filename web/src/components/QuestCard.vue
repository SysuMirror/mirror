<script setup>
import { STATUS_LABEL, avatarUrl, formatPrice, levelLabel, relativeTime } from '../utils/display'

defineProps({
  post: { type: Object, required: true },
})
</script>

<template>
  <article class="quest-card">
    <div class="quest-card__top">
      <h2 class="quest-card__title">{{ post.title }}</h2>
      <span
        v-if="post.postKind === 'bounty'"
        class="quest-card__price"
        :class="{ 'quest-card__price--muted': formatPrice(post) === '面议' }"
      >
        {{ formatPrice(post) }}
      </span>
      <span v-else class="quest-card__price quest-card__price--muted">求助</span>
    </div>
    <div class="quest-card__tags">
      <span class="badge" :class="post.postKind">{{ post.postKind === 'bounty' ? '悬赏' : '求助' }}</span>
      <span
        v-if="post.postKind === 'bounty'"
        class="status-pill"
        :class="post.questStatus"
      >
        {{ STATUS_LABEL[post.questStatus] || '待接单' }}
      </span>
    </div>
    <p class="quest-card__summary">{{ post.content }}</p>
    <footer class="quest-card__foot">
      <div class="quest-card__author">
        <img class="quest-card__avatar" :src="avatarUrl(post.authorAvatar)" alt="">
        <span class="quest-card__author-name">{{ post.authorName || '用户' }}</span>
        <span class="quest-card__level">{{ levelLabel(post.authorScore) }}</span>
      </div>
      <div class="quest-card__meta-right">
        <span>{{ relativeTime(post.postTime) }}</span>
        <span>评论 {{ post.commentNum ?? 0 }}</span>
      </div>
    </footer>
  </article>
</template>
