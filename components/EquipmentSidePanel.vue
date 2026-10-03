<template>
  <!-- ── Backdrop: tablet/mobile only — click outside to close ── -->
  <div
    v-if="tier !== 'desktop'"
    class="adaptive-backdrop"
    style="z-index: 109"
    @click="handleClose"
  ></div>

  <!-- ══════════════════════════════════════════════════════════════
       ROOT PANEL — TRUE FULL-BLEED OVERLAY
       position:absolute + inset:0 ensures it completely covers the
       RoomDetailPanel's scrollable body. z-index:100 sits above all
       room content. The solid background makes the parent invisible.
  ══════════════════════════════════════════════════════════════ -->
  <div
    class="esp"
    :class="`tier-${tier}`"
    :style="tier === 'mobile' ? sheetStyle : null"
  >
    <!-- Mobile drag handle -->
    <div
      v-if="tier === 'mobile'"
      class="adaptive-sheet-handle"
      @pointerdown="onSheetDragStart"
    ></div>

    <!-- ================================================================
         VIEW 1 — EQUIPMENT LIST
         ================================================================ -->
    <template v-if="!selectedMachine">
      <!-- ── Sticky Glassmorphism Header ── -->
      <header class="esp-header esp-header--sticky">
        <div class="esp-header__breadcrumb">
          <span class="esp-header__eyebrow">{{ roomLabel }}</span>
          <h2 class="esp-header__title">Thiết bị phòng học</h2>
        </div>
        <button class="esp-icon-btn" aria-label="Đóng" @click="handleClose">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </header>

      <!-- List body -->
      <div class="esp-list-body">
        <!-- Loading -->
        <div v-if="isLoadingList" class="esp-state">
          <span class="esp-state__spinner"></span>
          <p>Đang tải danh sách thiết bị…</p>
        </div>

        <!-- Empty -->
        <div v-else-if="machines.length === 0" class="esp-state esp-state--empty">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.1" opacity="0.25">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
            <polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>
          </svg>
          <p>Chưa có thiết bị nào được ghi nhận cho phòng này.</p>
        </div>

        <!-- Machine cards -->
        <ul v-else class="esp-machine-list">
          <li v-for="m in machines" :key="m.id">
            <button class="esp-machine-card" @click="selectMachine(m)">
              <div class="esp-machine-card__thumb">
                <img v-if="m.thumbnail" :src="m.thumbnail" :alt="m.title" />
                <svg v-else width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" opacity="0.35">
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                  <polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>
                </svg>
                <span v-if="m.has3DModel" class="esp-badge-3d">3D</span>
              </div>
              <div class="esp-machine-card__meta">
                <span class="esp-machine-card__name">{{ m.title }}</span>
                <span v-if="m.model" class="esp-machine-card__model">{{ m.model }}</span>
              </div>
              <svg class="esp-machine-card__chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </button>
          </li>
        </ul>
      </div>
    </template>

    <!-- ================================================================
         VIEW 2 — EQUIPMENT DETAIL
         ================================================================ -->
    <template v-else>
      <!-- ── Single Sticky Glassmorphism Header with SVG Back Arrow ── -->
      <header class="esp-header esp-header--sticky esp-header--detail">
        <button class="esp-back-btn" @click="selectedMachine = null" aria-label="Quay lại">
          <!-- Elegant SVG arrow — no browser default button appearance -->
          <svg class="esp-back-btn__arrow" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"/>
            <polyline points="11 18 5 12 11 6"/>
          </svg>
          <span class="esp-back-btn__label">Danh sách</span>
        </button>

        <div class="esp-header__title-wrap">
          <span class="esp-header__title esp-header__title--detail" :title="selectedMachine.title">{{ selectedMachine.title }}</span>
        </div>

        <button class="esp-icon-btn" aria-label="Đóng" @click="handleClose">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </header>

      <!-- Scrollable detail content -->
      <div class="esp-detail-scroll">

        <!-- ── Premium 3D Viewer Frame ── -->
        <div class="esp-viewer-wrap">
          <img
            v-if="viewMode === 'photo' && selectedMachine.photos[activePhotoIndex]"
            :src="selectedMachine.photos[activePhotoIndex]"
            :alt="selectedMachine.title"
            class="esp-viewer-img"
          />

          <model-viewer
            v-else-if="selectedMachine.modelUrl && !modelFailed"
            :key="selectedMachine.id + '-' + activeModelSrc"
            :src="activeModelSrc"
            camera-controls
            auto-rotate
            shadow-intensity="1"
            exposure="1"
            touch-action="pan-y"
            interaction-prompt="none"
            :style="{ '--poster-color': 'transparent' }"
            class="esp-viewer-model"
            @error="onModelError"
            @load="onModelLoad"
          >
            <div slot="progress-bar" class="esp-model-progress"></div>
            <div slot="poster" class="esp-model-loading">
              <span class="esp-state__spinner esp-state__spinner--sm"></span>
              <span>{{ statusText }}</span>
            </div>
          </model-viewer>

          <!-- Premium empty state — centered via flex -->
          <div v-else class="esp-viewer-empty">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.1" opacity="0.25">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
              <polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>
            </svg>
            <span>Chưa có mô hình 3D</span>
          </div>

          <!-- Scan line overlay for digital-twin feel -->
          <div class="esp-viewer-scanline" aria-hidden="true"></div>
          <!-- Bottom gradient bleeds info up over viewer -->
          <div class="esp-viewer-gradient"></div>
        </div>

        <!-- ── Thumbnail strip ── -->
        <div
          v-if="(selectedMachine.modelUrl && !modelFailed) || selectedMachine.photos.length > 0"
          class="esp-thumbstrip"
        >
          <button
            v-if="selectedMachine.modelUrl && !modelFailed"
            class="esp-thumb"
            :class="{ 'esp-thumb--active': viewMode === 'model' }"
            title="Xem model 3D"
            @click="selectModelView"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
              <polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>
            </svg>
            <span>3D</span>
          </button>

          <button
            v-for="(photo, idx) in selectedMachine.photos"
            :key="idx"
            class="esp-thumb esp-thumb--photo"
            :class="{ 'esp-thumb--active': viewMode === 'photo' && activePhotoIndex === idx }"
            :title="`Ảnh ${idx + 1}`"
            @click="selectPhoto(idx)"
          >
            <img :src="photo" :alt="`${selectedMachine.title} ảnh ${idx + 1}`" />
          </button>
        </div>

        <!-- ── Info pane — generous 24px content padding ── -->
        <div class="esp-info">

          <!-- Identity block -->
          <div class="esp-info__identity">
            <span v-if="selectedMachine.departments" class="esp-info__dept">{{ selectedMachine.departments }}</span>
            <h2 class="esp-info__name">{{ selectedMachine.title }}</h2>
            <p v-if="selectedMachine.model || selectedMachine.manufacturer" class="esp-info__sub">
              {{ selectedMachine.model }}<template v-if="selectedMachine.model && selectedMachine.manufacturer"> · </template>{{ selectedMachine.manufacturer }}
            </p>
            <div v-if="selectedMachine.status" class="esp-status" :class="`esp-status--${selectedMachine.status}`">
              <span class="esp-status__dot"></span>
              <span class="esp-status__label">{{ statusLabel(selectedMachine.status) }}</span>
            </div>
          </div>

          <!-- Metadata rows -->
          <dl class="esp-meta">
            <div class="esp-meta__row">
              <dt>MÔ TẢ</dt>
              <dd v-if="selectedMachine.story">{{ selectedMachine.story }}</dd>
              <dd v-else class="esp-meta__placeholder">Thông tin chi tiết sẽ được cập nhật sau.</dd>
            </div>
            <div v-if="selectedMachine.category" class="esp-meta__row">
              <dt>PHÂN LOẠI</dt>
              <dd>{{ selectedMachine.category }}</dd>
            </div>
            <div class="esp-meta__row">
              <dt>VỊ TRÍ</dt>
              <dd>{{ locationLabel(selectedMachine) }}</dd>
            </div>
          </dl>

          <p class="esp-footer-note">
            Thông số kỹ thuật, quy trình vận hành và lịch bảo trì sẽ được cập nhật trong phiên bản tiếp theo.
          </p>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useDeviceTier } from '~/composables/useDeviceTier'
