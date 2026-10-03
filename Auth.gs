/**
 * Auth.gs — Đăng nhập bằng email + mã OTP cho VGU Map.
 * ----------------------------------------------------------------------------
 * Dán file này vào CÙNG project Apps Script với Code.gs (Apps Script → dấu "+"
 * cạnh "Files" → Script → đặt tên "Auth"). Code.gs dùng doGet (dữ liệu phòng),
 * file này dùng doPost (đăng nhập) nên hai phần không đụng nhau.
 *
 * Danh sách được phép đăng nhập = các email trong tab nhân viên của CHÍNH
 * Google Sheet này (tab tên "Staff", hoặc bất kỳ tab nào có cột *email*).
 * Danh sách email KHÔNG bao giờ được gửi về trình duyệt.
 *
 * API (POST, body JSON, Content-Type: text/plain để tránh CORS preflight):
 *   { action: "requestCode", email }        → gửi mã 6 số vào email
 *   { action: "verify", email, code }       → trả về token đăng nhập (30 ngày)
 *   { action: "check", token }              → kiểm tra token còn hợp lệ
 * ----------------------------------------------------------------------------
 */

const AUTH_CONFIG = {
  STAFF_SHEET_NAME: 'Staff',      // tên tab danh sách nhân viên (ưu tiên)
  CODE_TTL_SEC: 10 * 60,          // mã OTP hết hạn sau 10 phút
  RESEND_WAIT_SEC: 60,            // tối thiểu 60s giữa 2 lần gửi mã
  MAX_ATTEMPTS: 5,                // nhập sai quá 5 lần → phải xin mã mới
  SESSION_DAYS: 30,               // thời hạn đăng nhập
  APP_NAME: 'VGU Map',
};

function doPost(e) {
  let req = {};
  try {
    req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    return authJson_({ ok: false, error: 'Yêu cầu không hợp lệ.' });
  }
  try {
    switch (req.action) {
      case 'requestCode': return authJson_(requestCode_(req.email));
      case 'verify':      return authJson_(verifyCode_(req.email, req.code));
      case 'check':       return authJson_(checkToken_(req.token));
      default:            return authJson_({ ok: false, error: 'Hành động không hợp lệ.' });
    }
  } catch (err) {
    console.error(err);
    return authJson_({ ok: false, error: 'Lỗi máy chủ, vui lòng thử lại sau.' });
  }
}

// ── 1. Gửi mã ───────────────────────────────────────────────────────────────
function requestCode_(rawEmail) {
  const email = normEmail_(rawEmail);
  if (!email) return { ok: false, error: 'Email không hợp lệ.' };

  const staff = getStaff_()[email];
  if (!staff) {
    return { ok: false, error: 'Email này không có trong danh sách nhân viên VGU.' };
  }

  const cache = CacheService.getScriptCache();
  const waitKey = 'otp_wait_' + email;
  if (cache.get(waitKey)) {
    return { ok: false, error: 'Mã vừa được gửi. Vui lòng đợi 1 phút rồi thử lại.' };
  }

  const code = String(Math.floor(100000 + Math.random() * 900000));
  cache.put('otp_' + email, JSON.stringify({ code: code, tries: 0 }), AUTH_CONFIG.CODE_TTL_SEC);
  cache.put(waitKey, '1', AUTH_CONFIG.RESEND_WAIT_SEC);

  MailApp.sendEmail({
    to: email,
    subject: '[' + AUTH_CONFIG.APP_NAME + '] Mã đăng nhập: ' + code,
    htmlBody:
      '<div style="font-family:Arial,sans-serif;font-size:14px;color:#0F1E36">' +
      '<p>Xin chào ' + escapeHtml_(staff.name || '') + ',</p>' +
      '<p>Mã đăng nhập ' + AUTH_CONFIG.APP_NAME + ' của bạn là:</p>' +
      '<p style="font-size:28px;font-weight:bold;letter-spacing:6px;color:#F58220">' + code + '</p>' +
      '<p>Mã có hiệu lực trong 10 phút. Nếu bạn không yêu cầu, hãy bỏ qua email này.</p>' +
      '</div>',
  });

  return { ok: true, name: staff.name || '' };
}

// ── 2. Xác minh mã → cấp token ─────────────────────────────────────────────
function verifyCode_(rawEmail, rawCode) {
  const email = normEmail_(rawEmail);
  const code = String(rawCode || '').replace(/\D/g, '');
  if (!email || code.length !== 6) return { ok: false, error: 'Mã không hợp lệ.' };

  const cache = CacheService.getScriptCache();
  const key = 'otp_' + email;
  const saved = cache.get(key);
  if (!saved) return { ok: false, error: 'Mã đã hết hạn. Vui lòng yêu cầu mã mới.' };

  const entry = JSON.parse(saved);
  if (entry.code !== code) {
    entry.tries++;
    if (entry.tries >= AUTH_CONFIG.MAX_ATTEMPTS) {
      cache.remove(key);
      return { ok: false, error: 'Nhập sai quá nhiều lần. Vui lòng yêu cầu mã mới.' };
    }
    cache.put(key, JSON.stringify(entry), AUTH_CONFIG.CODE_TTL_SEC);
    return { ok: false, error: 'Mã không đúng. Còn ' + (AUTH_CONFIG.MAX_ATTEMPTS - entry.tries) + ' lần thử.' };
  }
  cache.remove(key);

  const staff = getStaff_()[email];
  if (!staff) return { ok: false, error: 'Email không còn trong danh sách nhân viên.' };

  const exp = Date.now() + AUTH_CONFIG.SESSION_DAYS * 24 * 3600 * 1000;
  return { ok: true, token: signToken_(email, exp), email: email, name: staff.name || '', exp: exp };
}

