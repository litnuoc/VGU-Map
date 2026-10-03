<!-- pages/equipment/index.vue
     Trang danh mục TOÀN BỘ thiết bị (content/equipment/**), trước đây không tồn tại
     -> mục nav "Thiết bị" trong AppHeader.vue phải để disabled vì không có route
     nào để trỏ tới. File nằm trong thư mục equipment/ (không phải equipment-[id].vue)
     nên route là /equipment, KHÔNG đụng route /equipment-:id của trang chi tiết
     (Nuxt coi 2 tên file này là 2 segment literal khác nhau).
     Dữ liệu lấy 1 lần bằng queryContent('equipment').find() (giống getRoomEquipment
     trong useVguData.js), lọc/tìm kiếm xử lý phía client vì số lượng thiết bị nhỏ
     -> không cần thêm round-trip nào khác. -->
<template>
  <div class="catalog-page">
    <header class="catalog-head">
      <p class="eyebrow">[ CƠ SỞ DỮ LIỆU THIẾT BỊ ]</p>
      <h1>Danh mục thiết bị</h1>
      <p class="sub">Toàn bộ thiết bị đã ghi nhận trên khuôn viên VGU — bấm vào một thẻ để xem chi tiết 3D.</p>
    </header>

    <div class="toolbar">
      <div class="search-box">
        <span class="search-icon" aria-hidden="true">⌕</span>
        <input
          v-model="searchTerm"
          type="text"
          placeholder="Tìm theo tên, model, hãng sản xuất..."
          aria-label="Tìm kiếm thiết bị"
        />
      </div>

      <div class="filter-group">
        <select v-model="categoryFilter" aria-label="Lọc theo phân loại">
          <option value="">Mọi phân loại</option>
          <option v-for="c in categories" :key="c" :value="c">{{ c }}</option>
        </select>
        <select v-model="buildingFilter" aria-label="Lọc theo toà nhà">
          <option value="">Mọi toà nhà</option>
          <option v-for="b in buildings" :key="b" :value="b">{{ b }}</option>
        </select>
        <select v-model="statusFilter" aria-label="Lọc theo trạng thái">
          <option value="">Mọi trạng thái</option>
          <option v-for="s in statuses" :key="s" :value="s">{{ statusLabel(s) }}</option>
        </select>
      </div>
    </div>

    <p class="result-count">{{ filteredEquipment.length }} / {{ allEquipment.length }} thiết bị</p>

    <div v-if="pending" class="state-msg">Đang tải danh mục thiết bị...</div>

    <div v-else-if="!allEquipment.length" class="state-msg">
      Chưa có thiết bị nào được ghi nhận trong hệ thống.
    </div>

    <div v-else-if="!filteredEquipment.length" class="state-msg">
      Không tìm thấy thiết bị khớp với bộ lọc hiện tại.
      <button class="clear-btn" @click="clearFilters">[ XOÁ BỘ LỌC ]</button>
    </div>

    <div v-else class="catalog-grid">
      <NuxtLink
        v-for="eq in filteredEquipment"
        :key="eq.id"
        :to="`/equipment-${eq.id}`"
        class="eq-card"
        :style="{ '--accent': eq.media?.ambient_color || '#00ffcc' }"
      >
        <div class="eq-thumb">
          <img
            v-if="thumbFor(eq)"
            :src="thumbFor(eq)"
            alt=""
            loading="lazy"
            @error="onImgError(eq.id)"
          />
          <span v-else class="eq-thumb-fallback" aria-hidden="true">⧉</span>
          <span class="status-dot" :class="eq.status"></span>
        </div>

        <div class="eq-info">
          <h3>{{ eq.title || eq.id }}</h3>
          <p class="eq-model" v-if="eq.manufacturer || eq.model">
            {{ eq.manufacturer }}<span v-if="eq.manufacturer && eq.model"> — </span>{{ eq.model }}
          </p>
          <p class="eq-location" v-if="eq.location">
            {{ eq.location.building_id || 'N/A' }}
            <span v-if="eq.location.room_id"> · {{ eq.location.room_id }}</span>
          </p>
          <div class="eq-tags">
            <span v-if="eq.category" class="tag">{{ eq.category }}</span>
            <span class="tag status-tag" :class="eq.status">{{ statusLabel(eq.status) }}</span>
          </div>
        </div>
      </NuxtLink>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'

// @nuxt/content v2 -> queryContent() (không phải queryCollection() của v3),
// đồng bộ cách gọi với pages/equipment-[id].vue và useVguData.js.
const { data, pending } = await useAsyncData('equipment-catalog', () =>
  queryContent('equipment').find()
)

const allEquipment = computed(() => data.value || [])

useSeoMeta({
  title: 'Danh mục thiết bị | VGU Map',
  description: 'Danh sách toàn bộ thiết bị thí nghiệm và máy móc trên khuôn viên VGU.'
})

const searchTerm = ref('')
const categoryFilter = ref('')
const buildingFilter = ref('')
const statusFilter = ref('')

// Danh sách lựa chọn cho 3 dropdown, lấy trực tiếp từ dữ liệu thật (không hard-code)
// để tự cập nhật khi content/equipment/** có thêm file mới.
const categories = computed(() =>
  [...new Set(allEquipment.value.map(e => e.category).filter(Boolean))].sort()
)
const buildings = computed(() =>
  [...new Set(allEquipment.value.map(e => e.location?.building_id).filter(Boolean))].sort()
)
const statuses = computed(() =>
  [...new Set(allEquipment.value.map(e => e.status).filter(Boolean))]
)

const filteredEquipment = computed(() => {
  const q = searchTerm.value.trim().toLowerCase()
  return allEquipment.value.filter(eq => {
    if (categoryFilter.value && eq.category !== categoryFilter.value) return false
    if (buildingFilter.value && eq.location?.building_id !== buildingFilter.value) return false
    if (statusFilter.value && eq.status !== statusFilter.value) return false
    if (q) {
      const haystack = [eq.title, eq.model, eq.manufacturer, eq.id]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      if (!haystack.includes(q)) return false
    }
    return true
  })
})

function clearFilters() {
  searchTerm.value = ''
  categoryFilter.value = ''
  buildingFilter.value = ''
  statusFilter.value = ''
}

const STATUS_LABELS = {
  operational: 'Đang hoạt động',
  maintenance: 'Đang bảo trì',
  offline: 'Ngừng hoạt động'
}
function statusLabel(s) {
  return STATUS_LABELS[s] || s || 'Chưa rõ'
}

// Ảnh lỗi (404, path chưa tồn tại) -> rơi về ô fallback thay vì icon-vỡ của trình duyệt.
const brokenImages = ref(new Set())
function onImgError(id) {
  brokenImages.value = new Set(brokenImages.value).add(id)
}
function thumbFor(eq) {
  if (brokenImages.value.has(eq.id)) return null
  const first = eq.media?.images?.[0]
  if (!first) return null
  return typeof first === 'object' ? (first.src || first.url || first.path || null) : first
}
</script>

<style scoped>
.catalog-page {
  position: absolute;
  inset: 0;
  overflow-y: auto;
  background: #070A12;
  color: #fff;
  font-family: 'Be Vietnam Pro', sans-serif;
  /* AppHeader (layouts/default.vue) là position:absolute đè trên mọi trang,
     giống cách equipment-[id].vue đã chừa chỗ. */
  padding: calc(var(--header-h, 64px) + 24px) 32px 48px;
}
@media (max-width: 640px) {
  .catalog-page { padding: calc(var(--header-h-mobile, 54px) + 16px) 16px 32px; }
}

