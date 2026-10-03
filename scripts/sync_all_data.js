#!/usr/bin/env node
// scripts/sync_all_data.js
// -----------------------------------------------------------------------------
// Nguồn dữ liệu DUY NHẤT cho pipeline cập nhật tự động.
//
// Luồng:
//   Google Sheet  --(Apps Script /exec)-->  JSON
//        -> public/data/info_data.json   (chỉ ghi khi dữ liệu THỰC SỰ đổi)
//        -> content/Rooms/<room>.md      (regenerate cho các phòng có trong sheet)
//
// Yêu cầu: biến môi trường APPS_SCRIPT_URL trỏ tới Web App URL (/exec) của Code.gs.
// Chạy trong CI (Node 20 có sẵn global fetch). Thoát mã != 0 nếu fetch thất bại
// để GitHub Actions báo đỏ thay vì "xanh giả".
// -----------------------------------------------------------------------------
'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT       = path.resolve(__dirname, '..');
const INFO_PATH  = path.join(ROOT, 'public', 'data', 'info_data.json');
const DRIVE_PATH = path.join(ROOT, 'public', 'data', 'drive_data.json');
const ROOMS_DIR  = path.join(ROOT, 'content', 'Rooms');

// ─── Tunables ────────────────────────────────────────────────────────────────
//
// FETCH_TIMEOUT_MS: GAS cold-start can hold the TCP connection open for 30-45 s
//   before sending the first byte. 25 s was too aggressive and caused spurious
//   AbortErrors. 50 s gives the instance time to boot without letting truly
//   hung requests block the CI job indefinitely.
const FETCH_TIMEOUT_MS = 50_000;   // 50 s

// MAX_RETRIES: total attempts (1 initial + 4 retries). Five attempts with
//   exponential backoff covers: 1 cold-start miss + 1 transient 5xx + slack.
const MAX_RETRIES      = 5;

// RETRY_BASE_MS: first delay. Sequence (without jitter): 4 s → 8 s → 16 s → 32 s.
//   Total worst-case blocking time ≈ 60 s of delay + 5×50 s of I/O ≈ 4.3 min —
//   well within the Actions job timeout of 10 min.
const RETRY_BASE_MS    = 4_000;

// JITTER_MS: random milliseconds added to each delay to de-synchronise
//   concurrent workflow runs and avoid a thundering-herd effect on GAS.
const JITTER_MS        = 2_000;

// HTTP status codes that warrant a retry (transient by nature).
// 408 Request Timeout, 429 Too Many Requests, 5xx server errors.
// 4xx that are NOT in this set are configuration bugs → fail immediately.
const RETRYABLE_HTTP_CODES = new Set([408, 429, 500, 502, 503, 504]);

// ─── Env ─────────────────────────────────────────────────────────────────────
const APPS_SCRIPT_URL = (process.env.APPS_SCRIPT_URL || '').trim();

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function log(...args)  { console.log('[sync]', ...args); }
function warn(...args) { console.warn('[sync] ⚠', ...args); }

/** Milliseconds to sleep. */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Random jitter in [0, JITTER_MS) to spread out concurrent retries. */
const jitter = () => Math.floor(Math.random() * JITTER_MS);

/**
 * Print a clear, actionable error and exit 1.
 * Never leaks the full secret URL — shows only the safe prefix.
 */
function fail(msg, hint = '') {
  console.error('\n[sync] ✖ ' + msg);
  if (hint) console.error('[sync]   →', hint);
  console.error('');
  process.exit(1);
}

/**
 * Dump the full forensic context of a failed HTTP exchange to stderr, then exit.
 *
 * Directive 3: "the script must console.error the exact HTTP status code,
 * headers, and the raw response text before exiting with code 1."
 *
 * @param {Response|null} res        - The last fetch Response object (may be null on network error).
 * @param {string|null}   rawBody    - The response body already read as text (may be null).
 * @param {Error|null}    err        - The last JavaScript Error (network / abort / parse).
 * @param {number}        attempts   - Total attempts made.
 */
