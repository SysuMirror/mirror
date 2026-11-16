<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { createQuestPost } from '../api/quest'
import { useUserStore } from '../stores/user'
import { priceRangeError } from '../utils/money'
import MoneyInput from '../components/MoneyInput.vue'
import ImageUploader from '../components/ImageUploader.vue'
import PostPreview from '../components/PostPreview.vue'

// 对齐 BOSS 直聘发布职位页：单页表单，分「需求描述 / 需求要求」两大区，
// 描述区用标签页分栏填写，要求区放关键词、预算、截止、交付方式，底部协议 + 发布。
const DESC_TABS = [
  {
    key: 'desc', label: '需求说明', required: true,
    placeholder: '说清楚现在卡在哪、要做什么、希望对方怎么帮。例如：用 Vue 写的课程设计，手机上排版全乱了，希望帮忙调一下断点和表格…',
    hint: '必填。写具体一点，别人才能判断能不能接。',
  },
  {
    key: 'require', label: '交付要求', required: false,
    placeholder: '例如：改完要能在 375px 宽的手机上正常显示；把改动点用注释标出来；本周日前交付。',
    hint: '选填。对应 BOSS 直聘的「任职要求」。',
  },
  {
    key: 'extra', label: '补充说明', required: false,
    placeholder: '例如：预算可谈，能语音讲一遍思路更好；参考资料在附件里。',
    hint: '选填。对应 BOSS 直聘的「岗位福利 / 其他要求」。',
  },
]

const DELIVERY = [
  { value: 'any', label: '不限' },
  { value: 'online', label: '线上交付' },
  { value: 'offline', label: '当面 / 线下' },
]

const CATEGORIES = ['前端', '后端', '设计', '文案', '数据', '答疑', '其他']

const router = useRouter()
const user = useUserStore()

const postKind = ref('bounty')
const questCategory = ref('其他')
const title = ref('')
const descTab = ref('desc')
const descText = ref('')
const requireText = ref('')
const extraText = ref('')
const keywords = ref('')
const deliveryMode = ref('any')
const priceType = ref('fixed')
const priceFixed = ref('')
const priceMin = ref('')
const priceMax = ref('')
const deadline = ref('')
const attachments = ref([])
const agreed = ref(false)
const showPreview = ref(false)
const loading = ref(false)
const error = ref('')
const ready = ref(false)

const isBounty = computed(() => postKind.value === 'bounty')
// 提交前不吓人：第一次点「发布需求」之后才把金额规则提示亮出来
const submitTried = ref(false)
const priceError = computed(() =>
  submitTried.value && isBounty.value
    ? priceRangeError(priceType.value, priceFixed.value, priceMin.value, priceMax.value)
    : '',
)
const currentTab = computed(() => DESC_TABS.find(t => t.key === descTab.value) || DESC_TABS[0])
const textRefs = { desc: descText, require: requireText, extra: extraText }
const currentText = computed({
  get: () => textRefs[descTab.value].value,
  set: v => { textRefs[descTab.value].value = v },
})

onMounted(async () => {
  try {
    await user.refreshMe()
  }
  finally {
    ready.value = true
  }
})

watch(postKind, () => {
  error.value = ''
  deadline.value = ''
  priceFixed.value = ''
  priceMin.value = ''
  priceMax.value = ''
  priceType.value = 'fixed'
})

function buildContent() {
  const parts = []
  if (descText.value.trim())
    parts.push(descText.value.trim())
  if (requireText.value.trim())
    parts.push('【交付要求】\n' + requireText.value.trim())
  if (extraText.value.trim())
    parts.push('【补充说明】\n' + extraText.value.trim())
  if (keywords.value.trim())
    parts.push('【技能关键词】' + keywords.value.trim())
  const dm = DELIVERY.find(m => m.value === deliveryMode.value)
  if (dm && dm.value !== 'any')
    parts.push('【交付方式】' + dm.label)
  return parts.join('\n\n')
}

function buildPayload() {
  const payload = {
    title: title.value.trim(),
    content: buildContent(),
    postKind: postKind.value,
    category: questCategory.value,
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
  content: buildContent(),
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
  authorID: user.me?.userID,
  authorName: user.me?.name,
  authorAvatar: user.me?.avatarURL,
  authorScore: user.me?.score,
}))

function validate() {
  if (!title.value.trim())
    return '请填写需求标题'
  if (!descText.value.trim())
    return '请填写「需求说明」'
  // 悬赏金额按 contracts/money-rules.json 校验（当前 1–1000 元、最多两位小数）；区间还要 min <= max
  if (isBounty.value) {
    const priceMsg = priceRangeError(priceType.value, priceFixed.value, priceMin.value, priceMax.value)
    if (priceMsg)
      return priceMsg
  }
  if (!agreed.value)
    return '请先勾选《校园需求发布规范》'
  return ''
}

