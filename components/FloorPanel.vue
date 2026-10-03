<!-- components/FloorPanel.vue -->
<!--
  ARCHITECTURE CHANGES vs previous version:
  1. `forceCollapse` prop REMOVED — panel reads `activePanel` from store.
     When activePanel === 'room', it auto-collapses. No prop needed.

  2. DESKTOP: left is now hardcoded to var(--z-panel-floor-left, 36px) instead of
     var(--panels-left-width). BuildingsDashboard is fully off-screen when this
     panel is shown, so we only need to account for the tab stub (36px).

  3. MOBILE — Embedded floor selector:
     The .floor-bar that previously floated above the search bar in HologramMap
     is now rendered INSIDE this component, at the TOP of the bottom sheet
     (between the drag handle and the room list). It reads directly from the
     store (availableFloors, currentFloor, floorsWithDetail) which HologramMap
     populates via mapStore.setFloorMeta(). No prop-drilling, no floating elements.
-->
<template>
  <!-- Tablet: dim backdrop, tap to collapse -->
  <div
    v-if="tier === 'tablet'"
    class="adaptive-backdrop"
    style="z-index: 89"
    @click="isCollapsed = true"
  ></div>

  <div
    class="floor-panel"
    :class="[
      `tier-${tier}`,
      {
        'is-collapsed': tier !== 'mobile' && isCollapsed,
        'is-room-open': tier !== 'mobile' && activePanel === 'room'
      }
    ]"
    :style="tier === 'mobile' ? sheetStyle : null"
  >
    <!-- Mobile: drag handle at the very top -->
    <div
      v-if="tier === 'mobile'"
      class="adaptive-sheet-handle"
      @pointerdown="onSheetDragStart"
    ></div>

    <!-- ═══ MOBILE FLOOR SELECTOR (embedded in sheet header) ═══════════════
         On desktop/tablet the floor-bar lives in HologramMap.vue (floating HUD).
         On mobile it lives here, anchored to the top of the bottom sheet, so it
         travels with the sheet and can never collide with the search bar. -->
    <div v-if="tier === 'mobile' && availableFloors.length > 0" class="mobile-floor-bar">
      <!-- Exit building button -->
      <button
        class="mfb-btn mfb-exit"
        @click="handleExitBuilding"
        aria-label="Thoát khỏi toà nhà"
        title="Thoát toà nhà"
      >✕</button>

      <!-- Building label -->
      <span class="mfb-label">{{ buildingId }}</span>

      <!-- Floor buttons — scrollable row -->
      <div class="mfb-floors">
        <button
          v-for="f in availableFloors"
          :key="f"
          class="mfb-btn"
          :class="{
            'mfb-active':  f === currentFloor,
            'mfb-detail':  floorsWithDetailSet.has(f) && f !== currentFloor
          }"
          :aria-pressed="f === currentFloor"
          @click="handleSelectFloor(f)"
        >L{{ f }}</button>
      </div>
    </div>
    <!-- ════════════════════════════════════════════════════════════════════ -->

    <!-- Desktop/tablet: collapse toggle tab -->
    <button
      v-if="tier !== 'mobile'"
      class="toggle-btn"
      @click="isCollapsed = !isCollapsed"
      :title="isCollapsed ? 'Mở danh sách phòng' : 'Thu gọn'"
    >
      <svg v-if="!isCollapsed" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
        <line x1="9" y1="3" x2="9" y2="21"></line>
      </svg>
      <svg v-else width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
        <line x1="15" y1="3" x2="15" y2="21"></line>
      </svg>
    </button>

    <div class="panel-content-wrapper">
      <div class="breadcrumb">
        <span class="crumb">CAMPUS</span>
        <span class="sep">/</span>
        <span class="crumb active">{{ clusterLabel }}</span>
      </div>

      <h2 class="floor-title">Floor {{ floor }} Rooms</h2>

      <div class="type-tabs" v-if="roomTypes.length > 0">
        <button
          v-for="type in roomTypes"
          :key="type"
          class="type-tab"
          :class="{ active: activeType === type }"
          @click="activeType = type"
        >
          {{ typeLabel(type) }}
          <span class="tab-count">{{ countByType(type) }}</span>
        </button>
      </div>

      <div class="room-list">
        <div v-if="isLoading" class="state-msg">Đang tải danh sách phòng…</div>
        <div v-else-if="loadError" class="state-msg error">{{ loadError }}</div>
        <div v-else-if="filteredRooms.length === 0" class="state-msg">Không có phòng nào thuộc loại này.</div>

        <button
          v-for="room in filteredRooms"
          :key="room.id"
          class="room-card"
          :class="{ selected: selectedRoomId === room.id }"
          @click="handleSelectRoom(room)"
        >
          <div class="room-card-top">
            <span class="room-number">{{ room.roomNumber }}</span>
            <span class="room-status" :class="statusClass(room.status)">{{ statusLabel(room.status) }}</span>
          </div>
          <span class="room-name">{{ formatRoomName(room.roomName) }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { storeToRefs } from 'pinia'
import { useMapStore } from '~/Stores/mapStores'
import { useDeviceTier } from '~/composables/useDeviceTier'
import { useBottomSheet } from '~/composables/useBottomSheet'
// FIX BUG-1: Đã thêm useVguData vào import
import { useVguData, formatRoomName } from '~/composables/useVguData'

const props = defineProps({
  buildingId:     { type: String, default: null },
  clusterLabel:   { type: String, default: 'CLUSTER' },
  floor:          { type: [String, Number], default: null },
  selectedRoomId: { type: String, default: null },
})
const emit = defineEmits(['select-room'])

const mapStore = useMapStore()
const { activePanel, availableFloors, currentFloor, floorsWithDetail } = storeToRefs(mapStore)
const { tier } = useDeviceTier()
const { getRoomsByFloor } = useVguData()

// Mobile bottom sheet
// peek: 35% so the user can see roughly 65% of the map behind the sheet.
// The sheet contains the floor-bar at the top, so even in peek state the
// floor buttons are visible and tappable.
const {
  sheetStyle,
  onDragStart: onSheetDragStart,
  reset: resetSheet
} = useBottomSheet({ peek: 0.35, full: 0.85 })

// On desktop, auto-collapse when RoomDetailPanel opens (activePanel === 'room')
// No forceCollapse prop needed — we watch the store directly.
const isCollapsed = ref(false)
watch(activePanel, (panel) => {
  if (panel === 'room') isCollapsed.value = true
})

// floorsWithDetail is stored as an array in the store; convert to Set locally.
const floorsWithDetailSet = computed(() => new Set(floorsWithDetail.value))

// Floor selector actions (mobile) — delegate back to HologramMap via store.
// HologramMap watches mapStore.selectedFloor and calls its own selectFloor().
const handleSelectFloor = (f) => {
  mapStore.setFloor(f)
}
const handleExitBuilding = () => {
  mapStore.focusOnBuilding(null, null)
}

// ── Room loading ───────────────────────────────────────────────────────────────
const isLoading  = ref(false)
const loadError  = ref('')
const rooms      = ref([])
const activeType = ref('all')

const ROOM_TYPE_ORDER  = ['administration', 'teaching', 'laboratory', 'workshop', 'other']
const ROOM_TYPE_LABELS = {
  administration: 'Administration',
  teaching: 'Teaching',
  laboratory: 'Laboratory',
  workshop: 'Workshop',
  other: 'Khác',
}

const getFloorFromRoomNumber = (roomNumber, buildingId) => {
  if (!roomNumber) return null
  let s = String(roomNumber).toUpperCase()
  const b = (buildingId || '').toUpperCase()
  if (b && s.startsWith(b + '-')) s = s.substring(b.length + 1)
  const match = s.match(/^(\d+)/)
  if (!match) return null
  const numStr = match[1]
  if (s[numStr.length] === '.') return numStr
  if (numStr.length >= 3) return numStr.slice(0, numStr.length - 2)
  return numStr
}

const loadRooms = async () => {
  if (!props.buildingId || props.floor == null) { rooms.value = []; return }
  isLoading.value = true
  loadError.value = ''
  try {
    const fetched = await getRoomsByFloor(props.buildingId, props.floor)
    const expectedFloor = String(props.floor)
    rooms.value = fetched.filter(r => {
      const extracted = getFloorFromRoomNumber(r.roomNumber, props.buildingId)
      if (extracted && extracted !== expectedFloor) return false
      return String(r.floor) === expectedFloor
    })
  } catch (err) {
    console.error('[FloorPanel] Lỗi khi tải phòng:', err)
    loadError.value = 'Không tải được dữ liệu phòng. Vui lòng thử lại sau.'
    rooms.value = []
  } finally {
    isLoading.value = false
    activeType.value = 'all'
  }
}

watch(() => [props.buildingId, props.floor], () => {
  loadRooms()
  isCollapsed.value = false
  resetSheet()
}, { immediate: true })

const roomTypes = computed(() => {
  const present = new Set(rooms.value.map(r => r.roomType))
  const ordered = ROOM_TYPE_ORDER.filter(t => present.has(t))
  const extra   = [...present].filter(t => !ROOM_TYPE_ORDER.includes(t))
  const types   = [...ordered, ...extra]
  return types.length > 0 ? ['all', ...types] : []
})

const typeLabel    = (type) => (type === 'all' ? 'Tất cả' : (ROOM_TYPE_LABELS[type] || type))
const countByType  = (type) => type === 'all' ? rooms.value.length : rooms.value.filter(r => r.roomType === type).length
const filteredRooms = computed(() => {
  if (!activeType.value || activeType.value === 'all') return rooms.value
  return rooms.value.filter(r => r.roomType === activeType.value)
})

const statusClass = (status) => {
  if (status === 'active')   return 'is-active'
  if (status === 'inactive') return 'is-inactive'
  return 'is-unknown'
}
const statusLabel = (status) => {
  const map = { active: 'ACTIVE', inactive: 'INACTIVE' }
  return map[status] || (status || '').toUpperCase()
}

const handleSelectRoom = (room) => {
  emit('select-room', { roomId: room.id, buildingId: props.buildingId })
}
</script>

<style scoped>
/* ── Desktop / Tablet base ───────────────────────────────────────────────────
   FIX: left is now 0. BuildingsDashboardPanel uses translateX(-100%) to exit,
   meaning its entire 300px footprint — including the toggle-tab stub — is fully
   off-screen when FloorPanel is shown. The previous left: 36px was compensating
   for a tab stub that no longer exists in the visual layout, creating a phantom
   36px gap. Setting left: 0 eliminates it.

   HANDOFF SYNC: transition duration and cubic-bezier EXACTLY match
   BuildingsDashboardPanel's .buildings-panel transition so both panels move as
   a single choreographed unit — one pushing the other out. */
.floor-panel {
  position: absolute;
  top: var(--header-h, 64px);
  left: 0;         /* FIX: was 36px — BuildingsDashboard is fully off-screen; no stub remains */
  width: 280px;
  height: calc(100vh - var(--header-h, 64px));
  background-color: #0b1120;
  border-right: 1px solid #1f2d40;
  color: #e2e8f0;
  font-family: 'Inter', sans-serif;
  box-shadow: 4px 0 15px rgba(0,0,0,0.5);
  z-index: var(--z-panel-floor);
  /* SYNC: identical duration + cubic-bezier as .buildings-panel for the handoff */
  transition: transform 0.4s cubic-bezier(0.25, 1, 0.5, 1);
  overflow: visible;
  will-change: transform;
}

/* Collapsed: slide the panel body off-screen to the left.
   The toggle-btn stub still shows via its absolute right:-36px positioning. */
.floor-panel.is-collapsed {
  transform: translateX(-100%);
}

/* When RoomDetailPanel is open on desktop, FloorPanel collapses further —
   it's already handled by `is-collapsed` above (watch on activePanel sets it).
   No extra class needed. */

/* ── Tablet ── */
.floor-panel.tier-tablet {
  width: min(280px, 75vw);
}

/* ── Mobile: bottom sheet ─────────────────────────────────────────────────────
   position: fixed so the sheet is viewport-relative (not offset by any parent).
   z-index: --z-panel-floor (95) — above BuildingsDashboard (88), below
   RoomDetailPanel (100), far below floor-bar (gone on mobile, now inside sheet). */
.floor-panel.tier-mobile {
  position: fixed;
  top: auto;
  left: 0; right: 0; bottom: 0;
  width: 100%;
  height: auto;            /* height driven by sheetStyle from useBottomSheet */
  border-right: none;
  border-top: 1px solid #1f2d40;
  border-radius: 16px 16px 0 0;
  box-shadow: 0 -4px 24px rgba(0, 0, 0, 0.6);
  z-index: var(--z-panel-floor);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* ── Mobile floor selector strip ─────────────────────────────────────────────
   This replaces the floating .floor-bar from HologramMap.vue on mobile.
   It sits between the drag handle and the room list inside the bottom sheet. */
.mobile-floor-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px 8px;
  border-bottom: 1px solid rgba(239, 90, 36, 0.15);
  background: rgba(15, 24, 40, 0.98);
  flex-shrink: 0;
  overflow: hidden;
}

.mfb-label {
  font-family: 'Space Mono', monospace;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 1px;
  color: #EF5A24;
  flex-shrink: 0;
  padding-right: 6px;
  border-right: 1px solid rgba(239, 90, 36, 0.25);
}

.mfb-floors {
  display: flex;
  gap: 5px;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  flex: 1;
}
.mfb-floors::-webkit-scrollbar { display: none; }

.mfb-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.15);
  color: rgba(255, 255, 255, 0.7);
  font-family: 'Space Mono', monospace;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  flex-shrink: 0;
  touch-action: manipulation;
  transition: background 0.2s, border-color 0.2s, color 0.2s;
}
.mfb-btn:hover { border-color: rgba(239, 90, 36, 0.6); color: #fff; }
.mfb-btn.mfb-active { background: #EF5A24; border-color: #EF5A24; color: #fff; box-shadow: 0 0 10px #EF5A24; }
.mfb-btn.mfb-detail { border-color: rgba(6, 182, 212, 0.6); background: rgba(6, 182, 212, 0.08); color: #06B6D4; }
.mfb-exit {
  color: #EF5A24;
  border-color: rgba(239, 90, 36, 0.3);
  font-size: 13px;
  flex-shrink: 0;
}
.mfb-exit:hover { background: rgba(239, 90, 36, 0.12); }

/* ── Content wrapper ── */
.panel-content-wrapper {
  display: flex;
  flex-direction: column;
  width: 100%; height: 100%;
  padding: 16px 16px 0;
  overflow: hidden;
}
.floor-panel.tier-mobile .panel-content-wrapper {
  padding-top: 10px;
}

/* ── Toggle button (desktop/tablet) ── */
.toggle-btn {
  position: absolute;
  top: 12px; right: 12px;
  width: 32px; height: 32px;
  background: transparent; border: none; border-radius: 6px;
  color: #94a3b8;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
  z-index: 1;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
.toggle-btn:hover { color: #f1f5f9; background: rgba(255, 255, 255, 0.1); }
.floor-panel.is-collapsed .toggle-btn {
  right: -36px; top: 80px;
  width: 36px; height: 36px;
  background: #0b1120;
  border: 1px solid #1f2d40; border-left: none;
  border-radius: 0 8px 8px 0;
  box-shadow: 4px 0 10px rgba(0,0,0,0.3);
}

/* ── Typography & room list (unchanged) ── */
.breadcrumb {
  font-size: 11px; letter-spacing: 0.5px; color: #64748b;
  margin-bottom: 10px; text-transform: uppercase;
  flex-shrink: 0; padding-right: 32px;
}
.breadcrumb .crumb.active { color: #f1f5f9; font-weight: 700; }
.breadcrumb .sep { margin: 0 6px; }
.floor-title { margin: 0 0 14px; font-size: 18px; font-weight: 700; color: #fff; flex-shrink: 0; padding-right: 32px; }
.type-tabs { display: flex; gap: 6px; margin-bottom: 14px; flex-wrap: wrap; flex-shrink: 0; }
.type-tab {
  background: #0f172a; border: 1px solid #1e293b; color: #94a3b8;
  font-size: 11px; font-weight: 700; letter-spacing: 0.3px;
  padding: 6px 10px; border-radius: 6px; cursor: pointer;
  display: flex; align-items: center; gap: 6px; transition: all 0.15s;
}
.type-tab:hover { border-color: #f97316; color: #f1f5f9; }
.type-tab.active { background: #1d4ed8; border-color: #1d4ed8; color: #fff; }
.tab-count { background: rgba(255,255,255,0.15); border-radius: 4px; padding: 0 5px; font-size: 10px; }
.room-list {
  flex: 1; overflow-y: auto;
  display: flex; flex-direction: column; gap: 8px;
  padding-bottom: 16px;
}
.room-list::-webkit-scrollbar { width: 6px; }
.room-list::-webkit-scrollbar-thumb { background: #334155; border-radius: 4px; }
.state-msg { text-align: center; color: #94a3b8; font-size: 12px; padding: 24px 0; }
.state-msg.error { color: #f87171; }
.room-card {
  background: #101a2c; border: 1px solid #1e293b; border-left: 3px solid #1e293b;
  border-radius: 6px; padding: 10px 12px; text-align: left;
  cursor: pointer; display: flex; flex-direction: column; gap: 4px;
  transition: border-color 0.15s, background-color 0.15s;
}
.room-card:hover { border-color: #f97316; border-left-color: #f97316; }
.room-card.selected { background: #1e293b; border-left-color: #f97316; }
.room-card-top { display: flex; justify-content: space-between; align-items: center; }
.room-number { font-size: 12px; font-weight: 800; color: #fff; letter-spacing: 0.3px; }
.room-status { font-size: 9px; font-weight: 800; letter-spacing: 0.5px; padding: 2px 6px; border-radius: 4px; }
.room-status.is-active   { color: #22c55e; background: rgba(34, 197, 94, 0.12); }
.room-status.is-inactive { color: #ef4444; background: rgba(239, 68, 68, 0.12); }
.room-status.is-unknown  { color: #94a3b8; background: rgba(148, 163, 184, 0.12); }
.room-name { font-size: 12px; color: #94a3b8; }
</style>