import { useBottomSheet } from '~/composables/useBottomSheet'

const { tier } = useDeviceTier()
const { sheetStyle, onDragStart: onSheetDragStart } = useBottomSheet({ peek: 0.7, full: 0.94, onDismiss: () => handleClose() })

const props = defineProps({
  roomId: { type: String, default: null },
  buildingId: { type: String, default: null },
  roomName: { type: String, default: '' },
  instruments: { type: Array, default: () => [] },
  initialEquipment: { type: Object, default: null }
})

// 'equipment-focused' fires whenever the user selects a machine from the list,
// carrying the equipment_id so HologramMap can highlight the polygon on the map.
const emit = defineEmits(['close', 'equipment-focused'])

const config = useRuntimeConfig()

// ---------------------------------------------------------------------------
// [FIX-1] Robust base-URL helper.
// useRuntimeConfig().app.baseURL is '/VGU_Map/' in production, but could be
// '/' in dev or missing a trailing slash in edge cases. Always normalise to
// have exactly one trailing slash so path concatenation is safe everywhere.
// ---------------------------------------------------------------------------
const base = computed(() => {
  const raw = config.app.baseURL || '/'
  return raw.endsWith('/') ? raw : raw + '/'
})

// ---------------------------------------------------------------------------
// [FIX-2] Model URL builder using the normalised base.
// Using withBase from #app would work too, but base.value is simpler here
// since the value is stable after hydration.
// ---------------------------------------------------------------------------
const resolveModel = (glbCode) => {
  if (!glbCode) return ''
  return `${base.value}models/${glbCode}.glb`
}