function dumpFailureAndExit(res, rawBody, err, attempts) {
  const divider = '─'.repeat(60);

  console.error(`\n[sync] ✖ Tất cả ${attempts} lần thử đều thất bại.`);
  console.error(`[sync]   ${divider}`);

  // ── Last JS-level error ──────────────────────────────────────────────────
  if (err) {
    console.error(`[sync]   Error type    : ${err.name}`);
    console.error(`[sync]   Error message : ${err.message}`);
    if (err.cause) {
      console.error(`[sync]   Error cause   : ${err.cause}`);
    }
  }

  // ── Last HTTP response meta ──────────────────────────────────────────────
  if (res) {
    console.error(`[sync]   HTTP Status   : ${res.status} ${res.statusText}`);
    console.error(`[sync]   Response URL  : ${res.url}`);

    // Dump ALL response headers — they often contain rate-limit context,
    // Retry-After values, Google error codes, or CORS hints.
    console.error(`[sync]   Response Headers:`);
    try {
      for (const [key, value] of res.headers.entries()) {
        console.error(`[sync]     ${key}: ${value}`);
      }
    } catch {
      console.error(`[sync]     (headers not iterable)`);
    }
  } else {
    console.error(`[sync]   HTTP Response : none (request never completed)`);
  }

  // ── Raw response body ────────────────────────────────────────────────────
  // Cap at 2 000 chars: enough to see an HTML login page header, a GAS error
  // JSON, or a truncated 502 proxy message — without flooding the CI log.
  if (rawBody !== null && rawBody !== undefined) {
    const preview = rawBody.length > 2_000
      ? rawBody.slice(0, 2_000) + `\n… [truncated ${rawBody.length - 2_000} chars]`
      : rawBody;
    console.error(`[sync]   Raw Response Body (${rawBody.length} chars):`);
    console.error(preview);
  } else {
    console.error(`[sync]   Raw Response Body : (not captured)`);
  }

  console.error(`[sync]   ${divider}`);
  console.error(`[sync]   Hints:`);
  console.error(`[sync]     • GAS cold-start timeout? Increase FETCH_TIMEOUT_MS.`);
  console.error(`[sync]     • Persistent 429? GAS quota exceeded — reduce cron frequency.`);
  console.error(`[sync]     • HTML body? Web App is not public ("Anyone" access required).`);
  console.error(`[sync]     • Network error? Check GitHub Actions runner connectivity.\n`);

  process.exit(1);
}

function readJsonSafe(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return fallback; }
}

