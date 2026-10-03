<!-- components/HologramMap.vue -->
<template>
  <div ref="mapContainer" class="map-container"></div>

  <!-- ================= Thanh tìm kiếm toàn cục (Global Search) ================= -->
  <div class="global-search-container">
    <div class="search-wrapper">

      <!-- Search icon -->
      <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <circle cx="11" cy="11" r="8"></circle>
        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
      </svg>

      <!-- RIGHT SEGMENT: naked input, flex: 1 fills all remaining space -->
      <input
        v-model="searchQuery"
        type="text"
        class="global-search-input"
        :placeholder="currentBuildingId ? `Tìm phòng trong ${currentBuildingId}…` : 'Tìm phòng trên Campus…'"
        @input="onSearchInput"
        @focus="onSearchInput"
        @blur="onSearchBlur"
      />
    </div>

    <div v-if="searchResults.length > 0" class="global-search-results">
      <button
        v-for="r in searchResults"
        :key="r.id"
        class="global-search-item"
        @click="goToRoom(r)"
      >
        <div class="rs-info">
          <span class="rs-id">{{ r.roomNumber }}</span>
          <span class="rs-name">{{ formatRoomName(r.roomName) }}</span>
        </div>
        <span v-if="!currentBuildingId" class="rs-building">{{ r.buildingId }}</span>
      </button>
    </div>
    <div v-else-if="searchQuery.trim() && !isSearching" class="global-search-results">
      <div class="room-search-empty">Không tìm thấy phòng phù hợp.</div>
    </div>
  </div>

  <!-- ================= Thang máy chọn tầng (Elevator HUD) ================= -->
  <Transition name="hud-slide">
    <!-- ARCH-FIX: on mobile the floor-bar is rendered inside FloorPanel's
         bottom sheet header. Hiding it here prevents the collision with
         the search bar that previous CSS fixes failed to solve. -->
    <div v-if="currentBuildingId && tier !== 'mobile'" class="floor-bar" role="group" :aria-label="`Chọn tầng toà ${currentBuildingId}`">
      <button class="floor-btn exit-btn" aria-label="Thoát khỏi toà nhà, về toàn cảnh" title="Thoát khỏi toà nhà" @click="exitBuilding">
        ✕
      </button>

      <div class="floor-bar-label">{{ currentBuildingId }}</div>

      <button
        v-for="floor in availableFloors"
        :key="floor"
        class="floor-btn"
        :class="{
          active: floor === currentFloor,
          detail: floorsWithDetail.has(floor) && floor !== currentFloor
        }"
        :aria-pressed="floor === currentFloor"
        :aria-label="floorsWithDetail.has(floor) ? `Tầng ${floor}, có dữ liệu chi tiết` : `Tầng ${floor}`"
        :title="floorsWithDetail.has(floor) ? `Tầng ${floor} — có dữ liệu chi tiết` : `Tầng ${floor}`"
        @click="selectFloor(floor)"
      >
        L{{ floor }}
      </button>
    </div>
  </Transition>

  <!-- ================= Thông báo tòa chưa định vị GPS ================= -->
  <Transition name="fade">
    <div v-if="currentBuildingId && !isGeolocated && tier !== 'mobile'" class="calib-notice">
      <span class="calib-dot"></span>
      Sơ đồ phòng tòa <b>{{ currentBuildingId }}</b> chưa được định vị GPS — đang chờ hiệu chỉnh tọa độ.
    </div>
  </Transition>

  <!-- Lưu ý: RoomDetailPanel KHÔNG render ở đây nữa để tránh 2 panel chồng nhau.
       Panel thật (duy nhất) được render ở pages/index.vue, điều khiển bởi
       Pinia store (selectedRoom). currentRoomId ở component này chỉ dùng nội bộ
       để tô sáng phòng / hiện marker / load thiết bị trên bản đồ. -->
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

// MOD-1: formatRoomName is now a shared utility exported from useVguData.js.
// Imported here directly (not via the composable return object) so it can also
// be used outside of Vue reactive context (e.g. inside the marker-creation loop).
import { formatRoomName } from '~/composables/useVguData'

// ARCH-FIX: HologramMap publishes floor meta to the store so FloorPanel
// can render the mobile floor-bar without prop-drilling.
import { useMapStore } from '~/Stores/mapStores'
import { useDeviceTier } from '~/composables/useDeviceTier'

const mapStore = useMapStore()
const { tier } = useDeviceTier()

const { searchRooms } = useVguData()

const config = useRuntimeConfig()
const base = config.app.baseURL

const mapContainer = ref(null)
let map = null

const emit = defineEmits(['room-selected', 'building-selected', 'floor-selected', 'equipment-selected', 'ready'])

const props = defineProps({
  initialCenter: {
    type: Array,
    default: () => [106.6155, 11.1083]
  },
  initialZoom: {
    type: Number,
    default: 17.5
  },
  initialPitch: {
    type: Number,
    default: 45
  }
})

const INITIAL_BEARING = -17.6

let floorsConfig = {}
const floorCache = new Map()
let buildingCenters = {}
const roomNameMap = ref({})
const roomStatusMap = ref({})

const BUILDING_AFFINE = {
  B1: {
    a: 8.953441376466221e-9, b: -3.1497975865435756e-9, c: 106.61539732322666,
    d: 3.182455243237762e-9, e: 8.530074661663595e-9, f: 11.108226425177252
  },
  B5: {
    a: 9.348060047786096e-9, b: -3.137160929858734e-9, c: 106.61606158856533,
    d: 3.3218630132168528e-9, e: 8.497975978545847e-9, f: 11.108450685256834
  },
  AD: {
    a: 8.766061793685426e-9, b: -2.9401918155464064e-9, c: 106.61628563445295,
    d: 2.949511826570467e-9, e: 8.738362378840202e-9, f: 11.107702556018145
  },
  B2: {
    a: 8.934000874052131e-9, b: -3.0617993522497056e-9, c: 106.61556743104268,
    d: 3.2196508335119185e-9, e: 8.496017971414428e-9, f: 11.107734813646012
  },
  B3: {
    a: 8.936440007959682e-9, b: -3.0696022659468247e-9, c: 106.61564963590135,
    d: 3.243586829736276e-9, e: 8.457006822971136e-9, f: 11.107323754174958
  },
  B6: {
    a: 8.875957765081311e-9, b: -3.145148965918998e-9, c: 106.6163603769583,
    d: 3.2835800566738925e-9, e: 8.501705317206016e-9, f: 11.107779247247372
  }
}

