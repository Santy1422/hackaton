const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export async function apiGet(path) {
  const res = await fetch(`${API}/api${path}`)
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(body?.detail?.message || body?.message || res.statusText)
  }
  return body
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

export const OPCOS = ['Opco_A', 'Opco_B', 'Opco_C', 'Opco_D']
