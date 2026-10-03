<!-- pages/index.vue -->
<template>
  <div class="map-page">
    <!-- 3D map — runs client-side only -->
    <ClientOnly fallback-tag="div" fallback-class="loading-overlay">
      <HologramMap
        ref="hologramMapRef"
        @room-selected="handleRoomSelected"
        @building-selected="handleBuildingSelected"
        @floor-selected="handleFloorSelected"
        @equipment-selected="handleEquipmentSelected"
        @ready="onMapReady"
      />
    </ClientOnly>

    <!--
      ═══════════════════════════════════════════════════════════════════
        PANEL RENDERING — driven entirely by store.activePanel
        'buildings' → BuildingsDashboardPanel visible
        'floor'     → FloorPanel visible (BuildingsDashboard is CSS-hidden)
        'room'      → RoomDetailPanel visible (Floor behind it, collapsed)

        Desktop: panels are side-dock drawers, controlled by CSS classes.
        Mobile:  panels are bottom sheets, controlled by useBottomSheet.js.

        NO forceCollapse props. NO usePanelLayout calls scattered here.
        Just render the right component; the store + CSS handle everything.
      ═══════════════════════════════════════════════════════════════════
    -->

    <!-- ── Buildings Dashboard ── -->
    <!-- Always mounted so its building list stays cached between nav.
         CSS class 'is-offscreen' slides it to translateX(-100%) when
         activePanel !== 'buildings'. -->
    <BuildingsDashboardPanel
      @select-building="handleBuildingFromPanel"
    />

    <!-- ── Floor Panel ── -->
    <!-- Mounted only when a building + floor are selected.
         On desktop it slides in from the left at position left:var(--panels-left-width).
         On mobile it's a bottom sheet. -->
    <transition name="panel-slide">
      <FloorPanel
        v-if="activePanel === 'floor' || activePanel === 'room'"
        :building-id="selectedBuilding"
        :cluster-label="String(selectedBuilding ?? '').toUpperCase()"
        :floor="selectedFloor"
        :selected-room-id="selectedRoom"
        @select-room="handleFloorRoomSelect"
      />
    </transition>

    <!-- ── Room Detail Panel ── -->
    <transition name="cyber-slide">
      <RoomDetailPanel
        v-if="activePanel === 'room'"
        ref="roomDetailPanelRef"
        :room-id="selectedRoom"
        :building-id="selectedBuilding"
        @close="closePanel"
        @equipment-focused="handleEquipmentFocused"
      />
    </transition>

    <!-- Loading overlay -->
    <transition name="fade">
      <div v-if="isLoading" class="loading-overlay">
        <div class="cyber-loader" aria-hidden="true"></div>
        <p>ĐANG KHỞI TẠO HỆ THỐNG BẢN ĐỒ…</p>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useMapStore } from '~/Stores/mapStores'
import { usePanelLayout } from '~/composables/usePanelLayout'
import HologramMap from '~/components/HologramMap.vue'
import RoomDetailPanel from '~/components/RoomDetailPanel.vue'
import FloorPanel from '~/components/FloorPanel.vue'
import BuildingsDashboardPanel from '~/components/BuildingsDashboardPanel.vue'

const route         = useRoute()
const router        = useRouter()
const mapStore      = useMapStore()
const { selectedRoom, selectedBuilding, selectedFloor, isLoading, activePanel } = storeToRefs(mapStore)
const hologramMapRef    = ref(null)
const roomDetailPanelRef = ref(null)

// Initialise CSS variable subscriber (watches activePanel, sets --panels-left-width)
usePanelLayout()

// ── Event handlers from HologramMap ───────────────────────────────────────────
const handleRoomSelected = ({ roomId, buildingId, floor }) => {
  mapStore.focusOnRoom(roomId, buildingId, floor)
}
const handleBuildingSelected = ({ buildingId, floor }) => {
  mapStore.focusOnBuilding(buildingId, floor)
}
const handleFloorSelected = ({ floor }) => {
  mapStore.setFloor(floor)
}

const closePanel = () => {
  // clearSelection() nulls selectedRoom only → activePanel goes 'room' → 'floor'
  // FloorPanel stays open; RoomDetailPanel unmounts.
  mapStore.clearSelection()
}

// User clicks a building card inside BuildingsDashboardPanel → fly camera in.
const handleBuildingFromPanel = async (buildingId) => {
  await nextTick()
  if (hologramMapRef.value?.selectBuilding) {
    hologramMapRef.value.selectBuilding(String(buildingId))
  } else {
    mapStore.focusOnBuilding(String(buildingId), 1)
  }
}