const { getEquipmentListByRoom, getEquipmentInfo } = useVguData()

const isLoadingList = ref(false)
const machines = ref([])
const selectedMachine = ref(null)

const modelFailed = ref(false)
const triedFallback = ref(false)
const statusText = ref('Đang tải mô hình 3D…')
const activeModelSrc = ref('')
const viewMode = ref('model')
const activePhotoIndex = ref(0)
const selectPhoto = (index) => { viewMode.value = 'photo'; activePhotoIndex.value = index }
const selectModelView = () => { viewMode.value = 'model' }
let modelTimeoutId = null
const MODEL_LOAD_TIMEOUT_MS = 12000

// ---------------------------------------------------------------------------
// [FIX-3] Fallback model path: swap models/{code}.glb → models/models/{code}.glb.
// Only computed from the active primary modelUrl, not from `base` again, so
// it can't produce a double-base prefix.
// ---------------------------------------------------------------------------
const fallbackModelSrc = computed(() => {
  const primary = selectedMachine.value?.modelUrl
  if (!primary) return ''
  // Replace the last occurrence of "models/{file}.glb" with "models/models/{file}.glb"
  return primary.replace(/models\/([^/]+\.glb)$/, 'models/models/$1')
})

const clearModelTimeout = () => {
  if (modelTimeoutId) { clearTimeout(modelTimeoutId); modelTimeoutId = null }
}

const onModelError = () => {
  if (!triedFallback.value && fallbackModelSrc.value && fallbackModelSrc.value !== activeModelSrc.value) {
    console.warn('[EquipmentSidePanel] Primary path failed, trying fallback:',
      selectedMachine.value?.modelUrl, '->', fallbackModelSrc.value)
    triedFallback.value = true
    statusText.value = 'Đang thử lại đường dẫn phụ…'
    activeModelSrc.value = fallbackModelSrc.value
    armModelTimeout()
    return
  }
  console.warn('[EquipmentSidePanel] Both model paths failed:',
    selectedMachine.value?.modelUrl, '|', fallbackModelSrc.value)
  clearModelTimeout()
  modelFailed.value = true
}

const onModelLoad = () => { clearModelTimeout() }

const armModelTimeout = () => {
  clearModelTimeout()
  modelTimeoutId = setTimeout(() => {
    console.warn('[EquipmentSidePanel] Model load timed out:', activeModelSrc.value)
    onModelError()
  }, MODEL_LOAD_TIMEOUT_MS)
}

watch(() => selectedMachine.value?.modelUrl, (url) => {
  clearModelTimeout()
  modelFailed.value = false
  triedFallback.value = false
  statusText.value = 'Đang tải mô hình 3D…'
  activeModelSrc.value = url || ''
  if (url) armModelTimeout()
}, { immediate: true })

onUnmounted(() => clearModelTimeout())

const roomLabel = computed(() => {
  const parts = [props.buildingId, props.roomName || props.roomId].filter(Boolean)
  return parts.join(' // ')
})

const statusLabel = (status) => {
  const map = { operational: 'Đang hoạt động', maintenance: 'Đang bảo trì', offline: 'Ngưng hoạt động' }
  return map[status] || status
}

const locationLabel = (m) => {
  const parts = [
    m.buildingId,
    m.floor != null ? `Tầng ${m.floor}` : null,
    m.roomId,
    m.stationId
  ].filter(Boolean)
  return parts.length ? parts.join(' / ') : 'N/A'
}

