<template>
  <!-- [MOBILE-FIX] On mobile this is a bottom sheet. sheetStyle controls height
       via useBottomSheet. The root div gets class tier-mobile for CSS overrides. -->
  <div
    class="room-detail-panel"
    :class="tier === 'mobile' ? 'tier-mobile' : ''"
    :style="tier === 'mobile' ? sheetStyle : null"
  >
    <!-- [MOBILE-FIX] Drag handle — replaces close button as the top affordance on mobile.
         On desktop the close-btn (×) remains the dismiss control. -->
    <div
      v-if="tier === 'mobile'"
      class="adaptive-sheet-handle"
      @pointerdown="onSheetDragStart"
    ></div>

    <!-- Nút Đóng — hidden on mobile (drag-down or back gesture dismisses) -->
    <button class="close-btn" :class="{ 'is-mobile-hidden': tier === 'mobile' }" @click="closePanel">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    </button>

    <!-- 1. Header Section -->
    <div class="panel-header">
      <div class="room-location">
        <span class="building">{{ display.building || 'N/A' }}</span>
        <span class="separator">//</span>
        <span class="level">FLOOR {{ display.level ?? 'N/A' }}</span>
      </div>
      <h2 class="room-name">{{ display.name || 'N/A' }}</h2>
      <p class="department">{{ display.department || 'N/A' }}</p>
    </div>

    <!-- Vùng nội dung có thể cuộn -->
    <div class="panel-content">
      <div v-if="isLoading" class="state-msg">Đang tải dữ liệu phòng…</div>

      <template v-else>
        <!-- 2. Ảnh thực tế — luôn có khung (frame) cố định kích thước, không phụ
             thuộc ảnh tải được hay không, để không bao giờ "biến mất" như trước -->
        <div class="photo-section">
          <div v-if="display.photos && display.photos.length > 0" class="photo-grid" :class="{'single-photo': display.photos.length === 1}">
            <div
              v-for="(photo, index) in display.photos.slice(0, 2)"
              :key="props.roomId + '-' + index"
              class="photo-frame"
            >
              <!-- Spinner khi đang tải -->
              <div v-if="photoStates[index] !== 'loaded' && photoStates[index] !== 'error'" class="frame-spinner">
                <span class="spinner-ring"></span>
              </div>

              <!-- Ảnh thật -->
              <img
                v-show="photoStates[index] === 'loaded'"
                :src="photo"
                alt="Room Photo"
                class="room-image"
                @load="onImageLoad(index)"
                @error="onImageError($event, index)"
              />

              <!-- Lỗi hẳn (cả 2 URL fallback đều fail) -->
              <div v-if="photoStates[index] === 'error'" class="frame-error">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="7" width="18" height="14" rx="2" ry="2"></rect>
                  <circle cx="12" cy="14" r="3"></circle>
                  <path d="M16 3h-8l-2 4h12l-2-4z"></path>
                  <line x1="4" y1="4" x2="20" y2="20"></line>
                </svg>
                <span>Không tải được ảnh</span>
              </div>
            </div>
          </div>

          <div v-else class="no-photo-placeholder">
            <div class="placeholder-content">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="7" width="18" height="14" rx="2" ry="2"></rect>
                <circle cx="12" cy="14" r="3"></circle>
                <path d="M16 3h-8l-2 4h12l-2-4z"></path>
              </svg>
              <p>Chưa có ảnh thực tế</p>
              <span>Sẽ cập nhật ảnh thực tế tại đây cho phòng {{ display.name }}</span>
            </div>
          </div>
        </div>

        <!-- 3. Thông tin nhân sự (Đã được xử lý để xuống dòng) -->
  <div class="info-card" v-if="display.occupants.length > 0 || display.office || display.email">
          <h3 class="card-title highlight-title">ROOM INCHARGE</h3>
          <div class="card-body">
            <p v-for="(person, idx) in display.occupants" :key="idx" class="incharge-name">
              {{ person }}
            </p>
            <p class="incharge-position" v-if="display.office">
              Office: {{ display.office }}
            </p>
            <p class="incharge-email">
              <a :href="'mailto:' + display.email" v-if="display.email">{{ display.email }}</a>
              <span v-else>N/A</span>
            </p>
            <p class="incharge-phone" v-if="display.phone">Tel: {{ display.phone }}</p>
          </div>
        </div>


        <!-- 4. Thông tin mô tả -->
        <div class="info-card">
          <h3 class="card-title highlight-title">ROOM DESCRIPTION</h3>
          <div class="card-body">
            <p><strong>Phân loại:</strong> {{ display.roomType }}</p>
            <p v-if="display.roomFunction"><strong>Chức năng:</strong> {{ display.roomFunction }}</p>
            <p><strong>Diện tích:</strong> {{ display.area }} m2</p>
            <p><strong>Sức chứa:</strong> {{ display.capacity }}</p>
            
            <div class="working-hours mt-2">
              <strong class="text-highlight">Trạng thái / Hoạt động:</strong>
              <p>{{ display.status || 'N/A' }}</p>
            </div>
          </div>
        </div>


        <!-- 5. Featured Facility / Instruments -->
        <div class="info-card">
          <h3 class="card-title highlight-title">
            FEATURED INSTRUMENTS ({{ display.instruments ? display.instruments.length : 0 }})
          </h3>
          <div class="card-body">
            <ul v-if="display.instruments && display.instruments.length > 0" class="instrument-list">
              <li v-for="(item, index) in display.instruments" :key="index">
                {{ item.name || item }}
              </li>
            </ul>
            <div v-else class="empty-instruments">
              <p>No highlighted instruments available.</p>
            </div>
          </div>
        </div>
      </template>
    </div>

    <!-- 6. Action Button -->
    <div class="panel-footer">
      <button class="action-btn" @click="showMachineModal = true">VIEW ALL MACHINES IN THIS ROOM</button>
    </div>

    <!-- 7. Panel xem danh sách / 3D thiết bị trong phòng -->
    <EquipmentSidePanel
      v-if="showMachineModal"
      :room-id="roomId"
      :building-id="buildingId"
      :room-name="display.name"
      :instruments="display.instruments"
      :initial-equipment="initialEquipment"
      @close="closeMachinePanel"
      @equipment-focused="(id) => emit('equipment-focused', id)"
    />
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import EquipmentSidePanel from './EquipmentSidePanel.vue'
// [MOBILE-FIX] Convert RoomDetailPanel to a bottom sheet on mobile.
// Previously it had NO mobile CSS — rendered as 400px right-side drawer
// that completely covered the screen on phones.
import { useDeviceTier } from '~/composables/useDeviceTier'
import { useBottomSheet } from '~/composables/useBottomSheet'

