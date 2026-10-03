// plugins/model-viewer.client.ts
//
// Trước đây EquipmentSidePanel.vue tự chèn <script type="module" src="https://
// unpkg.com/@google/model-viewer/...">  lúc onMounted() để đăng ký custom
// element <model-viewer>. Cách này phụ thuộc vào CDN bên ngoài lúc runtime —
// nếu unpkg.com chậm/bị chặn (mạng công ty, ad-blocker, CSP…) thì custom
// element KHÔNG BAO GIỜ được đăng ký, khiến <model-viewer> chỉ là 1 thẻ HTML
// vô nghĩa: không bao giờ bắn sự kiện 'load'/'error', nội dung slot="poster"
// ("Đang tải mô hình 3D…") bị treo vĩnh viễn — xảy ra với MỌI thiết bị, kể cả
// khi file .glb hoàn toàn hợp lệ (không phải do thiếu file).
//
// Sửa: cài package thật (@google/model-viewer) và import ngay lúc khởi động
// app (chỉ ở client, vì đây là Web Component dùng document/customElements),
// tách khỏi bundle chính bằng plugin .client.ts để không ảnh hưởng thời gian
// build/SSR của các trang khác.
import '@google/model-viewer'

// [FIX] File plugin bắt buộc phải có `export default defineNuxtPlugin(...)`
// thì Nuxt mới nhận diện và đưa vào bundle khi build. Trước đây file chỉ có
// dòng import ở trên (không export gì) -> Nuxt bỏ qua file này lúc build,
// khiến @google/model-viewer KHÔNG BAO GIỜ thực sự nằm trong bundle deploy
// (dù npm install đã cài đúng gói) -> <model-viewer> không được đăng ký làm
// custom element -> gán src=... không có tác dụng gì, không có request .glb
// nào được gửi, mọi thiết bị đều bị coi là "lỗi" sau 12s timeout.
export default defineNuxtPlugin(() => {})
