<script setup>
import { ref } from 'vue'
import { uploadQuestImage } from '../api/upload'

const props = defineProps({
  modelValue: { type: Array, default: () => [] },
  max: { type: Number, default: 6 },
})

const emit = defineEmits(['update:modelValue'])

const uploading = ref(false)
const error = ref('')

async function onPick(ev) {
  const files = [...ev.target.files || []]
  ev.target.value = ''
  if (!files.length)
    return
  uploading.value = true
  error.value = ''
  const list = [...props.modelValue]
  try {
    for (const file of files) {
      if (list.length >= props.max)
        break
      if (!file.type.startsWith('image/'))
        continue
      const url = await uploadQuestImage(file)
      list.push({ url, name: file.name, type: 'image' })
    }
    emit('update:modelValue', list)
  }
  catch (e) {
    error.value = e.message
  }
  finally {
    uploading.value = false
  }
}

function remove(i) {
  const list = [...props.modelValue]
  list.splice(i, 1)
  emit('update:modelValue', list)
}
</script>

<template>
  <div class="img-uploader">
    <div class="img-grid">
      <div v-for="(img, i) in modelValue" :key="img.url" class="img-thumb">
        <img :src="img.url" alt="">
        <button type="button" class="img-remove" @click="remove(i)">×</button>
      </div>
      <label v-if="modelValue.length < max" class="img-add">
        <span>{{ uploading ? '…' : '+' }}</span>
        <input type="file" accept="image/*" multiple hidden @change="onPick">
      </label>
    </div>
    <p class="muted">最多 {{ max }} 张图片</p>
    <p v-if="error" class="error">{{ error }}</p>
  </div>
</template>

<style scoped>
.img-grid { display: flex; flex-wrap: wrap; gap: 10px; }
.img-thumb {
  position: relative;
  width: 80px;
  height: 80px;
  border-radius: 8px;
  overflow: hidden;
}
.img-thumb img { width: 100%; height: 100%; object-fit: cover; }
.img-remove {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 22px;
  height: 22px;
  border: none;
  border-radius: 4px;
  background: rgba(0,0,0,0.55);
  color: #fff;
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
}
.img-add {
  width: 80px;
  height: 80px;
  border: 1px dashed #94a3b8;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  color: #94a3b8;
  cursor: pointer;
  background: #f8fafc;
}
.error { color: #dc2626; font-size: 13px; }
</style>
