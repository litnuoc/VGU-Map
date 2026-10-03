<!-- components/BuildingsDashboardPanel.vue -->
<!--
  ARCHITECTURE CHANGE: This component no longer receives a `forceCollapse` prop.
  Instead it reads `activePanel` directly from the store.

  DESKTOP: When activePanel !== 'buildings', the class `is-offscreen` is applied,
  which slides the ENTIRE panel (body + tab) to translateX(-100%). This means
  the panel's 300px footprint is completely gone from the visual layout and
  --panels-left-width no longer needs to account for it.

  The tab-only stub visible in 'floor'/'room' stages comes from FloorPanel's own
  collapse stub — BuildingsDashboard is fully off-screen.

  MOBILE: When activePanel !== 'buildings', the panel is display:none so it does
  not fight the FloorPanel bottom sheet for z-index at the bottom of the screen.
-->
<template>
  <div
    class="buildings-panel"
    :class="{
      'is-collapsed': isCollapsed,
      'is-offscreen': activePanel !== 'buildings'
    }"
    role="complementary"
    aria-label="Danh sách toà nhà"
  >
    <!-- Toggle tab -->
    <button
      class="toggle-tab"
      @click="toggleCollapse"
      :title="isCollapsed ? 'Mở danh sách toà nhà' : 'Thu gọn'"
      :aria-label="isCollapsed ? 'Mở danh sách toà nhà' : 'Thu gọn'"
      :aria-expanded="!isCollapsed"
    >
      <!-- Desktop: left/right chevron for the side-drawer -->
      <span class="desktop-only">
        <svg
          class="tab-chevron"
          :class="{ flipped: isCollapsed }"
          width="14" height="14" viewBox="0 0 24 24"
          fill="none" stroke="currentColor" stroke-width="2.5"
          stroke-linecap="round" stroke-linejoin="round"
        >
          <polyline points="15 18 9 12 15 6"></polyline>
        </svg>
      </span>

      <!-- Mobile: iOS-style drag handle for the bottom sheet -->
      <div class="mobile-only mobile-handle">
        <span class="drag-pill" aria-hidden="true"></span>
        <span v-if="isCollapsed" class="mobile-label">Danh sách Toà nhà</span>
      </div>
    </button>

    <div class="panel-body">
      <div class="panel-head">
        <p class="eyebrow">[ CƠ SỞ DỮ LIỆU KHUÔN VIÊN ]</p>
        <h2 class="panel-title">Toàn bộ toà nhà</h2>
        <p class="panel-sub">Bấm vào một toà để fly vào trên bản đồ.</p>
      </div>

      <div class="panel-divider"></div>

      <div class="sidebar-meta">
        <h3 class="sidebar-title">VGU Campus Buildings</h3>
        <p class="sidebar-hint">Bấm vào một toà nhà để mở tầng &amp; phòng ngay trên bản đồ.</p>
      </div>

      <div v-if="isLoading" class="state-msg">
        <span class="pulse-dot"></span>
        Đang tải dữ liệu…
      </div>

      <div v-else class="building-list">
        <button
          v-for="b in buildings"
          :key="b.id"
          class="building-card"
          :class="{ 'is-active': activeId === b.id }"
          @click="enterBuilding(b.id)"
        >
          <span class="card-icon" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" stroke-width="1.8"
              stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 21h18"/><path d="M5 21V6a1 1 0 0 1 1-1h5v16"/>
              <path d="M15 21V10a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v11"/>
              <path d="M9 8h.01"/><path d="M9 12h.01"/><path d="M9 16h.01"/>
              <path d="M18 13h.01"/><path d="M18 17h.01"/>
            </svg>
          </span>

          <span class="card-main">
            <span class="card-eyebrow">
              <span class="pulse-dot sm" aria-hidden="true"></span>
              TOÀ {{ b.id }}
            </span>
            <span class="card-name">Cụm {{ b.id }}</span>
          </span>

          <span class="card-stats">
            <span><b>{{ b.roomCount }}</b> phòng</span>
            <span><b>{{ b.labCount }}</b> lab</span>
            <span><b>{{ b.floors.length }}</b> tầng</span>
          </span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useMapStore } from '~/Stores/mapStores'

