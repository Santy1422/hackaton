import { eur } from '../api'
import { useAudit } from '../hooks/useAudit'

const DRIVERS = [
  ['d1_milestone_billing', 'Milestone Billing'],
  ['d2_materials_outflow', 'Materials Outflow'],
  ['d3_subcon_payment', 'Subcontractor Payment'],
  ['d4_customer_collection', 'Customer Collection'],
  ['d5_weather_impact', 'Weather Impact'],
]

export default function DrillDown({ scenario, week, onClose }) {
  const { data, loading, error } = useAudit(scenario, week)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-800">
              Audit trail — Semana {week}
            </h2>
            <p className="text-sm text-slate-400">
              Escenario {scenario} · {data?.week_start || ''}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg px-3 py-1 text-slate-400 hover:bg-slate-100"
          >
            ✕
          </button>
        </div>

        {loading && <p className="mt-6 text-slate-400">Cargando…</p>}
        {error && <p className="mt-6 text-rose-500">{error}</p>}

        {data && (
          <>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {DRIVERS.map(([key, label]) => {
                const d = data.drivers?.[key]
                if (!d) return null
                return (
                  <div key={key} className="rounded-xl border border-slate-200 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-slate-700">
                        {label}
                      </span>
                      <span
                        className={`text-sm font-bold ${
                          (d.value || 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'
                        }`}
                      >
                        {eur(d.value)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">{d.assumption}</p>
                    {d.source_files?.length > 0 && (
                      <p className="mt-2 text-[11px] text-slate-400">
                        Source: {d.training_rows ?? 0} rows ·{' '}
                        {d.source_files.length} files
                      </p>
                    )}
                  </div>
                )
              })}
            </div>

            <div className="mt-4 flex items-center justify-between rounded-xl bg-slate-50 p-4">
              <div>
                <div className="text-xs text-slate-400">Net cashflow</div>
                <div className="text-lg font-bold text-slate-800">
                  {eur(data.net_cashflow)}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-slate-400">Covenant headroom</div>
                <div className="text-lg font-bold text-violet-600">
                  {eur(data.covenant_headroom)}
                </div>
              </div>
            </div>

            {data.audit_metadata && (
              <p className="mt-3 text-center text-[11px] text-slate-400">
                {data.audit_metadata.total_source_transactions?.toLocaleString()} transacciones ·{' '}
                {data.audit_metadata.gl_accounts_mapped} GL mapeadas
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
