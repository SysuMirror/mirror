<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import AuthorNotes from './AuthorNotes.vue'
import {
  acceptQuestOrder,
  confirmQuestComplete,
  deleteQuestPost,
  fetchQuestDetail,
  submitQuestComplete,
  submitReport,
  toggleSave,
  updateQuestStatus,
} from '../api/quest'
import { recordPostView } from '../api/stats'
import { useUserStore } from '../stores/user'
import { isSameAccount, withCurrentAuthor } from '../utils/author'
import {
  DEFAULT_AVATAR,
  STATUS_LABEL,
  avatarUrl,
  formatDeadline,
  formatPrice,
  levelLabel,
  relativeTime,
  statCount,
} from '../utils/display'

const props = defineProps({ id: { type: [String, Number], required: true } })
const emit = defineEmits(['updated', 'deleted'])
const router = useRouter()
const user = useUserStore()

const post = ref(null)
const loading = ref(true)
const error = ref('')
const actionMsg = ref('')
const statusDraft = ref('open')
const submitNote = ref('')

const isOwner = computed(() => isSameAccount(post.value, user.me))
const isWorker = computed(() => post.value?.order && user.me?.userID === post.value.order.workerID)
// 发布者资料按 authorID 关联当前账号：改名后不会出现「补充说明里是新名字、发布者栏还是旧名字」。
const publisher = computed(() => withCurrentAuthor(post.value, user.me) || {})
const isBounty = computed(() => post.value?.postKind === 'bounty')
const priceText = computed(() => isBounty.value ? formatPrice(post.value) : '求助')
const postedAt = computed(() => {
  if (!post.value?.postTime)
    return ''
  const d = new Date(post.value.postTime)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('zh-CN')
})

function onAvatarError(e) {
  const img = e.target
  if (img.dataset.fallback)
    return
  img.dataset.fallback = '1'
  img.src = DEFAULT_AVATAR
}

const statusOptions = [
  { value: 'open', label: '待接单' },
  { value: 'in_progress', label: '进行中' },
  { value: 'completed', label: '已完成' },
]

// 浏览数由服务端计数：只记别人的帖子、按账号去重；失败不打断详情展示。
async function syncViewCount(detail) {
  const postID = Number(detail.postID || props.id)
  try {
    const stats = await recordPostView(postID)
    // 快速切换详情时，别让旧请求把新帖子的数字覆盖掉
    if (stats && post.value?.postID === detail.postID) {
      post.value.viewCount = stats.viewCount
      post.value.chatCount = stats.chatCount
    }
  }
  catch { /* 统计服务不可用时保留列表里的基线值 */ }
}

async function load() {
  loading.value = true
  error.value = ''
  actionMsg.value = ''
  post.value = null
  try {
    await user.refreshMe()
    const detail = await fetchQuestDetail(Number(props.id))
    if (!detail)
      throw new Error('这条需求不存在或已被发布者删除')
    post.value = detail
    statusDraft.value = detail.questStatus || 'open'
    if (!isOwner.value)
      void syncViewCount(detail)
  }
  catch (e) {
    error.value = e?.message || '详情加载失败，请稍后重试'
  }
  finally {
    loading.value = false
  }
}

watch(() => props.id, load)
onMounted(load)

function contactAuthor() {
  if (!post.value?.authorID)
    return
  router.push({ name: 'messages', query: {
    user: String(post.value.authorID),
    post: String(post.value.postID || props.id),
  } })
}

function contactWorker() {
  if (!post.value?.order?.workerID)
    return
  router.push({ name: 'messages', query: {
    user: String(post.value.order.workerID),
    post: String(post.value.postID || props.id),
  } })
}

async function onSave() {
  if (!user.me?.phone)
    return
  try {
    const result = await toggleSave(Number(props.id), user.me.phone)
    post.value.isSaved = result.data?.isSaved ?? !post.value.isSaved
    actionMsg.value = post.value.isSaved ? '已收藏' : '已取消收藏'
    emit('updated')
  }
  catch (e) {
    error.value = e.message
  }
}

