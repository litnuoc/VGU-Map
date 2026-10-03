#!/usr/bin/env python3
"""
build_campus_buildings.py
--------------------------
Dựng lại public/campus-buildings.json TỪ DỮ LIỆU THẬT (site plan trong
"Building locations on the map.csv"), thay cho 5 khối "cluster-1..6" giả trước đây.

Kết quả giữ đúng: tên tòa thật (AD, B1, B2, B3, B5, B6) + bố cục tương đối thật giữa
các tòa (B3/B2/B1 xếp cột dọc, B6/B5 xếp cột dọc, AD nằm ngang phía trên — đúng như
site plan gốc).

CẢNH BÁO — ĐÂY VẪN LÀ VỊ TRÍ GẦN ĐÚNG (APPROXIMATE), CHƯA PHẢI TỌA ĐỘ GPS THẬT:
site plan không tự chứa tỷ lệ mét/đơn vị CAD thật cũng không có góc xoay so với
Bắc thật. Script này áp 1 phép biến đổi (translate + scale đều + xoay) lấy từ
`public/data/geo-calibration.json` — các tham số đó hiện là PLACEHOLDER (đoán hợp lý
để bản đồ hiển thị đúng hình dạng/tỷ lệ tương đối, KHÔNG đảm bảo đúng vị trí GPS
tuyệt đối). Khi có toạ độ GPS thật (>=1 góc toà nhà thật) + 1 kích thước thật
(vd chiều dài mặt tiền 1 toà), hãy cập nhật lại `geo-calibration.json` rồi chạy lại
script này — không cần sửa code nơi khác.
"""
import csv
import json
import math
import os
from collections import OrderedDict

SITE_PLAN_CSV = "/home/claude/location/Building locations on the map.csv"
CALIBRATION_PATH = "public/data/geo-calibration.json"
OUT_PATH = "public/campus-buildings.json"

BUILDING_IDS = {"AD", "B1", "B2", "B3", "B5", "B6"}

# Chiều cao ước lượng theo số tầng thực tế đã biết (mỗi tầng ~3.6m), dùng cho fill-extrusion
FLOORS_CONFIG_PATH = "public/data/floors-config.json"
DEFAULT_FLOOR_HEIGHT = 3.6


def load_calibration():
    if os.path.exists(CALIBRATION_PATH):
        with open(CALIBRATION_PATH, encoding="utf-8") as f:
            return json.load(f)
    # Placeholder mặc định — XEM CẢNH BÁO ở đầu file
    calib = {
        "_README": (
            "Placeholder pending real GPS calibration. anchor_latlng nen la 1 goc toa nha "
            "that (do tren Google Maps). anchor_cad_xy la diem CAD site-plan tuong ung DUNG "
            "goc do. scale_meters_per_unit va rotation_deg hien la GIA DINH, can hieu chinh "
            "khi co du lieu that."
        ),
        "anchor_latlng": [106.6155, 11.1083],
        "anchor_cad_xy": [24511.66, 15588.475],  # tam bbox toan bo site plan (placeholder)
        "scale_meters_per_unit": 0.02,  # GIA DINH: quy toan bo site plan ve be rong ~260m
        "rotation_deg": 0
    }
    os.makedirs(os.path.dirname(CALIBRATION_PATH), exist_ok=True)
    with open(CALIBRATION_PATH, "w", encoding="utf-8") as f:
        json.dump(calib, f, ensure_ascii=False, indent=2)
    return calib


def read_shells():
    shells = OrderedDict()
    with open(SITE_PLAN_CSV, encoding="utf-8") as fh:
        reader = csv.DictReader(fh, delimiter=";")
        for row in reader:
            rn = row["Room_Number"]
            if rn not in BUILDING_IDS:
                continue
            if int(row["Loop_Index"]) != 0:
                continue  # chỉ lấy vòng ngoài (footprint), bỏ qua chi tiết nội thất
            shells.setdefault(rn, []).append((
                float(row["StartX"]), float(row["StartY"]),
                float(row["EndX"]), float(row["EndY"]),
            ))
    return shells


def ring_from_segments(segs):
    ring = [(segs[0][0], segs[0][1])]
    for (x1, y1, x2, y2) in segs:
        ring.append((x2, y2))
    if ring[0] != ring[-1]:
        ring.append(ring[0])
    return ring


def cad_to_lonlat(x, y, calib):
    ax, ay = calib["anchor_cad_xy"]
    scale = calib["scale_meters_per_unit"]
    rot = math.radians(calib.get("rotation_deg", 0))
    dx_m = (x - ax) * scale
    dy_m = (y - ay) * scale
    east = dx_m * math.cos(rot) - dy_m * math.sin(rot)
    north = dx_m * math.sin(rot) + dy_m * math.cos(rot)
    anchor_lon, anchor_lat = calib["anchor_latlng"]
    meters_per_deg_lat = 111320.0
    meters_per_deg_lon = 111320.0 * math.cos(math.radians(anchor_lat))
    lon = anchor_lon + east / meters_per_deg_lon
    lat = anchor_lat + north / meters_per_deg_lat
    return [round(lon, 8), round(lat, 8)]


def main():
    calib = load_calibration()
    shells = read_shells()

    floors_config = {}
    if os.path.exists(FLOORS_CONFIG_PATH):
        with open(FLOORS_CONFIG_PATH, encoding="utf-8") as f:
            floors_config = json.load(f)

    features = []
    for building_id, segs in shells.items():
        ring = ring_from_segments(segs)
        coords = [cad_to_lonlat(x, y, calib) for (x, y) in ring]
        n_floors = len(floors_config.get(building_id, [])) or 1
        features.append({
            "type": "Feature",
            "id": building_id,
            "geometry": {"type": "Polygon", "coordinates": [coords]},
            "properties": {
                "building_id": building_id,
                "name": building_id,
                "height": n_floors * DEFAULT_FLOOR_HEIGHT,
                "base_height": 0,
                "floors": floors_config.get(building_id, [])
            }
        })

    fc = {"type": "FeatureCollection", "features": features}
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(fc, f, ensure_ascii=False, indent=2)
    print(f"[done] {OUT_PATH}: {len(features)} toa nha that (AD/B1/B2/B3/B5/B6)")
    print("[!] Vi tri hien la APPROXIMATE - can hieu chinh geo-calibration.json khi co GPS that")


if __name__ == "__main__":
    main()
