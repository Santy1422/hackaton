/* Altis Forecast — shared formatting + data normalization.
   Cero hardcode de negocio: umbral, status y headroom vienen del backend
   (/covenant). Aquí sólo formato, etiquetas de UI y merge forecast↔weather. */

// ---- money ----------------------------------------------------------------
export const eur = (n) =>
  new Intl.NumberFormat('nl-NL', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(Math.round(Number(n) || 0))

export const eurK = (n) => {
  const v = Number(n) || 0
  const a = Math.abs(v)
  if (a >= 1e6) return `${v < 0 ? '−' : ''}€${(a / 1e6).toFixed(1)}M`
  return `${v < 0 ? '−' : ''}€${Math.round(a / 1000)}k`
}

export const signed = (n) => (n >= 0 ? '+' : '−') + eur(Math.abs(n))

// ---- errors ---------------------------------------------------------------
// Aplana un error (string u objeto {message, hint}) a una línea legible.
export const errText = (e) =>
  !e ? '' : typeof e === 'string' ? e : [e.message, e.hint].filter(Boolean).join(' — ')

// ---- colours (mirror of theme tokens) -------------------------------------
export const COLORS = {
  ink: '#1C2530',
  inkSoft: '#5D6B78',
  inkFaint: '#8A95A0',
  hair: '#E6E0D4',
  green: '#2F6B57',
  greenSoft: '#3F7E6B',
  copper: '#C0552E',
  copperDeep: '#9B4423',
  amber: '#C8893A',
  rain: '#6B86A3',
  cloud: '#9DB2C2',
  clear: '#CFE0EA',
  grid: 'rgba(28,37,48,.08)',
  axis: 'rgba(28,37,48,.42)',
}

// ---- drivers (the five independently tunable streams) ---------------------
export const DRIVERS = [
  { key: 'd1_milestone_billing', label: 'Milestone billing', short: 'Billing', kind: 'in', desc: 'Invoiceable milestones × seasonal index × scenario, gated by workable days.' },
  { key: 'd4_customer_collection', label: 'Customer collections', short: 'Collections', kind: 'in', desc: 'Billing shifted by DSO (~5 wks), scaled per scenario payment behaviour.' },
  { key: 'd2_materials_outflow', label: 'Materials outflow', short: 'Materials', kind: 'out', desc: 'Roofing materials ordered ~2 weeks ahead of execution (~33% of billing).' },
  { key: 'd3_subcon_payment', label: 'Subcontractor payments', short: 'Subcontractors', kind: 'out', desc: '≈20% of milestone value, released on payment terms (net 14/30/60).' },
  { key: 'd5_weather_impact', label: 'Weather impact', short: 'Weather', kind: 'shift', desc: 'Rain / frost / wind stop roof work → billing & outflows defer to later weeks.' },
]

export const DRIVER_COLORS = {
  d1_milestone_billing: COLORS.green,
  d4_customer_collection: COLORS.greenSoft,
  d2_materials_outflow: COLORS.copper,
  d3_subcon_payment: COLORS.copperDeep,
  d5_weather_impact: COLORS.rain,
}

export const SCENARIOS = {
  base: { label: 'Base' },
  wet_qtr: { label: 'Wet quarter' },
  dry_qtr: { label: 'Dry quarter' },
}
export const SCENARIO_KEYS = ['base', 'wet_qtr', 'dry_qtr']

// ---- opcos ----------------------------------------------------------------
// La data del challenge está anonimizada: el id (Opco_A..D) ES la identidad.
// La lista viva llega de /api/opcos (useOpcos) — sin nombres/ciudades inventados.
export const sharePct = (share) => (share != null ? `${Math.round(share * 100)}% of revenue` : '')

// ---- weather --------------------------------------------------------------
export const WEATHER_GLYPH = { high: '🌧', medium: '⛅', low: '☀' }
export const RISK_TONE = { high: COLORS.rain, medium: COLORS.cloud, low: COLORS.clear }

/** Rain → workable days out of 5 (roofing can't proceed in heavy rain). */
export function workableDays(rain_mm) {
  const r = Number(rain_mm) || 0
  return Math.round(Math.max(1, Math.min(5, 5 - r / 12)) * 10) / 10
}

/** Normalize the /weather payload into design-shaped week cells.
 *  rain/risk vienen del backend; workable_days se deriva (el backend no lo da). */
export function normalizeWeather(weatherWeeks = []) {
  return weatherWeeks.map((w, i) => ({
    week: w.forecast_week || i + 1,
    iso_week: w.iso_week,
    week_start: w.week_start,
    rain_mm: Math.round(Number(w.rain_mm) || 0),
    wind_bft: w.wind_bft,
    weather_risk: w.risk_level,
    workable_days: w.workable_days ?? workableDays(w.rain_mm),
  }))
}

/**
 * Merge real forecast weeks with weather into the design week shape.
 * Forecast weeks already carry d1..d5 / gross_* / net_cashflow / cumulative_cf.
 */
export function mergeWeeks(forecastWeeks = [], weatherWeeks = []) {
  const wx = normalizeWeather(weatherWeeks)
  return forecastWeeks.map((f, i) => {
    const w = wx[i] || {}
    return {
      ...f,
      week: f.forecast_week ?? i + 1,
      rain_mm: w.rain_mm,
      wind_bft: w.wind_bft,
      weather_risk: w.weather_risk,
      workable_days: w.workable_days,
      iso_week: w.iso_week,
    }
  })
}

export const sumKey = (weeks, k) => weeks.reduce((s, w) => s + Number(w[k] || 0), 0)
