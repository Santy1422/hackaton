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
import { useCovenant, useApi } from '../hooks/useForecast'
import { C, fmtK, fmtM, TOOLTIP_LINE_CURSOR } from '../theme'
import ChartTooltip from '../components/ChartTooltip'
import { Card, ChartSkeleton, StatusPill } from '../components/ui'
import { IconShield, IconTrending, IconAlert } from '../components/icons'
import CovenantGauge from '../components/CovenantGauge'
import SavingsPanel from '../components/SavingsPanel'

export default function PEBoard() {
  const base = useCovenant('base')
  const wet = useCovenant('wet_qtr')
  const dry = useCovenant('dry_qtr')
  const monthly = useApi('/actuals/monthly', [])

  const all = base.data?.all_scenarios
  const threshold = base.data?.covenant_threshold || -500000
  const anyBreach = all && Object.values(all).some((s) => s?.any_breach)

  const merged = (base.data?.weeks || []).map((w, i) => ({
    week: `W${w.forecast_week}`,
    base: Number(w.cumulative_cf),
    wet_qtr: Number(wet.data?.weeks?.[i]?.cumulative_cf || 0),
    dry_qtr: Number(dry.data?.weeks?.[i]?.cumulative_cf || 0),
    threshold,
  }))

  const months = (monthly.data?.months || []).map((m) => ({
    month: m.month,
    revenue: Number(m.total_revenue),
  }))

  return (
    <div className="space-y-6">
      {/* Banner ejecutivo de covenant */}
      <div
        className={`flex items-center gap-3 rounded-2xl border p-4 ${
          anyBreach
            ? 'border-rose-200 bg-rose-50/60'
            : 'border-emerald-200 bg-emerald-50/50'
        }`}
      >
        <span
          className={`flex h-10 w-10 items-center justify-center rounded-xl ${
            anyBreach ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'
          }`}
        >
          {anyBreach ? <IconAlert size={20} /> : <IconShield size={20} />}
        </span>
        <div className="flex-1">
          <p className="text-sm font-semibold text-slate-800">
            {anyBreach
              ? 'Riesgo de breach de covenant en al menos un escenario'
              : 'Covenant headroom dentro de límites en los 3 escenarios'}
          </p>
          <p className="text-xs text-slate-500">
            Umbral mínimo de cashflow acumulado: {eur(threshold)} · horizonte 13 semanas
          </p>
        </div>
        <StatusPill status={anyBreach ? 'breach' : 'safe'}>
          {anyBreach ? 'Acción requerida' : 'Estable'}
        </StatusPill>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {all
          ? [
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
            ))
          : Array.from({ length: 3 }).map((_, i) => <ChartSkeleton key={i} height={150} />)}
      </div>

      <Card
        title="Cashflow acumulado · 3 escenarios"
        subtitle="Sensibilidad climática del headroom de covenant"
        icon={IconShield}
      >
        {base.loading ? (
          <ChartSkeleton height={300} />
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={merged} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="week" tickLine={false} axisLine={false} />
              <YAxis tickFormatter={fmtK} tickLine={false} axisLine={false} width={44} />
              <Tooltip content={<ChartTooltip />} cursor={TOOLTIP_LINE_CURSOR} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
              <Line dataKey="threshold" name="Umbral" stroke={C.outflow} strokeWidth={1.5}
                strokeDasharray="6 4" dot={false} />
              <Line dataKey="base" name="Base" stroke={C.primary} strokeWidth={2.5} dot={false} />
              <Line dataKey="wet_qtr" name="Wet Qtr" stroke={C.weather} strokeWidth={2} dot={false} />
              <Line dataKey="dry_qtr" name="Dry Qtr" stroke={C.materials} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </Card>

      <Card title="Revenue mensual (actuals)" subtitle="Portfolio consolidado · 4 opcos" icon={IconTrending}>
        {monthly.loading ? (
          <ChartSkeleton height={260} />
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={months} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" tickLine={false} axisLine={false} minTickGap={20} />
              <YAxis tickFormatter={fmtM} tickLine={false} axisLine={false} width={44} />
              <Tooltip content={<ChartTooltip />} cursor={TOOLTIP_LINE_CURSOR} />
              <Line dataKey="revenue" name="Revenue" stroke={C.inflow} strokeWidth={2.5}
                dot={false} activeDot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </Card>

      <SavingsPanel />
    </div>
  )
}