// ---------------------------------------------------------------------------
// [FIX-4] normalizeMachine: handle the { equipmentId, roomId, properties:{} }
// wrapper shape emitted by HologramMap when the user clicks an equipment polygon.
//
// ROOT CAUSE of the original bug:
//   HologramMap emits: { equipmentId, roomId, properties: { equipment_id, model_code, ... } }
//   RoomDetailPanel stores that object verbatim in initialEquipment.
//   EquipmentSidePanel calls normalizeMachine(props.initialEquipment).
//   normalizeMachine reads raw.model_code — which is UNDEFINED because the real
//   data is nested one level deeper inside raw.properties.
//   → glbCode = undefined → modelUrl = '' → v-else-if condition is falsy
//   → "Chưa có mô hình 3D" fallback shown immediately for EVERY equipment,
//     even those that have a valid .glb file on the server.
//
// FIX: if the incoming raw object has a `.properties` sub-object but is missing
// the flat equipment fields (equipment_id / model_code), merge properties UP into
// raw so every downstream lookup finds the right values at the top level.
// ---------------------------------------------------------------------------
const normalizeMachine = (raw) => {
  if (!raw) return null

  // Unwrap GeoJSON feature-properties wrapper: { equipmentId, roomId, properties: {...} }
  // Guard: only flatten when properties has the equipment shape AND the flat
  // fields are absent, so we never overwrite a legitimately flat object that
  // happens to also carry a `properties` key for some other reason.
  if (
    raw.properties &&
    typeof raw.properties === 'object' &&
    !raw.equipment_id &&
    !raw.model_code &&
    !raw.id
  ) {
    raw = { ...raw, ...raw.properties }
  }

  const id = raw.id || raw.equipment_id || raw.slug || raw.name

  // model_code is the short identifier that matches the .glb filename (e.g. "E16").
  // equipment_id is the fully-qualified id (e.g. "B5-105_E16") — do NOT use as filename.
  const glbCode = raw.model_code || raw.modelCode || raw.model || id

  return {
    id,
    title: raw.title || raw.name || raw.model_code || raw.equipment_id || id,
    model: raw.model || raw.model_code || '',
    manufacturer: raw.manufacturer || '',
    departments: Array.isArray(raw.departments) ? raw.departments.join(', ') : (raw.departments || ''),
    category: raw.category || '',
    status: raw.status || '',
    story: raw.story || raw.description || '',
    thumbnail: raw.media?.images?.[0] || raw.thumbnail || '',
    photos: raw.media?.images || raw.photos || (raw.thumbnail ? [raw.thumbnail] : (raw.image ? [raw.image] : [])),
    buildingId: raw.location?.building_id || raw.buildingId || raw.building_id || props.buildingId,
    floor: raw.location?.floor ?? raw.floor ?? null,
    roomId: raw.location?.room_id || raw.roomId || raw.room_id || props.roomId,
    stationId: raw.location?.station_id || raw.stationId || '',
    // [FIX-2] Use resolveModel() so the URL is always built against the correct
    // GitHub Pages base path. raw.modelUrl is respected if already absolute
    // (e.g. from a Nuxt Content markdown file that stores the full URL).
    modelUrl: raw.modelUrl || resolveModel(glbCode),
    // has3DModel: true when a model_code exists (indicating a .glb is intended).
    // The viewer + error/timeout flow handles missing files gracefully.
    has3DModel: !!(raw.modelUrl || raw.has3DModel || glbCode)
  }
}

// ---------------------------------------------------------------------------
// [FIX-5] loadMachineList: add GeoJSON as primary data source.
//
// The original code only queried Nuxt Content (content/equipment/) which has
// almost no entries (only one test markdown file). The actual equipment data
// for rooms like B5-105 lives in public/data/equipment/{roomId}.geojson —
// exactly the same files HologramMap uses to draw the equipment layer on the
// map. Adding a $fetch for that file ensures the machine list in the panel
// matches what the user sees drawn on the floor plan.
// ---------------------------------------------------------------------------
const loadMachineList = async () => {
  if (!props.roomId) return
  isLoadingList.value = true
  try {
    let list = []

    // 1) Nuxt Content: markdown-defined equipment (rich metadata, few entries)
    if (typeof getEquipmentListByRoom === 'function') {
      list = await getEquipmentListByRoom(props.roomId)
    }

    // 2) GeoJSON equipment file: the canonical map-layer source for room equipment
    if (!list || list.length === 0) {
      try {
        const geojson = await $fetch(
          `${base.value}data/equipment/${props.roomId}.geojson`
        )
        if (geojson?.features?.length > 0) {
          // Each feature.properties has: equipment_id, model_code, room_id, building_id, floor
          list = geojson.features.map(f => f.properties || f)
        }
      } catch (_) {
        // No GeoJSON for this room — that is expected for rooms without mapped equipment
      }
    }

    // 3) instruments prop: legacy fallback from room markdown's instruments list
    if ((!list || list.length === 0) && props.instruments.length > 0) {
      list = props.instruments
    }

    machines.value = (list || []).map(normalizeMachine).filter(Boolean)
  } catch (err) {
    console.error('[EquipmentSidePanel] Cannot load equipment list for room:', err)
    machines.value = props.instruments.map(normalizeMachine).filter(Boolean)
  } finally {
    isLoadingList.value = false
  }
}

