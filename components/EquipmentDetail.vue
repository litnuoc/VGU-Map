<!-- components/EquipmentDetail.vue -->
<template>
  <div class="equipment-detail" :style="{ '--accent': ambientColor }">
    <button @click="$emit('close')" class="btn-close">[ ĐÓNG ]</button>

    <header class="eq-header">
      <div class="sys-status">EQUIPMENT TELEMETRY: ONLINE</div>
      <h1>{{ item?.title }}</h1>
      <p class="eq-model">{{ item?.manufacturer }} — {{ item?.model }}</p>
      <div class="meta-info">
        <span>TÒA: {{ item?.location?.building_id || 'N/A' }}</span> |
        <span>TẦNG: {{ item?.location?.floor ?? 'N/A' }}</span> |
        <span>PHÒNG: {{ item?.location?.room_id || 'N/A' }}</span>
      </div>
      <span class="status-badge" :class="item?.status">{{ item?.status || 'unknown' }}</span>
    </header>

    <div class="eq-body">
      <!-- X-Ray flashlight viewer, tái sử dụng cùng hiệu ứng với RoomDetailPanel -->
      <div
        v-if="exteriorImage"
        class="xray-container"
        @mousemove="updateFlashlight($event)"
        @mouseleave="hideFlashlight"
      >
        <img :src="exteriorImage" class="eq-img exterior" alt="" />
        <img
          v-if="item?.media?.internal_blueprint"
          :src="item.media.internal_blueprint"
          class="eq-img blueprint"
          :style="flashlightStyle"
          alt=""
        />
      </div>

      <div class="info-block" v-if="item?.category || item?.departments?.length">
        <h4>[ PHÂN LOẠI ]</h4>
        <p v-if="item?.category">{{ item.category }}</p>
        <p v-if="item?.departments?.length">{{ item.departments.join(', ') }}</p>
      </div>

      <div class="info-block" v-if="primaryMechanism">
        <h4>[ CƠ CHẾ HOẠT ĐỘNG ]</h4>
        <p>{{ primaryMechanism }}</p>
      </div>

      <ContentRenderer v-if="item?.body" :value="item" class="eq-desc" />
      <p v-else-if="item?.description" class="eq-desc">{{ item.description }}</p>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'

const props = defineProps({
  item: {
    type: Object,
    default: null
  }
})

defineEmits(['close'])

const ambientColor = computed(() => props.item?.media?.ambient_color || '#00ffcc')

const exteriorImage = computed(() => {
  const images = props.item?.media?.images
  if (!images || !images.length) return null
  const first = images[0]
  if (typeof first === 'object' && first !== null) {
    return first.src || first.url || first.path || null
  }
  return first
})

const primaryMechanism = computed(() => props.item?.optional_information?.physics?.primary_mechanism || null)

// Hiệu ứng X-Ray Flashlight (giống RoomDetailPanel)
const flashlightPos = ref({ x: -100, y: -100 })
const isHovering = ref(false)

const updateFlashlight = (e) => {
  const rect = e.target.getBoundingClientRect()
  flashlightPos.value = {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top
  }
  isHovering.value = true
}

const hideFlashlight = () => {
  isHovering.value = false
}

const flashlightStyle = computed(() => {
  if (!isHovering.value) {
    return { clipPath: 'circle(0px at 0 0)' }
  }
  return {
    clipPath: `circle(100px at ${flashlightPos.value.x}px ${flashlightPos.value.y}px)`
  }
})
</script>

<style scoped>
.equipment-detail {
  position: relative;
  width: 100%;
  min-height: 100%;
  padding: 40px;
  max-width: 900px;
  margin: 0 auto;
  font-family: 'Space Mono', monospace;
  color: #e0e0e0;
}

.btn-close {
  position: absolute;
  top: 20px;
  right: 20px;
  background: none;
  border: 1px solid rgba(255, 51, 102, 0.4);
  padding: 6px 12px;
  color: #ff3366;
  cursor: pointer;
  font-family: 'Space Mono', monospace;
  font-size: 12px;
  transition: all 0.2s;
}

.btn-close:hover {
  color: #ff6699;
  border-color: #ff6699;
}

.eq-header {
  border-bottom: 2px solid var(--accent, #00ffcc);
  padding-bottom: 20px;
  margin-bottom: 25px;
}

.sys-status {
  font-size: 10px;
  color: var(--accent, #00ffcc);
  letter-spacing: 1px;
}

.eq-header h1 {
  margin: 10px 0 4px;
  font-size: 28px;
  color: #fff;
  font-family: 'Be Vietnam Pro', sans-serif;
}

.eq-model {
  color: #aaa;
  font-size: 13px;
  margin-bottom: 8px;
}

.meta-info {
  font-size: 11px;
  color: var(--accent, #00ffcc);
  opacity: 0.85;
}

.status-badge {
  display: inline-block;
  margin-top: 12px;
  padding: 3px 10px;
  border-radius: 3px;
  font-size: 10px;
  letter-spacing: 1px;
  text-transform: uppercase;
  border: 1px solid var(--accent, #00ffcc);
  color: var(--accent, #00ffcc);
}

.info-block {
  margin-bottom: 20px;
  padding-bottom: 15px;
  border-bottom: 1px solid rgba(0, 255, 204, 0.15);
}

.info-block h4 {
  font-size: 12px;
  color: #EF5A24;
  margin-bottom: 8px;
  letter-spacing: 1px;
}

.xray-container {
  position: relative;
  width: 100%;
  height: 320px;
  margin-bottom: 25px;
  overflow: hidden;
  border-radius: 4px;
  background: #0a0f1a;
  border: 1px solid rgba(0, 255, 204, 0.15);
}

.eq-img {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.eq-img.blueprint {
  filter: invert(1) hue-rotate(180deg);
  opacity: 0.85;
}

.eq-desc {
  font-size: 13px;
  line-height: 1.7;
  color: #ccc;
}

.detail-layout {
  font-family: var(--type-main);
}

.detail-status {
  color: var(--brand-accent);
  text-transform: none;
}

.detail-close {
  color: var(--brand-accent);
}

.detail-close:hover {
  color: var(--ink-strong);
  background: var(--brand-accent);
}

.detail-frame,
.detail-scan {
  border-color: var(--line-soft);
  background: var(--surface-panel);
}
</style>

<!-- Replace cyberpunk labels with a neutral status label:
"Trạng thái thiết bị: Đang hoạt động" -->
