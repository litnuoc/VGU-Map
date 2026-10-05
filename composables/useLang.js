// composables/useLang.js
// Song ngữ Việt / Anh cho toàn bộ giao diện VGU Map.
// - Chỉ dịch chữ của GIAO DIỆN. Dữ liệu từ Google Sheet (tên phòng, phòng ban,
//   người sử dụng…) giữ nguyên như trong Sheet.
// - Ngôn ngữ được nhớ theo trình duyệt (localStorage 'vgu-lang'), mặc định 'vi'.
// - Thêm câu mới: thêm cùng 1 key vào cả MESSAGES.vi và MESSAGES.en, rồi dùng t('key').
//   Tham số: t('map.floor', { f: 3 }) với chuỗi 'Tầng {f}'.
import { ref, computed } from 'vue'

const MESSAGES = {
  vi: {
    'common.close': 'Đóng',

    'header.home': 'Về trang bản đồ',
    'header.nav': 'Điều hướng chính',
    'header.map': 'Bản đồ tương tác',
    'header.equipment': 'Tất cả thiết bị',
    'header.logout': 'Đăng xuất',
    'header.lang': 'Ngôn ngữ',

    'index.loading': 'ĐANG KHỞI TẠO HỆ THỐNG BẢN ĐỒ…',

    'map.searchIn': 'Tìm phòng trong {b}…',
    'map.searchCampus': 'Tìm phòng trên Campus…',
    'map.noResult': 'Không tìm thấy phòng phù hợp.',
    'map.floorGroup': 'Chọn tầng toà {b}',
    'map.exit': 'Thoát khỏi toà nhà, về toàn cảnh',
    'map.exitShort': 'Thoát khỏi toà nhà',
    'map.floor': 'Tầng {f}',
    'map.floorDetail': 'Tầng {f} — có dữ liệu chi tiết',
    'map.labelsGroup': 'Hiện khung tên phòng',
    'map.labelsOn': 'Hiện khung tên phòng',
    'map.labelsOff': 'Ẩn khung tên phòng, chỉ giữ chấm',
    'map.calibA': 'Sơ đồ phòng tòa',
    'map.calibB': 'chưa được định vị GPS — đang chờ hiệu chỉnh tọa độ.',

    'bld.list': 'Danh sách toà nhà',
    'bld.open': 'Mở danh sách toà nhà',
    'bld.collapse': 'Thu gọn',
    'bld.mobile': 'Danh sách Toà nhà',
    'bld.eyebrow': '[ CƠ SỞ DỮ LIỆU KHUÔN VIÊN ]',
    'bld.title': 'Toàn bộ toà nhà',
    'bld.sub': 'Bấm vào một toà để fly vào trên bản đồ.',
    'bld.hint': 'Bấm vào một toà nhà để mở tầng & phòng ngay trên bản đồ.',
    'bld.loading': 'Đang tải dữ liệu…',
    'bld.tag': 'TOÀ {b}',
    'bld.name': 'Cụm {b}',
    'bld.rooms': 'phòng',
    'bld.labs': 'lab',
    'bld.floors': 'tầng',

    'floor.exit': 'Thoát khỏi toà nhà',
    'floor.exitShort': 'Thoát toà nhà',
    'floor.open': 'Mở danh sách phòng',
    'floor.collapse': 'Thu gọn',
    'floor.loading': 'Đang tải danh sách phòng…',
    'floor.empty': 'Không có phòng nào thuộc loại này.',
    'floor.error': 'Không tải được dữ liệu phòng. Vui lòng thử lại sau.',
    'floor.all': 'Tất cả',
    'floor.other': 'Khác',

    'room.loading': 'Đang tải dữ liệu phòng…',
    'room.photoError': 'Không tải được ảnh',
    'room.noPhoto': 'Chưa có ảnh thực tế',
    'room.noPhotoSub': 'Sẽ cập nhật ảnh thực tế tại đây cho phòng {n}',
    'room.type': 'Phân loại',
    'room.function': 'Chức năng',
    'room.area': 'Diện tích',
    'room.capacity': 'Sức chứa',
    'room.status': 'Trạng thái / Hoạt động',

    'booking.title': 'ĐẶT PHÒNG',
    'booking.prev': 'Ngày trước',
    'booking.next': 'Ngày sau',
    'booking.today': 'Hôm nay',
    'booking.loading': 'Đang tải lịch phòng…',
    'booking.grid': 'Lịch trống/bận theo giờ',
    'booking.slotBusy': '{l} — Đã có người đặt',
    'booking.slotPast': '{l} — Đã qua',
    'booking.slotFree': '{l} — Trống, bấm để đặt',
    'booking.free': 'Trống',
    'booking.busy': 'Đã đặt',
    'booking.hint': 'Bấm giờ trống để đặt',
    'booking.busyAt': 'Bận {t}',
    'booking.allFree': 'Cả ngày chưa có lịch đặt.',
    'booking.button': 'Đặt phòng trên Google Calendar',
    'booking.note': 'Mở bằng tài khoản Google @vgu.edu.vn. Phòng tự từ chối nếu giờ đó đã có người đặt.',
    'booking.eventTitle': 'Họp tại {r}',
    'booking.loadError': 'Không tải được lịch phòng.',
    'booking.connError': 'Không kết nối được máy chủ lịch.',

    'esp.title': 'Thiết bị phòng học',
    'esp.loading': 'Đang tải danh sách thiết bị…',
    'esp.empty': 'Chưa có thiết bị nào được ghi nhận cho phòng này.',
    'esp.back': 'Quay lại',
    'esp.list': 'Danh sách',
    'esp.no3d': 'Chưa có mô hình 3D',
    'esp.photo': 'Ảnh {n}',
    'esp.photoAlt': '{t} ảnh {n}',
    'esp.desc': 'MÔ TẢ',
    'esp.descPending': 'Thông tin chi tiết sẽ được cập nhật sau.',
    'esp.category': 'PHÂN LOẠI',
    'esp.location': 'VỊ TRÍ',
    'esp.future': 'Thông số kỹ thuật, quy trình vận hành và lịch bảo trì sẽ được cập nhật trong phiên bản tiếp theo.',
    'esp.loading3d': 'Đang tải mô hình 3D…',
    'esp.retry3d': 'Đang thử lại đường dẫn phụ…',
    'esp.floor': 'Tầng {f}',

    'status.operational': 'Đang hoạt động',
    'status.maintenance': 'Đang bảo trì',
    'status.offline': 'Ngưng hoạt động',
    'status.unknown': 'Chưa rõ',

    'eqlist.eyebrow': '[ CƠ SỞ DỮ LIỆU THIẾT BỊ ]',
    'eqlist.title': 'Danh mục thiết bị',
    'eqlist.sub': 'Toàn bộ thiết bị đã ghi nhận trên khuôn viên VGU — bấm vào một thẻ để xem chi tiết 3D.',
    'eqlist.searchPh': 'Tìm theo tên, model, hãng sản xuất...',
    'eqlist.searchAria': 'Tìm kiếm thiết bị',
    'eqlist.catAria': 'Lọc theo phân loại',
    'eqlist.catAll': 'Mọi phân loại',
    'eqlist.bldAria': 'Lọc theo toà nhà',
    'eqlist.bldAll': 'Mọi toà nhà',
    'eqlist.stAria': 'Lọc theo trạng thái',
    'eqlist.stAll': 'Mọi trạng thái',
    'eqlist.count': '{a} / {b} thiết bị',
    'eqlist.loading': 'Đang tải danh mục thiết bị...',
    'eqlist.none': 'Chưa có thiết bị nào được ghi nhận trong hệ thống.',
    'eqlist.noMatch': 'Không tìm thấy thiết bị khớp với bộ lọc hiện tại.',
    'eqlist.clear': '[ XOÁ BỘ LỌC ]',

    'eqd.close': '[ ĐÓNG ]',
    'eqd.building': 'TÒA',
    'eqd.floor': 'TẦNG',
    'eqd.room': 'PHÒNG',
    'eqd.category': '[ PHÂN LOẠI ]',
    'eqd.mechanism': '[ CƠ CHẾ HOẠT ĐỘNG ]',
    'eqpage.notFound': 'KHÔNG TÌM THẤY THIẾT BỊ:',
    'eqpage.back': '[ ← QUAY LẠI BẢN ĐỒ ]',

    'login.pageTitle': 'Đăng nhập · Vietnamese-German University Map',
    'login.lead': 'Tra cứu toà nhà, từng tầng, từng phòng và thiết bị phòng thí nghiệm trên bản đồ 3D tương tác — dành riêng cho cán bộ, nhân viên VGU.',
    'login.f1b': '6 toà nhà',
    'login.f1': '· hơn 1.000 phòng theo từng tầng',
    'login.f2b': 'Tìm phòng',
    'login.f2': 'và lọc theo chức năng',
    'login.f3b': 'Mô hình 3D',
    'login.f3': 'thiết bị phòng lab',
    'login.step1': '01 · EMAIL',
    'login.step2': '02 · MÃ XÁC NHẬN',
    'login.titleEmail': 'Đăng nhập',
    'login.titleCode': 'Nhập mã xác nhận',
    'login.sub1': 'Dùng email công việc đã đăng ký trong danh sách nhân viên VGU. Lần đầu sử dụng? Không cần đăng ký — chỉ cần nhập email.',
    'login.sub2': 'Mã 6 số đã được gửi tới',
    'login.sub2b': 'Mã có hiệu lực trong 10 phút.',
    'login.emailLabel': 'Email nhân viên',
    'login.checking': 'Đang kiểm tra…',
    'login.sendCode': 'Gửi mã đăng nhập',
    'login.codeLabel': 'Mã xác nhận',
    'login.verifying': 'Đang xác nhận…',
    'login.signIn': 'Đăng nhập',
    'login.changeEmail': '← Đổi email',
    'login.resendIn': 'Gửi lại mã sau {s}s',
    'login.resend': 'Gửi lại mã',
    'login.notConfigured': 'Trang chưa được cấu hình máy chủ đăng nhập. Vui lòng liên hệ quản trị viên.',
    'login.foot': 'Không đăng nhập được? Liên hệ phòng FM để được thêm email vào danh sách nhân viên.',
    'login.invalidEmail': 'Vui lòng nhập đúng định dạng email.',
    'login.sendFail': 'Không gửi được mã.',
    'login.connFail': 'Không kết nối được máy chủ đăng nhập.',
    'login.codeWrong': 'Mã không đúng.',
  },

  en: {
    'common.close': 'Close',

    'header.home': 'Back to the map',
    'header.nav': 'Main navigation',
    'header.map': 'Interactive map',
    'header.equipment': 'All equipment',
    'header.logout': 'Sign out',
    'header.lang': 'Language',

    'index.loading': 'INITIALISING MAP SYSTEM…',

    'map.searchIn': 'Search rooms in {b}…',
    'map.searchCampus': 'Search rooms on campus…',
    'map.noResult': 'No matching rooms found.',
    'map.floorGroup': 'Select a floor of building {b}',
    'map.exit': 'Leave the building, back to campus view',
    'map.exitShort': 'Leave the building',
    'map.floor': 'Floor {f}',
    'map.floorDetail': 'Floor {f} — detailed data available',
    'map.labelsGroup': 'Room labels',
    'map.labelsOn': 'Show room labels',
    'map.labelsOff': 'Hide room labels, keep the dots',
    'map.calibA': 'The room plan of building',
    'map.calibB': 'is not GPS-aligned yet — waiting for coordinate calibration.',

    'bld.list': 'Building list',
    'bld.open': 'Open building list',
    'bld.collapse': 'Collapse',
    'bld.mobile': 'Buildings',
    'bld.eyebrow': '[ CAMPUS DATABASE ]',
    'bld.title': 'All buildings',
    'bld.sub': 'Click a building to fly to it on the map.',
    'bld.hint': 'Click a building to open its floors & rooms on the map.',
    'bld.loading': 'Loading data…',
    'bld.tag': 'BUILDING {b}',
    'bld.name': 'Building {b}',
    'bld.rooms': 'rooms',
    'bld.labs': 'labs',
    'bld.floors': 'floors',

    'floor.exit': 'Leave the building',
    'floor.exitShort': 'Leave building',
    'floor.open': 'Open room list',
    'floor.collapse': 'Collapse',
    'floor.loading': 'Loading rooms…',
    'floor.empty': 'No rooms of this type.',
    'floor.error': 'Could not load room data. Please try again later.',
    'floor.all': 'All',
    'floor.other': 'Other',

    'room.loading': 'Loading room data…',
    'room.photoError': 'Could not load photo',
    'room.noPhoto': 'No photo yet',
    'room.noPhotoSub': 'A photo of {n} will be added here',
    'room.type': 'Type',
    'room.function': 'Function',
    'room.area': 'Area',
    'room.capacity': 'Capacity',
    'room.status': 'Status / Activity',

    'booking.title': 'BOOK THIS ROOM',
    'booking.prev': 'Previous day',
    'booking.next': 'Next day',
    'booking.today': 'Today',
    'booking.loading': 'Loading room calendar…',
    'booking.grid': 'Hourly availability',
    'booking.slotBusy': '{l} — Already booked',
    'booking.slotPast': '{l} — Past',
    'booking.slotFree': '{l} — Free, click to book',
    'booking.free': 'Free',
    'booking.busy': 'Booked',
    'booking.hint': 'Click a free hour to book',
    'booking.busyAt': 'Busy {t}',
    'booking.allFree': 'No bookings for this day.',
    'booking.button': 'Book on Google Calendar',
    'booking.note': 'Opens with your @vgu.edu.vn Google account. The room declines automatically if that time is already booked.',
    'booking.eventTitle': 'Meeting at {r}',
    'booking.loadError': 'Could not load the room calendar.',
    'booking.connError': 'Could not reach the calendar server.',

    'esp.title': 'Room equipment',
    'esp.loading': 'Loading equipment…',
    'esp.empty': 'No equipment has been recorded for this room yet.',
    'esp.back': 'Back',
    'esp.list': 'List',
    'esp.no3d': 'No 3D model yet',
    'esp.photo': 'Photo {n}',
    'esp.photoAlt': '{t} photo {n}',
    'esp.desc': 'DESCRIPTION',
    'esp.descPending': 'Details will be added later.',
    'esp.category': 'CATEGORY',
    'esp.location': 'LOCATION',
    'esp.future': 'Technical specifications, operating procedures and maintenance schedules will be added in a future version.',
    'esp.loading3d': 'Loading 3D model…',
    'esp.retry3d': 'Retrying with a fallback path…',
    'esp.floor': 'Floor {f}',

    'status.operational': 'Operational',
    'status.maintenance': 'Under maintenance',
    'status.offline': 'Out of service',
    'status.unknown': 'Unknown',

    'eqlist.eyebrow': '[ EQUIPMENT DATABASE ]',
    'eqlist.title': 'Equipment catalogue',
    'eqlist.sub': 'All equipment recorded on the VGU campus — click a card to see the 3D details.',
    'eqlist.searchPh': 'Search by name, model, manufacturer...',
    'eqlist.searchAria': 'Search equipment',
    'eqlist.catAria': 'Filter by category',
    'eqlist.catAll': 'All categories',
    'eqlist.bldAria': 'Filter by building',
    'eqlist.bldAll': 'All buildings',
    'eqlist.stAria': 'Filter by status',
    'eqlist.stAll': 'All statuses',
    'eqlist.count': '{a} / {b} items',
    'eqlist.loading': 'Loading equipment catalogue...',
    'eqlist.none': 'No equipment has been recorded in the system yet.',
    'eqlist.noMatch': 'No equipment matches the current filters.',
    'eqlist.clear': '[ CLEAR FILTERS ]',

    'eqd.close': '[ CLOSE ]',
    'eqd.building': 'BUILDING',
    'eqd.floor': 'FLOOR',
    'eqd.room': 'ROOM',
    'eqd.category': '[ CATEGORY ]',
    'eqd.mechanism': '[ OPERATING PRINCIPLE ]',
    'eqpage.notFound': 'EQUIPMENT NOT FOUND:',
    'eqpage.back': '[ ← BACK TO MAP ]',

    'login.pageTitle': 'Sign in · Vietnamese-German University Map',
    'login.lead': 'Explore buildings, floors, rooms and laboratory equipment on an interactive 3D map — for VGU faculty and staff only.',
    'login.f1b': '6 buildings',
    'login.f1': '· more than 1,000 rooms, floor by floor',
    'login.f2b': 'Find rooms',
    'login.f2': 'and filter by function',
    'login.f3b': '3D models',
    'login.f3': 'of laboratory equipment',
    'login.step1': '01 · EMAIL',
    'login.step2': '02 · VERIFICATION CODE',
    'login.titleEmail': 'Sign in',
    'login.titleCode': 'Enter verification code',
    'login.sub1': 'Use the work email registered on the VGU staff list. First time here? No sign-up needed — just enter your email.',
    'login.sub2': 'A 6-digit code has been sent to',
    'login.sub2b': 'The code is valid for 10 minutes.',
    'login.emailLabel': 'Staff email',
    'login.checking': 'Checking…',
    'login.sendCode': 'Send sign-in code',
    'login.codeLabel': 'Verification code',
    'login.verifying': 'Verifying…',
    'login.signIn': 'Sign in',
    'login.changeEmail': '← Change email',
    'login.resendIn': 'Resend code in {s}s',
    'login.resend': 'Resend code',
    'login.notConfigured': 'The sign-in server is not configured. Please contact the administrator.',
    'login.foot': 'Cannot sign in? Contact the FM office to have your email added to the staff list.',
    'login.invalidEmail': 'Please enter a valid email address.',
    'login.sendFail': 'Could not send the code.',
    'login.connFail': 'Could not reach the sign-in server.',
    'login.codeWrong': 'Incorrect code.',
  },
}

