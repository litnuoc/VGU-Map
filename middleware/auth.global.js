// middleware/auth.global.js
// Chặn mọi trang khi chưa đăng nhập → chuyển về /login (trang landing).
export default defineNuxtRouteMiddleware(async (to) => {
  if (import.meta.server) return
  const { ensureSession } = useAuth()
  const ok = await ensureSession()

  if (to.path === '/login') {
    if (!ok) return
    const r = typeof to.query.redirect === 'string' ? to.query.redirect : '/'
    // Chỉ cho chuyển hướng nội bộ (tránh open redirect sang site khác)
    return navigateTo(r.startsWith('/') && !r.startsWith('//') ? r : '/')
  }

  if (!ok) {
    return navigateTo({ path: '/login', query: to.fullPath !== '/' ? { redirect: to.fullPath } : {} })
  }
})
