import { useState } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { eur, OPCOS } from '../api'
import { useApi, useForecastOpco } from '../hooks/useForecast'
import KpiCard from '../components/KpiCard'

export default function OpcoMD({ scenario }) {
  const [opco, setOpco] = useState('Opco_B')
  const fc = useForecastOpco(scenario, opco)
  const wip = useApi(`/wip/${opco}`, [opco])

  const rows = (fc.data?.weeks || []).map((w) => ({
    week: `W${w.forecast_week}`,
    net: Number(w.net_cashflow),
  }))
  const s = wip.data?.summary

  return (
    <div className="space-y-6">
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

      {s && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <KpiCard label="WIP value" value={eur(s.wip_value)} />
          <KpiCard label="Proyectos activos" value={s.active_projects} accent="slate" />
          <KpiCard label="Run rate semanal" value={eur(s.weekly_run_rate)} accent="green" />
          <KpiCard
            label="Riesgo"
            value={s.risk_level?.toUpperCase()}
            accent={s.risk_level === 'high' ? 'red' : 'slate'}
          />
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="mb-1 font-semibold text-slate-700">
          Cash 13s — {opco} ({scenario})
        </h3>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={rows}>
            <defs>
              <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#eef2f6" />
            <XAxis dataKey="week" fontSize={12} />
            <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} fontSize={12} />
            <Tooltip formatter={(v) => eur(v)} />
            <Area dataKey="net" stroke="#7c3aed" fill="url(#g)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="mb-3 font-semibold text-slate-700">Top proyectos (90d)</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-slate-400">
              <th className="pb-2">Doc</th>
              <th className="pb-2">GL</th>
              <th className="pb-2 text-right">Facturado</th>
              <th className="pb-2 text-right">Txns</th>
            </tr>
          </thead>
          <tbody>
            {(wip.data?.top_projects || []).slice(0, 8).map((p, i) => (
              <tr key={i} className="border-t border-slate-100">
                <td className="py-2 font-mono text-xs">{p.doc_number}</td>
                <td className="py-2 text-slate-500">{p.gl_label || p.gl_account}</td>
                <td className="py-2 text-right font-semibold">{eur(p.total_billed)}</td>
                <td className="py-2 text-right text-slate-400">{p.transaction_count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
