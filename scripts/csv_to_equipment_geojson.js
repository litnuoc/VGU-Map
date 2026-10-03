#!/usr/bin/env node
// scripts/csv_to_equipment_geojson.js
//
// Chuyển 1 file CSV thiết bị (export từ CAD, mỗi thiết bị gồm 4 dòng "Line_1..4"
// tạo thành 1 hình chữ nhật) thành 1 file GeoJSON thiết bị, dùng CHUNG hệ toạ độ
// mét cục bộ với các file phòng ở public/data/rooms/{buildingId}.geojson.
//
// GIẢ ĐỊNH QUAN TRỌNG (đã kiểm chứng bằng số liệu mẫu B5-105_E3: chênh lệch
// StartX/EndX = 3200 mm khớp đúng với cột Length = 3.200,00 khi đọc theo định
// dạng số châu Âu): toạ độ trong CSV là MILIMET, và dùng CHUNG gốc toạ độ với
// hệ mét trong rooms geojson của building đó (không lệch gốc/tỉ lệ). Nếu sau
// khi chạy thử mà thiết bị hiển thị LỆCH RA NGOÀI phòng, giả định này sai —
// khi đó cần chuyển sang cách "fit-to-bbox" (map theo khung bao phòng thay vì
// dùng thẳng toạ độ), báo lại để mình viết bản khác.
//
// CÁCH DÙNG:
//   node scripts/csv_to_equipment_geojson.js \
//     --csv "thiết_bị_phòng_lab_105.csv" \
//     --room B5-105 \
//     --building B5 \
//     --floor 1 \
//     --out public/data/equipment/B5-105.geojson
//
// CSV format đầu vào (phân cách bằng ';', số kiểu châu Âu "1.234,56"):
//   Model;Segment_Type;StartX;StartY;EndX;EndY;Length
//   B5-105_E3;Line_1;5.557,30;64.448,98;8.757,30;64.448,98;3.200,00
//   ... (4 dòng Line_1..Line_4 cho mỗi Model, tạo thành 1 hình chữ nhật)

const fs = require('fs')
const path = require('path')

function parseArgs() {
  const args = process.argv.slice(2)
  const out = {}
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2)
      out[key] = args[i + 1]
      i++
    }
  }
  return out
}

// "5.557,30" -> 5557.30  (dấu . = phân cách nghìn, dấu , = thập phân)
function parseEuroNumber(str) {
  if (str == null) return NaN
  const cleaned = str.toString().trim().replace(/\./g, '').replace(',', '.')
  return parseFloat(cleaned)
}

const MM_TO_M = 1 / 1000

function main() {
  const args = parseArgs()
  const { csv, room, building, out } = args
  const floor = args.floor != null ? parseInt(args.floor, 10) : null

  if (!csv || !room || !building || !out) {
    console.error('Thiếu tham số. Cần: --csv <file> --room <room_id> --building <building_id> --out <file.geojson> [--floor <n>]')
    process.exit(1)
  }

  const raw = fs.readFileSync(csv, 'utf8')
  // Bỏ BOM nếu có (thấy \ufeff ở đầu file gốc)
  const content = raw.replace(/^\uFEFF/, '')
  const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0)

  const header = lines[0].split(';').map(h => h.trim().toLowerCase())
  const idx = {
    model: header.indexOf('model'),
    segment: header.indexOf('segment_type'),
    startX: header.indexOf('startx'),
    startY: header.indexOf('starty'),
    endX: header.indexOf('endx'),
    endY: header.indexOf('endy')
  }

  // Gom theo Model -> tập hợp các điểm góc (start/end của mỗi Line) -> khử trùng lặp
  const byModel = new Map()

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(';')
    const model = cols[idx.model]?.trim()
    if (!model) continue

    const sx = parseEuroNumber(cols[idx.startX]) * MM_TO_M
    const sy = parseEuroNumber(cols[idx.startY]) * MM_TO_M
    const ex = parseEuroNumber(cols[idx.endX]) * MM_TO_M
    const ey = parseEuroNumber(cols[idx.endY]) * MM_TO_M

    if (!byModel.has(model)) byModel.set(model, [])
    const pts = byModel.get(model)
    pts.push([sx, sy], [ex, ey])
  }

  const features = []
  for (const [model, pts] of byModel.entries()) {
    // Khử điểm trùng (mỗi góc hình chữ nhật xuất hiện 2 lần do 4 đoạn Line nối tiếp nhau)
    const unique = []
    for (const p of pts) {
      const exists = unique.some(u => Math.abs(u[0] - p[0]) < 1e-6 && Math.abs(u[1] - p[1]) < 1e-6)
      if (!exists) unique.push(p)
    }
    if (unique.length < 3) {
      console.warn(`[csv_to_equipment_geojson] Bỏ qua "${model}": chỉ có ${unique.length} điểm góc, không đủ tạo hình chữ nhật.`)
      continue
    }

    // Sắp các điểm theo góc quanh tâm để tạo ring hợp lệ (phòng khi thứ tự trong CSV không theo chiều quay)
    const cx = unique.reduce((s, p) => s + p[0], 0) / unique.length
    const cy = unique.reduce((s, p) => s + p[1], 0) / unique.length
    unique.sort((a, b) => Math.atan2(a[1] - cy, a[0] - cx) - Math.atan2(b[1] - cy, b[0] - cx))
    const ring = [...unique, unique[0]] // đóng ring

    features.push({
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: [ring] },
      properties: {
        equipment_id: model,
        room_id: room,
        building_id: building,
        floor: floor
      }
    })
  }

  const geojson = { type: 'FeatureCollection', features }

  fs.mkdirSync(path.dirname(out), { recursive: true })
  fs.writeFileSync(out, JSON.stringify(geojson, null, 2), 'utf8')

  console.log(`✔ Đã tạo ${out} với ${features.length} thiết bị (từ ${byModel.size} model trong CSV).`)
  if (features.length > 0) {
    const allX = features.flatMap(f => f.geometry.coordinates[0].map(p => p[0]))
    const allY = features.flatMap(f => f.geometry.coordinates[0].map(p => p[1]))
    console.log(`  Bounding box (mét, hệ toạ độ cục bộ building): X[${Math.min(...allX).toFixed(2)}, ${Math.max(...allX).toFixed(2)}]  Y[${Math.min(...allY).toFixed(2)}, ${Math.max(...allY).toFixed(2)}]`)
    console.log('  → So sánh khoảng này với bounding box của polygon phòng tương ứng trong data/rooms/' + building + '.geojson để kiểm tra có khớp không.')
  }
}

main()
