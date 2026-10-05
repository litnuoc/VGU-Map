<!-- components/RoomBookingCard.vue
     Thẻ "ĐẶT PHÒNG" trong RoomDetailPanel cho phòng có lịch Google Calendar
     (cột Calender_ID trong Google Sheet).
       Mức A: nút mở Google Calendar với phòng đã thêm sẵn làm khách mời.
       Mức B: lưới giờ trống/bận trong ngày (lấy qua Auth.gs → freeBusy_),
              bấm vào 1 giờ trống để mở Google Calendar đúng khung giờ đó.
     Chỉ hiển thị khoảng BẬN, không có tên cuộc họp / người đặt. -->
<template>
  <div class="info-card booking-card">
    <h3 class="card-title highlight-title">{{ t('booking.title') }}</h3>

    <div class="day-nav">
      <button type="button" class="nav-arrow" @click="shiftDay(-1)" :aria-label="t('booking.prev')">‹</button>
      <div class="day-label">
        <span class="day-name">{{ dayLabel }}</span>
        <button v-if="!isToday" type="button" class="today-link" @click="goToday">{{ t('booking.today') }}</button>
      </div>
      <button type="button" class="nav-arrow" @click="shiftDay(1)" :aria-label="t('booking.next')">›</button>
    </div>

    <div v-if="loading" class="fb-state">{{ t('booking.loading') }}</div>
    <div v-else-if="error" class="fb-state fb-error">{{ tServer(error) }}</div>
    <template v-else>
      <div class="slots" role="list" :aria-label="t('booking.grid')">
        <button
          v-for="slot in slots"
          :key="slot.hour"
          type="button"
          role="listitem"
          class="slot"
          :class="{ busy: slot.busy, past: slot.past }"
          :disabled="slot.busy || slot.past"
          :title="slot.busy ? t('booking.slotBusy', { l: slot.label }) : (slot.past ? t('booking.slotPast', { l: slot.label }) : t('booking.slotFree', { l: slot.label }))"
          @click="bookSlot(slot)"
        >
          <span class="slot-hour">{{ slot.hour }}h</span>
        </button>
      </div>
      <div class="legend">
        <span><i class="dot free"></i>{{ t('booking.free') }}</span>
        <span><i class="dot busy"></i>{{ t('booking.busy') }}</span>
        <span class="legend-hint">{{ t('booking.hint') }}</span>
      </div>
      <ul v-if="busyText.length" class="busy-list">
        <li v-for="(b, i) in busyText" :key="i">{{ t('booking.busyAt', { t: b }) }}</li>
      </ul>
      <p v-else class="all-free">{{ t('booking.allFree') }}</p>
    </template>

    <a class="book-btn" :href="bookingUrl()" target="_blank" rel="noopener">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18M12 14v4M10 16h4"/>
      </svg>
      {{ t('booking.button') }}
    </a>
    <p class="note">{{ t('booking.note') }}</p>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'

const props = defineProps({
  calendarId: { type: String, required: true },
  roomId: { type: String, default: '' },
  roomName: { type: String, default: '' }
})

const START_HOUR = 7
const END_HOUR = 21
const { freeBusy } = useAuth()
const { t, tServer, locale } = useLang()

const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
const day = ref(startOfDay(new Date()))
const busy = ref([])          // [{ start: Date, end: Date }]
const loading = ref(false)
const error = ref('')
const now = ref(new Date())
let reqSeq = 0

const isToday = computed(() => day.value.getTime() === startOfDay(new Date()).getTime())
const dayLabel = computed(() => {
  const s = day.value.toLocaleDateString(locale.value, { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })
  return s.charAt(0).toUpperCase() + s.slice(1)
})

async function load() {
  const seq = ++reqSeq
  loading.value = true
  error.value = ''
  now.value = new Date()
  const from = new Date(day.value)
  const to = new Date(day.value.getTime() + 24 * 3600 * 1000)
  try {
    const r = await freeBusy(props.calendarId, from, to)
    if (seq !== reqSeq) return
    if (!r.ok) { error.value = r.error || t('booking.loadError'); busy.value = []; return }
    busy.value = (r.busy || []).map(b => ({ start: new Date(b.start), end: new Date(b.end) }))
  } catch (e) {
    if (seq !== reqSeq) return
    error.value = t('booking.connError')
    busy.value = []
  } finally {
    if (seq === reqSeq) loading.value = false
  }
}

watch(() => [props.calendarId, day.value.getTime()], load, { immediate: true })

function shiftDay(n) { day.value = new Date(day.value.getFullYear(), day.value.getMonth(), day.value.getDate() + n) }
function goToday() { day.value = startOfDay(new Date()) }

