import { eur } from './api'

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

/**
 * Tooltip de Recharts con estética propia (tarjeta, cifras tabulares, EUR).
 * Uso: <Tooltip content={<ChartTooltip />} cursor={TOOLTIP_CURSOR} />
 */
export function ChartTooltip({ active, payload, label, formatter = eur }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-slate-200 bg-white/95 px-3 py-2 shadow-xl backdrop-blur">
      {label != null && (
        <p className="mb-1.5 text-xs font-semibold text-slate-500">{label}</p>
      )}
      <div className="space-y-1">
        {payload.map((p, i) => (
          <div key={i} className="flex items-center gap-2 text-sm">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-sm"
              style={{ backgroundColor: p.color || p.fill }}
            />
            <span className="text-slate-500">{p.name}</span>
            <span className="ml-auto font-semibold tabular-nums text-slate-800">
              {formatter(p.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export const TOOLTIP_CURSOR = { fill: 'rgba(79, 70, 229, 0.06)' }
export const TOOLTIP_LINE_CURSOR = { stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '4 4' }
