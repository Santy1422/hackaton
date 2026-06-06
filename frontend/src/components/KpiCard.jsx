import { IconArrowUp, IconArrowDown } from './icons'

const ACCENTS = {
  indigo: { bar: 'bg-indigo-500', icon: 'bg-indigo-50 text-indigo-600', val: 'text-slate-900' },
  violet: { bar: 'bg-indigo-500', icon: 'bg-indigo-50 text-indigo-600', val: 'text-slate-900' },
  green: { bar: 'bg-emerald-500', icon: 'bg-emerald-50 text-emerald-600', val: 'text-slate-900' },
  red: { bar: 'bg-rose-500', icon: 'bg-rose-50 text-rose-600', val: 'text-rose-600' },
  amber: { bar: 'bg-amber-500', icon: 'bg-amber-50 text-amber-600', val: 'text-slate-900' },
  slate: { bar: 'bg-slate-300', icon: 'bg-slate-100 text-slate-500', val: 'text-slate-900' },
}

export default function KpiCard({ label, value, sub, accent = 'indigo', icon: Icon, delta }) {
  const a = ACCENTS[accent] || ACCENTS.indigo
  const up = delta != null && delta >= 0
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm shadow-slate-200/40 transition hover:shadow-md hover:shadow-slate-200/60">
      <span className={`absolute inset-y-0 left-0 w-1 ${a.bar}`} />
      <div className="flex items-start justify-between">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          {label}
        </div>
        {Icon && (
          <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${a.icon}`}>
            <Icon size={15} />
          </span>
        )}
      </div>
      <div className={`mt-2 text-2xl font-bold tabular-nums tracking-tight ${a.val}`}>
        {value}
      </div>
      <div className="mt-1 flex items-center gap-2">
        {delta != null && (
          <span
            className={`inline-flex items-center gap-0.5 text-xs font-semibold tabular-nums ${
              up ? 'text-emerald-600' : 'text-rose-600'
            }`}
          >
            {up ? <IconArrowUp size={12} /> : <IconArrowDown size={12} />}
            {Math.abs(delta).toFixed(1)}%
          </span>
        )}
        {sub && <span className="text-xs text-slate-400">{sub}</span>}
      </div>
    </div>
  )
}
