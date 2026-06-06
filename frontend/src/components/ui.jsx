import { IconAlert, IconCheck } from './icons'

/** Tarjeta de sección estándar con encabezado opcional. */
export function Card({ title, subtitle, action, icon: Icon, children, className = '' }) {
  return (
    <section
      className={`rounded-2xl border border-slate-200/80 bg-white shadow-sm shadow-slate-200/40 ${className}`}
    >
      {(title || action) && (
        <header className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            {Icon && (
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                <Icon size={17} />
              </span>
            )}
            <div>
              <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
              {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
            </div>
          </div>
          {action}
        </header>
      )}
      <div className="p-5">{children}</div>
    </section>
  )
}

/** Pill de estado semántico (covenant / riesgo). */
const STATUS_STYLES = {
  safe: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  watch: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  breach: 'bg-rose-50 text-rose-700 ring-rose-600/20',
  neutral: 'bg-slate-100 text-slate-600 ring-slate-500/20',
  info: 'bg-indigo-50 text-indigo-700 ring-indigo-600/20',
}

export function StatusPill({ status = 'neutral', children, icon: Icon }) {
  const key = String(status).toLowerCase()
  const style = STATUS_STYLES[key] || STATUS_STYLES.neutral
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ring-1 ring-inset ${style}`}
    >
      {Icon && <Icon size={13} />}
      {children}
    </span>
  )
}

const RISK_MAP = {
  high: { cls: 'bg-rose-50 text-rose-700 ring-rose-600/20', label: 'Alto' },
  medium: { cls: 'bg-amber-50 text-amber-700 ring-amber-600/20', label: 'Medio' },
  low: { cls: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20', label: 'Bajo' },
}

export function RiskBadge({ level }) {
  const r = RISK_MAP[level] || RISK_MAP.low
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase ring-1 ring-inset ${r.cls}`}
    >
      {r.label}
    </span>
  )
}

/** Bloque de carga con shimmer (evita CLS y spinners largos). */
export function Skeleton({ className = '', style }) {
  return <div className={`skeleton rounded-lg ${className}`} style={style} />
}

export function ChartSkeleton({ height = 280 }) {
  return <Skeleton className="w-full" style={{ height }} />
}

/** Estado vacío / error con icono y mensaje. */
export function EmptyState({ title, hint, tone = 'neutral' }) {
  const Icon = tone === 'error' ? IconAlert : IconCheck
  const color = tone === 'error' ? 'text-rose-500' : 'text-slate-300'
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
      <span className={color}>
        <Icon size={28} />
      </span>
      <p className="text-sm font-medium text-slate-600">{title}</p>
      {hint && <p className="max-w-xs text-xs text-slate-400">{hint}</p>}
    </div>
  )
}
