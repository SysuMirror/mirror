<script setup>
import { computed } from 'vue'

const props = defineProps({
  /** 'content' | 'money' | 'confirm' */
  phase: { type: String, required: true },
  /** 悬赏走三步；求助跳过金额，但步进条仍占位对齐 */
  bounty: { type: Boolean, default: true },
})

const SLOTS = [
  { key: 'content', label: '内容' },
  { key: 'money', label: '金额与时间' },
  { key: 'confirm', label: '确认' },
]

const order = computed(() =>
  props.bounty ? ['content', 'money', 'confirm'] : ['content', 'confirm'],
)

function slotState(key) {
  if (key === 'money' && !props.bounty)
    return 'placeholder'
  const i = order.value.indexOf(props.phase)
  const k = order.value.indexOf(key)
  if (k < 0)
    return 'placeholder'
  if (k < i)
    return 'done'
  if (k === i)
    return 'active'
  return 'todo'
}
</script>

<template>
  <nav class="create-steps" aria-label="发布步骤">
    <template v-for="(s, i) in SLOTS" :key="s.key">
      <div
        class="create-steps__item"
        :class="`is-${slotState(s.key)}`"
        :aria-hidden="slotState(s.key) === 'placeholder' ? 'true' : undefined"
      >
        <span class="create-steps__dot" />
        <span class="create-steps__label">{{ s.label }}</span>
      </div>
      <div v-if="i < SLOTS.length - 1" class="create-steps__line" />
    </template>
  </nav>
</template>

<style scoped>
.create-steps {
  display: flex;
  align-items: center;
  margin-bottom: 28px;
}
.create-steps__item {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 0 0 auto;
  min-width: 4.5em;
}
.create-steps__item.is-placeholder {
  visibility: hidden;
  pointer-events: none;
}
.create-steps__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--border-strong);
  flex-shrink: 0;
}
.create-steps__item.is-active .create-steps__dot,
.create-steps__item.is-done .create-steps__dot {
  background: var(--text);
}
.create-steps__label {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-tertiary);
  white-space: nowrap;
}
.create-steps__item.is-active .create-steps__label {
  color: var(--text);
  font-weight: 600;
}
.create-steps__line {
  flex: 1;
  height: 1px;
  background: var(--border-strong);
  margin: 0 8px;
  min-width: 12px;
}
</style>
