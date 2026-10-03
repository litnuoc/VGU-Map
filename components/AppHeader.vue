<!-- components/AppHeader.vue
     Header dùng chung cho mọi trang (map + equipment detail + danh mục), render qua
     layouts/default.vue. Đổi từ thanh trong suốt/gradient sang thanh nền đặc + nav
     dạng nút viền theo yêu cầu bám sát 1 tham chiếu thiết kế cụ thể (badge logo cam,
     dòng phụ đề, 2 nút "BẢN ĐỒ TƯƠNG TÁC" / "TẤT CẢ THIẾT BỊ" bên phải, nút đang active
     viền cam). Giữ nguyên phần chữ/label hiện có của app (VGU MAP, tiếng Việt) thay vì
     copy nguyên văn chữ tiếng Anh trong ảnh tham chiếu — có thể đổi lại nếu cần.
     - `status`/`status-label` cho phép trang con (map) bơm trạng thái HUD riêng vào
       header mà không cần header biết gì về Pinia/HologramMap.
-->
<template>
  <header class="app-header">
    <NuxtLink to="/" class="header-brand" aria-label="Về trang bản đồ">
      <span class="header-badge">
        <img src="/VGU-Logo.png" class="header-logo" alt="" />
      </span>
      <span class="header-titles">
        <span class="header-title">
          <span class="title-accent">VGU</span> MAP
        </span>
        <span class="header-subtitle">DIGITAL MAP V3.1</span>
      </span>
    </NuxtLink>

    <div class="header-right">
      <nav class="header-nav" aria-label="Điều hướng chính">
        <NuxtLink to="/" class="nav-btn" exact-active-class="nav-btn--active">
          Bản đồ tương tác
        </NuxtLink>
        <!-- "Toà nhà" đã được tích hợp thành panel trực tiếp trên bản đồ
             (components/BuildingsDashboardPanel.vue), truy cập qua nút HUD
             bar ngay bên cạnh hud-context-panel trong pages/index.vue. -->
        <!-- pages/equipment/index.vue: trang danh mục toàn bộ thiết bị (route /equipment,
             không đụng /equipment-:id của trang chi tiết vì khác tên file/segment). -->
        <NuxtLink to="/equipment" class="nav-btn" active-class="nav-btn--active">
          Tất cả thiết bị
        </NuxtLink>
      </nav>

      <div class="header-status" v-if="statusLabel" role="status" aria-live="polite">
        <span class="pulse-dot" aria-hidden="true"></span>
        <span>{{ statusLabel }}</span>
      </div>
    </div>
  </header>
</template>

<script setup>
defineProps({
  statusLabel: { type: String, default: '' }
})
</script>

<style scoped>
.app-header {
  position: absolute;
  top: 0; left: 0; right: 0;
  z-index: 30; /* Trên map/floor-bar (20/60), dưới search bar (70) và panel (90/100) */
  height: var(--header-h, 64px);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 0 24px;
  /* Thanh nền đặc thay vì gradient trong suốt trước đây, để bám theo tham chiếu
     thiết kế (thanh header rõ khối, không loang vào map phía sau). */
  background: #0F1E36;
  border-bottom: 1px solid rgba(0, 255, 204, 0.12);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
}

.header-brand {
  display: flex; align-items: center; gap: 12px;
  text-decoration: none;
  border-radius: 6px;
}
.header-brand:focus-visible { outline: 2px solid #00ffcc; outline-offset: 4px; }

.header-badge {
  display: flex; align-items: center; justify-content: center;
  width: 38px; height: 38px;
  background: #EF5A24;
  border-radius: 8px;
  flex-shrink: 0;
}
.header-logo { height: 22px; width: auto; }

.header-titles { display: flex; flex-direction: column; gap: 1px; line-height: 1.1; }
.header-title {
  font-family: 'Be Vietnam Pro', sans-serif;
  font-size: 16px; font-weight: 700; color: #fff; letter-spacing: 0.5px;
}
.title-accent { color: #EF5A24; }
.header-subtitle {
  font-family: 'Space Mono', monospace;
  font-size: 10px; font-weight: 600; letter-spacing: 1.5px; color: #00ffcc;
  text-transform: uppercase;
}

.header-right { display: flex; align-items: center; gap: 20px; }

.header-nav { display: flex; align-items: center; gap: 10px; }
.nav-btn {
  font-family: 'Space Mono', monospace;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  color: #B3BFCD;
  text-decoration: none;
  padding: 9px 16px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 6px;
  white-space: nowrap;
  transition: color 0.15s, border-color 0.15s, background-color 0.15s;
}
.nav-btn:hover { color: #fff; border-color: rgba(0, 255, 204, 0.5); }
.nav-btn--active {
  color: #EF5A24;
  border-color: #EF5A24;
  background: rgba(239, 90, 36, 0.08);
}

.header-status {
  display: flex; align-items: center; gap: 8px;
  font-family: 'Space Mono', monospace;
  font-size: 11px; letter-spacing: 1px; color: #00ffcc;
  white-space: nowrap;
}
.pulse-dot {
  width: 8px; height: 8px; border-radius: 50%;
  background: #00ffcc; box-shadow: 0 0 8px #00ffcc;
  animation: pulse 1.6s ease-in-out infinite;
  flex-shrink: 0;
}
@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.4; transform: scale(0.7); }
}
@media (prefers-reduced-motion: reduce) {
  .pulse-dot { animation: none; }
}

/* Ngưỡng khớp với composables/useDeviceTier.js (BP_TABLET_MAX = 1024) để
   header đổi cùng lúc với các panel chuyển sang chế độ tablet/mobile. */
@media (max-width: 1024px) {
  .header-status { display: none; } /* Ưu tiên chỗ cho 2 nút nav trên màn hẹp */
}
@media (max-width: 640px) {
  .app-header { padding: 0 14px; height: var(--header-h-mobile, 54px); }
  .header-badge { width: 30px; height: 30px; }
  .header-logo { height: 17px; }
  .header-title { font-size: 13px; }
  .header-subtitle { display: none; }
  .header-nav { gap: 6px; }
  .nav-btn { padding: 6px 10px; font-size: 10px; }
}
</style>
