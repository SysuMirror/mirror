<script setup>
defineProps({
  open: { type: Boolean, default: false },
})

const emit = defineEmits(['close', 'select'])

// 静态还原：默认按管理员身份展示
const name = 'Mirror 用户'
const isAdmin = true

function select(key) {
  emit('select', key)
  emit('close')
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="mine-sheet" @click.self="emit('close')">
      <div class="mine-sheet__panel" role="menu">
        <button
          type="button"
          class="mine-sheet__item is-first mine-sheet__who"
          role="menuitem"
          @click="select('profile')"
        >
          <span class="mine-sheet__name">{{ name }}</span>
          <span class="mine-sheet__role">{{ isAdmin ? '管理员' : '甲方' }}</span>
        </button>

        <button
          v-if="isAdmin"
          type="button"
          class="mine-sheet__item"
          role="menuitem"
          @click="select('admin')"
        >管理台</button>
        <button
          v-if="isAdmin"
          type="button"
          class="mine-sheet__item"
          role="menuitem"
          @click="select('messages')"
        >集市消息</button>
        <button
          type="button"
          class="mine-sheet__item"
          role="menuitem"
          @click="select('profile')"
        >账号信息</button>
        <button
          type="button"
          class="mine-sheet__item"
          role="menuitem"
          @click="select('feedback')"
        >反馈</button>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.mine-sheet {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, .4);
  z-index: 200;
  display: flex;
  align-items: flex-end;
}

.mine-sheet__panel {
  width: 100%;
  background: var(--surface);
  border-radius: 16px 16px 0 0;
  padding: 8px 0 calc(env(safe-area-inset-bottom, 0px) + 12px);
  display: flex;
  flex-direction: column;
}

.mine-sheet__item {
  background: none;
  border: none;
  text-align: left;
  padding: 14px 20px;
  font-size: 15px;
  color: var(--text);
  cursor: pointer;
}

.mine-sheet__item:hover {
  background: var(--accent-soft);
}

.mine-sheet__who {
  display: flex;
  align-items: center;
  gap: 10px;
  border-bottom: 1px solid var(--border);
  margin-bottom: 6px;
  padding-top: 18px;
  padding-bottom: 16px;
}

.mine-sheet__name {
  font-weight: 600;
  font-size: 16px;
}

.mine-sheet__role {
  font-size: 12px;
  color: var(--text-muted);
  background: var(--accent-soft);
  padding: 2px 8px;
  border-radius: 999px;
}
</style>