// No props needed — activePanel drives everything.
const emit = defineEmits(['select-building'])

const mapStore = useMapStore()
const { activePanel } = storeToRefs(mapStore)

const config = useRuntimeConfig()
const base   = config.app.baseURL
const { getBuildingStats } = useVguData()

const isLoading  = ref(true)
const buildings  = ref([])
const isCollapsed = ref(false)
const activeId   = ref(null)

function toggleCollapse() {
  isCollapsed.value = !isCollapsed.value
}

function enterBuilding(id) {
  activeId.value = id
  emit('select-building', id)
}

onMounted(async () => {
  try {
    const [floorsRes, stats] = await Promise.all([
      fetch(`${base}data/floors-config.json`).then(r => r.json()),
      getBuildingStats()
    ])
    const ids = Object.keys(floorsRes)
    buildings.value = ids.map(id => {
      const floors = floorsRes[id] || []
      const s = stats[id] || { roomCount: 0, labCount: 0 }
      return { id, floors, roomCount: s.roomCount, labCount: s.labCount }
    }).sort((a, b) => a.id.localeCompare(b.id))
  } catch (e) {
    console.error('[BuildingsDashboardPanel]', e)
  } finally {
    isLoading.value = false
  }
})
</script>

<style scoped>
/* ── Layout ── */
.buildings-panel {
  position: absolute;
  top: var(--header-h, 64px);
  left: 0;
  bottom: 0;
  z-index: var(--z-panel-buildings);
  width: 300px;
  display: flex;
  flex-direction: row;
  overflow: visible;
  /* Slide the ENTIRE panel off-screen when activePanel !== 'buildings'.
     This is the key fix: translateX(-100%) removes the panel's 300px from
     the visual layout, so --panels-left-width can be computed correctly
     without waiting for any child component to call setPanelState(). */
  transform: translateX(0);
  opacity: 1;
  /* GUARD: explicit base state so visibility can be transitioned back in.
     visibility 0s linear (no delay) = element becomes visible INSTANTLY when
     is-offscreen is removed, ensuring the slide-in animation is always seen. */
  visibility: visible;
  /* SYNC: identical duration + cubic-bezier as FloorPanel for the push handoff.
     opacity + visibility included here to govern the ENTER (re-activation) path. */
  transition:
    transform 0.4s cubic-bezier(0.25, 1, 0.5, 1),
    opacity   0.4s cubic-bezier(0.25, 1, 0.5, 1),
    visibility 0s linear;   /* 0s delay = visible immediately on re-entry */
  will-change: transform;
}

/* is-offscreen: entire panel exits left — body AND tab must disappear completely.
   ─────────────────────────────────────────────────────────────────────────────
   BUG: translateX(-100%) = -300px. The .toggle-tab has `transform: translateX(300px)`
   so its net screen position was: -300 + 300 = 0px — sitting exactly on the left
   edge, colliding with FloorPanel's toggle button.

   FIX 1 — Extra clearance:
   calc(-100% - 40px) = -340px. Tab net position: -340 + 300 = -40px → off-screen. ✓

   FIX 2 — Opacity guard:
   opacity: 0 fades the panel out alongside the slide. If any subpixel rounding
   or a non-standard viewport zoom causes the tab to land on-screen, it will be
   invisible. Animates via the transition below.

   FIX 3 — Visibility guard:
   visibility: hidden removes the panel from hit-testing AND the accessibility tree
   so the tab can never receive focus or be announced by a screen reader while
   off-screen. The transition override uses a 0.4s delay so visibility only becomes
   hidden AFTER the slide+fade animation has already completed — preventing an
   instant-hide that would kill the exit animation.

   The base .buildings-panel rule uses `visibility 0s linear` (no delay) so that
   when is-offscreen is removed, visibility snaps back to visible immediately and
   the slide-in animation is fully visible from frame 1. */
