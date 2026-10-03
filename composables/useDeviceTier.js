// composables/useDeviceTier.js
//
// Nguồn breakpoint DUY NHẤT cho toàn app. Trước đây mỗi component tự chọn
// ngưỡng riêng (AppHeader: 760/640, EquipmentSidePanel: 900, các trang khác:
// 640) -> không nhất quán, không có khái niệm "tier" rõ ràng. Giờ mọi quyết
// định ADAPTIVE (đổi hẳn kiến trúc UI: side-dock <-> overlay <-> bottom sheet)
// đều đọc từ đây. CSS thuần (@media, cho các chi tiết nhỏ như font-size/padding)
// vẫn tồn tại song song nhưng PHẢI dùng đúng 2 con số bên dưới — CSS không cho
// import hằng số JS vào media query nên phải ghi cứng số, nhớ đối chiếu khi sửa.
//
//   Mobile  <= 640px    : bottom sheet kéo-thả (xem useBottomSheet.js)
//   Tablet  641–1024px  : side-dock thu hẹp + backdrop mờ
//   Desktop >  1024px   : side-dock cố định như thiết kế gốc, 3 panel song song

import { ref, computed, onMounted, onBeforeUnmount } from 'vue'

export const BP_MOBILE_MAX = 640
export const BP_TABLET_MAX = 1024

export function useDeviceTier() {
  const width = ref(import.meta.client ? window.innerWidth : BP_TABLET_MAX + 1)
  // pointer:coarse ~ thiết bị cảm ứng (điện thoại/tablet), dùng để tinh chỉnh
  // thêm nếu cần (vd. kích thước vùng chạm) mà không phụ thuộc mỗi kích thước.
  const isTouch = ref(import.meta.client ? window.matchMedia('(pointer: coarse)').matches : false)

  const tier = computed(() => {
    if (width.value <= BP_MOBILE_MAX) return 'mobile'
    if (width.value <= BP_TABLET_MAX) return 'tablet'
    return 'desktop'
  })

  const isMobile = computed(() => tier.value === 'mobile')
  const isTablet = computed(() => tier.value === 'tablet')
  const isDesktop = computed(() => tier.value === 'desktop')

  let onResize
  onMounted(() => {
    if (!import.meta.client) return
    onResize = () => { width.value = window.innerWidth }
    window.addEventListener('resize', onResize, { passive: true })
    window.addEventListener('orientationchange', onResize, { passive: true })
  })
  onBeforeUnmount(() => {
    if (!import.meta.client || !onResize) return
    window.removeEventListener('resize', onResize)
    window.removeEventListener('orientationchange', onResize)
  })

  return { tier, isMobile, isTablet, isDesktop, isTouch, width }
}
