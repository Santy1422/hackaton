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
import { eur } from '../api'
import { useApi, useForecastOpco } from '../hooks/useForecast'
import { C, fmtK, ChartTooltip, TOOLTIP_LINE_CURSOR } from '../theme'
import { Card, ChartSkeleton, StatusPill, EmptyState } from '../components/ui'
import KpiCard from '../components/KpiCard'
import OpcoPicker from '../components/OpcoPicker'
import { IconLayers, IconAlert, IconWallet, IconBox, IconHardHat } from '../components/icons'

export default function OpcoMD({ scenario, lockedOpco }) {
  const [opco, setOpco] = useState(lockedOpco || 'Opco_B')
  const fc = useForecastOpco(scenario, opco)
  const wip = useApi(`/wip/${opco}`, [opco])

  const rows = (fc.data?.weeks || []).map((w) => ({
    week: `W${w.forecast_week}`,
    net: Number(w.net_cashflow),
  }))
  const s = wip.data?.summary

  return (
    <div className="space-y-6">
      <OpcoPicker opco={opco} onChange={setOpco} lockedOpco={lockedOpco} />

      {wip.loading ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <ChartSkeleton key={i} height={96} />)}
        </div>
      ) : s ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiCard label="WIP value (90d)" value={eur(s.wip_value)} accent="indigo" icon={IconWallet} />
          <KpiCard label="Proyectos activos" value={s.active_projects} accent="slate" icon={IconLayers} />
          <KpiCard label="Run rate semanal" value={eur(s.weekly_run_rate)} accent="green" icon={IconBox} />
          <KpiCard
            label="Nivel de riesgo"
            value={s.risk_level?.toUpperCase()}
            accent={s.risk_level === 'high' ? 'red' : s.risk_level === 'medium' ? 'amber' : 'green'}
            icon={IconAlert}
          />
        </div>
      ) : null}

      <Card
        title={`Cash 13 semanas — ${opco}`}
        subtitle={`Escenario ${scenario}`}
        icon={IconLayers}
        action={
          s && (
            <StatusPill status={s.risk_level === 'high' ? 'breach' : s.risk_level === 'medium' ? 'watch' : 'safe'}>
              Riesgo {s.risk_level}
            </StatusPill>
          )
        }
      >
        {fc.loading ? (
          <ChartSkeleton height={280} />
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="opcoFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={C.primary} stopOpacity={0.35} />
                  <stop offset="95%" stopColor={C.primary} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="week" tickLine={false} axisLine={false} />
              <YAxis tickFormatter={fmtK} tickLine={false} axisLine={false} width={44} />
              <Tooltip content={<ChartTooltip />} cursor={TOOLTIP_LINE_CURSOR} />
              <Area dataKey="net" name="Net cashflow" stroke={C.primary} fill="url(#opcoFill)"
                strokeWidth={2.5} activeDot={{ r: 4 }} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </Card>

      <Card title="Top proyectos por facturación" subtitle="Últimos 90 días" icon={IconHardHat}>
        {wip.loading ? (
          <ChartSkeleton height={200} />
        ) : (wip.data?.top_projects || []).length === 0 ? (
          <EmptyState title="Sin proyectos en el período" hint="No hay facturación en los últimos 90 días para este opco." />
        ) : (
          <div className="-mx-2 overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400">
                  <th className="px-2 pb-2 font-semibold">Doc</th>
                  <th className="px-2 pb-2 font-semibold">GL</th>
                  <th className="px-2 pb-2 text-right font-semibold">Facturado</th>
                  <th className="px-2 pb-2 text-right font-semibold">Txns</th>
                </tr>
              </thead>
              <tbody>
                {(wip.data?.top_projects || []).slice(0, 8).map((p, i) => (
                  <tr key={i} className="border-t border-slate-100 transition hover:bg-slate-50/60">
                    <td className="px-2 py-2.5 font-mono text-xs text-slate-700">{p.doc_number}</td>
                    <td className="px-2 py-2.5 text-slate-500">{p.gl_label || p.gl_account}</td>
                    <td className="px-2 py-2.5 text-right font-semibold tabular-nums text-slate-800">
                      {eur(p.total_billed)}
                    </td>
                    <td className="px-2 py-2.5 text-right tabular-nums text-slate-400">
                      {p.transaction_count}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