const METERS_TO_MM = 1000

function transformRing(ring, coeffs) {
  return ring.map(([x, y]) => {
    const xMm = x * METERS_TO_MM
    const yMm = y * METERS_TO_MM
    return [
      coeffs.a * xMm + coeffs.b * yMm + coeffs.c,
      coeffs.d * xMm + coeffs.e * yMm + coeffs.f
    ]
  })
}

function transformBuildingGeojson(buildingId, geojson) {
  const coeffs = BUILDING_AFFINE[buildingId]
  if (!coeffs) return geojson
  return {
    type: 'FeatureCollection',
    features: geojson.features.map(f => ({
      ...f,
      geometry: {
        ...f.geometry,
        coordinates: f.geometry.coordinates.map(ring => transformRing(ring, coeffs))
      }
    }))
  }
}

const VGU_BOUNDS = { minLon: 106.60, maxLon: 106.63, minLat: 11.10, maxLat: 11.12 }
function isLatLng([lon, lat]) {
  return lon >= VGU_BOUNDS.minLon && lon <= VGU_BOUNDS.maxLon
    && lat >= VGU_BOUNDS.minLat && lat <= VGU_BOUNDS.maxLat
}

function polygonCentroid(coordinates) {
  const pts = coordinates[0]
  let sx = 0, sy = 0
  const n = pts.length - 1
  for (let i = 0; i < n; i++) { sx += pts[i][0]; sy += pts[i][1] }
  return [sx / n, sy / n]
}

const currentBuildingId = ref(null)
const currentFloor = ref(null)
const currentRoomId = ref(null)
const selectedEquipmentId = ref(null) // NEW: tracks the active equipment for map highlight
const availableFloors = ref([])
const isGeolocated = ref(false)
let currentBuildingGeojson = null

const floorsWithDetail = computed(() => {
  const s = new Set()
  if (!currentBuildingGeojson) return s
  for (const f of currentBuildingGeojson.features) {
    const p = f.properties || {}
    if (p.room_id && roomNameMap.value[p.room_id]) s.add(p.floor)
  }
  return s
})

onMounted(() => {
  if (!mapContainer.value) return

  map = new maplibregl.Map({
    container: mapContainer.value,
    style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
    center: props.initialCenter,
    zoom: props.initialZoom,
    pitch: props.initialPitch,
    bearing: INITIAL_BEARING,
    antialias: true
  })

  map.addControl(new maplibregl.NavigationControl(), 'top-right')
  map.addControl(new maplibregl.ScaleControl({ maxWidth: 120, unit: 'metric' }), 'bottom-right')

  map.on('load', async () => {
    console.log('[HologramMap] Map loaded successfully')
    try {
      await Promise.all([
        loadCampusBuildings(),
        initRoomsLayer(),
        loadFloorsConfig(),
        loadRoomNames()
      ])
    } catch (e) {
      console.error('[HologramMap] Init error:', e)
    } finally {
      emit('ready')
    }
  })

  map.on('click', 'vgu-buildings-3d', (e) => {
    const feature = e.features[0]
    const buildingId = feature.properties?.building_id || feature.properties?.cluster_id
    if (buildingId) selectBuilding(buildingId)
  })

  map.on('click', 'vgu-rooms-fill', (e) => {
    // ── MapLibre-native guard: queryRenderedFeatures ──────────────────────────
    // MapLibre calls ALL layer handlers whose geometry overlaps the click point,
    // in registration order — so this room handler fires BEFORE the equipment
    // handler. A boolean flag set by the equipment handler arrives too late.
    //
    // The correct solution: query the equipment layer synchronously at the same
    // pixel *right here*, before doing any room logic. If an equipment polygon
    // sits under the cursor, abort immediately and let the equipment handler
    // (which fires next) take ownership of this click.
    const equipmentUnderCursor = map.queryRenderedFeatures(e.point, {
      layers: ['vgu-equipment-fill']
    })
    if (equipmentUnderCursor.length > 0) return

    const feature = e.features[0]
    const roomId = feature.properties?.room_id
    if (roomId) {
      selectRoom(roomId, polygonCentroid(feature.geometry.coordinates), feature.properties)
    }
  })

  const setPointer = (v) => () => { map.getCanvas().style.cursor = v ? 'pointer' : '' }
  map.on('mouseenter', 'vgu-buildings-3d', setPointer(true))
  map.on('mouseleave', 'vgu-buildings-3d', setPointer(false))
  map.on('mouseenter', 'vgu-rooms-fill', setPointer(true))
  map.on('mouseleave', 'vgu-rooms-fill', setPointer(false))

  // ── HTML marker zoom-declutter ────────────────────────────────────────────
  // HTML markers are vanilla DOM nodes — MapLibre cannot control them natively.
  // Strategy: toggle the CSS class `hidden-by-zoom` on each marker element.
  // The class uses `!important` in the stylesheet, so it wins over any inline
  // style set by updateMarkerVisibility() (display) or any other JS path.
  // The two concerns are now strictly separated:
  //   syncZoomVisibility   → adds/removes .hidden-by-zoom (zoom gate, CSS class)
  //   updateMarkerVisibility → sets display:none/'' (floor/room filter, inline)
  // They cannot conflict because they touch different CSS properties.
  map.on('zoom', syncZoomVisibility)

  // ── Hover: cursor + feature-state ────────────────────────────────────────
  // mouseenter/mouseleave are simpler than mousemove and avoid per-pixel
  // overhead. feature-state 'hover' drives fill-opacity in the paint expression.
  map.on('mouseenter', 'vgu-equipment-fill', (e) => {
    map.getCanvas().style.cursor = 'pointer'
    if (!e.features.length) return
    const id = e.features[0].id
    if (id !== undefined) {
      hoveredEquipmentId = id
      map.setFeatureState({ source: 'vgu-equipment', id }, { hover: true })
    }
  })
  map.on('mouseleave', 'vgu-equipment-fill', () => {
    map.getCanvas().style.cursor = ''
    if (hoveredEquipmentId !== null) {
      map.setFeatureState({ source: 'vgu-equipment', id: hoveredEquipmentId }, { hover: false })
      hoveredEquipmentId = null
    }
  })

  // ── Click: select equipment + emit to Vue parent ──────────────────────────
  map.on('click', 'vgu-equipment-fill', (e) => {
    try {
      if (!e.features || e.features.length === 0) return

      const feature = e.features[0]
      const props = feature.properties
      // equipment_id is the canonical key; fall back to numeric feature id for safety
      const equipmentId = props.equipment_id || props.id
      if (!equipmentId) return

      console.log('[MapLibre] Equipment clicked:', equipmentId, props)

      // Setting selectedEquipmentId triggers the watcher → updateEquipmentHighlight()
      selectedEquipmentId.value = equipmentId

      // room_id and building_id are embedded in every equipment GeoJSON feature.
      // Reading them from feature.properties is more reliable than currentRoomId.value,
      // which may not be set yet if the user clicks equipment before selecting the room.
      emit('equipment-selected', {
        equipmentId,
        roomId:     props.room_id     || currentRoomId.value,
        buildingId: props.building_id || currentBuildingId.value,
        properties: props
      })
    } catch (err) {
      console.error('[MapLibre] Error in equipment click handler:', err)
    }
  })
})