// Thông báo tiếng Việt do Apps Script (Auth.gs) trả về → bản tiếng Anh.
const SERVER_EN = {
  'Yêu cầu không hợp lệ.': 'Invalid request.',
  'Hành động không hợp lệ.': 'Invalid request.',
  'Lỗi máy chủ, vui lòng thử lại sau.': 'Server error, please try again later.',
  'Email không hợp lệ.': 'Invalid email address.',
  'Email này không có trong danh sách nhân viên VGU.': 'This email is not on the VGU staff list.',
  'Mã vừa được gửi. Vui lòng đợi 1 phút rồi thử lại.': 'A code was just sent. Please wait 1 minute and try again.',
  'Mã không hợp lệ.': 'Invalid code.',
  'Mã đã hết hạn. Vui lòng yêu cầu mã mới.': 'The code has expired. Please request a new one.',
  'Nhập sai quá nhiều lần. Vui lòng yêu cầu mã mới.': 'Too many incorrect attempts. Please request a new code.',
  'Email không còn trong danh sách nhân viên.': 'This email is no longer on the staff list.',
  'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.': 'Your session is invalid or has expired.',
  'Lịch phòng không hợp lệ.': 'Invalid room calendar.',
  'Khoảng thời gian không hợp lệ (tối đa 8 ngày).': 'Invalid time range (maximum 8 days).',
  'Không có quyền xem lịch phòng này.': "You don't have access to this room's calendar.",
  'Không đọc được lịch phòng.': 'Could not read the room calendar.',
  'Bạn cần đăng nhập lại.': 'Please sign in again.',
  'Chưa cấu hình địa chỉ máy chủ đăng nhập (NUXT_PUBLIC_AUTH_URL).': 'The sign-in server address is not configured.',
}

