# VGU Map Nuxt - Tài liệu Tái cấu trúc

## Tổng quan

Dự án đã được tái cấu trúc từ Vanilla JS/JSON rời rạc sang ứng dụng Nuxt 3/Vue 3 chuyên nghiệp với kiến trúc Data-driven.

## Cấu trúc Dự án Mới

```
/workspace/
├── nuxt.config.ts              # Cấu hình Nuxt + PWA + Content
├── package.json                # Dependencies và scripts
├── composables/
│   └── useVguData.js           # Composable quản lý dữ liệu
├── components/
│   ├── HologramMap.vue         # Component bản đồ MapLibre
│   ├── RoomDetailPanel.vue     # Panel thông tin phòng
│   └── MapVGU.vue              # (Legacy - có thể xóa)
├── vue/
│   ├── app.vue                 # Entry point chính
│   ├── index.vue               # Page chính (có thể merge vào app.vue)
│   └── *.vue                   # Các component khác
├── content/
│   ├── labs/                   # Markdown files cho phòng
│   └── equipment/              # Markdown files cho thiết bị
├── public/
│   ├── icons/                  # PWA icons
│   ├── campus-buildings.json   # GeoJSON buildings
│   └── ...                     # Static assets
├── json-tung/                  # Data JSON cũ (backup)
└── md/                         # Documentation
```

## Các Thay Đổi Chính

### 1. Cấu hình Nuxt + PWA (`nuxt.config.ts`)

- **Module PWA**: `@vite-pwa/nuxt` tự động quản lý Service Worker, cache, versioning
- **Nuxt Content**: Truy vấn Markdown siêu tốc cho rooms/equipment
- **Vite Optimization**: Code splitting cho maplibre-gl và three.js
- **Google Fonts**: Be Vietnam Pro + Space Mono

### 2. Data Layer (`composables/useVguData.js`)

Thay thế `sync_all_data.js` với:
- ✅ Fetch JSON an toàn với UTF-8 encoding
- ✅ Promise.all để load song song
- ✅ Normalize data tự động
- ✅ Integration với Nuxt Content API
- ✅ Error handling chuẩn

```javascript
const { syncAll, getRoomInfo, getRoomEquipment } = useVguData()

// Load tất cả dữ liệu
const data = await syncAll()

// Query room từ Content
const room = await getRoomInfo('AD-247')

// Query equipment trong phòng
const equips = await getRoomEquipment('AD-247')
```

### 3. Component Architecture

#### `components/HologramMap.vue`
- Encapsulated MapLibre logic
- Emit events: `room-selected`, `building-selected`
- Props: `initialCenter`, `initialZoom`, `initialPitch`
- Auto cleanup onUnmounted

#### `components/RoomDetailPanel.vue`
- Glassmorphism UI với backdrop-filter
- X-Ray Flashlight effect (clipPath)
- ContentRenderer cho Markdown
- Loading/Error states

#### `vue/app.vue`
- Central state management
- Context-aware HUD bar
- Transition animations
- Loading overlay

### 4. Content Migration (Markdown)

Dữ liệu từ `info_data.json` đã được chuyển thành Markdown files:

```markdown
---
room_id: "1.CY"
name: "EXTORIOR SPACE - COURTYARD"
building_id: "B3"
floor: 1
head_of_lab:
  name: "Chưa cập nhật"
  email: "contact@vgu.edu.vn"
status: "maintenance"
---

Nội dung markdown cho phòng...
```

**Lợi ích:**
- Version control dễ dàng (Git diff rõ ràng)
- Nuxt Content auto-generate API endpoints
- Hỗ trợ Markdown formatting
- Dễ dàng edit bằng CMS hoặc text editor

## Hướng Dẫn Sử Dụng

### Cài đặt

```bash
# Install dependencies
npm install

# Chạy dev server
npm run dev

# Build production
npm run build

# Preview production build
npm run preview
```

### Development

```bash
# Mở dev server với hot-reload
npm run dev

# Truy cập: http://localhost:3000
```

### Production Build

```bash
# Generate static site (nếu muốn deploy lên GitHub Pages)
npm run generate

# Hoặc build SSR/SSG
npm run build
npm run preview
```

## PWA Configuration

PWA được cấu hình tự động trong `nuxt.config.ts`:

- **Manifest**: Tên, icons, theme color
- **Service Worker**: Auto-update, runtime caching cho JSON
- **Offline Support**: Cache strategies cho assets và data

### Thêm Icons PWA

Đặt icons tại `/public/icons/`:
- `icon-192x192.png`
- `icon-512x512.png`

## Migration từ Code Cũ

### Vanilla JS → Vue Composables

```javascript
// OLD: Vanilla JS
fetch('/info_data.json')
  .then(r => r.json())
  .then(data => { /* xử lý */ })

// NEW: Vue Composable
const { fetchJson } = useVguData()
const data = await fetchJson('/info_data.json')
```

### DOM Manipulation → Reactive State

```javascript
// OLD: document.getElementById('panel').style.display = 'block'

// NEW: Reactive state
const showPanel = ref(false)
showPanel.value = true
```

### Inline Scripts → Components

```html
<!-- OLD: Inline script trong HTML -->
<script>
  function initMap() { ... }
</script>

<!-- NEW: Vue Component -->
<script setup>
import { onMounted } from 'vue'
onMounted(() => { /* init map */ })
</script>
```

## Lộ Trình Cải Thiện Tiếp Theo

### 1. UX/UI Enhancements
- [ ] Glassmorphism panels với `backdrop-filter`
- [ ] X-Ray flashlight effect hoàn chỉnh
- [ ] Smooth transitions giữa các trạng thái
- [ ] Loading skeletons thay vì spinners

### 2. Performance
- [ ] Lazy loading cho floor plans
- [ ] Virtual scrolling cho danh sách dài
- [ ] Image optimization với Nuxt Image
- [ ] Prefetch data khi hover

### 3. Features
- [ ] Search rooms/buildings
- [ ] Filter by department/floor
- [ ] AR view với WebXR
- [ ] Real-time sensor data (telemetry)

### 4. Testing
- [ ] Unit tests cho composables
- [ ] E2E tests với Playwright
- [ ] Visual regression tests

## Troubleshooting

### Lỗi: "Cannot find module '#imports'"
- Đảm bảo đang dùng Nuxt 3 với auto-imports enabled
- Restart dev server sau khi thêm composables mới

### Lỗi: "MapLibre not rendering"
- Kiểm tra container có kích thước xác định
- Verify CSS import: `import 'maplibre-gl/dist/maplibre-gl.css'`

### Lỗi: "Content not found"
- Verify content files có frontmatter hợp lệ
- Check path: `content/labs/` và `content/equipment/`

## Liên hệ & Đóng góp

Xem thêm documentation tại `/workspace/md/`

---

**Version**: 1.0.0  
**Last Updated**: 2024  
**Framework**: Nuxt 3 + Vue 3 + TypeScript
