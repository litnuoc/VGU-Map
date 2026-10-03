<template>
  <div class="equipment-page">
    <EquipmentDetail v-if="item" :item="item" @close="goBack" />

    <div v-else class="eq-empty">
      <p>KHÔNG TÌM THẤY THIẾT BỊ: <b>{{ route.params.id }}</b></p>
      <button class="eq-back" @click="goBack">[ ← QUAY LẠI BẢN ĐỒ ]</button>
    </div>
  </div>
</template>

<script setup>
import { useRoute, useRouter } from 'vue-router'
import { useAsyncData } from '#app'

const route = useRoute()
const router = useRouter()

// @nuxt/content v2 -> dùng queryContent() (KHÔNG phải queryCollection() của v3).
const { data: item } = await useAsyncData(`equipment-${route.params.id}`, () =>
  queryContent('equipment').where({ id: route.params.id }).findOne()
)

useSeoMeta({
  title: () => item.value ? `${item.value.title} | VGU Map` : 'Chi tiết thiết bị | VGU Map',
  description: () => item.value?.optional_information?.physics?.primary_mechanism
    || (item.value ? `Thông số kỹ thuật của ${item.value.title} tại VGU.` : 'Thiết bị VGU.')
})

function goBack() {
  // Nếu có lịch sử điều hướng nội bộ thì lùi lại, không thì về trang bản đồ.
  if (window.history.state?.back) router.back()
  else router.push('/')
}
</script>

<style scoped>
.equipment-page {
  position: absolute;
  inset: 0;
  overflow-y: auto;
  background: #070A12;
  /* AppHeader (layouts/default.vue) là position:absolute đè trên mọi trang.
     Trước khi có header dùng chung, trang này bắt đầu ngay từ top:0 nên h1/btn-close
     (top:20px trong EquipmentDetail.vue) giờ sẽ bị header che nếu không chừa chỗ. */
  padding-top: var(--header-h, 64px);
}
@media (max-width: 640px) {
  .equipment-page { padding-top: var(--header-h-mobile, 54px); }
}
.eq-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 18px;
  height: 100%;
  color: #8aa;
  font-family: 'Space Mono', monospace;
  font-size: 14px;
}
.eq-empty b { color: #EF5A24; }
.eq-back {
  background: none;
  border: 1px solid rgba(0, 255, 204, 0.4);
  color: #00ffcc;
  padding: 8px 16px;
  border-radius: 4px;
  font-family: 'Space Mono', monospace;
  cursor: pointer;
  transition: all 0.2s ease;
}
.eq-back:hover { background: rgba(0, 255, 204, 0.1); }

.wrapper {
  background: var(--surface-root);
  color: var(--ink-strong);
  font-family: var(--type-main);
}

.cta {
  background: var(--brand-accent);
  border: 1px solid transparent;
  color: var(--ink-strong);
}

.cta:hover {
  background: var(--brand-accent-soft);
}
</style>