async function loadCampusBuildings() {
  try {
    const response = await fetch(`${base}campus-buildings.json`)
    const data = await response.json()

    buildingCenters = {}
    for (const f of data.features) {
      const id = f.properties?.building_id || f.id
      if (id && f.geometry?.type === 'Polygon') {
        buildingCenters[id] = polygonCentroid(f.geometry.coordinates)
      }
    }

    map.addSource('vgu-campus', { type: 'geojson', data })
    map.addLayer({
      id: 'vgu-buildings-3d',
      type: 'fill-extrusion',
      source: 'vgu-campus',
      paint: {
        'fill-extrusion-color': '#1a1a2e',
        'fill-extrusion-height': ['get', 'height'],
        'fill-extrusion-base': ['get', 'base_height'],
        'fill-extrusion-opacity': 0.9
      }
    })
    map.addLayer({
      id: 'vgu-buildings-outline',
      type: 'line',
      source: 'vgu-campus',
      paint: { 'line-color': '#EF5A24', 'line-width': 1, 'line-opacity': 0.6 }
    })
    map.addLayer({
      id: 'vgu-selected-3d',
      type: 'fill-extrusion',
      source: 'vgu-campus',
      paint: {
        'fill-extrusion-color': '#0C2B5C',
        'fill-extrusion-height': ['get', 'height'],
        'fill-extrusion-base': ['get', 'base_height'],
        'fill-extrusion-opacity': 0.12
      },
      filter: ['==', ['get', 'building_id'], '']
    })
    map.addLayer({
      id: 'vgu-selected-outline',
      type: 'line',
      source: 'vgu-campus',
      paint: { 'line-color': '#EF5A24', 'line-width': 3, 'line-opacity': 0.95 },
      filter: ['==', ['get', 'building_id'], '']
    })
  } catch (error) {
    console.error('[HologramMap] Failed to load campus buildings:', error)
  }
}

async function initRoomsLayer() {
  map.addSource('vgu-rooms', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] }
  })
  map.addLayer({
    id: 'vgu-rooms-fill',
    type: 'fill',
    source: 'vgu-rooms',
    paint: {
      'fill-color': [
        'match', ['get', 'type'],
        'laboratory', '#00ffcc',
        'corridor', '#334155',
        '#EF5A24'
      ],
      'fill-opacity': 0.35
    }
  })
  map.addLayer({
    id: 'vgu-rooms-outline',
    type: 'line',
    source: 'vgu-rooms',
    paint: { 'line-color': '#00ffcc', 'line-width': 1.5, 'line-opacity': 0.8 }
  })

  map.addSource('vgu-equipment', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
    generateId: true
  })

  // ── 2D fill layer for equipment polygons ──────────────────────────────────
  // Must be type:'fill' (not fill-extrusion) — consistent with vgu-rooms-fill
  // so click hitboxes, queryRenderedFeatures, and z-plane all behave correctly.
  // Color is managed by updateEquipmentHighlight() via setPaintProperty so
  // the initial expression here uses '' as a no-match placeholder.
  map.addLayer({
    id: 'vgu-equipment-fill',
    type: 'fill',
    source: 'vgu-equipment',
    paint: {
      'fill-color': [
        'case',
        ['==', ['get', 'equipment_id'], ''],  // placeholder; replaced by updateEquipmentHighlight()
        '#F58220',
        '#B3BFCD'
      ],
      'fill-opacity': [
        'case',
        ['boolean', ['feature-state', 'hover'], false],
        0.92,
        0.72
      ]
    }
  })

  // ── Outline layer stays as a 2-D line drawn around each block ──────────────
  map.addLayer({
    id: 'vgu-equipment-outline',
    type: 'line',
    source: 'vgu-equipment',
    paint: {
      'line-color': [
        'case',
        ['boolean', ['feature-state', 'hover'], false],
        '#00ffcc',
        '#38bdf8'
      ],
      'line-width': [
        'case',
        ['boolean', ['feature-state', 'hover'], false],
        2.5,
        1.0
      ]
    }
  })

  // ── Symbol label layer: text centred on each equipment polygon ─────────────
  // Attached to the same `vgu-equipment` source so labels auto-update with data.
  // Rendered after the fill layer so text sits on top in the draw order.
  // DECLUTTER: minzoom:19.5 hides labels when zoomed out; interpolated
  // text-opacity fades them in smoothly between z19.5→19.8 to avoid a hard snap.
  // Must be deeper than room markers (19.0) to preserve the zoom-reveal hierarchy.
  map.addLayer({
    id: 'vgu-equipment-labels',
    type: 'symbol',
    source: 'vgu-equipment',
    minzoom: 21.5, // Deeper than room markers (19.0) so equipment detail appears last
    layout: {
      // Display the short code (e.g. "E18") — falls back to equipment_id
      'text-field': [
        'coalesce',
        ['get', 'model_code'],
        ['get', 'equipment_id']
      ],
      'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
      'text-size': 11,
      'text-anchor': 'center',
      'text-allow-overlap': true,   // always show even when crowded
      'text-ignore-placement': true
    },
    paint: {
      'text-color': [
        'case',
        // Selected equipment gets accent-coloured text for extra pop
        ['==', ['get', 'equipment_id'], ''],  // placeholder; updated by updateEquipmentHighlight()
        '#F58220',
        '#FFFFFF'
      ],
      'text-halo-color': '#001A3A',
      'text-halo-width': 1.5,
      // FADE-IN: interpolate opacity at the minzoom boundary so labels
      // ease in rather than snapping on abruptly.
      // Window z19.5→z19.8 keeps the fade tight (≈0.3 zoom units) so it
      // feels snappy but not harsh.
      'text-opacity': [
        'interpolate',
        ['linear'],
        ['zoom'],
        21.5, 0,   // fully invisible at the minzoom threshold
        21.8, 1    // fully visible 0.3 zoom units deeper
      ]
    }
  })
}

