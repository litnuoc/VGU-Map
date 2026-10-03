import { fileURLToPath } from 'node:url'

export default defineNuxtConfig({
  // Tắt SSR: app là bản đồ 3D chạy hoàn toàn phía client (đã bọc <ClientOnly>),
  // đồng thời né lỗi Nitro prerender không tôn trọng baseURL khi build cho GitHub Pages.
  ssr: false,

  app: {
    baseURL: '/VGU_Map/',
    buildAssetsDir: 'assets',
    head: {
      htmlAttrs: { lang: 'vi' },
      // Nạp thật sự 2 font đang dùng khắp giao diện (trước đây chỉ khai báo trong
      // CSS nên rơi về font hệ thống). preconnect để giảm độ trễ tải font.
      link: [
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap'
        }
      ],
      meta: [
        // Khai báo tường minh thay vì trông chờ mặc định của Nuxt: app dùng
        // nhiều @media + composables/useDeviceTier.js dựa trên window.innerWidth,
        // nếu thiếu viewport, mobile sẽ render theo virtual viewport ~980px
        // (layout desktop) rồi zoom out -> mọi breakpoint phía trên vô nghĩa.
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        { name: 'theme-color', content: '#0F1E36' },
        { name: 'description', content: 'Bản đồ tương tác khuôn viên Trường Đại học Việt Đức (VGU).' }
      ]
    }
  },

  nitro: {
    preset: 'github_pages', // dùng gạch dưới "github_pages"
    prerender: {
      routes: ['/']
    },
    // [FIX] Thư mục models/ (chứa các file .glb) nằm ở GỐC REPO, không phải
    // trong public/ — Nuxt static generate mặc định CHỈ copy nội dung public/
    // ra bản build, nên mọi file .glb trong models/ trước đây KHÔNG BAO GIỜ
    // thực sự lên được trang deploy (404 vĩnh viễn), dù file có tồn tại và
    // đúng tên trên GitHub. Khai báo thêm publicAssets để Nitro copy luôn
    // models/ vào output, phục vụ tại đúng URL models/{code}.glb như code đang
    // gọi (EquipmentSidePanel.vue) — không cần di chuyển/upload lại file nào.
    publicAssets: [
      { baseURL: 'models', dir: fileURLToPath(new URL('./models', import.meta.url)) }
    ]
  },

  modules: [
  '@pinia/nuxt',
  '@nuxt/content',
  '@vite-pwa/nuxt'
],

content: {
  experimental: {
    clientDB: true
  }
},

  vite: {
    optimizeDeps: {
      include: ['three', 'maplibre-gl']
    }
  },

  build: {
    transpile: ['three']
  },

  pwa: {
    base: '/VGU_Map/',
    registerType: 'autoUpdate',
    manifest: {
      name: 'VGU Campus Map',
      short_name: 'VGU Map',
      description: 'Bản đồ tương tác khuôn viên Trường Đại học Việt Đức (VGU).',
      lang: 'vi',
      start_url: '/VGU_Map/',
      scope: '/VGU_Map/',
      display: 'standalone',
      orientation: 'any',
      background_color: '#05080d',
      theme_color: '#0F1E36',
      categories: ['education', 'navigation', 'maps'],
      icons: [
        { src: '/VGU_Map/icon-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: '/VGU_Map/icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: '/VGU_Map/icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
      ]
    },
    workbox: {
      // Cho phép điều hướng SPA fallback về index (deep-link /equipment-... khi offline)
      navigateFallback: '/VGU_Map/',
      // [FIX] KHÔNG đưa "glb" vào danh sách precache: vite-plugin-pwa mặc định
      // giới hạn 2MB/file để precache (tải sẵn lúc cài PWA), mà file .glb (mô
      // hình 3D) hầu như luôn > 2MB -> build FAIL CỨNG (throw Error, không chỉ
      // warning) ngay khi có 1 file .glb vượt ngưỡng. Bỏ "glb" khỏi globPatterns;
      // rule runtimeCaching bên dưới (CacheFirst cho .glb) đã đủ để cache file
      // này khi người dùng thực sự mở xem — không cần/không nên ép tải sẵn
      // hàng chục MB mô hình 3D ngay lúc cài app.
      globPatterns: ['**/*.{js,css,html,png,svg,json,geojson,woff2}'],
      runtimeCaching: [
        {
          // Dữ liệu phòng/toà: ưu tiên hiển thị nhanh từ cache rồi làm mới ngầm.
          urlPattern: ({ url }) => url.pathname.includes('/data/') && url.pathname.endsWith('.json'),
          handler: 'StaleWhileRevalidate',
          options: { cacheName: 'vgu-data-cache', expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 } }
        },
        {
          urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
          handler: 'CacheFirst',
          options: { cacheName: 'google-fonts', expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 } }
        },
        {
          urlPattern: /^https:\/\/drive\.google\.com\/.*/i,
          handler: 'StaleWhileRevalidate',
          options: { cacheName: 'drive-images', expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 } }
        },
        {
          urlPattern: /\.(?:png|jpg|jpeg|svg|webp|gltf|glb)$/,
          handler: 'CacheFirst',
          options: { cacheName: 'assets-3d-cache', expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 30 } }
        }
      ]
    }
  },

  compatibilityDate: '2026-07-20'
})
