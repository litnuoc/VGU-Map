function doGet(e) {
  const cache = CacheService.getScriptCache();
  const cacheKey = "vgu_rooms_api_data_v2";
  const forceRefresh = e && e.parameter && (e.parameter.nocache === "true" || e.parameter.force === "1");
  
  if (!forceRefresh) {
    const cachedData = cache.get(cacheKey);
    if (cachedData) {
      return ContentService.createTextOutput(cachedData).setMimeType(ContentService.MimeType.JSON);
    }
  } // [Đã sửa] Thêm ngoặc đóng

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheets = ss.getSheets();
    const roomsMap = {};
    
    sheets.forEach(sheet => {
      // ... logic lọc sheet của bạn ...
      const sheetName = sheet.getName();
      const normalizedSheetName = normalizeHeader(sheetName);
             
      if (normalizedSheetName.includes("danh_sach_nhan_vien") || normalizedSheetName.includes("nhan_vien") || normalizedSheetName.includes("staff") || normalizedSheetName.includes("employee") || normalizedSheetName.includes("hanh_chinh")) {
        return;
      }
      
      const data = sheet.getDataRange().getValues();
      if (!data || data.length < 2) return;
      const headerRowIndex = detectHeaderRowIndex(data);
      if (headerRowIndex < 0 || headerRowIndex >= data.length - 1) return;
      const normalizedHeaders = buildNormalizedHeaders(data[headerRowIndex]);
      
      for (let i = headerRowIndex + 1; i < data.length; i++) {
        const row = data[i];
        if (isBlankRow(row)) continue;
        const rowData = toRowObject(row, normalizedHeaders);
        const roomNumber = getFirstString(rowData, ["number", "room_number", "ma_phong", "so_phong", "room_code", "room"], "");
                 
        if (!roomNumber || roomNumber.toLowerCase().includes("total")) continue;
        
        if (!roomsMap[roomNumber]) {
          roomsMap[roomNumber] = {
            sheet_source: sheetName,
            room_number: roomNumber,
            heading_1: getFirstString(rowData, ["name", "heading_1", "ten", "ten_phong"], "___"),
            heading_2: getFirstString(rowData, ["ten_phong", "heading_2", "name"], "___"),
            department: getFirstString(rowData, ["department", "phong_ban", "bo_phan"], "___"),
            occupants_list: [],
            fm_room_function: getFirstString(rowData, ["fm_room_function", "function", "chuc_nang"], "___"),
            fm_room_type: getFirstString(rowData, ["fm_room_type", "type", "loai_phong", "loai"], "___"),
            area: getSafeNumberText(rowData, ["area", "room_area", "dien_tich"], "--"),
            unbounded_height: getSafeNumberText(rowData, ["unbounded_height", "height", "chieu_cao"], "--"),
            capacity: getSafeNumberText(rowData, ["capacity", "suc_chua"], "--"),
            status: getFirstString(rowData, ["status", "trang_thai"], "Chưa xác định") // [Đã sửa] Chuỗi bị đứt
          };
        }
        
        // ĐOẠN MỚI:
const occupantRaw = getFirstString(rowData, ["occupant", "nguoi_su_dung", "staff_name", "fm_staff_name", "nhan_su"], "");
if (occupantRaw) {
  // Tách chuỗi bằng dấu xuống dòng (hỗ trợ cả \n và \r\n từ Sheet)
  const occupantNames = occupantRaw.split(/\r?\n/);
  
  occupantNames.forEach(name => {
    const cleanName = name.trim();
    // Đưa từng tên riêng biệt vào mảng
    if (cleanName && roomsMap[roomNumber].occupants_list.indexOf(cleanName) === -1) {
      roomsMap[roomNumber].occupants_list.push(cleanName);
    }
  });
}

        const statusVal = getFirstString(rowData, ["status", "trang_thai"], "");
        if (statusVal) roomsMap[roomNumber].status = statusVal;
      }
    });

    const resultData = Object.keys(roomsMap).map(roomKey => {
      const room = roomsMap[roomKey];
      room.occupant_display = room.occupants_list.join(", ");
      delete room.occupants_list;
      return room;
    });

    if (resultData.length === 0) {
      throw new Error("Không tìm thấy dữ liệu phòng trong Google Sheets.");
    }

    const responsePayload = JSON.stringify({
      status: "success",
      total_rooms: resultData.length,
      last_updated: new Date().toISOString(),
      data: resultData
    });

    try {
      cache.put(cacheKey, responsePayload, 900);
    } catch (cacheError) {
      console.warn("Dữ liệu quá lớn, bỏ qua cache.");
    }

    return ContentService.createTextOutput(responsePayload).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error", message: String(error), data: []
    })).setMimeType(ContentService.MimeType.JSON);
  } // [Đã sửa] Thêm ngoặc đóng catch
}

// [Đã sửa] Bổ sung các dấu đóng ngoặc cho toàn bộ Helper Functions
function normalizeHeader(str) {
  if (!str) return "";
  // LỖI CŨ (đã sửa): dòng .replace(/[ ]/g, "d") biến dấu cách thành chữ "d"
  // => "Room Number" -> "roomdnumber" (KHÔNG khớp "room_number") nên MỌI cột có
  // tên nhiều chữ đều bị bỏ qua và trả về "___". Phải đổi dấu cách thành "_".
  return str.toString().toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // bỏ dấu tiếng Việt
    .replace(/đ/g, "d")                               // đ -> d (sau khi đã strip dấu)
    .replace(/[^a-z0-9]+/g, "_")                       // mọi ký tự không phải chữ/số -> "_"
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function detectHeaderRowIndex(data) {
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    for (let j = 0; j < row.length; j++) {
      const cellClean = normalizeHeader(row[j]);
      if (["number", "room_number", "ma_phong", "so_phong", "room"].indexOf(cellClean) !== -1) {
        return i;
      }
    }
  }
  return 0;
}

function buildNormalizedHeaders(headerRow) {
  return headerRow.map(cell => normalizeHeader(cell));
}

function isBlankRow(row) {
  return row.every(cell => cell === "" || cell === null || cell === undefined);
}

function toRowObject(row, normalizedHeaders) {
  const obj = {};
  normalizedHeaders.forEach((header, index) => {
    if (header) {
      obj[header] = row[index];
    }
  });
  return obj;
}

function getFirstString(rowData, keys, defaultValue) {
  const fallback = defaultValue !== undefined ? defaultValue : "";
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    if (rowData[key] !== undefined && rowData[key] !== null && rowData[key] !== "") {
      return rowData[key].toString().trim();
    }
  }
  return fallback;
}

function getSafeNumberText(rowData, keys, defaultValue) {
  const fallback = defaultValue !== undefined ? defaultValue : "--";
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    if (rowData[key] !== undefined && rowData[key] !== null && rowData[key] !== "") {
      return rowData[key].toString().trim();
    }
  }
  return fallback;
}