async function loadFloorsConfig() {
  try {
    const response = await fetch(`${base}data/floors-config.json`)
    floorsConfig = await response.json()
  } catch (error) {
    console.error('[HologramMap] Failed to load floors-config.json:', error)
  }
}

async function loadRoomNames() {
  try {
    const response = await fetch(`${base}data/info_data.json`)
    const json = await response.json()
    const rows = Array.isArray(json) ? json : (json?.data || [])
    const map_ = {}
    const statusMap_ = {}
    for (const r of rows) {
      const key = r.room_number
      if (!key) continue
      const en = (r.heading_1 || '').trim()
      const vi = (r.heading_2 || '').trim()
      if (en || vi) map_[key] = { en, vi }
      statusMap_[key] = normalizeRoomStatus(r.status)
    }
    roomNameMap.value = map_
    roomStatusMap.value = statusMap_
  } catch (error) {
    console.warn('[HologramMap] Không tải được info_data.json:', error)
  }
}

// Cùng logic chuẩn hoá status như useVguData.js, để màu chấm trên bản đồ
// nhất quán với trạng thái hiển thị ở panel chi tiết phòng.
function normalizeRoomStatus(raw) {
  const s = (raw || '').trim()
  if (s === 'Đang sử dụng') return 'active'
  if (s === 'Chưa sử dụng') return 'inactive'
  return 'unknown'
}

async function selectBuilding(buildingId) {
  if (!map) return  // MOD-2 FIX: guard against unmount during async init
  if (buildingId === currentBuildingId.value) return
  currentBuildingId.value = buildingId
  currentRoomId.value = null

  const floors = floorsConfig[buildingId] || []
  availableFloors.value = [...floors].sort((a, b) => a - b)
  
  mapStore.setFloorMeta({
    availableFloors:  availableFloors.value,
    currentFloor:     currentFloor.value,
    floorsWithDetail: [...floorsWithDetail.value],
  })

  map.setFilter('vgu-buildings-3d', ['!=', ['get', 'building_id'], buildingId])
  map.setFilter('vgu-buildings-outline', ['!=', ['get', 'building_id'], buildingId])
  map.setFilter('vgu-selected-3d', ['==', ['get', 'building_id'], buildingId])
  map.setFilter('vgu-selected-outline', ['==', ['get', 'building_id'], buildingId])

  const center = buildingCenters[buildingId] || props.initialCenter
  map.flyTo({ center, zoom: 19.2, pitch: 0, bearing: 0, duration: 1500 })

  currentBuildingGeojson = await getBuildingRoomsData(buildingId)

  isGeolocated.value = !!(currentBuildingGeojson?.features?.length
    && isLatLng(currentBuildingGeojson.features[0].geometry.coordinates[0][0]))

  if (isGeolocated.value && map.getSource('vgu-rooms')) {
    map.getSource('vgu-rooms').setData(currentBuildingGeojson)
  } else {
    if (map.getSource('vgu-rooms')) {
      map.getSource('vgu-rooms').setData({ type: 'FeatureCollection', features: [] })
    }
  }

  const defaultFloor = availableFloors.value[0] ?? null
  emit('building-selected', { buildingId, floor: defaultFloor })
  if (defaultFloor != null) selectFloor(defaultFloor)
}

function selectFloor(floorNumber) {
  if (!map) return  // MOD-2 FIX: guard against null map after unmount
  currentFloor.value = floorNumber
  
  mapStore.setFloorMeta({
    availableFloors:  availableFloors.value,
    currentFloor:     floorNumber,
    floorsWithDetail: [...floorsWithDetail.value],
  })

  currentRoomId.value = null
  updateRoomHighlightPaint()

  const filter = ['all',
    ['==', ['get', 'floor'], floorNumber],
    currentBuildingId.value ? ['==', ['get', 'building_id'], currentBuildingId.value] : true
  ]
  map.setFilter('vgu-rooms-fill', filter)
  map.setFilter('vgu-rooms-outline', filter)

  renderRoomMarkers(floorNumber)
  emit('floor-selected', { buildingId: currentBuildingId.value, floor: floorNumber })
}

