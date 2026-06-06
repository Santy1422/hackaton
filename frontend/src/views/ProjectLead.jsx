import { useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from 'recharts'
import { eur, OPCOS } from '../api'
import { useApi, useForecastOpco } from '../hooks/useForecast'

const RISK_BADGE = {
  high: 'bg-rose-100 text-rose-700',
  medium: 'bg-amber-100 text-amber-700',
  low: 'bg-emerald-100 text-emerald-700',
}

export default function ProjectLead({ scenario, lockedOpco }) {
  const [opco, setOpco] = useState(lockedOpco || 'Opco_B')
  const fc = useForecastOpco(scenario, opco)
  const weather = useApi('/weather', [])
  const milestones = useApi(`/milestones/${opco}`, [opco])

  const rows = (fc.data?.weeks || []).map((w) => ({
    week: `W${w.forecast_week}`,
    billing: Number(w.d1_milestone_billing),
    materials: Math.abs(Number(w.d2_materials_outflow)),
  }))

  return (
    <div className="space-y-6">
      {lockedOpco ? (
        <div className="inline-flex items-center gap-2 rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-sm font-medium text-violet-700">
          <span className="text-xs uppercase text-violet-400">Tu opco</span>
          {lockedOpco}
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {OPCOS.map((o) => (
            <button
              key={o}
              onClick={() => setOpco(o)}
              className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
                opco === o
                  ? 'border-violet-600 bg-violet-50 text-violet-700'
                  : 'border-slate-200 bg-white text-slate-500 hover:text-slate-800'
              }`}
            >
              {o}
            </button>
          ))}
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="mb-1 font-semibold text-slate-700">
          Materiales vs Billing — {opco}
        </h3>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={rows}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eef2f6" />
            <XAxis dataKey="week" fontSize={12} />
            <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} fontSize={12} />
            <Tooltip formatter={(v) => eur(v)} />
            <Legend />
            <Bar dataKey="billing" name="Billing" fill="#7c3aed" radius={[3, 3, 0, 0]} />
            <Bar dataKey="materials" name="Materiales" fill="#f59e0b" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="mb-3 font-semibold text-slate-700">Riesgo climático 13s</h3>
          <div className="space-y-1">
            {(weather.data?.weeks || []).map((w, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm odd:bg-slate-50"
              >
                <span className="text-slate-500">
                  W{w.forecast_week || i + 1} · iso {w.iso_week}
                </span>
                <span className="text-slate-400">{w.rain_mm}mm</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    RISK_BADGE[w.risk_level] || RISK_BADGE.low
                  }`}
                >
                  {w.risk_level}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="mb-3 font-semibold text-slate-700">
            Próximos milestones (180d)
          </h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-slate-400">
                <th className="pb-2">Doc</th>
                <th className="pb-2 text-right">Valor</th>
                <th className="pb-2 text-right">Último</th>
              </tr>
            </thead>
            <tbody>
              {(milestones.data?.milestones || []).slice(0, 8).map((m, i) => (
                <tr key={i} className="border-t border-slate-100">
                  <td className="py-2 font-mono text-xs">{m.doc_number}</td>
                  <td className="py-2 text-right font-semibold">
                    {eur(m.contract_value)}
                  </td>
                  <td className="py-2 text-right text-slate-400">
                    {m.last_billed_date}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
