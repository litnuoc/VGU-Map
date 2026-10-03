// composables/useAuth.js
// Đăng nhập bằng email nhân viên + mã OTP (xem Auth.gs trong Google Apps Script).
// Token đăng nhập được Apps Script ký (HMAC), lưu ở localStorage 30 ngày.
// Danh sách email nhân viên KHÔNG có ở phía web — chỉ Apps Script biết.
import { ref } from 'vue'

const TOKEN_KEY = 'vgu-auth-token'
const USER_KEY = 'vgu-auth-user'
const CHECKED_KEY = 'vgu-auth-checked' // sessionStorage: token đã xác minh trong tab này

const user = ref(null) // { email, name } — dùng chung toàn app

const store = {
  get(k, session = false) {
    try { return (session ? sessionStorage : localStorage).getItem(k) } catch (_) { return null }
  },
  set(k, v, session = false) {
    try { (session ? sessionStorage : localStorage).setItem(k, v) } catch (_) {}
  },
  del(k, session = false) {
    try { (session ? sessionStorage : localStorage).removeItem(k) } catch (_) {}
  },
}

// Đọc hạn dùng ghi trong token (phần trước dấu chấm = base64url("email|exp")).
function tokenExp(token) {
  try {
    const b64 = token.split('.')[0].replace(/-/g, '+').replace(/_/g, '/')
    const text = decodeURIComponent(escape(atob(b64 + '==='.slice((b64.length + 3) % 4))))
    return Number(text.slice(text.lastIndexOf('|') + 1)) || 0
  } catch (_) { return 0 }
}

export function useAuth() {
  const config = useRuntimeConfig()
  const authUrl = config.public.authUrl || ''

  async function call(body) {
    if (!authUrl) throw new Error('Chưa cấu hình địa chỉ máy chủ đăng nhập (NUXT_PUBLIC_AUTH_URL).')
    // text/plain → "simple request", không bị CORS preflight với Apps Script.
    const res = await fetch(authUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error(`Máy chủ đăng nhập trả lỗi HTTP ${res.status}.`)
    return res.json()
  }

  function clear() {
    store.del(TOKEN_KEY); store.del(USER_KEY); store.del(CHECKED_KEY, true)
    user.value = null
  }

  async function requestCode(email) {
    return call({ action: 'requestCode', email })
  }

  async function verify(email, code) {
    const r = await call({ action: 'verify', email, code })
    if (r.ok) {
      store.set(TOKEN_KEY, r.token)
      store.set(USER_KEY, JSON.stringify({ email: r.email, name: r.name }))
      store.set(CHECKED_KEY, r.token, true)
      user.value = { email: r.email, name: r.name }
    }
    return r
  }

  // true nếu đang có phiên hợp lệ. Mỗi tab chỉ hỏi Apps Script 1 lần.
  async function ensureSession() {
    const token = store.get(TOKEN_KEY)
    if (!token || tokenExp(token) < Date.now()) { clear(); return false }

    if (!user.value) {
      try { user.value = JSON.parse(store.get(USER_KEY) || 'null') } catch (_) {}
    }
    if (store.get(CHECKED_KEY, true) === token) return true

    try {
      const r = await call({ action: 'check', token })
      if (!r.ok) { clear(); return false }
      user.value = { email: r.email, name: r.name }
      store.set(USER_KEY, JSON.stringify(user.value))
      store.set(CHECKED_KEY, token, true)
      return true
    } catch (_) {
      // Mất mạng / máy chủ lỗi: cho dùng tiếp nếu token chưa hết hạn (PWA offline).
      return !!user.value
    }
  }

  function logout() {
    clear()
    return navigateTo('/login')
  }

  return { user, requestCode, verify, ensureSession, logout, isConfigured: !!authUrl }
}