const searchQuery = ref('')
const searchResults = ref([])
const isSearching = ref(false)
let searchDebounce = null

function onSearchInput() {
  clearTimeout(searchDebounce)
  const q = searchQuery.value.trim()
  if (!q) {
    searchResults.value = []
    return
  }
  searchDebounce = setTimeout(async () => {
    isSearching.value = true
    try {
      const rawResults = await searchRooms(q, 50)
      
      if (currentBuildingId.value) {
        searchResults.value = rawResults
          .filter(r => r.buildingId === currentBuildingId.value)
          .slice(0, 8)
      } else {
        searchResults.value = rawResults.slice(0, 8)
      }
    } finally {
      isSearching.value = false
    }
  }, 250)
}

function onSearchBlur() {
  setTimeout(() => {
    searchResults.value = []
    searchQuery.value = ''
  }, 200)
}

async function goToRoom(result) {
  if (!result?.buildingId) return
  searchQuery.value = ''
  searchResults.value = []

  if (currentBuildingId.value !== result.buildingId) {
    currentBuildingId.value = null
    await selectBuilding(result.buildingId)
  }
  if (result.floor != null && result.floor !== currentFloor.value) {
    selectFloor(result.floor)
  }

  const feature = currentBuildingGeojson?.features?.find(
    f => f.properties?.room_id === result.id
  ) ?? null
  const centroid = feature ? polygonCentroid(feature.geometry.coordinates) : null
  selectRoom(result.id, centroid, feature?.properties || { building_id: result.buildingId, floor: result.floor })
}

const ROOM_TYPE_COLOR_EXPR = ['match', ['get', 'type'],
  'laboratory', '#00ffcc',
  'corridor', '#334155',
  '#EF5A24'
]

function updateRoomHighlightPaint() {
  if (!map || !map.getLayer('vgu-rooms-fill') || !map.getLayer('vgu-rooms-outline')) return
  const selId = currentRoomId.value

  if (!selId) {
    map.setPaintProperty('vgu-rooms-fill', 'fill-opacity', 0.35)
    map.setPaintProperty('vgu-rooms-outline', 'line-color', ROOM_TYPE_COLOR_EXPR)
    map.setPaintProperty('vgu-rooms-outline', 'line-width', 1.5)
    map.setPaintProperty('vgu-rooms-outline', 'line-opacity', 0.8)
    return
  }

  map.setPaintProperty('vgu-rooms-fill', 'fill-opacity', [
    'case', ['==', ['get', 'room_id'], selId], 0.6, 0.1
  ])
  map.setPaintProperty('vgu-rooms-outline', 'line-color', [
    'case', ['==', ['get', 'room_id'], selId], ROOM_TYPE_COLOR_EXPR, '#334155'
  ])
  map.setPaintProperty('vgu-rooms-outline', 'line-width', [
    'case', ['==', ['get', 'room_id'], selId], 3, 1
  ])
  map.setPaintProperty('vgu-rooms-outline', 'line-opacity', [
    'case', ['==', ['get', 'room_id'], selId], 1, 0.25
  ])
}

function selectRoom(roomId, centroid, propsObj = {}) {
  currentRoomId.value = roomId
  updateRoomHighlightPaint()
  updateMarkerVisibility()
  emit('room-selected', {
    roomId,
    buildingId: propsObj.building_id || currentBuildingId.value,
    floor: propsObj.floor ?? currentFloor.value
  })
  if (map && centroid && isLatLng(centroid)) {
    map.flyTo({ center: centroid, zoom: 20.6, pitch: 30, bearing: 10, duration: 1200 })
  }
}

// closeRoomDetail() is called when the RoomDetailPanel UI is dismissed.
//
// Watcher handles resetting room state and camera fly-back.
function closeRoomDetail() {
  updateMarkerVisibility()
}

function exitBuilding() {
  if (!map) return  
  currentBuildingId.value = null
  currentFloor.value = null
  currentRoomId.value = null
  availableFloors.value = []
  isGeolocated.value = false
  currentBuildingGeojson = null
  
  searchQuery.value = ''
  searchResults.value = []

  clearRoomMarkers()
  clearEquipmentLayer()
  updateRoomHighlightPaint()

  map.setFilter('vgu-buildings-3d', null)
  map.setFilter('vgu-buildings-outline', null)
  map.setFilter('vgu-selected-3d', ['==', ['get', 'building_id'], ''])
  map.setFilter('vgu-selected-outline', ['==', ['get', 'building_id'], ''])

  if (map.getSource('vgu-rooms')) {
    map.getSource('vgu-rooms').setData({ type: 'FeatureCollection', features: [] })
  }

  map.flyTo({
    center: props.initialCenter,
    zoom: props.initialZoom,
    pitch: props.initialPitch,
    bearing: INITIAL_BEARING,
    duration: 1500
  })

  emit('building-selected', { buildingId: null, floor: null })
}

let hoveredEquipmentId = null
const equipmentCache = new Map()

async function loadEquipmentForRoom(buildingId, roomId) {
  if (!map || !map.getSource('vgu-equipment')) return  
  const cacheKey = `${buildingId}:${roomId}`
  try {
    let data = equipmentCache.get(cacheKey)
    if (!data) {
      const response = await fetch(`${base}data/equipment/${roomId}.geojson`)
      if (!response.ok) {
        clearEquipmentLayer()
        return
      }
      const raw = await response.json()
      data = transformBuildingGeojson(buildingId, raw)
      equipmentCache.set(cacheKey, data)
    }
    if (!map || !map.getSource('vgu-equipment')) return
    map.getSource('vgu-equipment').setData(data)
  } catch (error) {
    console.warn(`[HologramMap] Không tải được thiết bị cho phòng ${roomId}:`, error)
    clearEquipmentLayer()
  }
}

