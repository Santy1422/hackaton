import { useEffect } from 'react'
import { useAudit } from '../hooks/useAudit'
import { DRIVERS, DRIVER_COLORS, SCENARIOS, eur, signed } from '../altis/format'
import { Skeleton, Empty } from './primitives'

/**
 * Audit trail / drill-down — the auditability showpiece.
 * Real audit data (driver → assumption → model → source rows) + weather header.
 */
export default function AuditModal({ scenario, week, weekObj, onClose }) {
  const { data, loading, error } = useAudit(scenario, week)

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const w = weekObj || {}
  const label = SCENARIOS[scenario]?.label || scenario

  return (
    <div className="modal-bg" onClick={onClose} role="dialog" aria-modal="true" aria-label={`Audit trail week ${week}`}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-h">
          <div>
            <div className="modal-eyebrow">AUDIT TRAIL · TRACE TO SOURCE</div>
            <h2>Week {week}{data?.week_start ? ` · ${data.week_start}` : ''}</h2>
            <p>
              Scenario <b>{label}</b>
              {w.iso_week ? ` · ISO week ${w.iso_week}` : ''}
              {w.workable_days != null ? ` · ${w.workable_days}/5 workable days` : ''}
              {w.rain_mm != null ? ` · ${w.rain_mm}mm rain` : ''}
            </p>
          </div>
          <button className="modal-x" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {loading && (
          <div className="modal-drivers">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} height={92} />)}
          </div>
        )}
        {error && <Empty tone="error" title="Could not load audit trail" hint={error} />}

        {data && (
          <>
            <div className="modal-drivers">
              {DRIVERS.map((d) => {
                const dr = data.drivers?.[d.key]
                if (!dr) return null
                const v = Number(dr.value || 0)
                const pos = v >= 0
                const rows = dr.training_rows || (dr.gl_accounts?.length ?? 0)
                return (
                  <div className="md-drv" key={d.key}>
                    <div className="md-top">
                      <span className="md-dot" style={{ background: DRIVER_COLORS[d.key] }} />
                      <span className="md-l">{d.label}</span>
                      <span className={'md-v ' + (pos ? 'pos' : 'neg')}>{eur(v)}</span>
                    </div>
                    <p className="md-assume">{dr.assumption || d.desc}</p>
                    <div className="md-src">
                      ↳ {dr.model ? dr.model + ' · ' : ''}
                      {rows ? `${rows.toLocaleString()} GL rows` : `${label} assumptions`}
                      {dr.source_files?.length ? ` · ${dr.source_files.length} source files` : ''}
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="modal-foot">
              <div>
                <span className="mf-l">Net cash · week {week}</span>
                <span className={'mf-v ' + ((data.net_cashflow || 0) >= 0 ? 'pos' : 'neg')}>
                  {signed(data.net_cashflow)}
                </span>
              </div>
              <div>
                <span className="mf-l">Cumulative cash</span>
                <span className="mf-v">{eur(data.cumulative_cf)}</span>
              </div>
              <div>
                <span className="mf-l">Covenant headroom</span>
                <span className="mf-v copper">{eur(data.covenant_headroom)}</span>
              </div>
            </div>

            {data.audit_metadata && (
              <div className="modal-trace">
                {data.audit_metadata.total_source_transactions?.toLocaleString()} source transactions ·{' '}
                {data.audit_metadata.gl_accounts_mapped} GL accounts mapped
                {data.audit_metadata.systems_reconciled
                  ? ` across ${data.audit_metadata.systems_reconciled} reconciled systems`
                  : ''}{' '}
                · single source of truth: <code>forecast_13w</code>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
