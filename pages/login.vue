<!-- pages/login.vue
     Trang landing + đăng nhập. Chỉ email có trong danh sách nhân viên (tab "Staff"
     trên Google Sheet) mới nhận được mã. Không cần đăng ký: lần đầu đăng nhập
     cũng chính là "đăng ký". Kiểm tra email do Auth.gs (Apps Script) đảm nhận. -->
<template>
  <main class="login-page">
    <div class="grid-bg" aria-hidden="true"></div>
    <div class="glow" aria-hidden="true"></div>

    <section class="hero">
      <div class="brand">
        <span class="brand-badge"><img src="/VGU-Logo.png" alt="" /></span>
        <span class="brand-text">
          <span class="brand-title"><span class="accent">VGU</span> MAP</span>
          <span class="brand-sub">DIGITAL MAP V3.1</span>
        </span>
      </div>

      <h1 class="hero-title">
        Bản đồ số<br />khuôn viên <span class="accent">Đại học <span class="nowrap">Việt Đức</span></span>
      </h1>
      <p class="hero-lead">
        Tra cứu toà nhà, từng tầng, từng phòng và thiết bị phòng thí nghiệm
        trên bản đồ 3D tương tác — dành riêng cho cán bộ, nhân viên VGU.
      </p>

      <ul class="features">
        <li>
          <span class="f-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6"/></svg>
          </span>
          <span><b>6 toà nhà</b> · hơn 1.000 phòng theo từng tầng</span>
        </li>
        <li>
          <span class="f-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
          </span>
          <span><b>Tìm phòng</b> và lọc theo chức năng</span>
        </li>
        <li>
          <span class="f-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2 3 7l9 5 9-5-9-5ZM3 17l9 5 9-5M3 12l9 5 9-5"/></svg>
          </span>
          <span><b>Mô hình 3D</b> thiết bị phòng lab</span>
        </li>
      </ul>
    </section>

    <section class="card" aria-labelledby="login-title">
      <div class="steps" aria-hidden="true">
        <span :class="{ on: step >= 1 }">01 · EMAIL</span>
        <span class="step-line" :class="{ on: step >= 2 }"></span>
        <span :class="{ on: step >= 2 }">02 · MÃ XÁC NHẬN</span>
      </div>

      <h2 id="login-title" class="card-title">
        {{ step === 1 ? 'Đăng nhập' : 'Nhập mã xác nhận' }}
      </h2>
      <p class="card-sub" v-if="step === 1">
        Dùng email công việc đã đăng ký trong danh sách nhân viên VGU.
        Lần đầu sử dụng? Không cần đăng ký — chỉ cần nhập email.
      </p>
      <p class="card-sub" v-else>
        Mã 6 số đã được gửi tới <b>{{ email }}</b>{{ staffName ? ` (${staffName})` : '' }}.
        Mã có hiệu lực trong 10 phút.
      </p>

      <!-- Bước 1: email -->
      <form v-if="step === 1" class="form" @submit.prevent="sendCode" novalidate>
        <label class="field-label" for="email">Email nhân viên</label>
        <input
          id="email"
          ref="emailInput"
          v-model.trim="email"
          type="email"
          class="field"
          placeholder="ten.ho@vgu.edu.vn"
          autocomplete="email"
          inputmode="email"
          :disabled="busy"
          required
        />
        <button class="btn-primary" type="submit" :disabled="busy || !email">
          <span v-if="busy" class="spinner" aria-hidden="true"></span>
          {{ busy ? 'Đang kiểm tra…' : 'Gửi mã đăng nhập' }}
        </button>
      </form>

      <!-- Bước 2: mã OTP -->
      <form v-else class="form" @submit.prevent="checkCode" novalidate>
        <label class="field-label" for="code">Mã xác nhận</label>
        <input
          id="code"
          ref="codeInput"
          v-model="code"
          type="text"
          class="field field-code"
          placeholder="••••••"
          inputmode="numeric"
          autocomplete="one-time-code"
          maxlength="6"
          :disabled="busy"
          @input="code = code.replace(/\D/g, '').slice(0, 6)"
          required
        />
        <button class="btn-primary" type="submit" :disabled="busy || code.length !== 6">
          <span v-if="busy" class="spinner" aria-hidden="true"></span>
          {{ busy ? 'Đang xác nhận…' : 'Đăng nhập' }}
        </button>
        <div class="row-links">
          <button type="button" class="link" @click="backToEmail" :disabled="busy">← Đổi email</button>
          <button type="button" class="link" @click="sendCode" :disabled="busy || cooldown > 0">
            {{ cooldown > 0 ? `Gửi lại mã sau ${cooldown}s` : 'Gửi lại mã' }}
          </button>
        </div>
      </form>

      <p v-if="error" class="msg msg-error" role="alert">{{ error }}</p>
      <p v-if="!isConfigured" class="msg msg-error" role="alert">
        Trang chưa được cấu hình máy chủ đăng nhập. Vui lòng liên hệ quản trị viên.
      </p>

      <p class="card-foot">
        Không đăng nhập được? Liên hệ phòng FM để được thêm email vào danh sách nhân viên.
      </p>
    </section>
  </main>
