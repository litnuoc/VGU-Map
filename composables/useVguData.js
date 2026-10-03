// composables/useVguData.js
// Chỉ còn 2 hàm được UI dùng: getRoomInfo + getRoomEquipment (đọc từ Nuxt Content).
// Đã bỏ syncAll/normalizeInfo/getFloorPlan/fetchJson.

// ─── C-2: Module-level cache ────────────────────────────────────────────────
// Tất cả các hàm "đọc toàn bộ danh sách phòng" (searchRooms, getBuildingStats,
// getRoomsByFloor) đều dùng chung cache này.  Cache chỉ được nạp 1 lần duy nhất
// trong phiên làm việc; không cần invalidate vì dữ liệu phòng không thay đổi
// trong runtime.
let _allRoomsCache = null   // null = chưa nạp; [] = đã nạp (có thể rỗng)

const _getAllRooms = async () => {
  if (_allRoomsCache !== null) return _allRoomsCache
  const { queryContent } = await import('#imports')
  const rows = await queryContent().find()
  // Chỉ giữ các bản ghi có room_id (lọc bỏ equipment, news… nếu có trong content/)
  _allRoomsCache = (rows || []).filter(r => r.room_id)
  return _allRoomsCache
}
// ────────────────────────────────────────────────────────────────────────────

// ─── M-5: Module-level lazy singleton for drive_data.json ────────────────────
// Vấn đề cũ: RoomDetailPanel.vue gọi $fetch('drive_data.json') trong onMounted
// → mỗi lần mount (chuyển phòng) = 1 request mạng mới cho cùng 1 file tĩnh.
// Fix: 1 Promise duy nhất ở module scope. Lần đầu gọi thì fetch; mọi lần sau
// dùng lại kết quả đã có. Mọi caller chờ cùng 1 Promise → không bao giờ
// fetch song song kể cả khi 2 component mount đồng thời.
let _driveDataPromise = null

const _getDriveData = (baseURL) => {
  if (!_driveDataPromise) {
    _driveDataPromise = $fetch(`${baseURL}data/drive_data.json`)
      .catch((err) => {
        // Nếu fetch thất bại, xoá Promise để lần sau có thể thử lại.
        _driveDataPromise = null
        console.error('[useVguData] Không thể load drive_data.json:', err)
        return {}
      })
  }
  return _driveDataPromise
}
// ─────────────────────────────────────────────────────────────────────────────

