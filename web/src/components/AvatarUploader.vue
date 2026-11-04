<script setup>
import { ref } from 'vue'
import { uploadAvatar } from '../api/upload'
import { avatarUrl } from '../utils/display'

defineProps({
  url: { type: String, default: '' },
  size: { type: Number, default: 72 },
})
const emit = defineEmits(['update:url', 'uploaded'])

const uploading = ref(false)
const error = ref('')
const inputRef = ref(null)

async function onPick(ev) {
  const file = ev.target.files?.[0]
  ev.target.value = ''
  if (!file)
    return
  if (!file.type.startsWith('image/')) {
    error.value = '请选择图片文件'
    return
  }
  if (file.size > 5 * 1024 * 1024) {
    error.value = '图片不能超过 5MB'
    return
  }
  uploading.value = true
  error.value = ''
  try {
    const next = await uploadAvatar(file)
    emit('update:url', next)
    emit('uploaded', next)
  }
  catch (e) {
    error.value = e.message
  }
  finally {
    uploading.value = false
  }
}

function openPicker() {
  inputRef.value?.click()
}
</script>

<template>
  <div class="avatar-uploader">
    <div
      class="avatar-uploader__frame"
      :style="{ width: size + 'px', height: size + 'px' }"
    >
      <img :src="avatarUrl(url)" alt="头像" class="avatar-uploader__img">
      <button
        type="button"
        class="avatar-uploader__cam"
        :aria-label="uploading ? '上传中' : '修改头像'"
        :disabled="uploading"
        @click="openPicker"
      >
        <svg v-if="!uploading" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h2.1l1.2-1.8A1.5 1.5 0 0 1 11.05 3.5h1.9a1.5 1.5 0 0 1 1.25.7L15.4 6h2.1A2.5 2.5 0 0 1 20 8.5v8A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5v-8Z" stroke="currentColor" stroke-width="1.7" />
          <circle cx="12" cy="12.5" r="3.2" stroke="currentColor" stroke-width="1.7" />
        </svg>
        <span v-else class="avatar-uploader__spin" />
      </button>
      <input
        ref="inputRef"
        type="file"
        accept="image/*"
        class="avatar-uploader__input"
        @change="onPick"
      >
    </div>
    <p v-if="error" class="error">{{ error }}</p>
  </div>
</template>

<style scoped>
.avatar-uploader {
  display: inline-flex;
  flex-direction: column;
  align-items: flex-start;
}
.avatar-uploader__frame {
  position: relative;
  border-radius: 7px;
  overflow: visible;
  background: #2c3d56;
  border: 1px solid var(--border);
  box-shadow: none;
  flex-shrink: 0;
}
.avatar-uploader__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  border-radius: 6px;
  background: #2c3d56;
}
.avatar-uploader__cam {
  position: absolute;
  right: -6px;
  bottom: -6px;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  border: 1px solid var(--border);
  background: #fff;
  color: #374151;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: none;
  padding: 0;
}
.avatar-uploader__cam:disabled {
  opacity: 0.7;
  cursor: wait;
}
.avatar-uploader__spin {
  width: 12px;
  height: 12px;
  border: 2px solid #cbd5e1;
  border-top-color: #374151;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}
.avatar-uploader__input {
  position: absolute;
  width: 0;
  height: 0;
  opacity: 0;
  pointer-events: none;
}
.error { font-size: 13px; color: #dc2626; margin-top: 8px; }
</style>
