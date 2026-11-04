<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { createQuestPost } from '../api/quest'
import { useUserStore } from '../stores/user'
import CreateSteps from '../components/CreateSteps.vue'
import MoneyInput from '../components/MoneyInput.vue'
import ImageUploader from '../components/ImageUploader.vue'
import PostPreview from '../components/PostPreview.vue'

const PHASES = {
  content: 'content',
  money: 'money',
  confirm: 'confirm',
}

const router = useRouter()
const user = useUserStore()

const phase = ref(PHASES.content)
const postKind = ref('bounty')
const title = ref('')
const content = ref('')
const priceType = ref('fixed')
const priceFixed = ref('')
const priceMin = ref('')
const priceMax = ref('')
const deadline = ref('')
const attachments = ref([])
const loading = ref(false)
const error = ref('')
const ready = ref(false)

const isBounty = computed(() => postKind.value === 'bounty')

onMounted(async () => {
  try {
    await user.refreshMe()
  }
  finally {
    ready.value = true
  }
})

watch(postKind, () => {
  phase.value = PHASES.content
  error.value = ''
  deadline.value = ''
  priceFixed.value = ''
  priceMin.value = ''
  priceMax.value = ''
  priceType.value = 'fixed'
})

function buildPayload() {
  const payload = {
    title: title.value.trim(),
    content: content.value.trim(),
    postKind: postKind.value,
    attachments: attachments.value,
  }
  if (!isBounty.value)
    return payload

  if (deadline.value)
    payload.deadline = new Date(deadline.value).toISOString()
  payload.priceType = priceType.value
  if (priceType.value === 'fixed' && priceFixed.value)
    payload.quotePrice = Number(priceFixed.value)
  if (priceType.value === 'range') {
    payload.quotePriceMin = Number(priceMin.value)
    payload.quotePriceMax = Number(priceMax.value)
  }
  return payload
}

const previewDraft = computed(() => ({
  postKind: postKind.value,
  title: title.value,
  content: content.value,
  priceType: isBounty.value ? priceType.value : undefined,
  quotePrice: isBounty.value && priceType.value === 'fixed' && priceFixed.value
    ? Number(priceFixed.value)
    : null,
  quotePriceMin: isBounty.value && priceType.value === 'range' && priceMin.value
    ? Number(priceMin.value)
    : null,
  quotePriceMax: isBounty.value && priceType.value === 'range' && priceMax.value
    ? Number(priceMax.value)
    : null,
  deadline: isBounty.value && deadline.value
    ? new Date(deadline.value).toISOString()
    : null,
  attachments: attachments.value,
  authorName: user.me?.name,
  authorAvatar: user.me?.avatarURL,
  authorScore: user.me?.score,
}))

async function submit() {
  error.value = ''
  loading.value = true
  try {
    await createQuestPost(buildPayload())
    router.replace({ name: 'home' })
  }
  catch (e) {
    error.value = e.message || '发布失败'
  }
  finally {
    loading.value = false
  }
}

function nextStep() {
  if (phase.value === PHASES.content) {
    if (!title.value.trim() || !content.value.trim()) {
      error.value = '请填写标题和内容'
      return
    }
    error.value = ''
    phase.value = isBounty.value ? PHASES.money : PHASES.confirm
    return
  }
  if (phase.value === PHASES.money)
    phase.value = PHASES.confirm
}

function prevStep() {
  if (phase.value === PHASES.confirm) {
    phase.value = isBounty.value ? PHASES.money : PHASES.content
    return
  }
  if (phase.value === PHASES.money)
    phase.value = PHASES.content
}
</script>

<template>
  <div class="page">
    <header class="topbar">
      <h1>发布需求</h1>
    </header>

    <div v-if="!ready" class="status">加载中…</div>
    <div v-else-if="user.me && !user.me.canPost" class="panel">
      <p class="error">当前账号无发帖权限</p>
    </div>

    <div v-else class="create-flow">
      <CreateSteps :phase="phase" :bounty="isBounty" />

      <div class="panel form">
        <template v-if="phase === 'content'">
          <div class="form-section">
            <div class="segmented">
              <button type="button" :class="{ active: postKind === 'bounty' }" @click="postKind = 'bounty'">悬赏</button>
              <button type="button" :class="{ active: postKind === 'inquiry' }" @click="postKind = 'inquiry'">求助</button>
            </div>
          </div>
          <div class="form-section">
            <input v-model="title" maxlength="30" placeholder="标题">
          </div>
          <div class="form-section">
            <textarea v-model="content" rows="6" placeholder="详细说明" />
          </div>
          <div class="form-section">
            <ImageUploader v-model="attachments" />
          </div>
        </template>

        <template v-else-if="phase === 'money'">
          <div class="form-section">
            <MoneyInput
              v-model:price-type="priceType"
              v-model:fixed="priceFixed"
              v-model:min="priceMin"
              v-model:max="priceMax"
            />
          </div>
          <div class="form-section">
            <label class="deadline-label">截止日期：</label>
            <input v-model="deadline" type="datetime-local" class="profile-input">
          </div>
        </template>

        <PostPreview v-else :draft="previewDraft" />

        <p v-if="error" class="error">{{ error }}</p>

        <div class="form-nav">
          <button v-if="phase !== 'content'" type="button" class="btn ghost" @click="prevStep">上一步</button>
          <button v-if="phase !== 'confirm'" type="button" class="btn primary block" @click="nextStep">继续</button>
          <button v-else class="btn primary block" :disabled="loading" @click="submit">
            {{ loading ? '发布中…' : '确认发布' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.create-flow { margin-top: 8px; }
.deadline-label {
  display: block;
  margin: 0 0 8px;
  font-size: 14px;
  font-weight: 500;
  color: var(--text);
}
.form-nav {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid var(--border);
}
</style>