// ── 3. Kiểm tra token ──────────────────────────────────────────────────────
function checkToken_(token) {
  const data = readToken_(token);
  if (!data) return { ok: false, error: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.' };
  // Nhân viên bị xoá khỏi danh sách → mất quyền ngay, dù token chưa hết hạn.
  const staff = getStaff_()[data.email];
  if (!staff) return { ok: false, error: 'Email không còn trong danh sách nhân viên.' };
  return { ok: true, email: data.email, name: staff.name || '', exp: data.exp };
}

// ── Token: base64url(email|exp) + "." + HMAC-SHA256 (khoá bí mật lưu trong
//    Script Properties, tự tạo lần đầu, không bao giờ rời khỏi Apps Script) ──
function getSecret_() {
  const props = PropertiesService.getScriptProperties();
  let secret = props.getProperty('AUTH_SECRET');
  if (!secret) {
    secret = Utilities.getUuid() + Utilities.getUuid();
    props.setProperty('AUTH_SECRET', secret);
  }
  return secret;
}
function b64url_(bytesOrString) {
  return Utilities.base64EncodeWebSafe(bytesOrString).replace(/=+$/, '');
}
function signToken_(email, exp) {
  const payload = b64url_(email + '|' + exp);
  const sig = b64url_(Utilities.computeHmacSha256Signature(payload, getSecret_()));
  return payload + '.' + sig;
}
function readToken_(token) {
  if (!token || typeof token !== 'string' || token.indexOf('.') < 0) return null;
  const parts = token.split('.');
  const expected = b64url_(Utilities.computeHmacSha256Signature(parts[0], getSecret_()));
  if (expected !== parts[1]) return null;
  let decoded;
  try {
    decoded = Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[0] + '==='.slice((parts[0].length + 3) % 4))).getDataAsString();
  } catch (err) { return null; }
  const idx = decoded.lastIndexOf('|');
  const email = decoded.slice(0, idx);
  const exp = Number(decoded.slice(idx + 1));
  if (!email || !exp || exp < Date.now()) return null;
  return { email: email, exp: exp };
}

// ── Đọc danh sách nhân viên (cache 10 phút) ────────────────────────────────
function getStaff_() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get('staff_map_v1');
  if (cached) return JSON.parse(cached);

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheets = [];
  const named = ss.getSheetByName(AUTH_CONFIG.STAFF_SHEET_NAME);
  if (named) sheets = [named];
  else sheets = ss.getSheets(); // không có tab "Staff" → dò mọi tab có cột email

  const map = {};
  sheets.forEach(function (sheet) {
    const data = sheet.getDataRange().getValues();
    // Tìm dòng tiêu đề: dòng đầu tiên có ô chứa chữ "email"
    let headerIdx = -1, emailCol = -1, nameCol = -1;
    for (let i = 0; i < Math.min(data.length, 15) && headerIdx < 0; i++) {
      const headers = data[i].map(authNormHeader_);
      const ec = headers.findIndex(function (h) { return h.indexOf('email') !== -1; });
      if (ec >= 0) {
        headerIdx = i; emailCol = ec;
        nameCol = headers.findIndex(function (h) {
          return h === 'staff_name' || h === 'name' || h === 'ho_ten' || h === 'ten' || h.indexOf('name') !== -1;
        });
      }
    }
    if (headerIdx < 0) return;
    for (let r = headerIdx + 1; r < data.length; r++) {
      const em = normEmail_(data[r][emailCol]);
      if (!em) continue;
      map[em] = { name: nameCol >= 0 ? String(data[r][nameCol] || '').replace(/ /g, ' ').trim() : '' };
    }
  });

  try { cache.put('staff_map_v1', JSON.stringify(map), 600); } catch (err) { /* >100KB: bỏ qua cache */ }
  return map;
}

// ── Tiện ích ───────────────────────────────────────────────────────────────
function normEmail_(v) {
  const s = String(v || '').replace(/ /g, ' ').trim().toLowerCase();
  return /^[^@\s]+@[^@\s]+\.[a-z0-9.-]+$/.test(s) ? s : '';
}
function authNormHeader_(str) {
  return String(str || '').toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}
function escapeHtml_(s) {
  return String(s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
function authJson_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// Chạy tay 1 lần trong trình soạn Apps Script để cấp quyền gửi mail và
// kiểm tra số email đọc được: chọn hàm testStaffList → Run.
function testStaffList() {
  CacheService.getScriptCache().remove('staff_map_v1');
  const map = getStaff_();
  const emails = Object.keys(map);
  console.log('Số email được phép đăng nhập: ' + emails.length);
  console.log('Ví dụ: ' + emails.slice(0, 3).join(', '));
  MailApp.getRemainingDailyQuota(); // để Apps Script xin quyền gửi mail
}