const selectMachine = async (m) => {
  viewMode.value = 'model'
  activePhotoIndex.value = 0

  // Notify parent (RoomDetailPanel → index.vue → HologramMap) so the map
  // polygon highlight updates immediately when the user picks from the list.
  // m.id corresponds to equipment_id (e.g. "B5-105_E18").
  emit('equipment-focused', m.id)

  // Attempt to enrich from Nuxt Content (e.g. the spectrometer-01.md file)
  if (typeof getEquipmentInfo === 'function' && m.id) {
    try {
      const full = await getEquipmentInfo(m.id)
      if (full) {
        selectedMachine.value = normalizeMachine({ ...full, id: m.id })
        return
      }
    } catch (err) {
      console.warn('[EquipmentSidePanel] Could not fetch full equipment detail, using summary:', err)
    }
  }
  selectedMachine.value = m
}

const handleClose = () => {
  selectedMachine.value = null
  emit('close')
}

onMounted(() => {
  loadMachineList()
  if (props.initialEquipment) {
    // normalizeMachine now handles the { equipmentId, roomId, properties:{} } wrapper
    selectMachine(normalizeMachine(props.initialEquipment))
  }
})

watch(() => props.initialEquipment, (val) => {
  if (val) selectMachine(normalizeMachine(val))
})

watch(() => props.roomId, loadMachineList)
</script>


<style scoped>
/* ============================================================
   EQUIPMENT SIDE PANEL — Premium "Digital Twin" Full-Bleed Overlay
   Namespace prefix: .esp  (avoids all collisions with global CSS)

   ARCHITECTURE FIX:
   The root .esp uses position:absolute; inset:0 to completely
   cover its nearest positioned ancestor (RoomDetailPanel, which
   is position:absolute). This is the TRUE full-bleed overlay
   pattern — no stacked headers, no bleeding through.
   ============================================================ */

/* ── Scoped design tokens ── */
.esp {
  --esp-bg:           #03111f;
  --esp-surface:      #071828;
  --esp-glass-bg:     rgba(3, 17, 31, 0.82);
  --esp-glass-border: rgba(255, 255, 255, 0.08);
  --esp-card:         rgba(255, 255, 255, 0.035);
  --esp-card-hover:   rgba(245, 130, 32, 0.07);
  --esp-border:       rgba(255, 255, 255, 0.08);
  --esp-border-acc:   rgba(245, 130, 32, 0.40);
  --esp-accent:       #F58220;
  --esp-accent-dim:   rgba(245, 130, 32, 0.15);
  --esp-ink-hi:       #FFFFFF;
  --esp-ink-mid:      #B3BFCD;
  --esp-ink-lo:       #56677F;
  --esp-radius:       12px;
  --esp-font:         'Be Vietnam Pro', sans-serif;
  --esp-mono:         'Space Mono', monospace;
}

/* ══════════════════════════════════════════════════════════════
   ROOT — TRUE FULL-BLEED OVERLAY
   position:absolute + inset:0 covers the entire RoomDetailPanel
   (its nearest positioned ancestor). Solid background ensures
   no parent content bleeds through. z-index:100 sits on top.
   overflow-y:auto enables the overlay itself to scroll on short
   viewports — but the sticky header always stays in view.
   ══════════════════════════════════════════════════════════════ */
.esp {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  width: 100%;
  height: 100%;
  z-index: 100;
  background: var(--esp-bg);
  display: flex;
  flex-direction: column;
  font-family: var(--esp-font);
  color: var(--esp-ink-mid);
  overflow-y: auto;
  /* Entrance animation: slide up softly from the bottom */
  animation: esp-reveal 0.24s cubic-bezier(0.22, 1, 0.36, 1) both;
}

@keyframes esp-reveal {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0);    }
}

/* ── Tier overrides for tablet/mobile bottom-sheet behaviour ── */
.esp.tier-tablet {
  position: fixed;
  z-index: 109;
}