.catalog-head { margin-bottom: 24px; }
.eyebrow {
  font-family: 'Space Mono', monospace;
  font-size: 11px;
  letter-spacing: 1.5px;
  color: #00ffcc;
  margin: 0 0 6px;
}
.catalog-head h1 { margin: 0 0 6px; font-size: 26px; }
.catalog-head .sub { margin: 0; color: #9aa5b1; font-size: 13px; max-width: 640px; }

.toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 12px;
}
.search-box {
  flex: 1 1 260px;
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(0, 255, 204, 0.2);
  border-radius: 6px;
  padding: 8px 12px;
}
.search-icon { color: #00ffcc; font-size: 14px; }
.search-box input {
  flex: 1;
  background: none;
  border: none;
  outline: none;
  color: #fff;
  font-family: 'Space Mono', monospace;
  /* [FIX-mobile-zoom] < 16px khiến iOS Safari tự phóng to trang khi focus vào ô
     này — đây là ngưỡng bắt buộc của trình duyệt, không phải lựa chọn thẩm mỹ. */
  font-size: 16px;
}
.search-box input::placeholder { color: #6b7684; }

.filter-group { display: flex; flex-wrap: wrap; gap: 8px; }
.filter-group select {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(0, 255, 204, 0.2);
  color: #cfd8e3;
  border-radius: 6px;
  padding: 8px 10px;
  font-family: 'Space Mono', monospace;
  /* [FIX-mobile-zoom] Cùng lý do như search input phía trên. */
  font-size: 16px;
}

.result-count {
  font-family: 'Space Mono', monospace;
  font-size: 11px;
  color: #6b7684;
  margin: 0 0 18px;
}

.state-msg {
  color: #8aa;
  font-family: 'Space Mono', monospace;
  font-size: 13px;
  padding: 40px 0;
  text-align: center;
}
.clear-btn {
  display: block;
  margin: 12px auto 0;
  background: none;
  border: 1px solid rgba(0, 255, 204, 0.4);
  color: #00ffcc;
  padding: 6px 14px;
  border-radius: 4px;
  font-family: 'Space Mono', monospace;
  cursor: pointer;
}
.clear-btn:hover { background: rgba(0, 255, 204, 0.1); }

.catalog-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 18px;
}

.eq-card {
  display: flex;
  flex-direction: column;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(0, 255, 204, 0.12);
  border-radius: 8px;
  overflow: hidden;
  text-decoration: none;
  color: inherit;
  transition: border-color 0.15s, transform 0.15s;
}
.eq-card:hover {
  border-color: var(--accent, #00ffcc);
  transform: translateY(-2px);
}
.eq-card:focus-visible { outline: 2px solid var(--accent, #00ffcc); outline-offset: 2px; }

.eq-thumb {
  position: relative;
  height: 140px;
  background: #0a0f1a;
  display: flex;
  align-items: center;
  justify-content: center;
}
.eq-thumb img { width: 100%; height: 100%; object-fit: contain; }
.eq-thumb-fallback { font-size: 30px; color: rgba(0, 255, 204, 0.3); }
.status-dot {
  position: absolute;
  top: 10px;
  right: 10px;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: #6b7684;
  box-shadow: 0 0 6px rgba(0, 0, 0, 0.6);
}
.status-dot.operational { background: #22c55e; }
.status-dot.maintenance { background: #eab308; }
.status-dot.offline { background: #ef4444; }

.eq-info { padding: 12px 14px 14px; display: flex; flex-direction: column; gap: 4px; }
.eq-info h3 { margin: 0; font-size: 14px; color: #fff; }
.eq-model, .eq-location {
  margin: 0;
  font-size: 11px;
  color: #9aa5b1;
  font-family: 'Space Mono', monospace;
}
.eq-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
.tag {
  font-family: 'Space Mono', monospace;
  font-size: 10px;
  letter-spacing: 0.5px;
  padding: 2px 8px;
  border-radius: 3px;
  border: 1px solid rgba(0, 255, 204, 0.3);
  color: #00ffcc;
}
.status-tag { border-color: rgba(255,255,255,0.2); color: #9aa5b1; }
.status-tag.operational { border-color: rgba(34, 197, 94, 0.4); color: #22c55e; }
.status-tag.maintenance { border-color: rgba(234, 179, 8, 0.4); color: #eab308; }
.status-tag.offline { border-color: rgba(239, 68, 68, 0.4); color: #ef4444; }
</style>
