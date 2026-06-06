import { eur } from '../api'

const STATUS = {
  SAFE: { color: 'bg-emerald-500', text: 'text-emerald-600', label: 'SAFE' },
  WATCH: { color: 'bg-amber-500', text: 'text-amber-600', label: 'WATCH' },
  BREACH: { color: 'bg-rose-500', text: 'text-rose-600', label: 'BREACH' },
}

export default function CovenantGauge({ name, headroom, threshold, status }) {
  const s = STATUS[status] || STATUS.SAFE
  // headroom relativo a |threshold| para la barra (clamp 0..100)
  const pct = Math.max(
    0,
    Math.min(100, (headroom / Math.max(1, Math.abs(threshold))) * 100)
  )
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-700">{name}</span>
        <span className={`text-xs font-bold ${s.text}`}>{s.label}</span>
      </div>
      <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full ${s.color}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-2 flex justify-between text-xs text-slate-400">
        <span>Headroom</span>
        <span className="font-semibold text-slate-700">{eur(headroom)}</span>
      </div>
    </div>
  )
}
