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
import { eur } from '../api'
import { useApi, useForecastOpco } from '../hooks/useForecast'
import { C, fmtK, TOOLTIP_CURSOR } from '../theme'
import ChartTooltip from '../components/ChartTooltip'
import { Card, ChartSkeleton, RiskBadge, EmptyState } from '../components/ui'
import OpcoPicker from '../components/OpcoPicker'
import { IconBox, IconRain, IconClock, IconWind } from '../components/icons'

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

  const weeks = weather.data?.weeks || []
  const highRiskCount = weeks.filter((w) => w.risk_level === 'high').length

  return (
    <div className="space-y-6">
      <OpcoPicker opco={opco} onChange={setOpco} lockedOpco={lockedOpco} />

      <Card
        title={`Materiales vs Billing — ${opco}`}
        subtitle="Salidas de materiales adelantadas a la ejecución vs hitos facturables"
        icon={IconBox}
      >
        {fc.loading ? (
          <ChartSkeleton height={260} />
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="week" tickLine={false} axisLine={false} />
              <YAxis tickFormatter={fmtK} tickLine={false} axisLine={false} width={44} />
              <Tooltip content={<ChartTooltip />} cursor={TOOLTIP_CURSOR} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
              <Bar dataKey="billing" name="Billing" fill={C.primary} radius={[3, 3, 0, 0]} />
              <Bar dataKey="materials" name="Materiales" fill={C.materials} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card
          title="Riesgo climático · 13 semanas"
          subtitle={
            weeks.length
              ? `${highRiskCount} semana(s) de riesgo alto → posible desplazamiento de billing`
              : 'Lluvia / heladas → retraso de obra → billing diferido'
          }
          icon={IconRain}
        >
          {weather.loading ? (
            <ChartSkeleton height={300} />
          ) : weeks.length === 0 ? (
            <EmptyState title="Sin datos de clima" />
          ) : (
            <div className="space-y-1.5">
              {weeks.map((w, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 rounded-lg px-2.5 py-2 transition hover:bg-slate-50"
                >
                  <span className="w-16 shrink-0 text-xs font-medium text-slate-600">
                    W{w.forecast_week || i + 1}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-slate-400">
                    <IconRain size={13} />
                    <span className="tabular-nums">{w.rain_mm}mm</span>
                  </span>
                  {w.wind_bft != null && (
                    <span className="flex items-center gap-1 text-xs text-slate-400">
                      <IconWind size={13} />
                      <span className="tabular-nums">{w.wind_bft}</span>
                    </span>
                  )}
                  {/* Barra proporcional a la lluvia */}
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full ${
                        w.risk_level === 'high'
                          ? 'bg-rose-400'
                          : w.risk_level === 'medium'
                          ? 'bg-amber-400'
                          : 'bg-emerald-400'
                      }`}
                      style={{ width: `${Math.min(100, (Number(w.rain_mm) || 0) * 2)}%` }}
                    />
                  </div>
                  <RiskBadge level={w.risk_level} />
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title="Próximos milestones facturables" subtitle="Horizonte 180 días" icon={IconClock}>
          {milestones.loading ? (
            <ChartSkeleton height={300} />
          ) : (milestones.data?.milestones || []).length === 0 ? (
            <EmptyState title="Sin milestones próximos" />
          ) : (
            <div className="-mx-2 overflow-x-auto">
              <table className="w-full min-w-[360px] text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400">
                    <th className="px-2 pb-2 font-semibold">Doc</th>
                    <th className="px-2 pb-2 text-right font-semibold">Valor</th>
                    <th className="px-2 pb-2 text-right font-semibold">Último</th>
                  </tr>
                </thead>
                <tbody>
                  {(milestones.data?.milestones || []).slice(0, 8).map((m, i) => (
                    <tr key={i} className="border-t border-slate-100 transition hover:bg-slate-50/60">
                      <td className="px-2 py-2.5 font-mono text-xs text-slate-700">{m.doc_number}</td>
                      <td className="px-2 py-2.5 text-right font-semibold tabular-nums text-slate-800">
                        {eur(m.contract_value)}
                      </td>
                      <td className="px-2 py-2.5 text-right tabular-nums text-slate-400">
                        {m.last_billed_date}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
