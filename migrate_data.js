// migrate_data.js
// Bản chạy TAY (local) tương đương scripts/sync_all_data.js nhưng KHÔNG gọi mạng:
// chuyển public/data/info_data.json -> content/Rooms/*.md, gắn ảnh Drive.
//
// LỖI CŨ (đã sửa):
//   - đọc './info_data.json' và './drive_data.json' ở gốc repo (không tồn tại) —
//     thực tế nằm trong public/data/
//   - ghi ra content/labs/ trong khi app đọc content/Rooms/ (queryContent('Rooms'))
// Pipeline tự động dùng scripts/sync_all_data.js; file này chỉ để build lại local.
'use strict';

const fs = require('fs');
const path = require('path');

const infoPath = path.join(__dirname, 'public', 'data', 'info_data.json');
const drivePath = path.join(__dirname, 'public', 'data', 'drive_data.json');
const labsOutputDir = path.join(__dirname, 'content', 'Rooms');

// Tạo thư mục output nếu chưa có
if (!fs.existsSync(labsOutputDir)) fs.mkdirSync(labsOutputDir, { recursive: true });

// ─────────────────────────────────────────────
// 1. Đọc dữ liệu nguồn
// ─────────────────────────────────────────────
const infoRaw = JSON.parse(fs.readFileSync(infoPath, 'utf8'));
const rooms = infoRaw.data || infoRaw; // hỗ trợ cả 2 dạng { data: [...] } hoặc [...]

const driveData = fs.existsSync(drivePath)
  ? JSON.parse(fs.readFileSync(drivePath, 'utf8'))
  : {};

console.log(`Đang xử lý ${rooms.length} phòng (${Object.keys(driveData).length} phòng có ảnh Drive)...`);

// ─────────────────────────────────────────────
// 2. Bảng ánh xạ status ĐÚNG (bug cũ: so sánh với chuỗi bị lỗi encoding
//    ' ang s ng' nên KHÔNG BAO GIỜ khớp -> toàn bộ 467 phòng bị gán "maintenance")
// ─────────────────────────────────────────────
const STATUS_MAP = {
  'Đang sử dụng': 'operational',
  'Chưa sử dụng': 'vacant',
  'Chưa cập nhật': 'unknown'
};

// ─────────────────────────────────────────────
// 3. Helper: escape ký tự đặc biệt để không phá vỡ cú pháp YAML frontmatter
// ─────────────────────────────────────────────
function yamlSafe(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

// ─────────────────────────────────────────────
// 4. Helper: chuyển Google Drive fileId -> URL ảnh xem trực tiếp
// ─────────────────────────────────────────────
function driveImageUrl(fileId) {
  if (!fileId) return null;
  return `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`;
}

// ─────────────────────────────────────────────
// 5. Xử lý từng phòng
// ─────────────────────────────────────────────
let statusCounts = { operational: 0, vacant: 0, unknown: 0 };
let imageCount = 0;

rooms.forEach(room => {
  const roomId = room.room_number.replace(/\s+/g, '-').toUpperCase();

  // Trích số tầng từ mã phòng (VD: AD-207 -> tầng 2, 3.CR5 -> tầng 3, 1.LB1 -> tầng 1)
  let floor = 1;
  const match = roomId.match(/(?:AD-|B\d-)?(\d)\d{2}/) || roomId.match(/^(\d)\./);
  if (match) floor = parseInt(match[1], 10);

  const status = STATUS_MAP[room.status] || 'unknown';
  statusCounts[status]++;

  const imageId = driveData[roomId];
  const imageUrl = driveImageUrl(imageId);
  if (imageUrl) imageCount++;

  const name = yamlSafe(
    (room.heading_1 || 'Unknown') + (room.heading_2 ? ' - ' + room.heading_2 : '')
  );

  const mdContent = `---
room_id: "${roomId}"
name: "${name}"
building_id: "${room.sheet_source || 'UNKNOWN'}"
floor: ${floor}
departments:
  - "${yamlSafe(room.department || 'General')}"
room_type: "${yamlSafe(room.fm_room_function || '___')}"
area_m2: "${yamlSafe(room.area || '--')}"
capacity: "${yamlSafe(room.capacity || '--')}"
head_of_lab:
  name: "${yamlSafe(room.occupant_display || 'Chưa cập nhật')}"
  email: "contact@vgu.edu.vn"
  office: "${roomId}"
status: "${status}"
highlighted_equipment: []
image: "${imageUrl || ''}"
vr_panorama: ""
---

Trang thông tin không gian kiến trúc cho khu vực **${yamlSafe(room.heading_1)}**.
Hệ thống cảm biến và dữ liệu telemetry đang được đồng bộ.
`;

  fs.writeFileSync(path.join(labsOutputDir, `${roomId}.md`), mdContent);
});

console.log('✅ Hoàn tất chuyển đổi!');
console.log('   - Status:', statusCounts);
console.log('   - Phòng có ảnh Drive:', imageCount);
