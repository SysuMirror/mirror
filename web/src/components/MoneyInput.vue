<script setup>
import { computed, reactive } from 'vue'
import {
  MONEY_HINT, MONEY_LABELS, MONEY_MAX, MONEY_MIN, MONEY_RANGE_ORDER,
  moneyError, normalizeMoneyInput, parseMoney,
} from '../utils/money'

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

// 必须响应式：普通对象改属性不会触发下面的 error 重算，
// 用户输入一个被净化掉的非法字符时错误提示会不更新。
const touched = reactive({ fixed: false, min: false, max: false })

// 只提示「已经填了但填错」的情况；「还没填」留给提交时的必填校验。
const error = computed(() => {
  if (props.priceType === 'fixed')
    return touched.fixed && props.fixed ? moneyError(props.fixed, MONEY_LABELS.fixed) : ''
  if (props.priceType === 'range') {
    if (touched.min && props.min) {
      const e = moneyError(props.min, MONEY_LABELS.min)
      if (e)
        return e
    }
    if (touched.max && props.max) {
      const e = moneyError(props.max, MONEY_LABELS.max)
      if (e)
        return e
    }
    if (props.min && props.max
      && Number.isFinite(parseMoney(props.min)) && Number.isFinite(parseMoney(props.max))
      && parseMoney(props.min) > parseMoney(props.max))
      return MONEY_RANGE_ORDER
  }
  return ''
})

function clean(ev, key) {
  const v = normalizeMoneyInput(ev.target.value)
  // 净化后的值可能和 prop 相同，Vue 不会重渲染；直接写回 DOM 才不会残留非法字符
  ev.target.value = v
  touched[key] = true
  emit(`update:${key}`, v)
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
        :placeholder="`${MONEY_MIN} – ${MONEY_MAX}`"
        :value="fixed"
        :disabled="disabled"
        :aria-invalid="!!error"
        @input="clean($event, 'fixed')"
      >
      <span class="money-unit">元</span>
    </div>
    <div v-else-if="priceType === 'range'" class="money-range">
      <div class="money-row">
        <span class="money-prefix">¥</span>
        <input type="text" inputmode="decimal" placeholder="最低" :value="min" :disabled="disabled" @input="clean($event, 'min')">
      </div>
      <span class="money-dash">–</span>
      <div class="money-row">
        <span class="money-prefix">¥</span>
        <input type="text" inputmode="decimal" placeholder="最高" :value="max" :disabled="disabled" @input="clean($event, 'max')">
      </div>
    </div>
    <p class="money-rule">{{ MONEY_HINT }}</p>
    <p v-if="error" class="money-error" role="alert">{{ error }}</p>
    <p v-else-if="preview" class="money-preview">展示：{{ preview }}</p>
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
.money-row:focus-within { border-color: var(--accent, #1a6df2); }
.money-row:has(input[aria-invalid="true"]) { border-color: var(--danger, #c45c5c); }
.money-prefix { font-weight: 700; color: var(--text, #16181c); font-size: 18px; }
.money-unit { font-size: 13px; color: var(--text-muted, #a6a69f); flex: none; }
.money-row input {
  border: none;
  background: transparent;
  font: inherit;
  font-size: 18px;
  font-weight: 600;
  width: 100%;
  min-width: 0;
  outline: none;
}
.money-range { display: flex; align-items: center; gap: 8px; }
.money-range .money-row { flex: 1; min-width: 0; }
.money-dash { color: var(--text-muted, #a6a69f); font-weight: 700; }
.money-rule { font-size: 12px; color: var(--text-muted, #a6a69f); margin: -2px 0 0; }
.money-preview { font-size: 13px; color: var(--text-muted, #a6a69f); font-weight: 500; margin: 0; }
.money-error { font-size: 13px; color: var(--danger, #c45c5c); font-weight: 600; margin: 0; }
</style>
