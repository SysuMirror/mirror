<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  acceptQuestOrder,
  confirmQuestComplete,
  deleteQuestPost,
  fetchComments,
  fetchQuestDetail,
  postComment,
  submitQuestComplete,
  submitReport,
  toggleSave,
  updateQuestStatus,
} from '../api/quest'
import { useUserStore } from '../stores/user'
import { STATUS_LABEL, avatarUrl, formatDeadline, formatPrice, levelLabel } from '../utils/display'

const props = defineProps({ id: { type: [String, Number], required: true } })
const router = useRouter()
const user = useUserStore()
const post = ref(null)
const comments = ref([])
const commentText = ref('')
const loading = ref(true)
const error = ref('')
const actionMsg = ref('')
const statusDraft = ref('open')
const submitNote = ref('')

const isOwner = computed(() => post.value && user.me?.userID === post.value.authorID)
const isWorker = computed(() => post.value?.order && user.me?.userID === post.value.order.workerID)
const isBounty = computed(() => post.value?.postKind === 'bounty')
const myID = computed(() => user.me?.userID || 0)

const statusOptions = [
  { value: 'open', label: '待接单' },
  { value: 'in_progress', label: '进行中' },
  { value: 'completed', label: '已完成' },
]

async function load() {
  loading.value = true
  error.value = ''
  actionMsg.value = ''
  try {
    await user.refreshMe()
    post.value = await fetchQuestDetail(Number(props.id))
    statusDraft.value = post.value.questStatus || 'open'
    if (user.me?.phone)
      comments.value = await fetchComments(Number(props.id), user.me.phone)
  }
  catch (e) {
    error.value = e.message
  }
  finally {
    loading.value = false
  }
}

async function sendComment() {
  const text = commentText.value.trim()
  if (!text || !user.me?.phone)
    return
  try {
    await postComment(Number(props.id), text, user.me.phone)
    commentText.value = ''
    comments.value = await fetchComments(Number(props.id), user.me.phone)
  }
  catch (e) {
    error.value = e.message
  }
}

function contactAuthor() {
  if (!post.value?.authorID)
    return
  router.push({ name: 'messages', query: { user: String(post.value.authorID) } })
}

function contactWorker() {
  if (!post.value?.order?.workerID)
    return
  router.push({ name: 'messages', query: { user: String(post.value.order.workerID) } })
}

async function onSave() {
  if (!user.me?.phone)
    return
  try {
    const result = await toggleSave(Number(props.id), user.me.phone)
    post.value.isSaved = result.data?.isSaved ?? !post.value.isSaved
    actionMsg.value = post.value.isSaved ? '已收藏' : '已取消收藏'
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
    router.replace({ name: 'home' })
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
  }
  catch (e) {
    error.value = e.message
  }
}

onMounted(load)
</script>

<template>
  <div class="page page--no-nav">
    <header class="topbar">
      <button class="btn ghost" @click="router.back()">← 返回</button>
      <h1>详情</h1>
    </header>

    <p v-if="loading" class="status">加载中…</p>
    <p v-else-if="error" class="error">{{ error }}</p>
    <p v-if="actionMsg" class="success panel">{{ actionMsg }}</p>

    <template v-else-if="post">
      <article class="panel detail">
        <div class="quest-card__meta-row">
          <span class="badge" :class="post.postKind">{{ post.postKind === 'bounty' ? '悬赏' : '求助' }}</span>
          <span
            v-if="post.postKind === 'bounty'"
            class="status-pill"
            :class="post.questStatus"
          >
            {{ STATUS_LABEL[post.questStatus] || '待接单' }}
          </span>
        </div>
        <h2>{{ post.title }}</h2>
        <div v-if="post.postKind === 'bounty'" class="detail-price">{{ formatPrice(post) }}</div>
        <p v-if="post.questDeadline" class="detail-meta">截止：{{ formatDeadline(post.questDeadline) }}</p>
        <div class="detail-hero">
          <img class="detail-avatar" :src="avatarUrl(post.authorAvatar)" alt="">
          <div>
            <strong>{{ post.authorName }}</strong>
            <p class="detail-meta">{{ levelLabel(post.authorScore) }} · {{ new Date(post.postTime).toLocaleString('zh-CN') }}</p>
          </div>
        </div>
        <div class="detail-body">{{ post.content }}</div>

        <div v-if="post.attachments?.length" class="attach-grid">
          <a v-for="(a, i) in post.attachments" :key="i" :href="a.url" target="_blank" rel="noopener">
            <img :src="a.url" alt="">
          </a>
        </div>

        <div v-if="post.order" class="order-box panel">
          <strong>接单信息</strong>
          <p>接单人：{{ post.order.workerName || '用户' }}</p>
          <p v-if="post.order.submitNote" class="muted">完成说明：{{ post.order.submitNote }}</p>
        </div>

        <div v-if="isOwner && isBounty" class="profile-section">
          <label>帖子状态</label>
          <div class="filter-row">
            <select v-model="statusDraft">
              <option v-for="o in statusOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
            </select>
            <button class="btn primary sm" @click="onUpdateStatus">更新</button>
            <button class="btn danger sm" @click="onDelete">删除帖子</button>
          </div>
        </div>
        <div v-else-if="isOwner" class="detail-actions" style="margin-top:12px">
          <button class="btn danger sm" @click="onDelete">删除帖子</button>
        </div>

        <div class="detail-actions">
          <button
            v-if="isBounty && !isOwner && post.questStatus === 'open' && !post.order"
            class="btn primary"
            @click="onAccept"
          >
            我要接单
          </button>
          <template v-if="isBounty && isWorker && post.questStatus === 'in_progress'">
            <input v-model="submitNote" class="profile-input" placeholder="完成说明（可选）">
            <button class="btn primary" @click="onSubmitComplete">提交完成</button>
          </template>
          <button
            v-if="isBounty && isOwner && post.questStatus === 'pending_confirm'"
            class="btn primary"
            @click="onConfirmComplete"
          >
            确认任务已完成
          </button>
          <button v-if="!isOwner" class="btn primary" @click="contactAuthor">联系发布者</button>
          <button v-if="post.order && (isOwner || isWorker)" class="btn ghost" @click="contactWorker">联系接单人</button>
          <button class="btn ghost" @click="onSave">{{ post.isSaved ? '已收藏' : '收藏' }}</button>
          <button v-if="!isOwner" class="btn danger sm" @click="onReport">举报</button>
        </div>

        <p class="muted" style="margin-top:12px;font-size:13px">平台不托管资金，请通过私信自行协商与结算。</p>
      </article>

      <section class="panel">
        <h3>评论 ({{ comments.length }})</h3>
        <div v-for="c in comments" :key="c.PcommentID" class="comment">
          <strong>{{ c.Author }}</strong>
          <span class="muted"> · {{ new Date(c.CommentTime).toLocaleString('zh-CN') }}</span>
          <p>{{ c.Content }}</p>
        </div>
        <div class="comment-box">
          <textarea v-model="commentText" rows="3" placeholder="写评论…" />
          <button class="btn primary" @click="sendComment">发送</button>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.attach-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin: 12px 0;
}
.attach-grid img {
  width: 100px;
  height: 100px;
  object-fit: cover;
  border-radius: 7px;
}
.order-box {
  margin: 12px 0;
  padding: 12px;
  background: #f7f7f5;
  border-radius: 7px;
}
</style>
