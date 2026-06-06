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
import { C, fmtK, ChartTooltip, TOOLTIP_CURSOR } from '../theme'
import { Card, ChartSkeleton, EmptyState } from '../components/ui'
import { IconFileSearch } from '../components/icons'
import DrillDown from '../components/DrillDown'

export default function CFOView({ scenario }) {
  const { data, loading, error } = useForecast(scenario)
  const [week, setWeek] = useState(null)

  if (error) return <EmptyState tone="error" title="No se pudo cargar el forecast" hint={error} />

  const rows = (data?.weeks || []).map((w) => ({
    week: `W${w.forecast_week}`,
    forecast_week: w.forecast_week,
    inflow: Number(w.gross_inflow),
    outflow: Number(w.gross_outflow),
    net: Number(w.net_cashflow),
    cumulative: Number(w.cumulative_cf),
  }))
  const t = data?.totals

  return (
    <div className="space-y-6">
      {t && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Mini label="Inflow total 13s" value={eur(t.total_gross_inflow)} tone="text-emerald-600" />
          <Mini label="Outflow total 13s" value={eur(t.total_gross_outflow)} tone="text-rose-600" />
          <Mini
            label="Net cashflow 13s"
            value={eur(t.total_net_cashflow)}
            tone={t.total_net_cashflow >= 0 ? 'text-slate-900' : 'text-rose-600'}
          />
          <Mini label="Acumulado final" value={eur(t.final_cumulative_cf)} tone="text-indigo-600" />
        </div>
      )}

      <Card
        title="Flujo semanal por dirección"
        subtitle="Inflow vs outflow + acumulado · 13 semanas"
        icon={IconFileSearch}
        action={
          <span className="hidden items-center gap-1 text-xs text-slate-400 sm:flex">
            <IconFileSearch size={13} /> Click en una barra → audit trail
          </span>
        }
      >
        {loading ? (
          <ChartSkeleton height={340} />
        ) : (
          <ResponsiveContainer width="100%" height={340}>
            <ComposedChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="week" tickLine={false} axisLine={false} />
              <YAxis tickFormatter={fmtK} tickLine={false} axisLine={false} width={44} />
              <Tooltip content={<ChartTooltip />} cursor={TOOLTIP_CURSOR} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
              <Bar dataKey="inflow" name="Inflow" fill={C.inflow} radius={[3, 3, 0, 0]}
                onClick={(d) => setWeek(d.forecast_week)} cursor="pointer" />
              <Bar dataKey="outflow" name="Outflow" fill={C.outflow} radius={[0, 0, 3, 3]}
                onClick={(d) => setWeek(d.forecast_week)} cursor="pointer" />
              <Line dataKey="cumulative" name="Acumulado" stroke={C.primary} strokeWidth={2.5}
                dot={false} activeDot={{ r: 4 }} />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </Card>

      <Card title="Net cashflow por semana" subtitle="Verde = superávit · Rojo = déficit">
        {loading ? (
          <ChartSkeleton height={220} />
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="week" tickLine={false} axisLine={false} />
              <YAxis tickFormatter={fmtK} tickLine={false} axisLine={false} width={44} />
              <Tooltip content={<ChartTooltip />} cursor={TOOLTIP_CURSOR} />
              <Bar dataKey="net" name="Net" radius={[3, 3, 0, 0]}
                onClick={(d) => setWeek(d.forecast_week)} cursor="pointer">
                {rows.map((r, i) => (
                  <Cell key={i} fill={r.net >= 0 ? C.inflow : C.outflow} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>

      {week && <DrillDown scenario={scenario} week={week} onClose={() => setWeek(null)} />}
    </div>
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