export const useVguData = () => {
  /**
   * Lấy thông tin phòng từ Nuxt Content (content/Rooms/*.md).
   * Q-1 FIX: Kiểm tra cache chung _getAllRooms() trước — nếu cache đã có (tức
   * FloorPanel hoặc searchRooms đã nạp rồi) thì trả về ngay mà không cần thêm
   * round-trip queryContent. Chỉ fallback sang queryContent khi cache thực sự
   * chưa sẵn sàng (ví dụ người dùng mở link /room trực tiếp trước khi FloorPanel mount).
   * @param {string} roomId  ví dụ "AD-247"
   */
  const getRoomInfo = async (roomId) => {
    if (!roomId) return null
    try {
      // Q-1: fast path — serve from the shared in-memory cache when available.
      if (_allRoomsCache !== null) {
        const cached = _allRoomsCache.find(r => r.room_id === roomId)
        if (cached) return { ...normalizeRoom(cached), roomFunction: '' }
        // Room not found in cache — could be a valid absence (no .md file for
        // that room), so return null without hitting the network again.
        return null
      }
      // Slow path: cache not yet populated — query directly (and the subsequent
      // call to _getAllRooms() from any other function will populate the cache).
      const { queryContent } = await import('#imports')
      const room = await queryContent()
        .where({ room_id: roomId })
        .findOne()
      return room ? { ...normalizeRoom(room), roomFunction: '' } : null
    } catch (error) {
      console.error(`[useVguData] Không lấy được thông tin phòng ${roomId}:`, error)
      return null
    }
  }

  /**
   * Lấy danh sách thiết bị đặt trong phòng (content/equipment/**).
   * @param {string} roomId
   */
  const getRoomEquipment = async (roomId) => {
    try {
      const { queryContent } = await import('#imports')
      const equipments = await queryContent('equipment')
        .where({ 'location.room_id': roomId })
        .find()
      return equipments || []
    } catch (error) {
      console.error(`[useVguData] Không lấy được thiết bị của ${roomId}:`, error)
      return []
    }
  }

  /** Alias của getRoomEquipment. */
  const getEquipmentListByRoom = async (roomId) => getRoomEquipment(roomId)

  /**
   * Lấy chi tiết đầy đủ 1 thiết bị theo id.
   * @param {string} equipmentId
   */
  const getEquipmentInfo = async (equipmentId) => {
    try {
      const { queryContent } = await import('#imports')
      const equipment = await queryContent('equipment')
        .where({ id: equipmentId })
        .findOne()
      return equipment || null
    } catch (error) {
      console.error(`[useVguData] Không lấy được chi tiết thiết bị ${equipmentId}:`, error)
      return null
    }
  }

  /**
   * Lấy danh sách phòng của 1 tầng thuộc 1 tòa.
   * C-2: dùng cache thay vì queryContent().find() mỗi lần.
   * @param {string} buildingId
   * @param {string|number} floor
   */
  const getRoomsByFloor = async (buildingId, floor) => {
    if (!buildingId || floor == null) return []
    try {
      const floorNum = Number(floor)
      // C-2: đọc từ cache, không gọi queryContent lần nữa
      const all = await _getAllRooms()
      const rooms = all.filter(r => r.building_id === buildingId && r.floor === floorNum)
      return rooms.map(normalizeRoom)
    } catch (error) {
      console.error(`[useVguData] Không lấy được danh sách phòng ${buildingId} tầng ${floor}:`, error)
      throw error
    }
  }

  /**
   * Tìm phòng theo từ khoá.
   * C-1: lọc trong JS sau khi đọc cache — không scan toàn bộ DB qua mạng nữa.
   * C-2: dùng cache chung _getAllRooms().
   * @param {string} query
   * @param {number} limit
   */
  const searchRooms = async (query, limit = 8) => {
    const q = (query || '').trim()
    if (!q) return []
    try {
      const qLower = q.toLowerCase()
      // C-1 FIX: trước đây gọi queryContent().find() không có where → scan toàn DB.
      // Nay dùng cache: nếu cache chưa có thì nạp 1 lần, sau đó lọc trong bộ nhớ.
      const all = await _getAllRooms()
      return all
        .filter(r =>
          String(r.room_id).toLowerCase().includes(qLower) ||
          String(r.name || '').toLowerCase().includes(qLower)
        )
        .slice(0, limit)
        .map(normalizeRoom)
    } catch (error) {
      console.error(`[useVguData] Không tìm được phòng với từ khoá "${q}":`, error)
      return []
    }
  }

  // Các nhóm phân loại phòng
  const ROOM_TYPE_MAP = {
    'Administration': 'administration',
    'Laboratory': 'laboratory',
    'Workshop': 'workshop',
    'Teaching': 'teaching',
    'Other functions': 'other'
  }
  const normalizeRoomType = (raw) => ROOM_TYPE_MAP[raw] || 'other'

  const normalizeStatus = (raw) => {
    const s = (raw || '').toLowerCase()
    if (s === 'occupied' || s === 'active') return 'active'
    if (s === 'vacant') return 'inactive'
    return 'unknown'
  }

  const normalizeRoom = (r) => ({
    id: r.room_id,
    roomNumber: r.room_id,
    roomName: r.name || '',
    roomType: normalizeRoomType(r.room_type),
    rawRoomType: r.room_type || '',
    status: normalizeStatus(r.status),
    rawStatus: r.status || '',
    buildingId: r.building_id || null,
    floor: r.floor ?? null,
    department: Array.isArray(r.departments) ? r.departments.join(', ') : (r.departments || ''),
    area: r.area_m2 || '',
    capacity: r.capacity || '',
    occupants: r.head_of_lab?.name ? [r.head_of_lab.name] : []
  })

  /**
   * Thống kê số phòng / số phòng lab theo từng toà.
   * C-2: dùng cache thay vì queryContent().find() riêng.
   * @returns {Promise<Record<string, {roomCount:number, labCount:number}>>}
   */
  const getBuildingStats = async () => {
    try {
      // C-2 FIX: dùng cache thay vì một lần fetch riêng
      const rooms = await _getAllRooms()
      const stats = {}
      for (const r of rooms) {
        const b = r.building_id
        if (!b) continue
        if (!stats[b]) stats[b] = { roomCount: 0, labCount: 0 }
        stats[b].roomCount++
        if ((r.room_type || '').toLowerCase() === 'laboratory') stats[b].labCount++
      }
      return stats
    } catch (error) {
      console.error('[useVguData] Không lấy được thống kê toà nhà:', error)
      return {}
    }
  }

  /**
   * Lazy singleton fetch cho drive_data.json (ánh xạ room_id → Google Drive file ID).
   * M-5: dùng cache module-scope để chỉ fetch 1 lần dù có N component mount.
   * @param {string} baseURL  config.app.baseURL từ useRuntimeConfig()
   * @returns {Promise<Record<string, string>>}
   */
  const getDriveData = (baseURL) => _getDriveData(baseURL)

  return {
    getRoomInfo,
    getRoomEquipment,
    getEquipmentListByRoom,
    getEquipmentInfo,
    getRoomsByFloor,
    searchRooms,
    getBuildingStats,
    getDriveData,
    // MOD-1: Shared utility — previously duplicated in HologramMap.vue and FloorPanel.vue.
    // Exported here so both components import from one authoritative source.
    formatRoomName
  }
}

// ─── MOD-1: Shared formatRoomName utility ────────────────────────────────────
// Extracted from HologramMap.vue and FloorPanel.vue where the identical logic
// lived in two places. Any future changes to room-name display only need to
// happen once, here.
//
// Logic: some room names are stored duplicated in the sheet, e.g.
//   "Phòng học - Phòng học"  →  "Phòng học"
// If the name splits on " - " into an even number of equal halves, return
// just the first half.  Otherwise return the name unchanged.
export const formatRoomName = (name) => {
  if (!name || typeof name !== 'string') return name
  const parts = name.split(/\s*-\s*/)
  if (parts.length > 1 && parts.length % 2 === 0) {
    const halfIndex = parts.length / 2
    const firstHalf = parts.slice(0, halfIndex).join(' - ')
    const secondHalf = parts.slice(halfIndex).join(' - ')
    if (firstHalf === secondHalf) return firstHalf
  }
  return name
}
// ─────────────────────────────────────────────────────────────────────────────