.buildings-panel.is-offscreen {
  transform: translateX(calc(-100% - 40px));  /* FIX 1: tab pushed -40px beyond left edge */
  opacity: 0;                                  /* FIX 2: invisible if anything bleeds through */
  visibility: hidden;                          /* FIX 3: out of a11y tree and hit-testing */
  pointer-events: none;                        /* belt-and-suspenders: no ghost clicks during animation */
  /* EXIT transition: visibility hides only AFTER the 0.4s slide+fade completes.
     When is-offscreen is REMOVED, the base element's `visibility 0s linear`
     (no delay) takes over instead, so the panel is instantly visible on re-entry. */
  transition:
    transform   0.4s cubic-bezier(0.25, 1, 0.5, 1),
    opacity     0.4s cubic-bezier(0.25, 1, 0.5, 1),
    visibility  0s linear 0.4s;  /* delay = animation duration → hides after slide completes */
}

/* is-collapsed: only the body slides; the tab stub remains at left:0. */
.buildings-panel.is-collapsed .panel-body {
  transform: translateX(-100%);
}

/* ── Panel body ── */
.panel-body {
  width: 300px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #070A12;
  border-right: 1px solid rgba(0, 255, 204, 0.1);
  transform: translateX(0);
  /* SYNC: matches .buildings-panel and FloorPanel */
  transition: transform 0.4s cubic-bezier(0.25, 1, 0.5, 1);
  will-change: transform;
}

/* ── Toggle tab ──
   FIX: previously animated the `left` property (layout-thrashing, causes jitter).
   Now `left` is permanently anchored at 0 and we use `transform: translateX()`
   to reposition the tab — runs entirely on the GPU compositor thread.

   Default (panel expanded): translateX(300px) → tab sits at the right edge of
   the 300px panel body, appearing as a right-side stub.
   Collapsed:                translateX(0)     → tab sits flush at the left edge,
   appearing as a left-edge stub for the user to re-open the panel. */
