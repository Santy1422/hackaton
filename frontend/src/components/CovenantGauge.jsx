import { eur } from '../api'
import { StatusPill } from './ui'
import { IconCheck, IconAlert, IconShield } from './icons'

const STATUS = {
  SAFE: { tone: 'safe', bar: 'bg-emerald-500', value: 'text-emerald-600', icon: IconCheck, label: 'Safe' },
  WATCH: { tone: 'watch', bar: 'bg-amber-500', value: 'text-amber-600', icon: IconAlert, label: 'Watch' },
  BREACH: { tone: 'breach', bar: 'bg-rose-500', value: 'text-rose-600', icon: IconAlert, label: 'Breach' },
}

export default function CovenantGauge({ name, headroom, threshold, status }) {
  const s = STATUS[status] || STATUS.SAFE
  // Barra: headroom relativo a |threshold| (clamp 0..100).
  const pct = Math.max(0, Math.min(100, (headroom / Math.max(1, Math.abs(threshold))) * 100))
  const breach = status === 'BREACH'

  return (
    <div
      className={`rounded-2xl border bg-white p-4 shadow-sm transition ${
        breach ? 'border-rose-300 shadow-rose-100/60' : 'border-slate-200/80 shadow-slate-200/40'
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
          <IconShield size={15} className="text-slate-400" />
          {name}
        </span>
        <StatusPill status={s.tone} icon={s.icon}>
          {s.label}
        </StatusPill>
      </div>

      <div className={`mt-3 text-2xl font-bold tabular-nums tracking-tight ${s.value}`}>
        {eur(headroom)}
      </div>
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
        Headroom final
      </p>

      <div className="relative mt-3 h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full ${s.bar} transition-all duration-500`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] text-slate-400">
        <span>Umbral {eur(threshold)}</span>
        <span className="tabular-nums">{pct.toFixed(0)}%</span>
      </div>
    </div>
  )
}
