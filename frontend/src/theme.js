/** Paleta única para todos los charts — coherencia visual en todas las vistas. */
export const C = {
  ink: '#0f172a',
  muted: '#94a3b8',
  grid: '#eef2f6',
  primary: '#4f46e5', // indigo-600 — marca / acumulado
  primarySoft: '#818cf8', // indigo-400
  inflow: '#059669', // emerald-600 — cobros / positivo
  outflow: '#e11d48', // rose-600 — pagos / negativo
  materials: '#f59e0b', // amber-500 — materiales / dry
  weather: '#0ea5e9', // sky-500 — clima / wet
  neutral: '#64748b', // slate-500
}

/** Colores por escenario (consistentes con ScenarioToggle). */
export const SCENARIO_COLOR = {
  base: C.primary,
  wet_qtr: C.weather,
  dry_qtr: C.materials,
}

/** Formateadores compactos para ejes. */
export const fmtK = (v) => `${(Number(v) / 1000).toFixed(0)}k`
export const fmtM = (v) => `${(Number(v) / 1e6).toFixed(1)}M`

export const TOOLTIP_CURSOR = { fill: 'rgba(79, 70, 229, 0.06)' }
export const TOOLTIP_LINE_CURSOR = {
  stroke: '#cbd5e1',
  strokeWidth: 1,
  strokeDasharray: '4 4',
}