async function submit() {
  submitTried.value = true
  // 金额错误只交给响应式的 priceError 显示：用户改金额后提示会实时消失，
  // 不再把同一句文案同时塞进 error 里造成两条重复提示 / 旧文案挂着不走。
  const priceMsg = isBounty.value
    ? priceRangeError(priceType.value, priceFixed.value, priceMin.value, priceMax.value)
    : ''
  error.value = priceMsg ? '' : validate()
  if (priceMsg || error.value)
    return
  loading.value = true
  try {
    await createQuestPost(buildPayload())
    // 与 BOSS 直聘一致：发布后回到「职位管理」看状态与数据
    router.replace({ name: 'myposts' })
  }
  catch (e) {
    error.value = e?.message || '发布失败，请稍后重试'
  }
  finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="boss-page">
    <header class="boss-page__head">
      <div>
        <h1>发布需求</h1>
        <p>先说清楚要做什么，再写清要求和预算，一页填完就能发。</p>
      </div>
      <button type="button" class="boss-refresh" @click="router.push('/myposts')">← 返回需求管理</button>
    </header>

    <p v-if="!ready" class="boss-status">正在加载…</p>
    <div v-else-if="!user.me" class="boss-notice">
      <strong>还没登录</strong>
      <p>先登录再发布需求，登录后会自动回到这一页。</p>
      <button type="button" class="btn primary sm" @click="router.push('/login')">去登录</button>
    </div>
    <!-- canPost 缺省按「允许」兜底：dev 假数据不一定带这个字段，不能把发布页整页锁死 -->
    <div v-else-if="user.me.canPost === false" class="boss-notice">
      <p class="error">当前账号无发帖权限</p>
    </div>

    <div v-else class="boss-form">
      <section class="boss-form__section">
        <div class="boss-form__sectionhead">
          <h2>需求描述</h2>
          <span>让别人一眼看懂你要什么</span>
        </div>
        <div class="boss-form__body">
          <div class="boss-field">
            <label>需求类型 <em>*</em></label>
            <div class="boss-segmented">
              <button type="button" :class="{ active: postKind === 'bounty' }" @click="postKind = 'bounty'">悬赏（付钱找人做）</button>
              <button type="button" :class="{ active: postKind === 'inquiry' }" @click="postKind = 'inquiry'">求助（纯问答）</button>
            </div>
          </div>

          <div class="boss-field">
            <label for="boss-title">需求标题 <em>*</em></label>
            <div class="boss-field__withcount">
              <input id="boss-title" v-model="title" class="boss-input" maxlength="30" placeholder="例如：课程设计前端页面改成响应式">
              <span class="boss-field__count">{{ title.length }}/30</span>
            </div>
          </div>

          <div class="boss-field">
            <label>详细描述</label>
            <div class="boss-form__tabs">
              <button
                v-for="t in DESC_TABS"
                :key="t.key"
                type="button"
                :class="{ active: descTab === t.key }"
                @click="descTab = t.key"
              >{{ t.label }}<em v-if="t.required">*</em></button>
            </div>
            <textarea
              v-model="currentText"
              class="boss-textarea"
              rows="8"
              maxlength="2000"
              :placeholder="currentTab.placeholder"
            />
            <div class="boss-field__foot">
              <span>{{ currentTab.hint }}</span>
              <span>{{ currentText.length }}/2000</span>
            </div>
          </div>

          <div class="boss-field">
            <label>附件（可选）</label>
            <ImageUploader v-model="attachments" />
          </div>
        </div>
      </section>

      <section class="boss-form__section">
        <div class="boss-form__sectionhead">
          <h2>需求要求</h2>
          <span>对标 BOSS 直聘的经验 / 学历 / 薪资范围 / 职位关键词</span>
        </div>
        <div class="boss-form__body">
          <div class="boss-field">
            <label for="boss-category">需求分类</label>
            <select id="boss-category" v-model="questCategory" class="boss-input">
              <option v-for="c in CATEGORIES" :key="c" :value="c">{{ c }}</option>
            </select>
            <span class="boss-field__hint">决定它出现在大厅顶部哪个分类下面</span>
          </div>

          <div class="boss-field">
            <label for="boss-keywords">技能关键词</label>
            <input id="boss-keywords" v-model="keywords" class="boss-input" placeholder="例如：Vue、CSS、响应式，用逗号隔开">
            <span class="boss-field__hint">会写进需求详情，方便别人搜到</span>
          </div>

          <div class="boss-field boss-field--grid">
            <div>
              <label>预算范围 <em v-if="isBounty">*</em></label>
              <MoneyInput
                v-model:price-type="priceType"
                v-model:fixed="priceFixed"
                v-model:min="priceMin"
                v-model:max="priceMax"
              />
              <p v-if="priceError" class="error" role="alert">{{ priceError }}</p>
              <span v-if="!isBounty" class="boss-field__hint">纯求助不涉及金额，可跳过</span>
            </div>
            <div>
              <label for="boss-deadline">截止日期</label>
              <input id="boss-deadline" v-model="deadline" type="datetime-local" class="boss-input">
              <span class="boss-field__hint">不填表示长期有效</span>
            </div>
          </div>

          <div class="boss-field">
            <label>交付方式</label>
            <div class="boss-segmented boss-segmented--sm">
              <button
                v-for="m in DELIVERY"
                :key="m.value"
                type="button"
                :class="{ active: deliveryMode === m.value }"
                @click="deliveryMode = m.value"
              >{{ m.label }}</button>
            </div>
          </div>
        </div>
      </section>

      <div class="boss-form__submit">
        <label class="boss-agree">
          <input v-model="agreed" type="checkbox">
          我已阅读并遵守《校园需求发布规范》，不发布代考、代写等违规内容
        </label>
        <p v-if="error" class="error">{{ error }}</p>
        <div class="boss-form__submitrow">
          <button type="button" class="btn ghost" @click="showPreview = !showPreview">
            {{ showPreview ? '收起预览' : '预览效果' }}
          </button>
          <button type="button" class="boss-publish" :disabled="loading" @click="submit">
            {{ loading ? '发布中…' : '发布需求' }}
          </button>
        </div>
        <div v-if="showPreview" class="boss-form__preview">
          <PostPreview :draft="previewDraft" />
        </div>
      </div>
    </div>
  </div>
</template>
