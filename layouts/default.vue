<!-- layouts/default.vue
     Trước đây KHÔNG có layouts/ nào -> Header bị hard-code riêng trong pages/index.vue,
     còn pages/equipment-[id].vue không có nav gì cả. Giờ mọi <NuxtPage/> (qua app.vue)
     đều đi qua layout này -> Header luôn nhất quán, chỉ render 1 lần, không re-render
     khi đổi route (đúng khuyến nghị tách Header khỏi vòng đời dữ liệu trang).
     Trang con tự quyết định statusLabel qua provide/props nếu cần (xem pages/index.vue). -->
<template>
  <div class="default-layout">
    <AppHeader :status-label="headerStatus" />
    <div class="layout-body">
      <slot />
    </div>
  </div>
</template>

<script setup>
import { ref, provide } from 'vue'

// Trang con (vd. pages/index.vue) có thể gọi useHeaderStatus().set('...') để
// cập nhật dòng trạng thái trong header mà không cần layout biết về Pinia/HologramMap.
const headerStatus = ref('')
provide('header-status', headerStatus)
</script>

<style>
/* Biến CSS chiều cao header, dùng ở mọi nơi cần chừa chỗ (vd. equipment-page padding-top,
   global-search-container top). Đặt global (không scoped) để component con đọc được. */
:root {
  --header-h: 64px;
  --header-h-mobile: 54px;
}
</style>

<style scoped>
.default-layout {
  position: relative;
  width: 100%;
  height: 100%;
}
.layout-body {
  position: absolute;
  inset: 0;
}
</style>
