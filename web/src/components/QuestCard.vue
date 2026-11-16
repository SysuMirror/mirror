<script setup>
import { computed } from 'vue'
import { useUserStore } from '../stores/user'
import { withCurrentAuthor } from '../utils/author'
import { DEFAULT_AVATAR, STATUS_LABEL, avatarUrl, formatDeadline, formatPrice, relativeTime } from '../utils/display'

const props = defineProps({
  post: { type: Object, required: true },
})

const user = useUserStore()
// 作者名是发帖时的快照，改名后会旧；展示时按 authorID 关联当前账号资料。
// me 是响应式的，改完名字不用重新拉列表也能立刻跟上。
const author = computed(() => withCurrentAuthor(props.post, user.me))

// 列表只放标题 + 标签，正文一律点进详情才看。
// 标签从标题里挑技能词，不铺正文、不生成「AI 摘要」。
const SKILL_WORDS = [
  'Vue', 'React', 'HTML', 'CSS', 'JavaScript', 'TypeScript', 'Java', 'Python',
  'C语言', 'C++', 'SQL', 'Figma', 'PS', 'Excel', 'UniSSO', 'Dijkstra', 'Floyd',
  '多线程', '链表', '小程序', '响应式', '论文', '雅思', '英语', '数据结构',
  '算法', '数据分析', '课设', '作业',
]
const skillTags = computed(() => {
  const text = `${props.post.title || ''} ${props.post.keywords || ''}`
  return SKILL_WORDS.filter(w => text.toLowerCase().includes(w.toLowerCase())).slice(0, 2)
})

// 头像地址失效（断网、外链挂掉、脏数据）时回退到内置占位图，不显示破图标
function onAvatarError(e) {
  const img = e.target
  if (img.dataset.fallback)
    return
  img.dataset.fallback = '1'
  img.src = DEFAULT_AVATAR
}
</script>

<template>
  <article class="quest-card">
    <div class="quest-card__top">
      <h2 class="quest-card__title">{{ post.title || '未命名需求' }}</h2>
      <span
        v-if="post.postKind === 'bounty'"
        class="quest-card__price"
        :class="{ 'quest-card__price--muted': formatPrice(post) === '面议' }"
      >
        {{ formatPrice(post) }}
      </span>
      <span v-else class="quest-card__price quest-card__price--muted">求助</span>
    </div>

    <div class="quest-card__tags">
      <span class="badge" :class="post.postKind">
        {{ post.postKind === 'bounty' ? '悬赏' : '求助' }}
      </span>
      <span v-if="post.category" class="quest-card__cat">{{ post.category }}</span>
      <span v-for="t in skillTags" :key="t" class="quest-card__skill">{{ t }}</span>
      <span
        v-if="post.postKind === 'bounty'"
        class="status-pill"
        :class="post.questStatus"
      >
        {{ STATUS_LABEL[post.questStatus] || '待接单' }}
      </span>
    </div>

    <footer class="quest-card__foot">
      <div class="quest-card__foot-left">
        <img class="quest-card__avatar" :src="avatarUrl(author.authorAvatar)" alt="" @error="onAvatarError">
        <span class="quest-card__author-name">{{ author.authorName || '匿名用户' }}</span>
      </div>
      <div class="quest-card__meta-right">
        <span v-if="post.questDeadline">截止 {{ formatDeadline(post.questDeadline) }}</span>
        <span>{{ relativeTime(post.postTime) }}</span>
      </div>
    </footer>
  </article>
</template>