</template>

<script setup>
import { ref, nextTick, onMounted, onBeforeUnmount } from 'vue'

definePageMeta({ layout: false })
useHead({ title: 'Đăng nhập · VGU Map' })

const route = useRoute()
const { requestCode, verify, isConfigured } = useAuth()

const step = ref(1)
const email = ref('')
const code = ref('')
const staffName = ref('')
const busy = ref(false)
const error = ref('')
const cooldown = ref(0)
const emailInput = ref(null)
const codeInput = ref(null)
let timer = null

function startCooldown() {
  cooldown.value = 60
  clearInterval(timer)
  timer = setInterval(() => {
    cooldown.value--
    if (cooldown.value <= 0) clearInterval(timer)
  }, 1000)
}

async function sendCode() {
  error.value = ''
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.value)) {
    error.value = 'Vui lòng nhập đúng định dạng email.'
    return
  }
  busy.value = true
  try {
    const r = await requestCode(email.value.toLowerCase())
    if (!r.ok) { error.value = r.error || 'Không gửi được mã.'; return }
    staffName.value = r.name || ''
    step.value = 2
    code.value = ''
    startCooldown()
    await nextTick()
    codeInput.value?.focus()
  } catch (e) {
    error.value = e.message || 'Không kết nối được máy chủ đăng nhập.'
  } finally {
    busy.value = false
  }
}

async function checkCode() {
  error.value = ''
  busy.value = true
  try {
    const r = await verify(email.value.toLowerCase(), code.value)
    if (!r.ok) { error.value = r.error || 'Mã không đúng.'; code.value = ''; return }
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/'
    await navigateTo(redirect.startsWith('/') && !redirect.startsWith('//') ? redirect : '/')
  } catch (e) {
    error.value = e.message || 'Không kết nối được máy chủ đăng nhập.'
  } finally {
    busy.value = false
  }
}

async function backToEmail() {
  step.value = 1
  error.value = ''
  code.value = ''
  await nextTick()
  emailInput.value?.focus()
}

onMounted(() => emailInput.value?.focus())
onBeforeUnmount(() => clearInterval(timer))
</script>