async function onReport() {
  const reason = prompt('请简要说明举报原因')
  if (!reason?.trim() || !user.me?.phone)
    return
  try {
    await submitReport(Number(props.id), reason.trim(), user.me.phone)
    actionMsg.value = '举报已提交'
  }
  catch (e) {
    error.value = e.message
  }
}

async function onUpdateStatus() {
  try {
    await updateQuestStatus(Number(props.id), statusDraft.value)
    post.value.questStatus = statusDraft.value
    actionMsg.value = '状态已更新'
    emit('updated')
  }
  catch (e) {
    error.value = e.message
  }
}

async function onDelete() {
  if (!confirm('确定删除该帖？删除后不可恢复，且不会再出现在大厅。'))
    return
  try {
    await deleteQuestPost(Number(props.id))
    emit('deleted')
  }
  catch (e) {
    error.value = e.message
  }
}

async function onAccept() {
  try {
    const order = await acceptQuestOrder(Number(props.id))
    post.value.order = order
    post.value.questStatus = 'in_progress'
    actionMsg.value = '接单成功，请通过私信与对方联系'
    emit('updated')
  }
  catch (e) {
    error.value = e.message
  }
}

async function onSubmitComplete() {
  try {
    await submitQuestComplete(Number(props.id), submitNote.value.trim())
    await load()
    actionMsg.value = '已提交完成，等待发布者确认'
    emit('updated')
  }
  catch (e) {
    error.value = e.message
  }
}

async function onConfirmComplete() {
  try {
    await confirmQuestComplete(Number(props.id))
    await load()
    actionMsg.value = '任务已完结'
    emit('updated')
  }
  catch (e) {
    error.value = e.message
  }
}
</script>