.toggle-tab {
  position: absolute;
  top: 20px;
  left: 0;                          /* FIX: was 300px — now anchored; position via transform only */
  transform: translateX(300px);     /* FIX: was `left: 300px` — GPU-composited, zero layout cost */
  width: 36px;
  height: 64px;
  background: #0D1B30;
  border: 1px solid rgba(0, 255, 204, 0.18);
  border-left: none;
  border-radius: 0 10px 10px 0;
  color: #7a8fa6;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1;
  transition:
    transform 0.4s cubic-bezier(0.25, 1, 0.5, 1),  /* FIX: was `left` — now transform only */
    color 0.15s, background 0.15s, border-color 0.15s;
  will-change: transform;           /* FIX: was `left` */
}
.buildings-panel.is-collapsed .toggle-tab {
  transform: translateX(0);         /* FIX: was `left: 0` — tab glides to left edge via transform */
  border-color: rgba(0, 255, 204, 0.28);
  background: #0F1E36;
}
.toggle-tab:hover { color: #fff; background: #1a2f4e; border-color: rgba(0, 255, 204, 0.5); }
.toggle-tab:focus-visible { outline: 2px solid #00ffcc; outline-offset: 2px; }

.tab-chevron { transition: transform 0.32s cubic-bezier(0.4, 0, 0.2, 1); }
.tab-chevron.flipped { transform: rotate(180deg); }

/* ── Responsive visibility switches ──
   desktop-only: flex so the SVG wrapper inherits .toggle-tab's alignment.
   mobile-only:  hidden by default; revealed inside the mobile @media block.   */
.desktop-only {
  display: flex;
  align-items: center;
  justify-content: center;
}
.mobile-only { display: none; }

/* ── Mobile handle internals (sized here; layout controlled in @media) ── */
.drag-pill {
  display: block;
  width: 36px;
  height: 4px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.3);
  flex-shrink: 0;
}
.mobile-label {
  font-family: 'Space Mono', monospace;
  font-size: 9px;
  letter-spacing: 1px;
  color: rgba(255, 255, 255, 0.4);
  text-transform: uppercase;
  white-space: nowrap;
}

/* ── Header ── */
.panel-head { padding: 18px 18px 14px; flex-shrink: 0; }
.eyebrow {
  font-family: 'Space Mono', monospace;
  font-size: 9px; letter-spacing: 1.5px; color: #00ffcc; margin: 0 0 6px;
}
.panel-title {
  margin: 0 0 4px;
  font-family: 'Be Vietnam Pro', sans-serif;
  font-size: 20px; font-weight: 700; color: #fff; line-height: 1.2;
}
.panel-sub { margin: 0; font-size: 11px; color: #6b7a8d; line-height: 1.5; }
.panel-divider { height: 1px; background: rgba(0, 255, 204, 0.08); margin: 0 18px; flex-shrink: 0; }
.sidebar-meta { padding: 12px 18px 8px; flex-shrink: 0; }
.sidebar-title { margin: 0 0 4px; font-size: 12px; font-weight: 700; color: #F58220; text-transform: uppercase; letter-spacing: 0.5px; }
.sidebar-hint { margin: 0; font-size: 11px; line-height: 1.5; color: #6b7a8d; }

/* ── Loading / List ── */
.state-msg {
  display: flex; align-items: center; gap: 8px;
  color: #6b7a8d;
  font-family: 'Space Mono', monospace; font-size: 11px; padding: 16px 18px;
}
.building-list {
  flex: 1; overflow-y: auto; padding: 6px 10px 20px;
  display: flex; flex-direction: column; gap: 6px;
  scrollbar-width: thin; scrollbar-color: #1f2d40 transparent;
}
.building-list::-webkit-scrollbar { width: 4px; }
.building-list::-webkit-scrollbar-thumb { background: #1f2d40; border-radius: 4px; }

/* ── Card ── */
.building-card {
  display: flex; align-items: center; gap: 10px;
  width: 100%; text-align: left;
  background: rgba(255,255,255,0.02);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 10px; padding: 10px 11px;
  cursor: pointer; color: inherit; font-family: inherit;
  transition: border-color 0.18s, background 0.18s, transform 0.18s;
}
.building-card:hover { border-color: rgba(239, 90, 36, 0.55); background: rgba(239, 90, 36, 0.07); transform: translateX(3px); }
.building-card.is-active { border-color: #EF5A24; background: rgba(239, 90, 36, 0.13); }
.building-card:focus-visible { outline: 2px solid #00ffcc; outline-offset: 2px; }

.card-icon { flex-shrink: 0; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; border-radius: 7px; background: rgba(239, 90, 36, 0.1); color: #F58220; }
.card-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.card-eyebrow { display: flex; align-items: center; gap: 5px; font-family: 'Space Mono', monospace; font-size: 8px; letter-spacing: 0.5px; color: #00ffcc; }
.card-name { font-size: 13px; font-weight: 700; color: #fff; }
.card-stats { flex-shrink: 0; display: flex; flex-direction: column; align-items: flex-end; gap: 1px; font-family: 'Space Mono', monospace; font-size: 9px; color: #6b7a8d; }
.card-stats b { color: #c9d4e0; font-size: 10px; }

/* ── Pulse dot ── */
.pulse-dot {
  display: inline-block; width: 6px; height: 6px; border-radius: 50%;
  background: #00ffcc; box-shadow: 0 0 6px #00ffcc;
  animation: pulse 1.8s ease-in-out infinite; flex-shrink: 0;
}
.pulse-dot.sm { width: 5px; height: 5px; }
@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.35; transform: scale(0.65); }
}

/* ── Motion preferences ── */
@media (prefers-reduced-motion: reduce) {
  .pulse-dot { animation: none; }
  /* Disable all transitions; opacity + visibility still apply as instant final states */
  .buildings-panel, .panel-body, .toggle-tab, .tab-chevron { transition: none; }
}

/* ── Tablet (641–1024px) ── */
@media (max-width: 1024px) {
  .buildings-panel { width: 280px; }
  .panel-body { width: 280px; }
  /* FIX: was `left: 280px` — use transform to match desktop pattern; no layout cost */
  .toggle-tab { transform: translateX(280px); }
  /* FIX: was `left: 0` */
  .buildings-panel.is-collapsed .toggle-tab { transform: translateX(0); }
}

/* ── Mobile (≤640px): bottom sheet ──
   On mobile this panel is only ever shown when activePanel === 'buildings'.
   When activePanel changes away, is-offscreen is applied, and on mobile we
   use display:none instead of translateX so there is zero z-index interference
   with FloorPanel's bottom sheet. */
@media (max-width: 640px) {
  /* ── Panel layout ── */
  .buildings-panel {
    top: auto;
    left: 0; right: 0; bottom: 0;
    width: 100%;
    flex-direction: column;       /* FIX: was column-reverse — .toggle-tab now sits on top */
    justify-content: flex-end;    /* anchors the stack firmly against bottom: 0           */
    z-index: var(--z-panel-buildings);
    transform: none !important;
    transition: none;
  }
  .buildings-panel.is-offscreen {
    display: none;
    pointer-events: none;
  }
  .panel-body {
    width: 100%;
    max-height: 52vh;
    transform: none !important;
    border-right: none;
    border-radius: 0;             /* no top radius — unified sheet under .toggle-tab      */
    border-top: 1px solid rgba(0, 255, 204, 0.12);
    transition: max-height 0.32s cubic-bezier(0.4, 0, 0.2, 1);
    padding-bottom: env(safe-area-inset-bottom, 0px);
  }
  .buildings-panel.is-collapsed .panel-body {
    max-height: 0;
    border-top-color: transparent;
  }

  /* ── Toggle tab: native bottom-sheet handle ──
     Replaces the desktop side-drawer tab entirely on mobile.
     - Borderless, seamless background matching .panel-body (#070A12)
     - Rounded top corners (14px) signal it as a sheet handle
     - Taller hit-target (48px) for comfortable thumb tap
     - flex column-reverse so drag-pill renders at the top of the tab
       and the contextual label appears below it                        */
  .toggle-tab {
    position: static;
    left: auto !important;
    /* Cancel the desktop/tablet translateX — position is now flow-based */
    transform: none !important;
    width: 100%;
    height: 48px;
    background: #070A12;          /* seamless with .panel-body */
    border: none;                  /* no teal outline on mobile */
    border-radius: 14px 14px 0 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 6px;
    color: rgba(255, 255, 255, 0.4);
    transition: background 0.18s;
  }
  /* Collapsed state: same bg — the label text is the only context cue */
  .buildings-panel.is-collapsed .toggle-tab {
    transform: none !important;
    background: #070A12;
    border-color: transparent;
  }
  /* Hover: very subtle lift so it doesn't flash like the desktop tab */
  .toggle-tab:hover {
    background: #0D1421;
    border-color: transparent;
    color: rgba(255, 255, 255, 0.6);
  }

  /* ── Visibility swap ── */
  .desktop-only { display: none; }
  .mobile-only  { display: flex; }

  /* ── Mobile handle layout ──
     column: pill on top, label below
     pointer-events: none so clicks bubble up to the <button>            */
  .mobile-handle {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 6px;
    width: 100%;
    pointer-events: none;
  }

  /* ── Building list & cards (horizontal scroll on mobile) ── */
  .building-list {
    flex-direction: row;
    overflow-x: auto; overflow-y: hidden;
    padding: 8px 10px 10px;
  }
  .building-card { flex-direction: column; align-items: flex-start; min-width: 140px; flex-shrink: 0; }
  .card-stats { flex-direction: row; gap: 8px; margin-top: 4px; }
}
</style>