<style scoped>
.login-page {
  --navy: #0F1E36;
  --navy-2: #002554;
  --accent: #F58220;
  --ink: #FFFFFF;
  --ink-soft: #B3BFCD;
  --ink-dim: #6B7FA0;
  --line: rgba(255, 255, 255, 0.10);

  position: fixed; inset: 0;
  overflow-y: auto;
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(320px, 440px);
  align-items: center;
  gap: 64px;
  padding: 48px clamp(20px, 6vw, 96px);
  background: radial-gradient(1200px 700px at 15% 10%, #0b2a57 0%, #05101f 60%, #030a14 100%);
  color: var(--ink);
  font-family: 'Be Vietnam Pro', sans-serif;
}

.grid-bg {
  position: fixed; inset: 0; pointer-events: none;
  background-image:
    linear-gradient(rgba(245, 130, 32, 0.07) 1px, transparent 1px),
    linear-gradient(90deg, rgba(245, 130, 32, 0.07) 1px, transparent 1px);
  background-size: 48px 48px;
  mask-image: radial-gradient(circle at 30% 40%, #000 0%, transparent 70%);
  -webkit-mask-image: radial-gradient(circle at 30% 40%, #000 0%, transparent 70%);
}
.glow {
  position: fixed; width: 520px; height: 520px; right: -120px; bottom: -160px;
  border-radius: 50%; pointer-events: none;
  background: radial-gradient(circle, rgba(245, 130, 32, 0.22), transparent 65%);
  filter: blur(10px);
}

/* ── Hero ── */
.hero { position: relative; z-index: 1; max-width: 640px; }
.brand { display: flex; align-items: center; gap: 12px; margin-bottom: 48px; }
.brand-badge {
  width: 44px; height: 44px; border-radius: 10px; background: var(--accent);
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 0 24px rgba(245, 130, 32, 0.45);
}
.brand-badge img { width: 30px; height: auto; }
.brand-text { display: flex; flex-direction: column; line-height: 1.1; }
.brand-title { font-weight: 800; font-size: 20px; letter-spacing: 0.5px; }
.brand-sub { font-family: 'Space Mono', monospace; font-size: 11px; color: #00ffcc; letter-spacing: 1.5px; margin-top: 3px; }
.accent { color: var(--accent); }
.nowrap { white-space: nowrap; }

.hero-title {
  font-size: clamp(32px, 4.4vw, 56px); line-height: 1.12; font-weight: 800;
  letter-spacing: -0.5px; margin: 0 0 20px;
}
.hero-lead { font-size: 17px; line-height: 1.6; color: var(--ink-soft); margin: 0 0 36px; max-width: 520px; }

.features { list-style: none; padding: 0; margin: 0; display: grid; gap: 14px; }
.features li { display: flex; align-items: center; gap: 14px; color: var(--ink-soft); font-size: 15px; }
.features b { color: var(--ink); font-weight: 600; }
.f-icon {
  width: 38px; height: 38px; flex-shrink: 0; border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
  border: 1px solid rgba(245, 130, 32, 0.35); background: rgba(245, 130, 32, 0.08); color: var(--accent);
}
.f-icon svg { width: 18px; height: 18px; }

/* ── Card ── */
.card {
  position: relative; z-index: 1;
  background: rgba(15, 30, 54, 0.88);
  border: 1px solid rgba(245, 130, 32, 0.28);
  border-radius: 16px;
  padding: 32px 30px 26px;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(12px);
}
.steps {
  display: flex; align-items: center; gap: 10px; margin-bottom: 22px;
  font-family: 'Space Mono', monospace; font-size: 10.5px; letter-spacing: 1px; color: var(--ink-dim);
}
.steps .on { color: var(--accent); }
.step-line { flex: 1; height: 1px; background: var(--line); }
.step-line.on { background: var(--accent); }

.card-title { font-size: 26px; font-weight: 700; margin: 0 0 8px; }
.card-sub { font-size: 14px; line-height: 1.6; color: var(--ink-soft); margin: 0 0 22px; }
.card-sub b { color: var(--ink); font-weight: 600; word-break: break-all; }

.form { display: grid; gap: 12px; }
.field-label { font-size: 12px; font-weight: 600; color: var(--ink-soft); letter-spacing: 0.3px; }
.field {
  width: 100%; height: 48px; padding: 0 14px; box-sizing: border-box;
  border-radius: 10px; border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(0, 0, 0, 0.28); color: var(--ink);
  font-family: inherit; font-size: 15px; outline: none;
  transition: border-color 0.2s, box-shadow 0.2s;
}
.field::placeholder { color: var(--ink-dim); }
.field:focus { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(245, 130, 32, 0.2); }
.field-code {
  font-family: 'Space Mono', monospace; font-size: 24px; letter-spacing: 12px; text-align: center;
}

.btn-primary {
  height: 48px; margin-top: 4px; border: none; border-radius: 10px; cursor: pointer;
  background: var(--accent); color: #fff; font-family: inherit; font-size: 15px; font-weight: 700;
  display: flex; align-items: center; justify-content: center; gap: 10px;
  box-shadow: 0 8px 22px rgba(245, 130, 32, 0.35);
  transition: transform 0.15s, box-shadow 0.2s, opacity 0.2s;
}
.btn-primary:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 10px 28px rgba(245, 130, 32, 0.5); }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; box-shadow: none; }

.row-links { display: flex; justify-content: space-between; margin-top: 2px; }
.link {
  background: none; border: none; padding: 4px 0; cursor: pointer;
  color: var(--ink-soft); font-family: inherit; font-size: 13px;
}
.link:hover:not(:disabled) { color: var(--accent); }
.link:disabled { opacity: 0.45; cursor: default; }

.msg { margin: 16px 0 0; padding: 10px 12px; border-radius: 8px; font-size: 13px; line-height: 1.5; }
.msg-error { background: rgba(239, 68, 68, 0.12); border: 1px solid rgba(239, 68, 68, 0.4); color: #fca5a5; }

.card-foot {
  margin: 22px 0 0; padding-top: 16px; border-top: 1px solid var(--line);
  font-size: 12px; line-height: 1.6; color: var(--ink-dim);
}

.spinner {
  width: 16px; height: 16px; border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.35); border-top-color: #fff;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

:focus-visible { outline: 2px solid #00ffcc; outline-offset: 2px; }

/* ── Mobile ── */
@media (max-width: 900px) {
  .login-page {
    grid-template-columns: 1fr; gap: 28px; align-items: start;
    padding: 28px 16px 40px;
  }
  .brand { margin-bottom: 24px; }
  .hero-lead { font-size: 15px; margin-bottom: 20px; }
  .features { display: none; }
  .card { padding: 24px 20px 20px; }
}
@media (prefers-reduced-motion: reduce) {
  .btn-primary, .field { transition: none; }
  .spinner { animation-duration: 2s; }
}
</style>
