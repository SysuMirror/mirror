<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { addNote, fetchNotes } from '../api/notes'
import { useUserStore } from '../stores/user'
import { withCurrentAuthor } from '../utils/author'
import { relativeTime } from '../utils/display'
import {
  NOTE_MAX_LENGTH,
  NOTE_MAX_PER_POST,
  noteError,
  noteLength,
  noteMessage,
} from '../utils/note'

const props = defineProps({
  postId: { type: [String, Number], required: true },
  isOwner: { type: Boolean, default: false },
  authorName: { type: String, default: '发布者' },
})

const user = useUserStore()
// 历史补充说明里存的是写入时的名字快照；账号改名后按 authorID 关联当前资料，
// 避免同一条帖子里「发布者」是新名字、「补充 1」还是旧名字。
const notes = ref([])
const resolvedNotes = computed(() => notes.value.map(n => withCurrentAuthor(n, user.me)))
const loading = ref(true)
const error = ref('')
const draft = ref('')
const draftError = ref('')
const saving = ref(false)
const flash = ref('')
const maxPerPost = ref(NOTE_MAX_PER_POST)

const draftId = computed(() => `note-draft-${props.postId}`)
const limitReached = computed(() => notes.value.length >= (maxPerPost.value || NOTE_MAX_PER_POST))
const liveError = computed(() => {
  if (noteLength(draft.value) > NOTE_MAX_LENGTH)
    return noteMessage('tooLong', { max: NOTE_MAX_LENGTH })
  return draftError.value
})

function formatTime(iso) {
  if (!iso)
    return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('zh-CN')
}

async function load() {
  loading.value = true
  error.value = ''
  draft.value = ''
  draftError.value = ''
  flash.value = ''
  notes.value = []
  try {
    const result = await fetchNotes(props.postId)
    notes.value = result.notes
    maxPerPost.value = result.maxPerPost || NOTE_MAX_PER_POST
  }
  catch (e) {
    error.value = e?.message || '补充说明加载失败，请稍后重试'
  }
  finally {
    loading.value = false
  }
}

watch(() => props.postId, load)
watch(draft, () => {
  if (draftError.value)
    draftError.value = ''
})
onMounted(load)

