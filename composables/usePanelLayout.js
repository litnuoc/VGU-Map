// composables/usePanelLayout.js
//
// Refactored: this file is now a PURE CSS-variable setter driven by the store's
// `activePanel` computed value. It no longer holds its own module-scope state,
// has no forceCollapse wiring, and has no race conditions.
//
// --panels-left-width is the only output: it tells the HUD bar and any other
// element anchored to the left-panel stack how wide that stack currently is.
//
//  activePanel='buildings' → BuildingsDashboard open (300px body + 36px tab) = 336px
//  activePanel='floor'     → Buildings tab only (36px) + FloorPanel (280px)  = 316px
//  activePanel='room'      → Buildings tab only (36px), Floor collapsed (0)   =  36px
//  mobile (any)            → all panels are bottom sheets                     =   0px
//
import { watch, onMounted, onBeforeUnmount } from 'vue'
import { storeToRefs } from 'pinia'
import { useMapStore } from '~/Stores/mapStores'

const DESKTOP_BUILDINGS_W = 300
const TABLET_BUILDINGS_W  = 280
const BUILDINGS_TAB_W     = 36
const FLOOR_W             = 280

// Reference-count guard so the single resize listener survives multiple
// components calling usePanelLayout() in the same page.
let _refCount = 0
let _onResize = null

export function usePanelLayout() {
  const mapStore    = useMapStore()
  const { activePanel } = storeToRefs(mapStore)

  function _recalc() {
    if (typeof window === 'undefined') return
    const w         = window.innerWidth
    const isMobile  = w <= 640
    const isTablet  = w <= 1024

    if (isMobile) {
      document.documentElement.style.setProperty('--panels-left-width', '0px')
      return
    }

    const bW   = isTablet ? TABLET_BUILDINGS_W : DESKTOP_BUILDINGS_W
    const tabW = BUILDINGS_TAB_W

    let total = 0
    switch (activePanel.value) {
      case 'buildings':
        total = bW + tabW   // full buildings panel
        break
      case 'floor':
        total = tabW + FLOOR_W  // buildings collapsed to tab + floor panel open
        break
      case 'room':
        total = tabW            // buildings tab only; floor panel is collapsed
        break
    }

    document.documentElement.style.setProperty('--panels-left-width', total + 'px')
  }

  // Re-run whenever activePanel or viewport width changes
  onMounted(() => {
    if (_refCount === 0) {
      _onResize = _recalc
      window.addEventListener('resize', _onResize, { passive: true })
    }
    _refCount++
    _recalc()
  })

  onBeforeUnmount(() => {
    _refCount--
    if (_refCount === 0 && _onResize) {
      window.removeEventListener('resize', _onResize)
      _onResize = null
    }
  })

  // Watch activePanel so the CSS variable updates immediately on store change,
  // not just on the next resize event.
  watch(activePanel, _recalc)

  return { activePanel }
}
