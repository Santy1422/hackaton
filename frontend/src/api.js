const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

// --- Token storage (JWT bearer) ----------------------------------------------
const TOKEN_KEY = 'altis_token'

export const getToken = () => localStorage.getItem(TOKEN_KEY)
export const setToken = (t) => localStorage.setItem(TOKEN_KEY, t)
export const clearToken = () => localStorage.removeItem(TOKEN_KEY)

function authHeaders() {
  const t = getToken()
  return t ? { Authorization: `Bearer ${t}` } : {}
}

// Códigos 401 que significan "tu token ya no sirve" → cerrar sesión.
const TOKEN_DEAD = new Set([
  'TOKEN_EXPIRED',
  'INVALID_TOKEN',
  'NOT_AUTHENTICATED',
  'USER_INACTIVE',
])

function apiError(res, body) {
  // El backend usa el envelope `{ detail: { code, message, hint } }`.
  const detail = body?.detail || body
  const e = new Error(detail?.message || res.statusText)
  e.code = detail?.code
  e.status = res.status
  e.hint = detail?.hint

  // Token muerto: limpiar y avisar a la app (AuthContext escucha el evento).
  if (res.status === 401 && getToken() && TOKEN_DEAD.has(e.code)) {
    clearToken()
    window.dispatchEvent(new Event('auth:logout'))
  }
  return e
}

// fetch que convierte un fallo de red (backend caído, CORS, offline) en un
// Error legible en vez del críptico "Failed to fetch".
async function request(path, init) {
  let res
  try {
    res = await fetch(`${API}/api${path}`, init)
  } catch {
    const e = new Error('Cannot reach the server. Check your connection and try again.')
    e.code = 'NETWORK'
    throw e
  }
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw apiError(res, body)
  return body
}

export async function apiGet(path) {
  return request(path, { headers: { ...authHeaders() } })
}

export async function apiPost(path, payload) {
  return request(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(payload),
  })
}

// Descarga un binario (PDF) generado por el backend, con auth. Robusto: no
// depende de librerías de PDF en el browser (server-side, datos reales).
export async function apiDownload(path, filename) {
  let res
  try {
    res = await fetch(`${API}/api${path}`, { headers: { ...authHeaders() } })
  } catch {
    const e = new Error('Cannot reach the server. Check your connection and try again.')
    e.code = 'NETWORK'
    throw e
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw apiError(res, body)
  }
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

export const eur = (n) =>
  new Intl.NumberFormat('nl-NL', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(Number(n) || 0)

export const SCENARIOS = [
  { id: 'base', label: 'Base' },
  { id: 'wet_qtr', label: 'Wet Quarter' },
  { id: 'dry_qtr', label: 'Dry Quarter' },
]

// La lista real de OpCos es data-driven (useOpcos → /api/opcos). No hardcodear.