// ── Equipment highlight: data-driven paint driven by selectedEquipmentId ──────
// Called whenever selectedEquipmentId changes. Uses MapLibre's `case` expression
// so only the matching feature gets the accent colour; all others stay dimmed.
// Also updates the label layer's text-color to echo the selection state.
function updateEquipmentHighlight() {
  if (!map || !map.getLayer('vgu-equipment-fill')) return

  const selId = selectedEquipmentId.value || ''

  // fill-color (not fill-extrusion-color) — layer is type:'fill'
  map.setPaintProperty('vgu-equipment-fill', 'fill-color', [
    'case',
    ['==', ['get', 'equipment_id'], selId],
    '#F58220',   // VGU brand accent — selected
    '#B3BFCD'    // Dimmed slate — unselected
  ])

  // Label text colour: selected equipment gets the same accent highlight
  if (map.getLayer('vgu-equipment-labels')) {
    map.setPaintProperty('vgu-equipment-labels', 'text-color', [
      'case',
      ['==', ['get', 'equipment_id'], selId],
      '#F58220',
      '#FFFFFF'
    ])
  }
}

function clearEquipmentLayer() {
  hoveredEquipmentId = null
  selectedEquipmentId.value = null
  if (map?.getSource('vgu-equipment')) {
    map.getSource('vgu-equipment').setData({ type: 'FeatureCollection', features: [] })
  }
}

watch(currentRoomId, (roomId) => {
  if (!roomId || !currentBuildingId.value) {
    clearEquipmentLayer()
    return
  }
  loadEquipmentForRoom(currentBuildingId.value, roomId)
})

// ── Sync selectedEquipmentId → MapLibre paint ─────────────────────────────
watch(selectedEquipmentId, () => {
  updateEquipmentHighlight()
})

// ── Sync store room deselect → map highlight & camera fly-back ────────────
// Khi selectedRoom = null (dù là đóng panel hay exit building), luôn clear highlight,
// reset marker và fly về góc nhìn tổng quan tòa nhà.
watch(
  () => mapStore.selectedRoom,
  (roomId) => {
    if (roomId !== null) return          // selection set — selectRoom() already handled this

    currentRoomId.value = null
    updateRoomHighlightPaint()
    updateMarkerVisibility()

    // Nếu vẫn đang ở trong tòa nhà → fly về tổng quan tòa nhà
    if (currentBuildingId.value && map) {
      const center = buildingCenters[currentBuildingId.value] || props.initialCenter
      map.flyTo({
        center,
        zoom: 19.2,
        pitch: 0,
        bearing: 0,
        duration: 800,
        easing: t => t < 0.5 ? 2*t*t : -1+(4-2*t)*t
      })
    }
  }
)

// FIX BUG-2 & BUG-3: Theo dõi selectedFloor từ store để cập nhật map và currentFloor
watch(
  () => mapStore.selectedFloor,
  (newFloor) => {
    if (newFloor == null) return
    if (newFloor === currentFloor.value) return
    if (!currentBuildingId.value) return
    selectFloor(newFloor)
  }
)

let roomMarkers = []

// ── Zoom-gate: CSS-class strategy ────────────────────────────────────────────
const ROOM_MARKER_MINZOOM = 19.0

function syncZoomVisibility() {
  if (!map) return
  const zoomedOut = map.getZoom() < ROOM_MARKER_MINZOOM
  roomMarkers.forEach(({ el }) => {
    el.classList.toggle('hidden-by-zoom', zoomedOut)
  })
}

function clearRoomMarkers() {
  roomMarkers.forEach(m => m.marker.remove())
  roomMarkers = []
}

function updateMarkerVisibility() {
  const selId = currentRoomId.value
  roomMarkers.forEach(({ el, roomId }) => {
    el.style.display = (!selId || roomId === selId) ? '' : 'none'
  })
}

function renderRoomMarkers(floorNumber) {
  if (!map) return  
  clearRoomMarkers()
  if (!isGeolocated.value || !currentBuildingGeojson) return

  const rooms = currentBuildingGeojson.features.filter(
    f => f.properties?.floor === floorNumber
  )

  rooms.forEach(room => {
    const centroid = polygonCentroid(room.geometry.coordinates)
    if (!isLatLng(centroid)) return

    const roomId = room.properties.room_id
    const name = roomNameMap.value[roomId]
    const label = name ? (name.vi || name.en) : ''

    const el = document.createElement('div')
    el.className = 'vgu-room-marker'
    el.style.cssText = 'position:relative;width:0;height:0;cursor:pointer;pointer-events:auto;'

    const dot = document.createElement('div')
    dot.className = 'room-dot'
    const ping = document.createElement('span')
    ping.className = 'room-ping'
    const core = document.createElement('span')
    core.className = 'room-core'
    dot.appendChild(ping)
    dot.appendChild(core)

    // Màu chấm theo trạng thái phòng: inactive = cam, active = xanh lá,
    // unknown giữ nguyên màu cam mặc định (chưa xác định).
    const status = roomStatusMap.value[roomId]
    if (status === 'active') {
      dot.classList.add('room-dot--active')
    } else if (status === 'inactive') {
      dot.classList.add('room-dot--inactive')
    }

    const card = document.createElement('div')
    card.className = 'room-marker-card'

    const idEl = document.createElement('div')
    idEl.className = 'room-marker-id'
    idEl.textContent = roomId          
    card.appendChild(idEl)

    if (label) {
      const nameEl = document.createElement('div')
      nameEl.className = 'room-marker-name'
      nameEl.textContent = formatRoomName(label)  
      card.appendChild(nameEl)
    }

    el.appendChild(dot)
    el.appendChild(card)
    el.addEventListener('click', (e) => {
      e.stopPropagation()
      selectRoom(roomId, centroid, room.properties)
    })

    const marker = new maplibregl.Marker({ element: el }).setLngLat(centroid).addTo(map)
    roomMarkers.push({ marker, el, roomId })
  })

  syncZoomVisibility()
  updateMarkerVisibility()
}

