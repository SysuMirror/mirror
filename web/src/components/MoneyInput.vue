<script setup>
import { computed } from 'vue'

const props = defineProps({
  priceType: { type: String, default: 'fixed' },
  fixed: { type: String, default: '' },
  min: { type: String, default: '' },
  max: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
})

const emit = defineEmits(['update:priceType', 'update:fixed', 'update:min', 'update:max'])

const types = [
  { value: 'fixed', label: '固定金额' },
  { value: 'range', label: '金额区间' },
  { value: 'negotiable', label: '面议' },
]

const preview = computed(() => {
  if (props.priceType === 'fixed' && props.fixed)
    return `¥${props.fixed}`
  if (props.priceType === 'range' && props.min && props.max)
    return `¥${props.min} – ¥${props.max}`
  if (props.priceType === 'negotiable')
    return '面议'
  return ''
})

function onFixedInput(ev) {
  const v = ev.target.value.replace(/[^\d.]/g, '')
  emit('update:fixed', v)
}

function onMinInput(ev) {
  emit('update:min', ev.target.value.replace(/[^\d.]/g, ''))
}

function onMaxInput(ev) {
  emit('update:max', ev.target.value.replace(/[^\d.]/g, ''))
}
</script>

<template>
  <div class="money-input">
    <div class="segmented">
      <button
        v-for="t in types"
        :key="t.value"
        type="button"
        :class="{ active: priceType === t.value }"
        :disabled="disabled"
        @click="emit('update:priceType', t.value)"
      >
        {{ t.label }}
      </button>
    </div>
    <div v-if="priceType === 'fixed'" class="money-row">
      <span class="money-prefix">¥</span>
      <input
        type="text"
        inputmode="decimal"
        pattern="[0-9]*"
        placeholder="0"
        :value="fixed"
        :disabled="disabled"
        @input="onFixedInput"
      >
    </div>
    <div v-else-if="priceType === 'range'" class="money-range">
      <div class="money-row">
        <span class="money-prefix">¥</span>
        <input type="text" inputmode="decimal" placeholder="最低" :value="min" :disabled="disabled" @input="onMinInput">
      </div>
      <span class="money-dash">–</span>
      <div class="money-row">
        <span class="money-prefix">¥</span>
        <input type="text" inputmode="decimal" placeholder="最高" :value="max" :disabled="disabled" @input="onMaxInput">
      </div>
    </div>
    <p v-if="preview" class="money-preview">展示：{{ preview }}</p>
  </div>
</template>

<style scoped>
.money-input { display: flex; flex-direction: column; gap: 10px; }
.money-row {
  display: flex;
  align-items: center;
  gap: 6px;
  background: transparent;
  border: 1px solid var(--input-border, #e4e4e1);
  border-radius: 7px;
  padding: 10px 12px;
}
.money-prefix { font-weight: 700; color: var(--text, #16181c); font-size: 18px; }
.money-row input {
  border: none;
  background: transparent;
  font: inherit;
  font-size: 18px;
  font-weight: 600;
  width: 100%;
  outline: none;
}
.money-range { display: flex; align-items: center; gap: 8px; }
.money-range .money-row { flex: 1; }
.money-dash { color: var(--text-muted, #a6a69f); font-weight: 700; }
.money-preview { font-size: 13px; color: var(--text-muted, #a6a69f); font-weight: 500; margin: 0; }
</style>
