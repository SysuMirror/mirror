<script setup>
defineProps({ slide: { type: Object, required: true } })
</script>

<template>
  <span class="eco-media" :class="{ 'eco-media--paired': slide.image === 'dual-phone' }">
    <img
      v-for="(image, index) in slide.images"
      :key="image"
      :src="image"
      :class="{
        'eco-media__phone': slide.image === 'dual-phone',
        'eco-media__phone--back': slide.image === 'dual-phone' && index === 0,
      }"
      :alt="slide.image === 'dual-phone' && index === 0 ? '' : slide.alt"
      decoding="async"
      draggable="false"
    />
  </span>
</template>

<style scoped>
.eco-media {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  container-type: size;
}

.eco-media img {
  display: block;
  min-width: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
  user-select: none;
}

.eco-media--paired img.eco-media__phone {
  width: auto;
  max-width: 45cqw;
  height: 96cqh;
  object-fit: contain;
  position: relative;
  z-index: 1;
  filter: drop-shadow(0 13px 16px #050711a8);
}

.eco-media--paired img.eco-media__phone--back {
  z-index: 0;
  max-width: 38cqw;
  height: 77cqh;
  margin-right: -7cqw;
  transform: translateY(6cqh);
  opacity: .66;
  filter: saturate(.84) drop-shadow(0 11px 11px #05071180);
}
</style>