async function submit() {
  if (saving.value || limitReached.value)
    return
  const err = noteError(draft.value)
  if (err) {
    draftError.value = err
    return
  }
  saving.value = true
  draftError.value = ''
  flash.value = ''
  try {
    // 服务端返回的是权威记录（含净化后的内容与落库时间），不再重复拉整列表
    const note = await addNote(props.postId, draft.value)
    if (note)
      notes.value = [...notes.value, note]
    else
      await load()
    draft.value = ''
    flash.value = '补充说明已发布，所有访问者都能看到'
  }
  catch (e) {
    draftError.value = e?.message || '发布失败，请稍后重试'
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <section class="author-notes" aria-labelledby="author-notes-title">
    <header class="author-notes__head">
      <h3 id="author-notes-title">发布者补充</h3>
      <span class="author-notes__count">{{ notes.length }} 条</span>
      <span class="author-notes__hint">只展示发布者本人后续补充的细节，不设公开评论区</span>
    </header>

    <p v-if="loading" class="author-notes__status">正在加载补充说明…</p>
    <div v-else-if="error" class="author-notes__error">
      <span>{{ error }}</span>
      <button type="button" class="btn ghost sm" @click="load">重新加载</button>
    </div>

    <template v-else>
      <ol v-if="notes.length" class="note-timeline">
        <li v-for="(item, i) in resolvedNotes" :key="item.id" class="note-timeline__item">
          <span class="note-timeline__dot">{{ i + 1 }}</span>
          <div class="note-timeline__body">
            <div class="note-timeline__meta">
              <span class="note-timeline__label">补充 {{ i + 1 }}</span>
              <span class="note-timeline__author">{{ item.authorName || authorName }}</span>
              <time :title="formatTime(item.createdAt)">{{ relativeTime(item.createdAt) || '刚刚' }}</time>
            </div>
            <p class="note-timeline__text">{{ item.content }}</p>
          </div>
        </li>
      </ol>

      <div v-else class="note-empty">
        <strong>{{ isOwner ? '还没有补充过细节' : '发布者暂时没有补充说明' }}</strong>
        <p>{{ isOwner
          ? '想到新的验收标准、交付时间或参考资料，随时补在下面，所有想接单的人都能看到。'
          : '发布者补了新的细节会直接显示在这里；着急的话可以点上方「私聊发布者」直接问。' }}</p>
      </div>

      <form v-if="isOwner" class="note-compose" @submit.prevent="submit">
        <label :for="draftId">补充一条细节</label>
        <textarea
          :id="draftId"
          v-model="draft"
          rows="3"
          :disabled="saving || limitReached"
          placeholder="例如：需要交付源文件、接口兼容 Python 3.11、周末方便对接…"
        />
        <div class="note-compose__foot">
          <span class="note-compose__counter" :class="{ 'is-over': noteLength(draft) > NOTE_MAX_LENGTH }">
            {{ noteLength(draft) }} / {{ NOTE_MAX_LENGTH }}
          </span>
          <span v-if="liveError" class="note-compose__error">{{ liveError }}</span>
          <span v-else-if="flash" class="note-compose__flash">{{ flash }}</span>
          <button type="submit" class="btn primary sm" :disabled="saving || limitReached">
            {{ saving ? '发布中…' : '发布补充' }}
          </button>
        </div>
        <p v-if="limitReached" class="note-compose__limit">已达到每条需求最多 {{ maxPerPost }} 条的上限</p>
      </form>
    </template>
  </section>
</template>

<style scoped>
.author-notes {
  margin: 22px 0 0;
  padding: 18px 20px 20px;
  background: #f8faff;
  border: 1px solid #e6edf9;
  border-radius: 10px;
}
.author-notes__head {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 14px;
}
.author-notes__head h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: var(--text);
}
.author-notes__count {
  padding: 2px 9px;
  border-radius: 999px;
  background: var(--accent-soft);
  color: var(--accent);
  font-size: 12px;
  font-weight: 600;
}
.author-notes__hint {
  margin-left: auto;
  font-size: 12px;
  color: var(--text-muted);
}
.author-notes__status {
  margin: 0;
  font-size: 13px;
  color: var(--text-muted);
}
.author-notes__error {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 13px;
  color: var(--danger);
}

.note-timeline {
  list-style: none;
  margin: 0 0 16px;
  padding: 0;
}
.note-timeline__item {
  position: relative;
  display: flex;
  gap: 12px;
  padding-bottom: 14px;
}
.note-timeline__item:last-child {
  padding-bottom: 0;
}
.note-timeline__item:not(:last-child)::before {
  content: '';
  position: absolute;
  left: 11px;
  top: 25px;
  bottom: 0;
  width: 1px;
  background: #d9e4f7;
}
.note-timeline__dot {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 23px;
  height: 23px;
  border-radius: 50%;
  background: #dbe8ff;
  color: var(--accent);
  font-size: 12px;
  font-weight: 700;
}
.note-timeline__body {
  flex: 1;
  min-width: 0;
  padding: 10px 14px;
  background: var(--surface);
  border: 1px solid #e9eef7;
  border-radius: 8px;
}
.note-timeline__meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--text-muted);
}
.note-timeline__label {
  color: var(--accent);
  font-weight: 600;
}
.note-timeline__author {
  color: var(--text-secondary);
}
.note-timeline__text {
  margin: 6px 0 0;
  font-size: 14px;
  line-height: 1.7;
  color: var(--text);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.note-empty {
  padding: 14px 16px;
  background: var(--surface);
  border: 1px dashed #d9e4f7;
  border-radius: 8px;
}
.note-empty strong {
  font-size: 14px;
  color: var(--text);
}
.note-empty p {
  margin: 4px 0 0;
  font-size: 13px;
  line-height: 1.7;
  color: var(--text-muted);
}

.note-compose {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #e6edf9;
}
.note-compose label {
  display: block;
  margin-bottom: 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
}
.note-compose textarea {
  display: block;
  width: 100%;
  min-height: 80px;
  padding: 10px 12px;
  border: 1px solid var(--input-border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--text);
  font: inherit;
  font-size: 14px;
  line-height: 1.6;
  resize: vertical;
}
.note-compose textarea:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px rgba(26, 109, 242, 0.1);
}
.note-compose textarea:disabled {
  background: #f2f4f8;
  color: var(--text-muted);
}
.note-compose__foot {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 10px;
}
.note-compose__foot button {
  margin-left: auto;
}
.note-compose__counter {
  font-size: 12px;
  color: var(--text-muted);
}
.note-compose__counter.is-over {
  color: var(--danger);
}
.note-compose__error {
  font-size: 12px;
  color: var(--danger);
}
.note-compose__flash {
  font-size: 12px;
  color: var(--success);
}
.note-compose__limit {
  margin: 8px 0 0;
  font-size: 12px;
  color: var(--warning);
}

@media (max-width: 767px) {
  .author-notes {
    margin-top: 20px;
    padding: 16px 14px;
  }
  .author-notes__hint {
    flex-basis: 100%;
    margin-left: 0;
  }
  .note-timeline__body {
    padding: 10px 12px;
  }
  .note-compose__foot button {
    margin-left: 0;
  }
}
</style>
