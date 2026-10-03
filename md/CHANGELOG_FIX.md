# Nhật ký sửa lỗi & tối ưu — VGU Campus Map

Tổng hợp các thay đổi trong lần cập nhật này. Tất cả đã được build kiểm chứng
(`npx nuxi generate` chạy xanh) và script đồng bộ đã test end-to-end.

## ⚠️ VIỆC BẮT BUỘC LÀM 1 LẦN (nếu chưa có)

Pipeline cập nhật tự động từ Google Sheets cần **URL Web App** của `Code.gs`:

1. Trong Google Apps Script: **Deploy → New deployment → Web app**
   (Execute as: *Me*; Who has access: *Anyone*). Copy URL dạng
   `https://script.google.com/macros/s/……/exec`.
2. Trên GitHub repo: **Settings → Secrets and variables → Actions → Variables →
   New repository variable**
   - Name: `APPS_SCRIPT_URL`
   - Value: dán URL ở bước 1.

Không đặt biến này thì workflow `Update Info Data` sẽ **cố ý báo đỏ** (fail rõ ràng)
thay vì âm thầm ghi dữ liệu rỗng.

> Nhánh triển khai đang thống nhất là **`main`** (cả deploy lẫn auto-sync). Nếu
> nhánh chính của repo là tên khác, sửa `TARGET_BRANCH` trong
> `.github/workflows/update_data.yml` và trường `branches` trong `deploy.yml`.

---

## 1. Hệ thống cập nhật dữ liệu tự động (Google Sheets → PWA) — trọng tâm

| Lỗi cũ | Sửa |
|---|---|
| `update_data.yml` gọi `sync_all_data.js` và `build_pwa.js` **không tồn tại** → job fail mỗi lần chạy | Tạo mới `scripts/sync_all_data.js` (fetch Apps Script → `info_data.json` → regenerate `content/Rooms`); bỏ bước `build_pwa.js` (SW đã tự cập nhật nhờ `registerType: autoUpdate`) |
| Workflow checkout/push nhánh **`Test`** trong khi deploy build từ **`main`** → dữ liệu mới không bao giờ lên sóng | Đồng bộ về **`main`** qua biến `TARGET_BRANCH` |
| Commit dữ liệu kèm **`[skip ci]`** → chặn luôn deploy → cập nhật không hiển thị | Bỏ `[skip ci]`; chỉ commit **khi dữ liệu thật sự đổi** (guard `git diff --staged`) |
| `git add` sai đường dẫn (`info_data.json`, `map_data.json`, `sw.js` ở gốc) | `git add public/data/info_data.json content/Rooms` |
| Cron `*/5` → tối đa 288 deploy/ngày | `*/15` (có chú thích cách chỉnh) + script bỏ qua ghi khi không đổi |
| `Code.gs > normalizeHeader`: `.replace(/[ ]/g, "d")` biến dấu cách thành **chữ "d"** → mọi cột nhiều chữ ("Room Number", "Phòng ban"…) không khớp và trả về `___` | Đổi dấu cách/ký tự lạ thành `_`; xử lý riêng `đ → d` |
| `migrate_data.js` đọc `./info_data.json` (không có) và ghi `content/labs/` (app đọc `content/Rooms/`) | Sửa đường dẫn: đọc `public/data/info_data.json`, ghi `content/Rooms/` |

`sync_all_data.js` được kiểm thử 3 nhánh: dữ liệu không đổi (bỏ qua ghi), dữ liệu
đổi (ghi + regenerate .md, map trạng thái đúng), thiếu URL (fail exit 1).

## 2. PWA & tải trang

- **Nạp thật 2 web-font** `Space Mono` + `Be Vietnam Pro` (trước chỉ khai báo trong
  CSS nên rơi về font hệ thống). Thêm `preconnect` + cache font trong SW.
- Manifest đầy đủ: `start_url`/`scope` = `/VGU_Map/`, `background_color`,
  `theme_color` (#0F1E36), icon maskable, `lang`, `categories`.
- Runtime cache: `data/*.json` dùng **StaleWhileRevalidate** (mở nhanh, làm mới ngầm);
  ảnh Google Drive StaleWhileRevalidate; `navigateFallback` để deep-link hoạt động offline.

## 3. Định tuyến & tính năng thiết bị (lỗi tồn đọng)

- `app.vue` **thiếu `<NuxtPage/>`** → mọi route trong `pages/` (kể cả
  `equipment-[id]`) không truy cập được. Đã tách UI bản đồ sang `pages/index.vue`
  và để `app.vue` làm vỏ mỏng chứa `<NuxtPage/>` (cấu trúc Nuxt chuẩn).
- **Nối tính năng thiết bị vào UI**: mỗi thẻ thiết bị trong panel phòng có nút
  *"Xem chi tiết thiết bị →"* mở trang `equipment-[id]`.
- `equipment-[id].vue`: `goBack` fallback về `/` (trước trỏ `/equipment` không tồn tại);
  bỏ class Tailwind (dự án không dùng Tailwind) thay bằng style thật.
- **`getRoomInfo` không bao giờ trả kết quả**: `@nuxt/content` viết thường mọi `_path`
  (`content/Rooms` → `/rooms`) nên `queryContent('Rooms')` không khớp. Đổi sang lọc
  theo trường `room_id`, độc lập hoa/thường → tên phòng hiển thị đúng.

## 4. Tối ưu & dọn code

- `Stores/mapStores.ts`: bỏ state/action chết (`rooms`, `mapCoordinates`, `mapZoom`,
  `getRoomByNumber`, và `fetchRoomsData` với URL placeholder không nơi nào gọi).
- `useVguData.js`: bỏ `syncAll` (mỗi lần mount fetch 3 file JSON rồi **vứt đi** vì
  HologramMap tự nạp dữ liệu riêng) cùng `getFloorPlan`/`fetchJson` không dùng.
- Overlay loading nay tắt theo sự kiện `@ready` của bản đồ (có timeout an toàn 6s),
  thay vì chờ fetch thừa.
- Marker phòng: thay class Tailwind vô tác dụng bằng style thật (giữ vùng click).
- Thêm `prefers-reduced-motion`, nhãn `aria-*` cho thang máy chọn tầng, đóng panel
  bằng phím **Esc**, chỉnh responsive HUD trên màn hình hẹp.
- `deploy.yml`: `npm ci` thay `npm install` (cài đặt tái lập theo lockfile).

## Ghi chú còn lại (từ phiên trước, chưa đụng)

- Footprint **AD** đang bị affine ép co bề rộng ~13% (cụm phòng đo ~129×43.5m so với
  footprint 129×38m). Nếu thấy AD bó ngang: chỉnh lại footprint rồi giải lại affine
  cho AD (quy trình đã tự động hoá ở phiên trước).
- Một số phòng "ảo" trong `content/Rooms` (vd tầng 2 của AD) không có polygon tương
  ứng trong geojson — đó là đặc thù dữ liệu nguồn, không phải lỗi hiển thị.