const slots = computed(() => {
  const out = []
  for (let h = START_HOUR; h < END_HOUR; h++) {
    const s = new Date(day.value.getFullYear(), day.value.getMonth(), day.value.getDate(), h)
    const e = new Date(s.getTime() + 3600 * 1000)
    out.push({
      hour: h,
      start: s,
      end: e,
      label: `${h}:00–${h + 1}:00`,
      busy: busy.value.some(b => b.start < e && b.end > s),
      past: e <= now.value
    })
  }
  return out
})

const fmt = (d) => d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false })
const busyText = computed(() =>
  busy.value
    .slice()
    .sort((a, b) => a.start - b.start)
    .map(b => `${fmt(b.start)}–${fmt(b.end)}`)
)

// Định dạng thời gian Google Calendar: YYYYMMDDTHHMMSSZ (UTC)
const gcal = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')

function bookingUrl(start, end) {
  const p = new URLSearchParams({
    action: 'TEMPLATE',
    text: t('booking.eventTitle', { r: props.roomId }),
    location: `${props.roomId}${props.roomName ? ' – ' + props.roomName : ''} · Vietnamese-German University`,
    add: props.calendarId,
    ctz: 'Asia/Ho_Chi_Minh'
  })
  if (start && end) p.set('dates', `${gcal(start)}/${gcal(end)}`)
  return `https://calendar.google.com/calendar/render?${p.toString()}`
}

function bookSlot(slot) {
  if (slot.busy || slot.past) return
  window.open(bookingUrl(slot.start, slot.end), '_blank', 'noopener')
}
</script>

<style scoped>
.booking-card { display: flex; flex-direction: column; gap: 12px; }
.booking-card .card-title { margin-bottom: 0; }

.day-nav { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.nav-arrow {
  width: 30px; height: 30px; border-radius: 6px; cursor: pointer; flex-shrink: 0;
  background: transparent; border: 1px solid #334155; color: #cbd5e1; font-size: 18px; line-height: 1;
}
.nav-arrow:hover { border-color: #f97316; color: #fff; }
.day-label { display: flex; flex-direction: column; align-items: center; gap: 2px; text-align: center; }
.day-name { font-size: 13px; font-weight: 700; color: #f1f5f9; }
.today-link { background: none; border: none; padding: 0; cursor: pointer; font-size: 11px; color: #f97316; }

.slots { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; }
.slot {
  height: 34px; border-radius: 5px; cursor: pointer;
  border: 1px solid rgba(34, 197, 94, 0.45); background: rgba(34, 197, 94, 0.10); color: #86efac;
  font-family: 'Space Mono', monospace; font-size: 11px; font-weight: 700;
  transition: background 0.15s, border-color 0.15s;
}
.slot:hover:not(:disabled) { background: rgba(34, 197, 94, 0.25); border-color: #22c55e; color: #fff; }
.slot.busy { border-color: rgba(249, 115, 22, 0.6); background: rgba(249, 115, 22, 0.22); color: #fdba74; cursor: not-allowed; }
.slot.past:not(.busy) { border-color: #1e293b; background: transparent; color: #475569; cursor: default; }
.slot.past.busy { opacity: 0.5; }

.legend { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; font-size: 11px; color: #94a3b8; }
.legend span { display: inline-flex; align-items: center; gap: 5px; }
.legend-hint { margin-left: auto; color: #64748b; }
.dot { width: 9px; height: 9px; border-radius: 2px; display: inline-block; }
.dot.free { background: rgba(34, 197, 94, 0.5); }
.dot.busy { background: rgba(249, 115, 22, 0.7); }

.busy-list { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 6px; }
.busy-list li {
  font-size: 11px; color: #fdba74; padding: 3px 8px; border-radius: 4px;
  background: rgba(249, 115, 22, 0.12); border: 1px solid rgba(249, 115, 22, 0.3);
}
.all-free { margin: 0; font-size: 12px; color: #86efac; }

.fb-state { font-size: 12px; color: #94a3b8; padding: 10px 0; text-align: center; }
.fb-error { color: #fca5a5; }

.book-btn {
  display: flex; align-items: center; justify-content: center; gap: 8px;
  height: 40px; border-radius: 8px; text-decoration: none;
  background: #f97316; color: #fff; font-size: 13px; font-weight: 700;
  transition: background 0.15s;
}
.book-btn:hover { background: #ea580c; }
.book-btn svg { width: 16px; height: 16px; }
.note { margin: 0; font-size: 11px; line-height: 1.5; color: #64748b; }

@media (max-width: 640px) {
  .slots { grid-template-columns: repeat(7, 1fr); }
  .legend-hint { display: none; }
}
</style>
