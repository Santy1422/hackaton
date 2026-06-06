import { DRIVERS, DRIVER_COLORS, eur, eurK, sumKey } from '../altis/format'

/* ---- recharts tooltip (design styled) ------------------------------------ */
export function ChartTip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid var(--hair)',
        borderRadius: 10,
        padding: '9px 11px',
        boxShadow: '0 12px 30px -12px rgba(28,37,48,.3)',
        fontFamily: 'var(--sans)',
      }}
    >
      {label != null && (
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-soft)', marginBottom: 5 }}>
          {label}
        </div>
      )}
      {payload.map((p, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
          <span style={{ width: 10, height: 10, borderRadius: 3, background: p.color || p.fill }} />
          <span style={{ color: 'var(--ink-soft)' }}>{p.name}</span>
          <span style={{ marginLeft: 'auto', fontFamily: 'var(--mono)', fontWeight: 600 }}>
            {eur(p.value)}
          </span>
        </div>
      ))}
    </div>
  )
}

/* ---- panel --------------------------------------------------------------- */
export function Panel({ title, hint, children, pad = true }) {
  return (
    <section className="panel">
      {(title || hint) && (
        <div className="panel-h">
          {title && <h3>{title}</h3>}
          {hint && <span className="panel-hint">{hint}</span>}
        </div>
      )}
      <div className={pad ? 'panel-b' : ''}>{children}</div>
    </section>
  )
}

/* ---- editorial stat box -------------------------------------------------- */
export function StatBox({ rows }) {
  return (
    <div className="statbox">
      {rows.map((r, i) => (
        <div className="sb-row" key={i}>
          <span className="sb-l">{r.label}</span>
          <span className={'sb-v ' + (r.tone || '')}>{r.value}</span>
          {r.sub && <span className="sb-w">{r.sub}</span>}
        </div>
      ))}
    </div>
  )
}

/* ---- KPI card with left accent ------------------------------------------- */
export function Kpi({ label, value, accent = 'ink', sub }) {
  return (
    <div className={'kpi a-' + accent}>
      <div className="kpi-l">{label}</div>
      <div className="kpi-v">{value}</div>
      {sub && <div className="kpi-s">{sub}</div>}
    </div>
  )
}

/* ---- driver chips (five tunable streams, 13-week totals) ----------------- */
export function DriverChips({ weeks }) {
  return (
    <div className="drv-row">
      {DRIVERS.map((d) => {
        const v = sumKey(weeks, d.key)
        const pos = d.kind === 'in'
        return (
          <div className="drv" key={d.key}>
            <span className="drv-dot" style={{ background: DRIVER_COLORS[d.key] }} />
            <div className={'drv-v ' + (pos ? 'pos' : 'neg')}>{eurK(v)}</div>
            <div className="drv-l">{d.short}</div>
            <div className="drv-d">{d.desc}</div>
          </div>
        )
      })}
    </div>
  )
}

/* ---- skeleton ------------------------------------------------------------ */
export function Skeleton({ height = 280 }) {
  return <div className="sk" style={{ height, width: '100%' }} />
}

/* ---- empty / error ------------------------------------------------------- */
export function Empty({ title, hint, tone }) {
  return (
    <div style={{ textAlign: 'center', padding: '38px 12px' }}>
      <p style={{ fontWeight: 600, color: tone === 'error' ? 'var(--copper)' : 'var(--ink-soft)' }}>
        {title}
      </p>
      {hint && <p style={{ fontSize: 12, color: 'var(--ink-faint)', marginTop: 4 }}>{hint}</p>}
    </div>
  )
}
