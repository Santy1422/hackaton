export default function KpiCard({ label, value, sub, accent = 'violet' }) {
  const accents = {
    violet: 'text-violet-600',
    green: 'text-emerald-600',
    red: 'text-rose-600',
    slate: 'text-slate-700',
  }
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
        {label}
      </div>
      <div className={`mt-1 text-2xl font-bold ${accents[accent]}`}>{value}</div>
      {sub && <div className="mt-1 text-xs text-slate-400">{sub}</div>}
    </div>
  )
}