const { tier } = useDeviceTier()
// safeTopPx=130: same safe zone as FloorPanel (header+search+gap).
// peek 40% so room info is readable without obscuring the map entirely.
const { sheetStyle, onDragStart: onSheetDragStart, setFull: openFullSheet } = useBottomSheet({ peek: 0.40, full: 0.88, safeTopPx: 130 })

const showMachineModal = ref(false)
// Thiết bị được chọn thẳng từ khối trên bản đồ (bấm vào thiết bị -> mở panel
// chi tiết máy đó ngay, bỏ qua bước danh sách). Xem openEquipment() bên dưới.
const initialEquipment = ref(null)

const closeMachinePanel = () => {
  showMachineModal.value = false
  initialEquipment.value = null
}

// Gọi từ pages/index.vue khi người dùng bấm vào 1 khối thiết bị trên bản đồ
// (sự kiện 'equipment-selected' từ HologramMap.vue) — mở thẳng panel thiết bị
// ở chế độ chi tiết, không cần bấm "VIEW ALL MACHINES..." trước.
const openEquipment = (equipmentProps) => {
  initialEquipment.value = equipmentProps
  showMachineModal.value = true
}
defineExpose({ openEquipment })

const props = defineProps({
  roomId: { type: String, default: null },
  buildingId: { type: String, default: null }
})

// 'equipment-focused' bubbles up from EquipmentSidePanel so index.vue can
// call hologramMapRef.highlightEquipment(id) to sync the map polygon highlight.
const emit = defineEmits(['close', 'equipment-focused'])
const closePanel = () => emit('close')

const { getRoomInfo, getDriveData } = useVguData()

const config = useRuntimeConfig()
const base = config.app.baseURL

const isLoading = ref(false)
const roomData = ref(null)
const driveData = ref({})