function yamlSafe(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function driveImageUrl(fileId) {
  return fileId ? `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000` : '';
}

const STATUS_MAP = {
  'Đang sử dụng': 'operational',
  'Chưa sử dụng': 'vacant',
  'Chưa cập nhật': 'unknown',
};

function roomIdFrom(roomNumber) {
  return String(roomNumber).replace(/\s+/g, '-').toUpperCase();
}

function floorFrom(roomId) {
  const m = roomId.match(/(?:AD-|B\d-)?\\d{0,2}(\d)\d{2}/)
         || roomId.match(/^(\d)\./);
  return m ? parseInt(m[1], 10) : 1;
}

// Canonical form for change-detection: strips last_updated so a re-fetch of
// identical data never triggers an unnecessary commit + deploy.
function canonical(rooms) {
  const cleaned = rooms
    .map(r => ({
      sheet_source:      r.sheet_source      ?? '',
      room_number:       r.room_number       ?? '',
      heading_1:         r.heading_1         ?? '',
      heading_2:         r.heading_2         ?? '',
      department:        r.department        ?? '',
      fm_room_function:  r.fm_room_function  ?? '',
      fm_room_type:      r.fm_room_type      ?? '',
      area:              r.area              ?? '',
      unbounded_height:  r.unbounded_height  ?? '',
      capacity:          r.capacity          ?? '',
      status:            r.status            ?? '',
      occupant_display:  r.occupant_display  ?? '',
    }))
    .sort((a, b) => a.room_number.localeCompare(b.room_number));
  return JSON.stringify(cleaned);
}

// ─────────────────────────────────────────────────────────────────────────────
// URL pre-flight validation
// ─────────────────────────────────────────────────────────────────────────────
function validateUrl(url) {
  if (!url) {
    fail(
      'Thiếu biến môi trường APPS_SCRIPT_URL.',
      'GitHub repo → Settings → Secrets and variables → Actions → Variables tab\n' +
      '  → New repository variable → Name: APPS_SCRIPT_URL\n' +
      '  → Value: https://script.google.com/macros/s/<DEPLOYMENT_ID>/exec'
    );
  }

  let parsed;
  try { parsed = new URL(url); }
  catch {
    fail(
      `APPS_SCRIPT_URL không phải URL hợp lệ: "${url}"`,
      'Giá trị phải bắt đầu bằng https://script.google.com/macros/s/…/exec'
    );
  }

  if (!parsed.hostname.endsWith('script.google.com')) {
    warn(`URL không phải script.google.com — hostname: ${parsed.hostname}`);
  }

  if (url.includes('/macros/s/') && url.endsWith('/dev')) {
    fail(
      'URL kết thúc bằng /dev thay vì /exec.',
      'URL /dev yêu cầu phiên đăng nhập Google — không hoạt động trong CI.\n' +
      '  Thay /dev bằng /exec và cập nhật biến APPS_SCRIPT_URL.'
    );
  }

  if (url.includes('/d/') && url.includes('/edit')) {
    fail(
      'Đây là URL script editor, không phải Web App URL.',
      'Trong Apps Script: Deploy → Manage deployments → copy URL kết thúc bằng /exec'
    );
  }

  if (!url.endsWith('/exec') && !url.includes('/exec?')) {
    warn(
      'APPS_SCRIPT_URL không kết thúc bằng /exec — có thể gây lỗi 404.\n' +
      '  URL đúng: https://script.google.com/macros/s/<DEPLOYMENT_ID>/exec'
    );
  }

  // Log safe prefix only — never log the full URL (it contains the deployment ID)
  const safePart = url.replace(/(\/macros\/s\/)([^/]+)(\/.*)/, '$1***$3');
  log(`URL: ${safePart}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Network layer
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Single fetch attempt with an AbortController-based hard timeout.
 *
 * Directive 2: "Explicitly set a generous timeout (e.g., 30 to 60 seconds)."
 * FETCH_TIMEOUT_MS is set to 50 000 ms (50 s) — see Tunables above.
 *
 * @returns {Promise<Response>}
 * @throws  {Error} with name 'AbortError' on timeout, or a TypeError on DNS/TCP failure.
 */
async function fetchOnce(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal:   controller.signal,
      headers:  { Accept: 'application/json, text/plain, */*' },
    });
    return res;
  } catch (err) {
    if (err.name === 'AbortError') {
      throw Object.assign(
        new Error(`Request timed out after ${FETCH_TIMEOUT_MS / 1000} s (GAS cold-start?)`),
        { name: 'AbortError' }
      );
    }
    throw err; // re-throw DNS / TCP / TLS errors verbatim
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fetch with exponential-backoff retry and full forensic logging on exhaustion.
 *
 * Directive 1: "Wrap the fetch call in a robust retry loop (up to 3–5 attempts
 *              with increasing delays) to gracefully handle Google's transient errors."
 * Directive 3: "console.error the exact HTTP status code, headers, and the raw
 *              response text before exiting with code 1."
 *
 * Retry policy:
 *   • RETRYABLE_HTTP_CODES (408, 429, 500, 502, 503, 504) → retry after backoff.
 *   • 429 additionally inspects the Retry-After header and respects it.
 *   • Network / timeout errors → retry after backoff.
 *   • 401, 403, 404, other 4xx → configuration bug, fail immediately (no retry).
 *
 * @returns {Promise<Response>} A 2xx Response whose body has NOT been consumed.
 */
async function fetchWithRetry(url) {
  /** Last JavaScript Error (network/abort). Updated on every failed attempt. */
  let lastErr = null;

  /**
   * Last HTTP Response object. Kept so dumpFailureAndExit can read its status,
   * URL, and headers even after the body has been consumed.
   * NOTE: The body of this object IS consumed (read into lastRawBody) so it
   *       must NOT be used for JSON parsing — only for metadata.
   */
  let lastResponse = null;

  /**
   * Raw response body captured on retryable HTTP errors (5xx / 429).
   * For successful 2xx paths the body is left unconsumed for the caller.
   */
  let lastRawBody  = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    log(`Lần thử ${attempt}/${MAX_RETRIES} (timeout: ${FETCH_TIMEOUT_MS / 1000}s)…`);

    try {
      const res = await fetchOnce(url);
      lastResponse = res; // keep reference (body not yet consumed)

      // ── Permanent 4xx: configuration bugs — never retry ─────────────────
      if (res.status === 404) {
        fail(
          `Apps Script trả HTTP 404 Not Found.`,
          'Nguyên nhân thường gặp và cách sửa:\n\n' +
          '  1. URL sai hoặc deployment đã bị xoá.\n' +
          '     → Apps Script → Deploy → Manage deployments\n' +
          '       → Chọn deployment đang active → Copy Web App URL → Cập nhật APPS_SCRIPT_URL\n\n' +
          '  2. Web App được Deploy với "Who has access: Only myself".\n' +
          '     → GitHub Actions không có phiên Google → Google trả 404/redirect.\n' +
          '     FIX: Apps Script → Deploy → Manage deployments → Edit (bút chì)\n' +
          '       → Who has access → chọn "Anyone" → Deploy → copy URL mới.\n\n' +
          '  3. URL kết thúc bằng /dev thay vì /exec.\n' +
          '     → Đổi /dev → /exec trong biến APPS_SCRIPT_URL.\n\n' +
          '  4. Script bị giới hạn bởi Google Workspace domain policy.\n' +
          '     → Liên hệ Google Workspace Admin để mở "Run as anyone".'
        );
      }

      if (res.status === 401 || res.status === 403) {
        fail(
          `Apps Script trả HTTP ${res.status} — lỗi xác thực/phân quyền.`,
          '→ Kiểm tra "Who has access" trong Manage deployments — phải là "Anyone".'
        );
      }

      // ── HTTP 429 Too Many Requests: rate-limited — retry with backoff ────
      //
      // GAS enforces per-user and per-script quotas. A 429 is transient and
      // *must* be retried, not failed immediately. Respect Retry-After when
      // Google provides it.
      if (res.status === 429) {
        lastRawBody = await res.text().catch(() => '(body unreadable)');
        lastErr     = new Error(`HTTP 429 Too Many Requests`);

        const retryAfterHeader = res.headers.get('retry-after');
        let delayMs;
        if (retryAfterHeader) {
          const seconds = parseInt(retryAfterHeader, 10);
          delayMs = (isNaN(seconds) ? RETRY_BASE_MS : seconds * 1_000) + jitter();
          warn(`HTTP 429 — Retry-After: ${retryAfterHeader}s → chờ ${Math.round(delayMs / 1_000)}s…`);
        } else {
          delayMs = RETRY_BASE_MS * Math.pow(2, attempt - 1) + jitter();
          warn(`HTTP 429 (no Retry-After header) → backoff ${Math.round(delayMs / 1_000)}s…`);
        }

        if (attempt < MAX_RETRIES) {
          await sleep(delayMs);
          continue; // next attempt
        }
        break; // exhausted
      }

      // ── 5xx Transient server errors: retry with exponential backoff ──────
      //
      // 500 Internal Server Error  — GAS script crash
      // 502 Bad Gateway            — proxy / load balancer hiccup
      // 503 Service Unavailable    — GAS overloaded
      // 504 Gateway Timeout        — GAS took too long to respond to the proxy
      if (RETRYABLE_HTTP_CODES.has(res.status)) {
        // Consume the body NOW so we can log it on final failure.
        // The response object is then only useful for its metadata.
        lastRawBody = await res.text().catch(() => '(body unreadable)');
        lastErr     = new Error(`HTTP ${res.status} ${res.statusText}`);

        warn(`HTTP ${res.status} ${res.statusText} — lỗi tạm thời, sẽ thử lại.`);
        if (lastRawBody) {
          // Log a short preview immediately so each attempt's error is visible
          // in the CI log stream, not just the final dump.
          warn(`  Body preview: ${lastRawBody.slice(0, 200)}`);
        }

        if (attempt < MAX_RETRIES) {
          const delayMs = RETRY_BASE_MS * Math.pow(2, attempt - 1) + jitter();
          log(`Chờ ${Math.round(delayMs / 1_000)}s trước khi thử lại…`);
          await sleep(delayMs);
          continue; // next attempt
        }
        break; // exhausted — fall through to dumpFailureAndExit
      }

      // ── Other non-ok, non-retryable 4xx ─────────────────────────────────
      if (!res.ok) {
        lastRawBody = await res.text().catch(() => '(body unreadable)');
        fail(
          `Apps Script trả HTTP ${res.status} ${res.statusText}.`,
          `Body: ${lastRawBody.slice(0, 500)}`
        );
      }

      // ── 2xx Success ───────────────────────────────────────────────────────
      // Detect an HTML login-redirect masquerading as 200 OK.
      // GAS returns 200 + HTML when "Who has access" is not set to "Anyone".
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json') && !contentType.includes('text/plain')) {
        const body = await res.text();
        const isHtml = body.trimStart().startsWith('<!') || body.trimStart().toLowerCase().startsWith('<html');
        if (isHtml) {
          fail(
            `Apps Script trả về trang HTML (${res.status}) thay vì JSON.`,
            'Đây là trang đăng nhập Google — Web App chưa được mở public.\n' +
            '  FIX: Apps Script → Deploy → Manage deployments → Edit\n' +
            '    → Who has access → "Anyone" → Re-deploy\n' +
            '    → Copy URL mới và cập nhật APPS_SCRIPT_URL.\n' +
            '  Content-Type nhận được: ' + contentType
          );
        }
        warn(`Content-Type không phải JSON: ${contentType} — vẫn thử parse.`);
        // Wrap the already-read text in a synthetic object so the caller can
        // read it uniformly via res._text.
        return { ok: true, status: res.status, statusText: res.statusText,
                 headers: res.headers, url: res.url, _text: body };
      }

      // Clean 2xx with JSON content-type — return without consuming the body.
      return res;

    } catch (err) {
      // Network-level errors (DNS failure, TCP reset, AbortError from timeout).
      lastErr = err;
      warn(`Lần thử ${attempt}/${MAX_RETRIES} thất bại [${err.name}]: ${err.message}`);

      if (attempt < MAX_RETRIES) {
        const delayMs = RETRY_BASE_MS * Math.pow(2, attempt - 1) + jitter();
        log(`Chờ ${Math.round(delayMs / 1_000)}s trước khi thử lại…`);
        await sleep(delayMs);
        // continue to next iteration (implicit at end of for loop)
      }
    }
  }

  // ── All attempts exhausted ────────────────────────────────────────────────
  // Directive 3: dump HTTP status, ALL headers, raw body, then exit 1.
  dumpFailureAndExit(lastResponse, lastRawBody, lastErr, MAX_RETRIES);
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Fetch dữ liệu từ Apps Script
// ─────────────────────────────────────────────────────────────────────────────
async function fetchRooms() {
  validateUrl(APPS_SCRIPT_URL);
  log('Đang gọi Apps Script…');

  const res = await fetchWithRetry(APPS_SCRIPT_URL);

  let payload;
  try {
    // Handle the synthetic response from the HTML-detection / non-JSON path
    const raw = res._text !== undefined ? res._text : await res.text();
    payload = JSON.parse(raw);
  } catch (e) {
    fail(
      `Phản hồi không phải JSON hợp lệ: ${e.message}`,
      'Kiểm tra Code.gs: hàm doGet() phải return ContentService\n' +
      '  .createTextOutput(JSON.stringify(data))\n' +
      '  .setMimeType(ContentService.MimeType.JSON)'
    );
  }

  if (payload.status && payload.status !== 'success') {
    fail(`Apps Script báo lỗi: ${payload.message || 'unknown'}`);
  }

  const rooms = Array.isArray(payload) ? payload : (payload.data || []);
  if (!Array.isArray(rooms) || rooms.length === 0) {
    fail('Apps Script trả về 0 phòng — dừng để tránh ghi đè dữ liệu rỗng.');
  }

  log(`✔ Nhận ${rooms.length} phòng từ Apps Script.`);
  return rooms;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Regenerate content/Rooms/*.md (upsert, KHÔNG xoá file cũ ngoài sheet)
// ─────────────────────────────────────────────────────────────────────────────
function regenerateRooms(rooms, driveData) {
  fs.mkdirSync(ROOMS_DIR, { recursive: true });
  let images = 0;
  const counts = { operational: 0, vacant: 0, unknown: 0 };

  for (const room of rooms) {
    const roomId = roomIdFrom(room.room_number);
    if (!roomId) continue;

    const floor  = floorFrom(roomId);
    const status = STATUS_MAP[room.status] || 'unknown';
    counts[status] = (counts[status] || 0) + 1;

    const imageUrl = driveImageUrl(driveData[roomId]);
    if (imageUrl) images++;

    const name = yamlSafe(
      (room.heading_1 || 'Unknown') + (room.heading_2 ? ' - ' + room.heading_2 : '')
    );

    const md =
`---
room_id: "${roomId}"
name: "${name}"
building_id: "${yamlSafe(room.sheet_source || 'UNKNOWN')}"
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
image: "${imageUrl}"
vr_panorama: ""
---

Trang thông tin không gian kiến trúc cho khu vực **${yamlSafe(room.heading_1)}**.
Hệ thống cảm biến và dữ liệu telemetry đang được đồng bộ.
`;
    fs.writeFileSync(path.join(ROOMS_DIR, `${roomId}.md`), md);
  }

  log(`Đã regenerate ${rooms.length} file Rooms/. Trạng thái:`, counts,
      `| ${images} phòng có ảnh Drive.`);
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Main
// ─────────────────────────────────────────────────────────────────────────────
(async () => {
  log('─── Bắt đầu đồng bộ dữ liệu ───────────────────────────────────────────');
  log(`Node ${process.version} | ${new Date().toISOString()}`);
  log(`Config: timeout=${FETCH_TIMEOUT_MS / 1_000}s | retries=${MAX_RETRIES} | base-delay=${RETRY_BASE_MS / 1_000}s | jitter=${JITTER_MS / 1_000}s`);

  const rooms     = await fetchRooms();
  const driveData = readJsonSafe(DRIVE_PATH, {});

  // So sánh với dữ liệu hiện có: chỉ ghi khi nội dung thật sự đổi
  const existing      = readJsonSafe(INFO_PATH, null);
  const existingRooms = existing && Array.isArray(existing.data) ? existing.data : [];

  if (existing && canonical(existingRooms) === canonical(rooms)) {
    log('✅ Dữ liệu không đổi — bỏ qua ghi file (workflow sẽ không commit/deploy).');
    log('─── Hoàn tất (no-op) ───────────────────────────────────────────────────');
    process.exit(0);
  }

  const payload = {
    status:       'success',
    total_rooms:  rooms.length,
    last_updated: new Date().toISOString(),
    data:         rooms,
  };
  fs.mkdirSync(path.dirname(INFO_PATH), { recursive: true });
  fs.writeFileSync(INFO_PATH, JSON.stringify(payload, null, 2));
  log('Đã ghi', path.relative(ROOT, INFO_PATH));

  regenerateRooms(rooms, driveData);

  log('✅ Có thay đổi — workflow sẽ commit & kích hoạt deploy.');
  log('─── Hoàn tất ───────────────────────────────────────────────────────────');
})();
