import { useEffect } from 'react'
import { eur } from '../api'
import { useAudit } from '../hooks/useAudit'
import { Skeleton, EmptyState } from './ui'
import {
  IconClose,
  IconArrowUp,
  IconArrowDown,
  IconFileSearch,
  IconWallet,
  IconBox,
  IconHardHat,
  IconCheck,
  IconRain,
} from './icons'

const DRIVERS = [
  ['d1_milestone_billing', 'Milestone Billing', IconWallet, 'inflow'],
  ['d2_materials_outflow', 'Materials Outflow', IconBox, 'outflow'],
  ['d3_subcon_payment', 'Subcontractor Payment', IconHardHat, 'outflow'],
  ['d4_customer_collection', 'Customer Collection', IconCheck, 'inflow'],
  ['d5_weather_impact', 'Weather Impact', IconRain, 'neutral'],
]

export default function DrillDown({ scenario, week, onClose }) {
  const { data, loading, error } = useAudit(scenario, week)

  // Cerrar con Escape (escape-routes / modal-escape).
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Audit trail semana ${week}`}
    >
      <div
        className="animate-scale-in max-h-[88vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-slate-100 bg-white/95 px-6 py-4 backdrop-blur">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <IconFileSearch size={18} />
            </span>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Audit trail · Semana {week}
              </h2>
              <p className="text-xs text-slate-400">
                Escenario <span className="font-medium text-slate-500">{scenario}</span>
                {data?.week_start ? ` · ${data.week_start}` : ''}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <IconClose size={18} />
          </button>
        </header>

        <div className="p-6">
          {loading && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-28" />
              ))}
            </div>
          )}
          {error && <EmptyState tone="error" title="No se pudo cargar el audit trail" hint={error} />}

          {data && (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {DRIVERS.map(([key, label, Icon, dir]) => {
                  const d = data.drivers?.[key]
                  if (!d) return null
                  const positive = (d.value || 0) >= 0
                  return (
                    <div
                      key={key}
                      className="rounded-xl border border-slate-200 bg-slate-50/40 p-3.5 transition hover:border-indigo-200 hover:bg-white"
                    >
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                          <span className="text-slate-400">
                            <Icon size={16} />
                          </span>
                          {label}
                        </span>
                        <span
                          className={`flex items-center gap-0.5 text-sm font-bold tabular-nums ${
                            dir === 'neutral'
                              ? 'text-slate-600'
                              : positive
                              ? 'text-emerald-600'
                              : 'text-rose-600'
                          }`}
                        >
                          {dir !== 'neutral' &&
                            (positive ? <IconArrowUp size={13} /> : <IconArrowDown size={13} />)}
                          {eur(d.value)}
                        </span>
                      </div>
                      <p className="mt-2 text-xs leading-relaxed text-slate-500">{d.assumption}</p>
                      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                        {d.model && (
                          <span className="rounded-md bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-600">
                            {d.model}
                          </span>
                        )}
                        {d.training_rows > 0 && (
                          <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                            {d.training_rows.toLocaleString()} filas fuente
                          </span>
                        )}
                        {d.source_files?.length > 0 && (
                          <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                            {d.source_files.length} archivos
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    Net cashflow
                  </div>
                  <div
                    className={`mt-1 text-xl font-bold tabular-nums ${
                      (data.net_cashflow || 0) >= 0 ? 'text-slate-900' : 'text-rose-600'
                    }`}
                  >
                    {eur(data.net_cashflow)}
                  </div>
                </div>
                <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-indigo-400">
                    Covenant headroom
                  </div>
                  <div className="mt-1 text-xl font-bold tabular-nums text-indigo-700">
                    {eur(data.covenant_headroom)}
                  </div>
                </div>
              </div>

              {data.audit_metadata && (
                <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 rounded-xl bg-slate-50 px-4 py-3 text-[11px] text-slate-400">
                  <span>
                    <strong className="font-semibold text-slate-600">
                      {data.audit_metadata.total_source_transactions?.toLocaleString()}
                    </strong>{' '}
                    transacciones fuente
                  </span>
                  <span className="text-slate-300">·</span>
                  <span>
                    <strong className="font-semibold text-slate-600">
                      {data.audit_metadata.systems_reconciled}
                    </strong>{' '}
                    sistemas reconciliados
                  </span>
                  <span className="text-slate-300">·</span>
                  <span>
                    <strong className="font-semibold text-slate-600">
                      {data.audit_metadata.gl_accounts_mapped}
                    </strong>{' '}
                    cuentas GL mapeadas
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