// M-5 FIX: replaced per-mount $fetch with module-level singleton from useVguData.
// Subsequent mounts resolve instantly from the already-settled Promise — no extra
// network requests when the user navigates between rooms.
getDriveData(base).then(res => {
  if (res && Object.keys(res).length) driveData.value = res
})

// Trạng thái từng khung ảnh: 'loading' | 'loaded' | 'error'. Luôn có khung cố
// định kích thước hiển thị (spinner/ảnh/icon lỗi) — không bao giờ "biến mất"
// như cách làm cũ (ẩn <img> bằng display:none khiến cả khối co về 0).
const photoStates = ref({})

const onImageLoad = (index) => {
  photoStates.value[index] = 'loaded'
}

const onImageError = (event, index) => {
  const img = event.target
  if (img.dataset.fallbackTried) {
    photoStates.value[index] = 'error'
    return
  }
  img.dataset.fallbackTried = '1'
  const match = img.src.match(/\/d\/([^=]+)/)
  const fileId = match ? match[1] : null
  if (fileId) {
    img.src = `https://drive.google.com/thumbnail?id=${fileId}&sz=w800`
  } else {
    photoStates.value[index] = 'error'
  }
}

const cleanData = (data) => {
  if (!data || data === '___' || data === '--' || data === 'Chưa cập nhật' || data === 'unknown') return ''
  return data
}

// Helper: Lọc bỏ tên bị lặp lại
const formatRoomName = (name) => {
  if (!name || typeof name !== 'string') return name
  const parts = name.split(/\s*-\s*/)
  if (parts.length > 1 && parts.length % 2 === 0) {
    const halfIndex = parts.length / 2
    const firstHalf = parts.slice(0, halfIndex).join(' - ')
    const secondHalf = parts.slice(halfIndex).join(' - ')
    if (firstHalf === secondHalf) return firstHalf
  }
  return name
}

const fetchRoom = async (id) => {
  if (!id) {
    roomData.value = null
    return
  }
  isLoading.value = true
  roomData.value = await getRoomInfo(id)
  isLoading.value = false
}

watch(() => props.roomId, (id) => {
  photoStates.value = {}
  fetchRoom(id)
}, { immediate: true })

const display = computed(() => {
  const r = roomData.value
  if (!r) {
    return {
      building: cleanData(props.buildingId),
      level: null,
      name: formatRoomName(props.roomId || ''),
      department: '',
      photos: [],
      occupants: [],
      roomFunction: '',
      roomType: 'N/A',
      area: 'N/A',
      capacity: 'N/A',
      status: '',
      instruments: []
    }
  }

  let photos = []
  const currentRoomId = props.roomId ? props.roomId.trim() : ''

  if (currentRoomId && driveData.value[currentRoomId]) {
    const fileId = driveData.value[currentRoomId]
    photos = [`https://lh3.googleusercontent.com/d/${fileId}=s800`]
  }

  // Tách tên nhân sự bằng dấu phẩy để hiển thị trên nhiều dòng
  let occupantsList = []
  if (r.occupants) {
    const occString = Array.isArray(r.occupants) ? r.occupants.join(', ') : r.occupants
    occupantsList = occString.split(',').map(s => s.trim()).filter(Boolean)
  }

  return {
    building: r.buildingId || cleanData(props.buildingId),
    level: r.floor ?? null,
    name: formatRoomName(r.roomName),
    department: r.department,
    photos,
    occupants: occupantsList,
    roomFunction: r.roomFunction,
    roomType: r.rawRoomType || 'N/A',
    area: r.area || 'N/A',
    capacity: r.capacity || 'N/A',
    status: r.rawStatus,
    // B-2 FIX: was hard-coded to [] — now reads from the room record so that
    // FEATURED INSTRUMENTS actually lists what's in the Content frontmatter.
    // Supports both array (instruments: [...]) and the legacy string form.
    instruments: Array.isArray(r.instruments)
      ? r.instruments
      : (r.instruments ? [r.instruments] : [])
  }
})
</script>

