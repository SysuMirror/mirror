<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

const title = ref('')
const content = ref('')
const budgetType = ref('negotiable')
const budgetMin = ref('')
const budgetMax = ref('')
const contactName = ref('')
const contactMethod = ref('')
const expectDate = ref('')
const error = ref('')
const loading = ref(false)

const budgetOptions = [
  { value: 'negotiable', label: '面议' },
  { value: 'fixed', label: '固定预算' },
  { value: 'range', label: '预算区间' },
]

const showMin = computed(() => budgetType.value === 'fixed' || budgetType.value === 'range')
const showMax = computed(() => budgetType.value === 'range')

function submit() {
  error.value = ''
  if (!title.value.trim() || !content.value.trim()) {
    error.value = '请填写需求标题和描述'
    return
  }
  if (!contactName.value.trim() || !contactMethod.value.trim()) {
    error.value = '请留下称呼和联系方式，方便我们对接'
    return
  }
  if (budgetType.value === 'range' && (!budgetMin.value || !budgetMax.value || Number(budgetMin.value) > Number(budgetMax.value))) {
    error.value = '请填写有效的预算区间'
    return
  }
  // 静态还原：提交后回到列表
  router.replace({ name: 'home' })
}
</script>

<template>
  <div class="page">
    <header class="topbar">
      <h1>发布需求</h1>
      <button class="btn ghost sm" @click="router.push({ name: 'home' })">返回</button>
    </header>

    <div class="panel form order-form">
      <p class="form-lead">描述你想做的事，我们评估后会通过留下的联系方式与你对接。带 * 为必填。</p>

      <div class="form-section">
        <label>需求标题 *</label>
        <input v-model="title" maxlength="60" placeholder="例如：学院活动报名小程序" />
      </div>

      <div class="form-section">
        <label>需求描述 *</label>
        <textarea v-model="content" rows="6" placeholder="想解决什么问题、大致功能、使用场景……写得越具体评估越准"></textarea>
      </div>

      <div class="form-section">
        <label>预算 *</label>
        <div class="budget-options">
          <button
            v-for="b in budgetOptions"
            :key="b.value"
            type="button"
            class="budget-opt"
            :class="{ on: budgetType === b.value }"
            @click="budgetType = b.value"
          >{{ b.label }}</button>
        </div>
        <div v-if="showMin" class="budget-inputs">
          <input v-model="budgetMin" type="number" min="0" placeholder="最低（元）" />
          <input v-if="showMax" v-model="budgetMax" type="number" min="0" placeholder="最高（元）" />
        </div>
      </div>

      <div class="form-section two-col">
        <div>
          <label>怎么称呼你 *</label>
          <input v-model="contactName" maxlength="30" placeholder="姓名 / 团队 / 部门" />
        </div>
        <div>
          <label>联系方式 *</label>
          <input v-model="contactMethod" maxlength="120" placeholder="手机 / 微信 / 邮箱" />
        </div>
      </div>

      <div class="form-section">
        <label>期望完成时间（可选）</label>
        <input v-model="expectDate" type="date" />
      </div>

      <p v-if="error" class="error">{{ error }}</p>

      <button class="btn primary block" :disabled="loading" @click="submit">
        {{ loading ? '提交中…' : '提交需求' }}
      </button>

      <p class="form-foot">提交后可在「我的需求」中随时查看处理进度</p>
    </div>
  </div>
</template>

<style scoped>
.budget-options {
  display: flex;
  gap: 8px;
  margin-bottom: 10px;
}

.budget-opt {
  padding: 8px 14px;
  border-radius: var(--radius);
  border: 1px solid var(--input-border);
  background: var(--surface);
  color: var(--text-muted);
  font-size: 13px;
  cursor: pointer;
}

.budget-opt.on {
  background: var(--accent-soft);
  border-color: var(--accent);
  color: var(--accent);
  font-weight: 600;
}

.budget-inputs {
  display: flex;
  gap: 10px;
}

.budget-inputs input {
  flex: 1;
}
</style>
