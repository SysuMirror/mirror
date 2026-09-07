<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { fetchQuestList, updateUserProfile } from '../api/quest'
import { useUserStore } from '../stores/user'
import QuestCard from '../components/QuestCard.vue'
import AvatarUploader from '../components/AvatarUploader.vue'
import { levelLabel } from '../utils/display'

const router = useRouter()
const user = useUserStore()
const tab = ref('posts')
const items = ref([])
const loading = ref(false)
const error = ref('')
const editName = ref('')
const editAvatar = ref('')
const saving = ref(false)
const editing = ref(false)
const notice = ref('')

async function loadList() {
  loading.value = true
  error.value = ''
  try {
    const params = tab.value === 'saved' ? { saved: true } : { myPosts: true }
    const res = await fetchQuestList(params)
    items.value = res.items
  }
  catch (e) {
    error.value = e.message
  }
  finally {
    loading.value = false
  }
}

async function init() {
  await user.refreshMe()
  if (user.me) {
    editName.value = user.me.name || ''
    editAvatar.value = user.me.avatarURL || ''
  }
  await loadList()
}

async function saveProfile() {
  if (!user.me)
    return
  saving.value = true
  error.value = ''
  try {
    await updateUserProfile({
      userID: user.me.userID,
      name: editName.value.trim(),
      avatarURL: editAvatar.value.trim(),
    })
    await user.refreshMe()
    if (user.me) {
      editName.value = user.me.name || editName.value
      editAvatar.value = user.me.avatarURL || editAvatar.value
    }
    notice.value = '已保存'
    editing.value = false
  }
  catch (e) {
    error.value = e.message
  }
  finally {
    saving.value = false
  }
}

async function onAvatarUploaded(url) {
  editAvatar.value = url
  if (!user.me)
    return
  try {
    await updateUserProfile({
      userID: user.me.userID,
      name: (editName.value || user.me.name || '').trim(),
      avatarURL: url,
    })
    await user.refreshMe()
    notice.value = '头像已更新'
  }
  catch (e) {
    error.value = e.message
  }
}

function openEdit() {
  editing.value = true
  notice.value = ''
  if (user.me) {
    editName.value = user.me.name || ''
    editAvatar.value = user.me.avatarURL || editAvatar.value
  }
}

function cancelEdit() {
  editing.value = false
  if (user.me) {
    editName.value = user.me.name || ''
    editAvatar.value = user.me.avatarURL || ''
  }
}

function switchTab(t) {
  tab.value = t
  loadList()
}

function openPost(id) {
  router.push({ name: 'detail', params: { id } })
}

function logout() {
  user.logout()
  router.push({ name: 'login' })
}

onMounted(init)
</script>

<template>
  <div class="page">
    <header class="topbar">
      <h1>个人信息</h1>
    </header>

    <div v-if="user.me" class="profile-hero">
      <div class="profile-hero__main">
        <AvatarUploader
          :url="editAvatar || user.me.avatarURL"
          :size="72"
          @uploaded="onAvatarUploaded"
        />
        <div class="profile-hero__info">
          <h2 class="profile-hero__name">{{ editName || user.me.name }}</h2>
          <p class="profile-level">{{ levelLabel(user.me.score || 0) }}</p>
        </div>
      </div>
      <div v-if="!editing" class="profile-edit">
        <button type="button" class="btn ghost block" @click="openEdit">编辑资料</button>
      </div>
      <div v-else class="profile-edit profile-edit--open">
        <input v-model="editName" class="profile-input" maxlength="30" placeholder="昵称">
        <button class="btn primary sm" :disabled="saving" @click="saveProfile">
          {{ saving ? '…' : '保存' }}
        </button>
        <button type="button" class="btn ghost sm" @click="cancelEdit">取消</button>
      </div>
      <p v-if="notice" class="success" style="margin-top:10px">{{ notice }}</p>
    </div>

    <div class="tabs">
      <button :class="{ active: tab === 'posts' }" @click="switchTab('posts')">发帖</button>
      <button :class="{ active: tab === 'saved' }" @click="switchTab('saved')">收藏</button>
    </div>

    <p v-if="loading" class="status">加载中…</p>
    <p v-else-if="error" class="error">{{ error }}</p>
    <div v-else-if="!items.length" class="empty-state">
      <h3>{{ tab === 'saved' ? '还没有收藏' : '还没有发帖' }}</h3>
      <p>{{ tab === 'saved' ? '在详情页收藏帖子后会显示在这里' : '去发布你的第一条需求' }}</p>
    </div>
    <div v-else class="card-list">
      <div v-for="p in items" :key="p.postID" class="card-wrap" @click="openPost(p.postID)">
        <QuestCard :post="p" />
      </div>
    </div>

    <button type="button" class="btn-logout" @click="logout">退出登录</button>
  </div>
</template>

<style scoped>
.profile-level {
  margin: 0;
  font-size: 13px;
  color: var(--text-muted);
  font-weight: 500;
}
.profile-edit {
  display: flex;
  gap: 10px;
  align-items: center;
  margin-top: 16px;
}
.profile-edit--open .profile-input { flex: 1; margin: 0; }
.profile-hero__main { overflow: visible; }
.btn-logout {
  display: block;
  width: 100%;
  margin: 28px 0 8px;
  padding: 12px 16px;
  border-radius: 7px;
  border: 1px solid #e8a0a0;
  background: #fff;
  color: #c45c5c;
  font: inherit;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
}
.btn-logout:active {
  background: #fff8f8;
}
</style>