<style scoped>
.room-detail-panel {
  position: absolute;
  /* [FIX] top:0 trước đây đè lên .app-header (z-index:20) vì panel này có
     z-index:100 cao hơn -> header bị che mất ở dải bên phải, tạo khoảng
     trống đen vô nghĩa phía trên nội dung panel. Neo dưới header, khớp đúng
     pattern đã dùng ở EquipmentSidePanel.vue. */
  top: var(--header-h, 64px);
  right: 0;
  width: 400px;
  height: calc(100vh - var(--header-h, 64px));
  background-color: #0b1120;
  border-left: 1px solid #1f2d40;
  display: flex;
  flex-direction: column;
  color: #e2e8f0;
  font-family: 'Inter', sans-serif;
  box-shadow: -4px 0 15px rgba(0,0,0,0.5);
  z-index: 100;
}
.close-btn {
  position: absolute;
  top: 15px;
  right: 15px;
  background: transparent;
  border: none;
  color: #64748b;
  cursor: pointer;
  transition: color 0.2s;
}
.close-btn:hover {
  color: #f87171;
}
.panel-header {
  padding: 24px 20px 16px;
  border-bottom: 1px dashed #1f2d40;
}
.room-location {
  font-size: 10px;
  font-weight: 700;
  color: #f97316;
  letter-spacing: 1px;
  margin-bottom: 8px;
  text-transform: uppercase;
}
.room-location .separator {
  margin: 0 4px;
  color: #64748b;
}
.room-name {
  font-size: 22px;
  font-weight: 700;
  color: #ffffff;
  margin: 0 0 4px 0;
}
.department {
  font-size: 13px;
  color: #94a3b8;
  margin: 0;
}
.panel-content {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.panel-content::-webkit-scrollbar {
  width: 6px;
}
.panel-content::-webkit-scrollbar-thumb {
  background: #334155;
  border-radius: 4px;
}
.state-msg {
  padding: 20px 0;
  text-align: center;
  color: #94a3b8;
  font-size: 13px;
}
.photo-section {
  /* Prevent this block from being squashed when .panel-content (flex column)
     distributes leftover space to the info-cards below. Without flex-shrink:0
     the browser is free to compress this element toward zero height. */
  flex-shrink: 0;
  width: 100%;
  border-radius: 8px;
  overflow: hidden;
}
.photo-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.photo-grid.single-photo {
  grid-template-columns: 1fr;
}
.photo-frame {
  position: relative;
  width: 100%;
  /* aspect-ratio is the source of truth for height so the frame always renders
     even before the image loads. The explicit min-height is a belt-and-suspenders
     fallback for any browser that ignores aspect-ratio inside a grid cell. */
  aspect-ratio: 4 / 3;
  min-height: 160px;
  /* Nền trắng vì bản vẽ mặt bằng (floor plan) thực tế có nền trắng —
     dùng object-fit: contain nên phần nền lộ ra phải khớp màu ảnh gốc,
     tránh viền tối lộ ra hai bên/trên dưới. */
  background-color: #ffffff;
  border: 1px solid #334155;
  border-radius: 6px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  /* Guarantee the frame itself never shrinks inside any outer flex context */
  flex-shrink: 0;
}
.room-image {
  /* Hiển thị TRỌN VẸN ảnh thực tế (floor plan), không cắt bớt.
     position:absolute pins it to the frame's padding box so it never
     affects the frame's own layout size, which could otherwise create
     a circular sizing dependency. */
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
  /* border-radius matches the frame so the image is clipped cleanly
     at the rounded corners — overflow:hidden alone isn't enough in all
     browsers when the child is absolutely positioned. */
  border-radius: 6px;
  display: block;
}
.frame-spinner {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
.spinner-ring {
  width: 26px;
  height: 26px;
  border: 3px solid rgba(148, 163, 184, 0.25);
  border-top-color: #EF5A24;
  border-radius: 50%;
  animation: frame-spin 0.8s linear infinite;
}
@keyframes frame-spin {
  to { transform: rotate(360deg); }
}
.frame-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  color: #64748b;
  text-align: center;
  padding: 0 12px;
}
.frame-error span {
  font-size: 11px;
}
.no-photo-placeholder {
  width: 100%;
  height: 180px;
  background-color: #1e293b;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  color: #94a3b8;
  text-align: center;
}
.placeholder-content svg {
  margin-bottom: 8px;
  color: #94a3b8;
}
.placeholder-content p {
  font-weight: 600;
  margin: 0;
  font-size: 14px;
}
.placeholder-content span {
  font-size: 11px;
  color: #94a3b8;
}
.info-card {
  background-color: #0f172a;
  border: 1px solid #1e293b;
  border-radius: 8px;
  padding: 16px;
}
.card-title {
  font-size: 14px;
  font-weight: 800;
  color: #94a3b8;
  letter-spacing: 0.5px;
  margin: 0 0 12px 0;
  text-transform: uppercase;
}
.highlight-title {
  color: #f97316;
}
.card-body p {
  margin: 0 0 6px 0;
  font-size: 13px;
  line-height: 1.5;
}
.card-body p strong {
  color: #cbd5e1;
}
.incharge-name {
  font-weight: 700;
  font-size: 13px !important;
  color: #ffffff;
  margin-bottom: 4px !important;
}
.incharge-position {
  color: #cbd5e1;
  margin-top: 8px !important;
}
.incharge-email a {
  color: #0ea5e9;
  text-decoration: none;
}
.incharge-email a:hover {
  text-decoration: underline;
}
.mt-2 {
  margin-top: 12px;
}
.text-highlight {
  color: #f8fafc;
  font-size: 12px;
}
.instrument-list {
  list-style: none;
  padding: 0;
  margin: 0;
  font-size: 13px;
}
.instrument-list li {
  padding: 6px 0;
  border-bottom: 1px solid #1e293b;
}
.instrument-list li:last-child {
  border-bottom: none;
}
.empty-instruments {
  background-color: #1e293b;
  padding: 12px;
  border-radius: 4px;
  text-align: center;
  color: #64748b;
  font-style: italic;
  font-size: 12px;
}
.panel-footer {
  padding: 16px 20px;
  border-top: 1px solid #1f2d40;
}
.action-btn {
  width: 100%;
  background-color: #f97316;
  color: #ffffff;
  border: none;
  padding: 14px;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 1px;
  border-radius: 6px;
  cursor: pointer;
  text-transform: uppercase;
  transition: background-color 0.2s;
}
.action-btn:hover {
  background-color: #ea580c;
}

.sheet {
  background: var(--surface-root);
  color: var(--ink-strong);
  font-family: var(--type-main);
}

.sheet__crumb {
  color: var(--brand-accent);
}

.info-box {
  background: var(--surface-panel);
  border: 1px solid var(--line-soft);
}

.primary-action {
  background: var(--brand-accent);
  color: var(--ink-strong);
}

.primary-action:hover {
  background: var(--brand-accent-soft);
}

.sheet__spinner {
  color: var(--brand-accent);
}

.mail-link {
  color: #8092A9;
}

.close-control:hover {
  color: var(--brand-accent);
}

/* ===== [MOBILE-FIX] Tier: mobile (≤640px) — Bottom Sheet =====
   RoomDetailPanel previously had ZERO mobile styles, rendering as a 400px
   fixed right-side drawer that consumed the full phone screen width.
   Fix: convert to a bottom sheet identical in pattern to FloorPanel.tier-mobile.
   z-index: 105 — above FloorPanel (95) and BuildingsDashboard (88) so the room
   detail is always on top when open, without fighting the floor-bar (115). */
.room-detail-panel.tier-mobile {
  position: fixed;
  top: auto;
  right: 0;
  left: 0;
  bottom: 0;
  width: 100%;
  height: auto;         /* height is driven by sheetStyle (useBottomSheet) */
  border-left: none;
  border-top: 1px solid rgba(239, 90, 36, 0.25);
  border-radius: 20px 20px 0 0;
  box-shadow: 0 -6px 30px rgba(0, 0, 0, 0.6);
  z-index: 105;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* Hide the × close button on mobile — the drag handle + dragging down dismiss it.
   Keeping a small icon-only button visible in the top-right for accessibility. */
.close-btn.is-mobile-hidden {
  /* Reposition to not clash with drag handle, keep it reachable for a11y */
  top: 10px;
  right: 12px;
  opacity: 0.5;
}

@media (max-width: 640px) {
  /* Give the panel-header some top padding so it clears the drag handle pill */
  .room-detail-panel.tier-mobile .panel-header {
    padding-top: 4px;
  }
  /* Ensure scrollable content area works inside the sheet height */
  .room-detail-panel.tier-mobile .panel-content {
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    flex: 1;
  }
}
</style>
