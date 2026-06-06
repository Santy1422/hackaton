import { eur } from '../api'

/**
 * Tooltip de Recharts con estética propia (tarjeta, cifras tabulares, EUR).
 * Uso: <Tooltip content={<ChartTooltip />} cursor={TOOLTIP_CURSOR} />
 */
export default function ChartTooltip({ active, payload, label, formatter = eur }) {
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
