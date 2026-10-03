#!/usr/bin/env python3
"""
build_rooms_geojson.py
-----------------------
Đọc các file CSV hình học phòng (Room_Number;Loop_Index;Segment_Type;StartX;StartY;EndX;EndY;Length)
xuất ra bởi CAD, và dựng lại polygon cho từng phòng, gộp theo tòa nhà thành 1 file GeoJSON/tòa.

LƯU Ý QUAN TRỌNG VỀ HỆ TỌA ĐỘ:
- Các file theo tầng (vd AD-1st.csv, B3-1st.csv...) dùng đơn vị mm, mỗi tòa có 1 gốc tọa độ
  CAD riêng (đã kiểm chứng: các tầng trong cùng 1 tòa dùng chung 1 hệ, vd AD-1st/AD-3rd/AD-5th
  có bbox chồng lấn nhau).
- File tổng "Building locations on the map.csv" (site plan) dùng 1 hệ **khác hoàn toàn** về
  tỷ lệ/gốc — 1 phòng học đơn lẻ trong AD-1st.csv (vd AD-103, 9120 x 4005 đơn vị) đã gần bằng
  kích thước cả khối nhà AD trong site plan (12791 x 4309 đơn vị) => 2 file này KHÔNG cùng scale,
  không thể ghép trực tiếp. Cần hệ số quy đổi + góc xoay riêng cho từng tòa (chưa có dữ liệu này).
- Vì vậy script này CHỈ dựng đúng hình dạng/kích thước phòng bên trong 1 tòa (đơn vị mét, coi
  1 đơn vị CAD = 1mm). Vị trí tuyệt đối của từng tòa trên bản đồ thật (lat/lng) do
  `public/data/geo-calibration.json` quyết định — mặc định là placeholder, CẦN được hiệu chỉnh
  bằng dữ liệu GPS thật (xem ghi chú trong file đó).
"""
import csv
import json
import math
import os
import sys
from collections import defaultdict, OrderedDict

MM_PER_UNIT = 1.0  # 1 đơn vị CAD trong các file theo tầng = 1mm
UNIT_TO_METERS = MM_PER_UNIT / 1000.0

SRC_ROOT = sys.argv[1] if len(sys.argv) > 1 else "/home/claude/location/Building location of each floor of each of them"
OUT_DIR = sys.argv[2] if len(sys.argv) > 2 else "public/data/rooms"

FLOOR_NAME_TO_NUM = {
    "1st": 1, "2nd": 2, "3rd": 3, "4th": 4, "5th": 5, "6th": 6,
}

BUILDING_DIRS = {
    "AD": "Admin Building location for each floor",
    "B1": "B1",
    "B2": "B2",
    "B3": "B3",
    "B5": "B5",
    "B6": "B6",
}


def read_segments(path):
    """Đọc CSV, trả về dict {(room_number, loop_index): [ (x1,y1,x2,y2,type), ... ]} giữ đúng thứ tự."""
    rooms = OrderedDict()
    with open(path, encoding="utf-8") as fh:
        reader = csv.DictReader(fh, delimiter=";")
        for row in reader:
            key = (row["Room_Number"], int(row["Loop_Index"]))
            rooms.setdefault(key, []).append((
                float(row["StartX"]), float(row["StartY"]),
                float(row["EndX"]), float(row["EndY"]),
                row["Segment_Type"],
            ))
    return rooms


def segments_to_ring(segments):
    """Nối các đoạn Line/Arc (theo thứ tự đã có trong CSV) thành 1 vòng điểm khép kín.
    Arc được xấp xỉ bằng dây cung (chord) nối start->end vì CSV không cho bán kính/tâm cung."""
    ring = []
    for (x1, y1, x2, y2, _seg_type) in segments:
        if not ring:
            ring.append((x1, y1))
        ring.append((x2, y2))
    if ring and ring[0] != ring[-1]:
        ring.append(ring[0])
    return ring


def to_meters(ring):
    return [[round(x * UNIT_TO_METERS, 4), round(y * UNIT_TO_METERS, 4)] for (x, y) in ring]


def build_building_geojson(building_id, floor_dir_path):
    features = []
    if not os.path.isdir(floor_dir_path):
        print(f"  [skip] không thấy thư mục {floor_dir_path}")
        return None

    for fname in sorted(os.listdir(floor_dir_path)):
        if not fname.lower().endswith(".csv"):
            continue
        floor_key = fname.replace(f"{building_id}-", "").replace(".csv", "")
        floor_num = FLOOR_NAME_TO_NUM.get(floor_key)
        if floor_num is None:
            print(f"  [warn] không nhận diện được tầng từ tên file: {fname}")
            continue

        path = os.path.join(floor_dir_path, fname)
        rooms = read_segments(path)

        # gộp loop theo room_number: loop 0 = vòng ngoài, các loop khác = lỗ (hole) bên trong
        by_room = defaultdict(dict)
        for (room_number, loop_index), segs in rooms.items():
            ring = segments_to_ring(segs)
            if len(ring) < 4:
                continue  # không đủ điểm tạo polygon hợp lệ
            by_room[room_number][loop_index] = to_meters(ring)

        for room_number, loops in by_room.items():
            ordered_loops = [loops[i] for i in sorted(loops.keys())]
            geometry = {"type": "Polygon", "coordinates": ordered_loops}
            features.append({
                "type": "Feature",
                "geometry": geometry,
                "properties": {
                    "room_id": room_number,
                    "building_id": building_id,
                    "floor": floor_num,
                },
            })

    return {"type": "FeatureCollection", "features": features}


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    floors_config = {}

    for building_id, subdir in BUILDING_DIRS.items():
        floor_dir_path = os.path.join(SRC_ROOT, subdir)
        print(f"[build] {building_id} <- {floor_dir_path}")
        fc = build_building_geojson(building_id, floor_dir_path)
        if fc is None:
            continue

        floors_present = sorted({f["properties"]["floor"] for f in fc["features"]})
        floors_config[building_id] = floors_present

        out_path = os.path.join(OUT_DIR, f"{building_id}.geojson")
        with open(out_path, "w", encoding="utf-8") as out:
            json.dump(fc, out, ensure_ascii=False)
        print(f"  -> {out_path} ({len(fc['features'])} phòng, tầng: {floors_present})")

    with open(os.path.join(os.path.dirname(OUT_DIR), "floors-config.json"), "w", encoding="utf-8") as f:
        json.dump(floors_config, f, ensure_ascii=False, indent=2)
    print(f"[done] floors-config.json: {floors_config}")


if __name__ == "__main__":
    main()