.esp.tier-mobile {
  position: fixed;
  top: auto;
  bottom: 0;
  height: auto;
  border-top: 1px solid var(--esp-border);
  border-radius: 18px 18px 0 0;
  z-index: 109;
  padding-bottom: env(safe-area-inset-bottom, 0px);
  /* Mobile overrides overflow — the bottom sheet itself controls height */
  overflow-y: hidden;
}

/* ============================================================
   STICKY GLASSMORPHISM HEADER
   Single header per view. position:sticky + top:0 keeps it
   anchored while the content scrolls beneath it. backdrop-filter
   blur gives the frosted-glass effect over scrolling content.
   ============================================================ */
.esp-header--sticky {
  position: sticky;
  top: 0;
  z-index: 10;
  /* Glassmorphism: semi-transparent bg + blur */
  background: var(--esp-glass-bg);
  backdrop-filter: blur(16px) saturate(180%);
  -webkit-backdrop-filter: blur(16px) saturate(180%);
  border-bottom: 1px solid var(--esp-glass-border);
  /* Prevent content from shining through on sharp scroll */
  -webkit-transform: translateZ(0);
  transform: translateZ(0);
}

.esp-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 18px 20px 16px;
  flex-shrink: 0;
}

.esp-header--detail {
  padding: 14px 16px;
  gap: 10px;
}

.esp-header__breadcrumb {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
  flex: 1;
}

.esp-header__eyebrow {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 1.6px;
  text-transform: uppercase;
  color: var(--esp-accent);
  font-family: var(--esp-mono);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.esp-header__title {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  color: var(--esp-ink-hi);
}

/* Title in detail header — truncated, fills available space */
.esp-header__title-wrap {
  flex: 1;
  min-width: 0;
}

.esp-header__title--detail {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: var(--esp-ink-mid);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ── Icon close button (×) ── */
.esp-icon-btn {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  background: transparent;
  border: 1px solid var(--esp-border);
  border-radius: 8px;
  color: var(--esp-ink-lo);
  cursor: pointer;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
}
.esp-icon-btn:hover {
  background: rgba(248, 113, 113, 0.10);
  border-color: rgba(248, 113, 113, 0.35);
  color: #f87171;
}

/* ── Elegant SVG Back Button — no browser default styling ── */
.esp-back-btn {
  /* Reset all browser button defaults */
  appearance: none;
  -webkit-appearance: none;
  margin: 0;
  padding: 8px 14px 8px 10px;
  /* Our design */
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid var(--esp-border);
  border-radius: 10px;
  color: var(--esp-ink-lo);
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.18s, color 0.18s, border-color 0.18s, transform 0.18s;
  white-space: nowrap;
}
.esp-back-btn:hover {
  background: rgba(255, 255, 255, 0.07);
  border-color: rgba(255, 255, 255, 0.18);
  color: var(--esp-ink-hi);
  transform: translateX(-1px);
}
.esp-back-btn:hover .esp-back-btn__arrow {
  transform: translateX(-3px);
}
.esp-back-btn__arrow {
  flex-shrink: 0;
  transition: transform 0.18s cubic-bezier(0.22, 1, 0.36, 1);
}
.esp-back-btn__label {
  font-size: 12px;
  font-weight: 600;
  font-family: var(--esp-font);
  letter-spacing: 0.2px;
}

/* ============================================================
   SHARED STATE (spinner / empty)
   ============================================================ */
.esp-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 64px 24px;
  color: var(--esp-ink-lo);
  font-size: 13px;
  text-align: center;
  line-height: 1.65;
}
.esp-state p { margin: 0; }

.esp-state__spinner {
  display: inline-block;
  width: 24px;
  height: 24px;
  border: 2px solid rgba(245, 130, 32, 0.15);
  border-top-color: var(--esp-accent);
  border-radius: 50%;
  animation: esp-spin 0.7s linear infinite;
  flex-shrink: 0;
}
.esp-state__spinner--sm {
  width: 15px;
  height: 15px;
}
@keyframes esp-spin { to { transform: rotate(360deg); } }

/* ============================================================
   VIEW 1 — EQUIPMENT LIST
   ============================================================ */
.esp-list-body {
  flex: 1;
  padding: 24px 20px;
  overscroll-behavior: contain;
}

.esp-machine-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* ── Machine card ── */
.esp-machine-card {
  display: flex;
  align-items: center;
  gap: 14px;
  width: 100%;
  padding: 14px 15px;
  background: var(--esp-card);
  border: 1px solid var(--esp-border);
  border-radius: var(--esp-radius);
  color: inherit;
  font-family: var(--esp-font);
  text-align: left;
  cursor: pointer;
  transition:
    background 0.15s,
    border-color 0.18s,
    transform 0.16s cubic-bezier(0.22, 1, 0.36, 1),
    box-shadow 0.18s;
}
.esp-machine-card:hover {
  background: var(--esp-card-hover);
  border-color: var(--esp-border-acc);
  transform: translateX(4px);
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.25);
}