async function getBuildingRoomsData(buildingId) {
  if (floorCache.has(buildingId)) return floorCache.get(buildingId)
  try {
    const response = await fetch(`${base}data/rooms/${buildingId}.geojson`)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const raw = await response.json()
    const data = transformBuildingGeojson(buildingId, raw)
    floorCache.set(buildingId, data)
    return data
  } catch (error) {
    console.error(`[HologramMap] Failed to load rooms for building ${buildingId}:`, error)
    return null
  }
}

onUnmounted(() => {
  clearRoomMarkers()
  if (map) { map.remove(); map = null }
})

function highlightEquipment(equipmentId) {
  selectedEquipmentId.value = equipmentId ?? null
}

defineExpose({ goToRoom, closeRoomDetail, selectBuilding, highlightEquipment })
</script>

<style scoped>
.map-container {
  width: 100%;
  height: 100vh;
  position: absolute;
  top: 0;
  left: 0;
}

:deep(.maplibregl-ctrl) {
  background: rgba(15, 30, 54, 0.9);
  border: 1px solid rgba(239, 90, 36, 0.3);
  border-radius: 4px;
}
:deep(.maplibregl-ctrl button) { background: transparent; color: #00ffcc; }
:deep(.maplibregl-ctrl button:hover) { background: rgba(239, 90, 36, 0.2); }
:deep(.maplibregl-popup-content) {
  background: rgba(15, 30, 54, 0.95);
  border: 1px solid rgba(239, 90, 36, 0.4);
  color: white;
  font-family: 'Be Vietnam Pro', sans-serif;
  backdrop-filter: blur(8px);
}
:deep(.maplibregl-popup-tip) { border-top-color: rgba(15, 30, 54, 0.95); }

:deep(.maplibregl-ctrl-scale) {
  background-color: rgba(0, 32, 64, 0.8) !important;
  color: #FFFFFF !important;
  border: 1px solid #F58220 !important;
  border-top: none !important;
  padding: 2px 8px !important;
  border-radius: 0 0 4px 4px !important;
  font-family: 'Space Mono', monospace, sans-serif !important;
  font-weight: 500 !important;
  font-size: 10px !important;
  letter-spacing: 0.03em !important;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3) !important;
  border-top-color: transparent !important;
}

.global-search-container {
  position: absolute;
  top: calc(var(--header-h, 64px) + 12px);
  left: 50%;
  transform: translateX(-50%);
  z-index: 70;
  width: 340px;
  max-width: 92vw;
}

.search-wrapper {
  width: 100%;
  height: 44px;
  display: flex;
  flex-direction: row;
  align-items: center;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(11, 17, 32, 0.85);
  backdrop-filter: blur(8px);
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.35);
  transition: border-color 0.2s ease;
}

.search-wrapper:focus-within {
  border-color: #EF5A24;
}

.search-icon {
  flex-shrink: 0;
  align-self: center;
  width: 15px;
  height: 15px;
  margin: 0 10px 0 14px;
  color: #64748b;
  pointer-events: none;
}

.global-search-input {
  flex: 1;
  min-width: 0;
  height: 100%;
  padding: 0 16px 0 0;
  background: transparent;
  border: none;
  outline: none;
  color: #fff;
  font-family: 'Space Mono', monospace;
  font-size: 13px;
  line-height: 1;
}

.global-search-input::placeholder {
  color: rgba(255, 255, 255, 0.35);
}

.global-search-results {
  margin-top: 8px;
  width: 100%;
  max-height: 320px;
  overflow-y: auto;
  background: rgba(11, 17, 32, 0.95);
  border: 1px solid rgba(239, 90, 36, 0.3);
  border-radius: 12px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  backdrop-filter: blur(8px);
}

.global-search-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  text-align: left;
  background: transparent;
  border: none;
  border-radius: 8px;
  padding: 10px 12px;
  cursor: pointer;
  color: #e2e8f0;
  transition: background 0.15s;
}
.global-search-item:hover { background: rgba(239, 90, 36, 0.15); }