// Giá trị trạng thái phòng trong Google Sheet → hiển thị tiếng Anh (Sheet giữ nguyên)
const DATA_EN = {
  'Đang sử dụng': 'In use',
  'Chưa sử dụng': 'Not in use',
  'Chưa xác định': 'Unknown',
  'Chưa cập nhật': 'Not updated',
}

const LANG_KEY = 'vgu-lang'
const lang = ref('vi')
let initialised = false

function applyHtmlLang(l) {
  if (typeof document !== 'undefined') document.documentElement.lang = l
}

export function useLang() {
  if (!initialised && typeof window !== 'undefined') {
    initialised = true
    try {
      const saved = window.localStorage.getItem(LANG_KEY)
      if (saved === 'vi' || saved === 'en') lang.value = saved
    } catch (_) { /* localStorage bị chặn → giữ mặc định */ }
    applyHtmlLang(lang.value)
  }

  const t = (key, params) => {
    let s = MESSAGES[lang.value]?.[key] ?? MESSAGES.vi[key] ?? key
    if (params) s = s.replace(/\{(\w+)\}/g, (_, k) => (params[k] ?? ''))
    return s
  }

  // Dịch thông báo lỗi trả về từ máy chủ (Auth.gs) khi đang ở chế độ tiếng Anh
  const tServer = (msg) => {
    if (!msg || lang.value !== 'en') return msg
    if (SERVER_EN[msg]) return SERVER_EN[msg]
    const m = String(msg).match(/^Mã không đúng\. Còn (\d+) lần thử\.$/)
    if (m) return `Incorrect code. ${m[1]} attempt(s) left.`
    const h = String(msg).match(/^Máy chủ đăng nhập trả lỗi HTTP (\d+)\.$/)
    if (h) return `The sign-in server returned HTTP ${h[1]}.`
    return msg
  }

  // Dịch một số giá trị dữ liệu cố định (trạng thái phòng) khi ở tiếng Anh
  const tData = (val) => (lang.value === 'en' && DATA_EN[val]) ? DATA_EN[val] : val

  const setLang = (l) => {
    if (l !== 'vi' && l !== 'en') return
    lang.value = l
    try { window.localStorage.setItem(LANG_KEY, l) } catch (_) {}
    applyHtmlLang(l)
  }

  const locale = computed(() => (lang.value === 'en' ? 'en-GB' : 'vi-VN'))

  return { lang, t, tServer, tData, setLang, locale }
}