// User taps a room card inside FloorPanel → fly camera to room.
const handleFloorRoomSelect = ({ roomId, buildingId }) => {
  const bId = buildingId ?? selectedBuilding.value
  if (hologramMapRef.value?.goToRoom) {
    hologramMapRef.value.goToRoom({ id: roomId, buildingId: bId, floor: selectedFloor.value })
  } else {
    mapStore.focusOnRoom(roomId, bId, selectedFloor.value)
  }
}

const onMapReady = async () => {
  isLoading.value = false
  const targetBuilding = route.query.building
  if (targetBuilding && hologramMapRef.value?.selectBuilding) {
    await nextTick()
    hologramMapRef.value.selectBuilding(String(targetBuilding))
    router.replace({ path: '/', query: {} })
  }
}

const handleEquipmentSelected = async ({ roomId, buildingId, properties }) => {
  const resolvedRoomId     = roomId     || properties?.room_id
  const resolvedBuildingId = buildingId ?? properties?.building_id ?? selectedBuilding.value
  const resolvedFloor      = properties?.floor ?? selectedFloor.value

  if (resolvedRoomId && selectedRoom.value !== resolvedRoomId) {
    // Room isn't open yet — focus it first, then wait for RoomDetailPanel to mount.
    mapStore.focusOnRoom(resolvedRoomId, resolvedBuildingId, resolvedFloor)
    // Three ticks: (1) store update, (2) v-if re-evaluation, (3) child onMounted
    await nextTick()
    await nextTick()
    await nextTick()
  }
  // At this point RoomDetailPanel is guaranteed to be mounted and its
  // defineExpose({ openEquipment }) is callable.
  roomDetailPanelRef.value?.openEquipment(properties)
}

// ── Panel → Map highlight sync ────────────────────────────────────────────────
// When the user selects equipment from the list inside EquipmentSidePanel the
// event bubbles up through RoomDetailPanel → here → HologramMap.highlightEquipment.
// This keeps the map polygon highlight in sync with the panel's selected item
// even when the selection originates from the UI list, not a map click.
const handleEquipmentFocused = (equipmentId) => {
  hologramMapRef.value?.highlightEquipment(equipmentId ?? null)
}

// Keyboard: Esc → close room panel; second Esc → exit building entirely.
const onKey = (e) => {
  if (e.key !== 'Escape') return
  if (selectedRoom.value) {
    closePanel()
  } else if (selectedBuilding.value) {
    mapStore.focusOnBuilding(null, null)
  }
}

let safetyTimer
onMounted(() => {
  isLoading.value = true
  safetyTimer = setTimeout(() => { isLoading.value = false }, 6000)
  window.addEventListener('keydown', onKey)
})
onBeforeUnmount(() => {
  clearTimeout(safetyTimer)
  window.removeEventListener('keydown', onKey)
})
</script>

<style scoped>
.map-page {
  position: absolute;
  inset: 0;
  overflow: hidden;
}

/* ── Loading overlay ── */
.loading-overlay {
  position: absolute; inset: 0; z-index: var(--z-overlay);
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 20px; background: #05080d; color: #00ffcc;
  font-family: 'Space Mono', monospace; font-size: 13px; letter-spacing: 1px;
}
.cyber-loader {
  width: 56px; height: 56px;
  border: 3px solid rgba(0, 255, 204, 0.2); border-top-color: #00ffcc;
  border-radius: 50%; animation: spin 1s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* ── Panel transitions ── */
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

/* RoomDetailPanel — slides in from the right on desktop */
.cyber-slide-enter-active, .cyber-slide-leave-active {
  transition: transform 0.38s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.38s ease;
}
.cyber-slide-enter-from, .cyber-slide-leave-to {
  transform: translateX(24px);
  opacity: 0;
}

/* FloorPanel — slides up from below on mobile, fades in on desktop */
.panel-slide-enter-active, .panel-slide-leave-active {
  transition: opacity 0.32s ease, transform 0.32s cubic-bezier(0.4, 0, 0.2, 1);
}
.panel-slide-enter-from, .panel-slide-leave-to {
  opacity: 0;
  transform: translateX(-12px);
}

@media (prefers-reduced-motion: reduce) {
  .cyber-loader { animation: none; }
  .fade-enter-active, .fade-leave-active,
  .cyber-slide-enter-active, .cyber-slide-leave-active,
  .panel-slide-enter-active, .panel-slide-leave-active { transition: none; }
}


</style>