.rs-info { display: flex; flex-direction: column; gap: 2px; }
.rs-id { font-family: 'Space Mono', monospace; font-size: 11px; font-weight: 700; color: #EF5A24; }
.rs-name { font-size: 11px; color: #94a3b8; }
.rs-building {
  font-size: 10px; font-weight: 700; color: #94a3b8;
  background: rgba(255,255,255,0.1); padding: 2px 6px; border-radius: 4px; margin-left: 10px;
}
.room-search-empty { padding: 10px; font-size: 11px; color: #64748b; text-align: center; }

.global-search-results::-webkit-scrollbar { width: 6px; }
.global-search-results::-webkit-scrollbar-thumb { background: #334155; border-radius: 4px; }

.floor-bar {
  position: absolute;
  left: 50%;
  bottom: 24px;
  transform: translateX(-50%);
  z-index: 60;
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  background: rgba(15, 30, 54, 0.9);
  border: 1px solid rgba(239, 90, 36, 0.3);
  border-radius: 999px;
  backdrop-filter: blur(10px);
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.5);
  max-width: 100%;
}

.floor-bar-label {
  font-family: 'Space Mono', monospace; font-size: 11px; font-weight: 700;
  letter-spacing: 1px; color: #EF5A24; padding: 0 6px 0 4px;
  border-right: 1px solid rgba(239, 90, 36, 0.2);
}

.floor-btn {
  width: 40px; height: 40px; border-radius: 50%; display: flex;
  align-items: center; justify-content: center; background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.12); color: rgba(255, 255, 255, 0.7);
  font-family: 'Space Mono', monospace; font-size: 12px; font-weight: 700;
  cursor: pointer; transition: all 0.25s ease;
}
.floor-btn:hover { border-color: rgba(239, 90, 36, 0.6); color: #fff; }
.floor-btn.detail {
  border-color: rgba(6, 182, 212, 0.6); background: rgba(6, 182, 212, 0.08);
  color: #06B6D4; box-shadow: 0 0 8px rgba(6, 182, 212, 0.25);
}
.floor-btn.detail:hover { color: #fff; border-color: #06B6D4; }
.floor-btn.active { background: #EF5A24; border-color: #EF5A24; color: #fff; box-shadow: 0 0 12px #EF5A24; }

.exit-btn { margin-right: 4px; color: #EF5A24; border-color: rgba(239, 90, 36, 0.25); font-size: 14px; }
.exit-btn:hover { background: rgba(239, 90, 36, 0.12); color: #fff; }

.calib-notice {
  position: absolute; bottom: 80px; left: 50%; transform: translateX(-50%);
  z-index: 20; display: flex; align-items: center; gap: 10px; max-width: 90vw;
  padding: 10px 18px; background: rgba(15, 30, 54, 0.92);
  border: 1px solid rgba(239, 90, 36, 0.4); border-radius: 6px;
  backdrop-filter: blur(8px); color: #e0e0e0; font-family: 'Space Mono', monospace;
  font-size: 12px; line-height: 1.4;
}
.calib-notice b { color: #EF5A24; }
.calib-dot {
  width: 8px; height: 8px; border-radius: 50%; background: #EF5A24;
  box-shadow: 0 0 8px #EF5A24; animation: calib-pulse 1.4s ease-in-out infinite; flex-shrink: 0;
}
@keyframes calib-pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.4; transform: scale(0.6); } }

:deep(.vgu-room-marker) { transition: opacity 0.3s ease; }

:deep(.vgu-room-marker.hidden-by-zoom) {
  opacity: 0 !important;
  pointer-events: none !important;
}

:deep(.room-dot) { position: absolute; transform: translate(-50%, -50%); width: 14px; height: 14px; display: flex; align-items: center; justify-content: center; }
:deep(.room-ping) { position: absolute; display: inline-flex; width: 100%; height: 100%; border-radius: 50%; background: #EF5A24; opacity: 0.75; animation: room-ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite; }
:deep(.room-core) { position: relative; width: 8px; height: 8px; border-radius: 50%; background: #EF5A24; box-shadow: 0 0 6px #EF5A24; }
/* Trạng thái phòng: inactive = cam (mặc định), active = xanh lá */
:deep(.room-dot--active .room-ping) { background: #22C55E; }
:deep(.room-dot--active .room-core) { background: #22C55E; box-shadow: 0 0 6px #22C55E; }
:deep(.room-dot--inactive .room-ping) { background: #EF5A24; }
:deep(.room-dot--inactive .room-core) { background: #EF5A24; box-shadow: 0 0 6px #EF5A24; }
@keyframes room-ping { 75%, 100% { transform: scale(2); opacity: 0; } }
:deep(.room-marker-card) {
  position: absolute; top: 14px; left: 50%; transform: translateX(-50%);
  min-width: 96px; max-width: 160px; padding: 5px 10px; text-align: center;
  border-radius: 4px; background: rgba(15, 30, 54, 0.95);
  border: 1px solid rgba(239, 90, 36, 0.3); box-shadow: 0 4px 14px rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(6px); transition: transform 0.2s ease, border-color 0.2s ease;
}
:deep(.room-marker-card:hover) { transform: translateX(-50%) scale(1.05); border-color: #EF5A24; }
:deep(.room-marker-id) { font-family: 'Space Mono', monospace; font-size: 10px; font-weight: 800; letter-spacing: 0.5px; color: #EF5A24; text-transform: uppercase; }
:deep(.room-marker-name) { font-family: 'Be Vietnam Pro', sans-serif; font-size: 9px; line-height: 1.2; color: rgba(255, 255, 255, 0.82); margin-top: 2px; display: -webkit-box; line-clamp: 2; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }

.hud-slide-enter-active, .hud-slide-leave-active { transition: opacity 0.3s ease, transform 0.3s ease; }
.hud-slide-enter-from, .hud-slide-leave-to { opacity: 0; transform: translateY(-50%) translateX(-16px); }
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

@media (prefers-reduced-motion: reduce) {
  :deep(.room-ping) { animation: none; opacity: 0.4; }
  .calib-dot { animation: none; }
  .hud-slide-enter-active, .hud-slide-leave-active, .fade-enter-active, .fade-leave-active { transition: none; }
}

@media (max-width: 640px) {
  .global-search-container { width: min(360px, 94vw); top: calc(var(--header-h-mobile, 54px) + 8px); left: 50%; transform: translateX(-50%); }
  .search-wrapper { height: 40px; }
  .search-icon { margin: 0 8px 0 10px; }
  .global-search-input { font-size: 12px; }
  .global-search-results { max-height: 38vh; }
  .floor-bar { top: calc(var(--header-h-mobile, 54px) + 76px); bottom: auto; left: 50%; transform: translateX(-50%); z-index: 115; gap: 6px; padding: 6px 8px; max-width: 92vw; overflow-x: auto; -webkit-overflow-scrolling: touch; scrollbar-width: none; }
  .floor-bar::-webkit-scrollbar { display: none; }
  .floor-btn { width: 38px; height: 38px; font-size: 11px; flex-shrink: 0; touch-action: manipulation; }
  .floor-bar-label { flex-shrink: 0; }
  .exit-btn { flex-shrink: 0; }
  .calib-notice { top: calc(var(--header-h-mobile, 54px) + 138px); bottom: auto; z-index: 61; }
  :deep(.room-marker-card) { min-width: 84px; max-width: 130px; padding: 4px 8px; }
  :deep(.room-marker-id) { font-size: 9px; }
  :deep(.room-marker-name) { font-size: 8px; line-clamp: 1; -webkit-line-clamp: 1; }

  /* ── MapLibre controls: eradicated on mobile ────────────────────────────────
     Both bottom control containers are killed completely. The attribution widget
     inherits the global .maplibregl-ctrl dark-panel style and was still visually
     bleeding through the safe-area gap even at z-index: 1. display:none removes
     the nodes from layout and paint entirely — no bleed, no overlap, no jitter. */
  :deep(.maplibregl-ctrl-bottom-left),
  :deep(.maplibregl-ctrl-bottom-right) {
    display: none !important;
  }
}
</style>