<template>
  <div class="detail-pane">
    <p v-if="loading" class="status">正在加载需求详情…</p>
    <div v-else-if="error" class="detail-notice">
      <p class="error">{{ error }}</p>
      <button type="button" class="btn ghost sm" @click="load">重新加载</button>
    </div>
    <div v-else-if="!post" class="detail-notice">
      <p>这条需求暂时无法显示，可能已被发布者删除。</p>
    </div>

    <template v-else>
      <p v-if="actionMsg" class="detail-flash">{{ actionMsg }}</p>

      <div class="detail-head">
        <div class="detail-head__main">
          <div class="detail-head__titleline">
            <h2>{{ post.title || '未命名需求' }}</h2>
            <span
              class="detail-head__price"
              :class="{ 'detail-head__price--muted': !isBounty || priceText === '面议' }"
            >{{ priceText }}</span>
          </div>
          <div class="detail-head__tags">
            <span class="badge" :class="post.postKind">{{ isBounty ? '悬赏' : '求助' }}</span>
            <span v-if="isBounty" class="status-pill" :class="post.questStatus">
              {{ STATUS_LABEL[post.questStatus] || '待接单' }}
            </span>
            <span class="detail-head__tag">{{ relativeTime(post.postTime) }}发布</span>
            <span v-if="post.questDeadline" class="detail-head__tag">截止 {{ formatDeadline(post.questDeadline) }}</span>
            <span class="detail-head__tag">浏览 {{ statCount(post.viewCount) }}</span>
            <span class="detail-head__tag">沟通 {{ statCount(post.chatCount) }}</span>
          </div>
        </div>
        <div class="detail-head__actions">
          <button type="button" class="btn ghost sm" @click="onSave">{{ post.isSaved ? '已收藏' : '收藏' }}</button>
          <button v-if="!isOwner" type="button" class="btn primary" @click="contactAuthor">私聊发布者</button>
        </div>
      </div>

      <section class="detail-section">
        <h3>需求描述</h3>
        <div class="detail-body">{{ post.content || '发布者暂未填写详细说明，可直接私聊询问。' }}</div>
        <div v-if="post.attachments?.length" class="attach-grid">
          <a v-for="(a, i) in post.attachments" :key="i" :href="a.url" target="_blank" rel="noopener">
            <img :src="a.url" alt="">
          </a>
        </div>
      </section>

      <section class="detail-section">
        <h3>需求信息</h3>
        <dl class="info-grid">
          <div><dt>任务类型</dt><dd>{{ isBounty ? '悬赏任务' : '纯求助' }}</dd></div>
          <div><dt>悬赏金额</dt><dd>{{ priceText }}</dd></div>
          <div><dt>当前状态</dt><dd>{{ STATUS_LABEL[post.questStatus] || '待接单' }}</dd></div>
          <div><dt>截止时间</dt><dd>{{ formatDeadline(post.questDeadline) || '未设置' }}</dd></div>
          <div><dt>发布时间</dt><dd>{{ postedAt }}</dd></div>
          <div><dt>发布者</dt><dd>{{ publisher.authorName || '用户' }}</dd></div>
        </dl>
      </section>

      <div class="detail-publisher">
        <img class="detail-avatar" :src="avatarUrl(publisher.authorAvatar)" alt="" @error="onAvatarError">
        <div class="detail-publisher__info">
          <strong>{{ publisher.authorName || '用户' }}</strong>
          <span>{{ levelLabel(publisher.authorScore) }} · {{ relativeTime(post.postTime) }}发布</span>
        </div>
        <button v-if="!isOwner" type="button" class="btn ghost sm" @click="contactAuthor">发私信</button>
      </div>

      <div v-if="post.order" class="order-box">
        <strong>接单信息</strong>
        <p>接单人：{{ post.order.workerName || '用户' }}</p>
        <p v-if="post.order.submitNote" class="muted">完成说明：{{ post.order.submitNote }}</p>
      </div>

      <div v-if="isOwner && isBounty" class="detail-owner-row">
        <label for="status-select">帖子状态</label>
        <select id="status-select" v-model="statusDraft">
          <option v-for="o in statusOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
        </select>
        <button type="button" class="btn ghost sm" @click="onUpdateStatus">更新</button>
        <button type="button" class="btn danger sm" @click="onDelete">删除帖子</button>
      </div>
      <div v-else-if="isOwner" class="detail-owner-row">
        <button type="button" class="btn danger sm" @click="onDelete">删除帖子</button>
      </div>

      <div class="detail-actions">
        <button
          v-if="isBounty && !isOwner && post.questStatus === 'open' && !post.order"
          type="button"
          class="btn primary"
          @click="onAccept"
        >我要接单</button>
        <template v-if="isBounty && isWorker && post.questStatus === 'in_progress'">
          <input v-model="submitNote" class="profile-input" placeholder="完成说明（可选）">
          <button type="button" class="btn primary" @click="onSubmitComplete">提交完成</button>
        </template>
        <button
          v-if="isBounty && isOwner && post.questStatus === 'pending_confirm'"
          type="button"
          class="btn primary"
          @click="onConfirmComplete"
        >确认任务已完成</button>
        <button v-if="post.order && (isOwner || isWorker)" type="button" class="btn ghost" @click="contactWorker">联系接单人</button>
        <button v-if="!isOwner" type="button" class="btn danger sm" @click="onReport">举报</button>
      </div>

      <p class="detail-note">这里不设公开评论区。想问细节、谈价格、对接进度，直接点上面的「私聊发布者」一对一聊。平台不托管资金，请自行协商与结算。</p>

      <AuthorNotes
        :post-id="Number(post.postID || props.id)"
        :is-owner="!!isOwner"
        :author-name="publisher.authorName || '发布者'"
      />
    </template>
  </div>
</template>

<style scoped>
.detail-notice {
  padding: 8px 0 20px;
}
.detail-notice .error {
  margin: 0 0 12px;
}
.attach-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 14px;
}
.attach-grid img {
  width: 100px;
  height: 100px;
  object-fit: cover;
  border-radius: 6px;
  border: 1px solid var(--border);
}
.detail-owner-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
}
.detail-owner-row label {
  font-size: 13px;
  color: var(--text-secondary);
}
.detail-owner-row select {
  padding: 7px 10px;
  border: 1px solid var(--input-border);
  border-radius: 6px;
  font: inherit;
  font-size: 13px;
  background: var(--surface);
  color: var(--text);
}
</style>
