import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { eur } from '../api'
import { useApi } from '../hooks/useForecast'
import { C, fmtK, TOOLTIP_CURSOR } from '../theme'
import ChartTooltip from './ChartTooltip'
import { Card, ChartSkeleton, EmptyState } from './ui'
import { IconWallet } from './icons'

export default function SavingsPanel() {
  const { data, loading, error } = useApi('/savings', [])

  if (error) return <EmptyState tone="error" title="No se pudo calcular el ahorro" hint={error} />

  const rows = (data?.opcos || []).map((o) => ({
    opco: o.opco,
    DSO: o.dso_annual_saving,
    Buffer: o.buffer_annual_saving,
    Clima: o.weather_annual_saving,
  }))
  const p = data?.portfolio

  return (
    <Card
      title="Ahorro anual estimado por OpCo"
      subtitle="ROI del sistema · DSO + buffer de caja + clima (calibrado)"
      icon={IconWallet}
    >
      {loading ? (
        <ChartSkeleton height={300} />
      ) : (
        <>
          {p && (
            <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Mini label="Ahorro anual portfolio" value={eur(p.total_annual_saving)} tone="text-emerald-600" />
              <Mini label="Caja liberada DSO" value={eur(p.dso_cash_released)} tone="text-indigo-600" />
              <Mini label="Buffer reducido" value={eur(p.buffer_cash_released)} tone="text-slate-900" />
            </div>
          )}
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="opco" tickLine={false} axisLine={false} />
              <YAxis tickFormatter={fmtK} tickLine={false} axisLine={false} width={44} />
              <Tooltip content={<ChartTooltip />} cursor={TOOLTIP_CURSOR} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
              <Bar dataKey="DSO" stackId="s" fill={C.inflow} radius={[0, 0, 0, 0]} />
              <Bar dataKey="Buffer" stackId="s" fill={C.primary} />
              <Bar dataKey="Clima" stackId="s" fill={C.weather} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          {data?.assumptions && (
            <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
              Supuestos: coste de capital {Math.round(data.assumptions.cost_of_capital * 100)}% ·
              reducción de buffer {Math.round(data.assumptions.forecast_buffer_reduction * 100)}% ·
              clima calibrado a su confianza empírica (R²≈{data.assumptions.weather_signal_calibration}).
            </p>
          )}
        </>
      )}
    </Card>
  )
}

function Mini({ label, value, tone }) {
  return (
    <div className="rounded-xl border border-slate-200/80 bg-white px-4 py-3 shadow-sm">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</div>
      <div className={`mt-1 text-lg font-bold tabular-nums ${tone}`}>{value}</div>
    </div>
  )
}
