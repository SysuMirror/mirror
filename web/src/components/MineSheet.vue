<script setup>
defineProps({
  open: { type: Boolean, default: false },
})
const emit = defineEmits(['close', 'select'])

const items = [
  { key: 'profile', label: '个人信息' },
  { key: 'feedback', label: '反馈' },
]

function onSelect(key) {
  emit('select', key)
  emit('close')
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="mine-sheet" @click.self="emit('close')">
      <div class="mine-sheet__panel" role="menu">
        <button
          v-for="(item, i) in items"
          :key="item.key"
          type="button"
          class="mine-sheet__item"
          :class="{ 'is-first': i === 0 }"
          role="menuitem"
          @click="onSelect(item.key)"
        >
          {{ item.label }}
        </button>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.mine-sheet {
  position: fixed;
  inset: 0;
  z-index: 80;
  background: rgba(22, 24, 28, 0.28);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding: 16px 16px calc(16px + env(safe-area-inset-bottom, 0));
}
.mine-sheet__panel {
  width: min(360px, 100%);
  background: #fff;
  border-radius: 7px;
  overflow: hidden;
  border: 1px solid #ecece9;
}
.mine-sheet__item {
  display: block;
  width: 100%;
  border: none;
  background: #fff;
  text-align: left;
  padding: 14px 16px;
  font: inherit;
  font-size: 15px;
  color: #16181c;
  cursor: pointer;
  border-top: 1px solid #ecece9;
}
.mine-sheet__item.is-first {
  border-top: none;
  background: #f7f7f5;
}
.mine-sheet__item:active {
  background: #f0f0ee;
}
</style>