.esp-machine-card__thumb {
  position: relative;
  flex-shrink: 0;
  width: 52px;
  height: 52px;
  border-radius: 9px;
  overflow: hidden;
  background: rgba(0, 37, 84, 0.50);
  border: 1px solid var(--esp-border);
  display: flex;
  align-items: center;
  justify-content: center;
}
.esp-machine-card__thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.esp-badge-3d {
  position: absolute;
  bottom: 3px;
  right: 3px;
  font-size: 8px;
  font-weight: 700;
  font-family: var(--esp-mono);
  background: var(--esp-accent);
  color: #fff;
  padding: 2px 4px;
  border-radius: 3px;
  line-height: 1.4;
  letter-spacing: 0.3px;
}

.esp-machine-card__meta {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.esp-machine-card__name {
  font-size: 13px;
  font-weight: 600;
  color: var(--esp-ink-hi);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.esp-machine-card__model {
  font-size: 11px;
  color: var(--esp-ink-lo);
  font-family: var(--esp-mono);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.esp-machine-card__chevron {
  flex-shrink: 0;
  color: var(--esp-ink-lo);
  opacity: 0;
  transition: opacity 0.15s, transform 0.15s;
}
.esp-machine-card:hover .esp-machine-card__chevron {
  opacity: 1;
  transform: translateX(3px);
}

/* ============================================================
   VIEW 2 — EQUIPMENT DETAIL
   ============================================================ */
.esp-detail-scroll {
  flex: 1;
  display: flex;
  flex-direction: column;
  overscroll-behavior: contain;
  /* No overflow here — the root .esp handles scrolling */
}

/* ── Premium 3D Viewer Frame ── */
.esp-viewer-wrap {
  position: relative;
  width: 100%;
  /* 16/9 aspect — enforced, non-negotiable */
  aspect-ratio: 16 / 9;
  background: #020c16;
  overflow: hidden;
  flex-shrink: 0;
  /* High-end digital twin viewport styling */
  border-radius: 0;               /* flush against sticky header */
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  /* Inner shadow for depth */
  box-shadow: inset 0 0 60px rgba(0, 0, 0, 0.55), inset 0 1px 0 rgba(255,255,255,0.04);
}

.esp-viewer-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.esp-viewer-model {
  width: 100%;
  height: 100%;
  display: block;
  --poster-color: transparent;
}

/* Premium empty state — perfectly centered via Flexbox */
.esp-viewer-empty {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: var(--esp-ink-lo);
  font-size: 11px;
  font-family: var(--esp-mono);
  letter-spacing: 0.8px;
}

/* Subtle horizontal scanline — signature digital-twin aesthetic element */
.esp-viewer-scanline {
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(
    to bottom,
    transparent,
    transparent 2px,
    rgba(0, 0, 0, 0.04) 2px,
    rgba(0, 0, 0, 0.04) 4px
  );
  pointer-events: none;
  mix-blend-mode: overlay;
}

/* Bottom gradient bleeds info up over viewer */
.esp-viewer-gradient {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 72px;
  background: linear-gradient(to bottom, transparent, var(--esp-bg));
  pointer-events: none;
}

.esp-model-progress { display: none; }

/* Loading poster — centered via Flexbox */
.esp-model-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  height: 100%;
  font-size: 12px;
  font-family: var(--esp-mono);
  color: var(--esp-ink-lo);
  letter-spacing: 0.5px;
}

/* ── Thumbnail strip ── */
.esp-thumbstrip {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 10px 24px;
  background: rgba(0, 0, 0, 0.25);
  border-bottom: 1px solid var(--esp-border);
  overflow-x: auto;
  flex-shrink: 0;
}
.esp-thumbstrip::-webkit-scrollbar { height: 2px; }
.esp-thumbstrip::-webkit-scrollbar-thumb {
  background: rgba(255,255,255,0.10);
  border-radius: 2px;
}

.esp-thumb {
  flex-shrink: 0;
  width: 46px;
  height: 46px;
  border: 2px solid transparent;
  border-radius: 8px;
  background: rgba(255,255,255,0.05);
  color: var(--esp-ink-lo);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  cursor: pointer;
  overflow: hidden;
  transition: border-color 0.15s, background 0.15s, transform 0.15s;
}
.esp-thumb span {
  font-size: 8px;
  font-weight: 700;
  font-family: var(--esp-mono);
  line-height: 1;
  letter-spacing: 0.3px;
}
.esp-thumb--photo { padding: 0; }
.esp-thumb--photo img { width: 100%; height: 100%; object-fit: cover; display: block; }
.esp-thumb:hover {
  border-color: rgba(245,130,32,0.45);
  transform: translateY(-1px);
}
.esp-thumb--active {
  border-color: var(--esp-accent);
  background: rgba(245,130,32,0.08);
}

/* ── Info pane — 24px generous content padding ── */
.esp-info {
  display: flex;
  flex-direction: column;
  padding: 24px 24px 40px;
  gap: 0;
}

/* Identity block: dept / name / model / status */
.esp-info__identity {
  padding-bottom: 24px;
  border-bottom: 1px solid var(--esp-border);
  margin-bottom: 0;
}

.esp-info__dept {
  display: block;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 1.8px;
  text-transform: uppercase;
  color: var(--esp-accent);
  font-family: var(--esp-mono);
  margin-bottom: 8px;
}

.esp-info__name {
  margin: 0 0 6px;
  font-size: 20px;
  font-weight: 700;
  color: var(--esp-ink-hi);
  line-height: 1.25;
  letter-spacing: -0.3px;
}

.esp-info__sub {
  margin: 0 0 14px;
  font-size: 12px;
  color: var(--esp-ink-lo);
  font-family: var(--esp-mono);
  letter-spacing: 0.3px;
}

/* Status pill */
.esp-status {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 5px 12px 5px 9px;
  border-radius: 999px;
  border: 1px solid transparent;
  width: fit-content;
}
.esp-status--operational { background: rgba(34,197,94,0.07);  border-color: rgba(34,197,94,0.22); }
.esp-status--maintenance  { background: rgba(245,158,11,0.07); border-color: rgba(245,158,11,0.22); }
.esp-status--offline      { background: rgba(248,113,113,0.07);border-color: rgba(248,113,113,0.22); }

.esp-status__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}
.esp-status--operational .esp-status__dot { background: #22c55e; box-shadow: 0 0 6px rgba(34,197,94,0.7); }
.esp-status--maintenance  .esp-status__dot { background: #f59e0b; box-shadow: 0 0 6px rgba(245,158,11,0.7); }
.esp-status--offline      .esp-status__dot { background: #f87171; box-shadow: 0 0 6px rgba(248,113,113,0.7); }

.esp-status__label {
  font-size: 11px;
  font-weight: 600;
  color: var(--esp-ink-mid);
  letter-spacing: 0.2px;
}

/* ── Metadata rows (<dl>) — generous spacing, clear hierarchy ── */
.esp-meta {
  margin: 0;
  display: flex;
  flex-direction: column;
}

.esp-meta__row {
  padding: 20px 0;
  border-bottom: 1px solid var(--esp-border);
  display: flex;
  flex-direction: column;
  /* Distinct gap between muted label and bright value */
  gap: 8px;
}
.esp-meta__row:last-child { border-bottom: none; }

/* Muted small uppercase labels */
.esp-meta__row dt {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 1.8px;
  text-transform: uppercase;
  color: var(--esp-ink-lo);
  font-family: var(--esp-mono);
}

/* Bright bold values */
.esp-meta__row dd {
  margin: 0;
  font-size: 14px;
  line-height: 1.65;
  color: var(--esp-ink-mid);
  font-weight: 400;
}

.esp-meta__placeholder {
  font-style: italic;
  color: var(--esp-ink-lo) !important;
  font-size: 13px !important;
}

/* Footer note */
.esp-footer-note {
  margin: 24px 0 0;
  padding: 13px 15px;
  border: 1px dashed rgba(255, 255, 255, 0.07);
  border-radius: 9px;
  font-size: 11px;
  line-height: 1.7;
  color: var(--esp-ink-lo);
  font-style: italic;
}

/* ============================================================
   REDUCED MOTION
   ============================================================ */
@media (prefers-reduced-motion: reduce) {
  .esp                  { animation: none; }
  .esp-machine-card     { transition: background 0.15s, border-color 0.15s; }
  .esp-back-btn         { transition: background 0.15s, color 0.15s, border-color 0.15s; }
  .esp-back-btn__arrow  { transition: none; }
  .esp-state__spinner   { animation: none; opacity: 0.5; }
  .esp-thumb            { transition: border-color 0.15s, background 0.15s; }
}
</style>
