<template>
  <div class="app-root">
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </div>
</template>

<script setup>
</script>

<style>
@import url('https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700;800&family=Space+Mono:wght@400;700&display=swap');

:root {
  --panels-left-width: 336px;

  --brand-accent: #F58220;
  --brand-accent-soft: #F7A14C;
  --brand-accent-muted: #FAC08F;

  --brand-deep: #002554;
  --brand-deep-2: #001A3A;
  --brand-deep-3: #002040;
  --brand-deep-4: #002D5C;

  --ink-strong: #FFFFFF;
  --ink-soft: #B3BFCD;
  --ink-dim: #6B7FA0;

  --line-soft: rgba(255, 255, 255, 0.10);
  --line-accent: rgba(245, 130, 32, 0.45);

  --surface-root: var(--brand-deep-2);
  --surface-panel: var(--brand-deep-3);
  --surface-elevated: var(--brand-deep-4);
  --type-main: 'Be Vietnam Pro', sans-serif;
  --type-alt: 'Space Mono', monospace;

  /* Z-index layers */
  --z-map-overlay:         10;
  --z-hud:                 20;
  --z-app-header:          30;
  --z-calib:               61;
  --z-search:              70;
  --z-panel-buildings:     85;
  --z-panel-floor:         90;
  --z-panel-room:         100;
  --z-overlay:            200;
}

a,
button,
input,
select,
textarea {
  font-family: var(--type-main);
}

:focus-visible {
  outline: 2px solid var(--brand-accent);
  outline-offset: 3px;
  border-radius: 3px;
}

:focus:not(:focus-visible) {
  outline: none;
}

.app-loader {
  background: linear-gradient(180deg, #001A3A 0%, #002554 100%);
}

.app-loader__ring {
  border-top-color: var(--brand-accent);
}

* { box-sizing: border-box; }

html, body, #__nuxt {
  margin: 0;
  padding: 0;
  width: 100%;
  height: 100%;
}

body {
  background: var(--surface-root);
  color: var(--ink-soft);
  font-family: var(--type-main);
  -webkit-font-smoothing: antialiased;
  overflow: hidden;
  overscroll-behavior: none;
  -webkit-text-size-adjust: 100%;
  text-size-adjust: 100%;
}

a, button {
  touch-action: manipulation;
}

.app-root {
  position: relative;
  width: 100vw;
  height: 100%;        /* Fallback for browsers without dvh support */
  height: 100dvh;      /* Dynamic Viewport Height: shrinks to the true visual
                          bottom on mobile, accounting for retractable browser
                          chrome (address bar, nav bar). Prevents bottom-anchored
                          panels from floating above the real viewport edge. */
  overflow: hidden;
}

.loading-overlay {
  position: absolute; inset: 0; z-index: 100;
  display: flex; align-items: center; justify-content: center;
  background: #05080d; color: #00ffcc;
  font-family: 'Space Mono', monospace; letter-spacing: 1px;
}

.adaptive-backdrop {
  position: fixed;
  top: var(--header-h, 64px);
  left: 0; right: 0; bottom: 0;
  background: rgba(5, 8, 13, 0.6);
  backdrop-filter: blur(3px);
  -webkit-backdrop-filter: blur(3px);
  animation: adaptive-backdrop-in 0.2s ease;
}
@keyframes adaptive-backdrop-in { from { opacity: 0; } to { opacity: 1; } }

.adaptive-sheet-handle {
  width: 100%;
  display: flex;
  justify-content: center;
  padding: 10px 0 8px;
  cursor: grab;
  touch-action: none;
  flex-shrink: 0;
  background: inherit;
}
.adaptive-sheet-handle::before {
  content: '';
  width: 40px; height: 4px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.25);
}
.adaptive-sheet-handle:active { cursor: grabbing; }

@media (prefers-reduced-motion: reduce) {
  .adaptive-backdrop { animation: none; }
}
</style>
