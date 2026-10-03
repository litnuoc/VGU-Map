// Stores/mapStores.ts
//
// ─── ARCHITECTURAL OVERVIEW ────────────────────────────────────────────────────
// `activePanel` is now the SINGLE SOURCE OF TRUTH for which panel is visible.
// It is a computed value derived entirely from selectedBuilding / selectedRoom
// so it is ALWAYS in sync with selection state — no manual calls needed.
//
//   null     → no building selected: BuildingsDashboard open, others unmounted
//   'floor'  → building + floor selected, no room: FloorPanel open, Buildings hidden
//   'room'   → room selected: RoomDetailPanel open, others behind
//
// Components read `activePanel` via storeToRefs instead of receiving forceCollapse
// props or calling usePanelLayout() directly.
//
// `floorMeta` carries real-time floor-selector data that HologramMap owns internally.
// Publishing it here lets FloorPanel render the floor-bar on mobile without
// prop-drilling through index.vue.
// ───────────────────────────────────────────────────────────────────────────────
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useMapStore = defineStore('map', () => {
  // ── Selection state (unchanged external API) ──────────────────────────────────
  const selectedRoom     = ref<string | null>(null)
  const selectedBuilding = ref<string | null>(null)
  const selectedFloor    = ref<number | null>(null)
  const isLoading        = ref(false)

  // ── Floor meta — written by HologramMap, read by FloorPanel on mobile ─────────
  // Stored as plain arrays (Sets are not reactive).
  // Consumers: new Set(floorsWithDetail.value) when they need Set API.
  const availableFloors  = ref<number[]>([])
  const currentFloor     = ref<number | null>(null)
  const floorsWithDetail = ref<number[]>([])   // floors that have room detail data

  // ── Derived: which panel is active ────────────────────────────────────────────
  // Pure computed — never set directly. Components subscribe to this one value.
  const activePanel = computed<'buildings' | 'floor' | 'room'>(() => {
    if (selectedRoom.value)     return 'room'
    if (selectedBuilding.value) return 'floor'
    return 'buildings'
  })

  const hasSelection = computed(() => !!selectedBuilding.value || !!selectedRoom.value)

  // ── Actions ───────────────────────────────────────────────────────────────────
  function focusOnRoom(roomId: string, buildingId: string | null, floor: number | null) {
    selectedRoom.value = roomId
    if (buildingId) selectedBuilding.value = buildingId
    if (floor != null) selectedFloor.value = floor
  }

  function focusOnBuilding(buildingId: string | null, floor: number | null) {
    selectedBuilding.value = buildingId
    selectedFloor.value    = floor
    selectedRoom.value     = null
    if (!buildingId) {
      availableFloors.value  = []
      currentFloor.value     = null
      floorsWithDetail.value = []
    }
  }

  function setFloor(floor: number | null) {
    selectedFloor.value = floor
  }

  function clearSelection() {
    selectedRoom.value = null
  }

  // Called by HologramMap whenever it enters a building or switches floors.
  function setFloorMeta(meta: {
    availableFloors: number[]
    currentFloor: number | null
    floorsWithDetail: number[]
  }) {
    availableFloors.value   = meta.availableFloors
    currentFloor.value      = meta.currentFloor
    floorsWithDetail.value  = meta.floorsWithDetail
  }

  return {
    selectedRoom, selectedBuilding, selectedFloor, isLoading,
    availableFloors, currentFloor, floorsWithDetail,
    activePanel, hasSelection,
    focusOnRoom, focusOnBuilding, setFloor, clearSelection, setFloorMeta,
  }
})
