import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from 'recharts'
import { eur } from '../api'
import { useCovenant } from '../hooks/useForecast'
import { useApi } from '../hooks/useForecast'
import CovenantGauge from '../components/CovenantGauge'

export default function PEBoard() {
  const base = useCovenant('base')
  const wet = useCovenant('wet_qtr')
  const dry = useCovenant('dry_qtr')
  const monthly = useApi('/actuals/monthly', [])

  const all = base.data?.all_scenarios
  const threshold = base.data?.covenant_threshold || -500000

  // Acumulado de los 3 escenarios alineado por semana
  const merged = (base.data?.weeks || []).map((w, i) => ({
    week: `W${w.forecast_week}`,
    base: Number(w.cumulative_cf),
    wet_qtr: Number(wet.data?.weeks?.[i]?.cumulative_cf || 0),
    dry_qtr: Number(dry.data?.weeks?.[i]?.cumulative_cf || 0),
  }))

  const months = (monthly.data?.months || []).map((m) => ({
    month: m.month,
    revenue: Number(m.total_revenue),
  }))

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {all &&
          [
            ['Base', 'base'],
            ['Wet Quarter', 'wet_qtr'],
            ['Dry Quarter', 'dry_qtr'],
          ].map(([label, id]) => (
            <CovenantGauge
              key={id}
              name={label}
              headroom={all[id]?.final_headroom || 0}
              threshold={threshold}
              status={all[id]?.status}
            />
          ))}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="mb-1 font-semibold text-slate-700">
          Cashflow acumulado 13s — 3 escenarios
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={merged}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eef2f6" />
            <XAxis dataKey="week" fontSize={12} />
            <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} fontSize={12} />
            <Tooltip formatter={(v) => eur(v)} />
            <Legend />
            <Line dataKey="base" stroke="#7c3aed" strokeWidth={2} dot={false} />
            <Line dataKey="wet_qtr" stroke="#0ea5e9" strokeWidth={2} dot={false} />
            <Line dataKey="dry_qtr" stroke="#f59e0b" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="mb-1 font-semibold text-slate-700">
          Revenue mensual (actuals)
        </h3>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={months}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eef2f6" />
            <XAxis dataKey="month" fontSize={11} minTickGap={20} />
            <YAxis tickFormatter={(v) => `${(v / 1e6).toFixed(1)}M`} fontSize={12} />
            <Tooltip formatter={(v) => eur(v)} />
            <Line dataKey="revenue" stroke="#10b981" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
