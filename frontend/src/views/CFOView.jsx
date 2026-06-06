import { useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  ComposedChart,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { eur } from '../api'
import { useForecast } from '../hooks/useForecast'
import DrillDown from '../components/DrillDown'

export default function CFOView({ scenario }) {
  const { data, loading, error } = useForecast(scenario)
  const [week, setWeek] = useState(null)

  if (loading) return <p className="text-slate-400">Cargando forecast…</p>
  if (error) return <p className="text-rose-500">{error}</p>

  const rows = (data?.weeks || []).map((w) => ({
    week: `W${w.forecast_week}`,
    forecast_week: w.forecast_week,
    inflow: Number(w.gross_inflow),
    outflow: Number(w.gross_outflow),
    net: Number(w.net_cashflow),
    cumulative: Number(w.cumulative_cf),
  }))

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="mb-1 flex items-center justify-between">
          <h3 className="font-semibold text-slate-700">
            Flujo semanal (inflow / outflow + acumulado)
          </h3>
          <span className="text-xs text-slate-400">
            Click en una barra → audit trail
          </span>
        </div>
        <ResponsiveContainer width="100%" height={340}>
          <ComposedChart data={rows}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eef2f6" />
            <XAxis dataKey="week" fontSize={12} />
            <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} fontSize={12} />
            <Tooltip formatter={(v) => eur(v)} />
            <Legend />
            <Bar dataKey="inflow" name="Inflow" fill="#10b981" radius={[3, 3, 0, 0]}
              onClick={(d) => setWeek(d.forecast_week)} cursor="pointer" />
            <Bar dataKey="outflow" name="Outflow" fill="#f43f5e" radius={[0, 0, 3, 3]}
              onClick={(d) => setWeek(d.forecast_week)} cursor="pointer" />
            <Line dataKey="cumulative" name="Acumulado" stroke="#7c3aed" strokeWidth={2} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="mb-1 font-semibold text-slate-700">Net cashflow por semana</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={rows}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eef2f6" />
            <XAxis dataKey="week" fontSize={12} />
            <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} fontSize={12} />
            <Tooltip formatter={(v) => eur(v)} />
            <Bar dataKey="net" name="Net" radius={[3, 3, 0, 0]}
              onClick={(d) => setWeek(d.forecast_week)} cursor="pointer">
              {rows.map((r, i) => (
                <Cell key={i} fill={r.net >= 0 ? '#10b981' : '#f43f5e'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {week && (
        <DrillDown scenario={scenario} week={week} onClose={() => setWeek(null)} />
      )}
    </div>
  )
}
