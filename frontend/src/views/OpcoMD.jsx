import { useState } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useApi, useForecastOpco } from '../hooks/useForecast'
import { COLORS, SCENARIOS, eur, eurK, errText, signed, sumKey } from '../altis/format'
import { Panel, Kpi, Skeleton, Empty, ChartTip } from '../components/primitives'
import OpcoTabs from '../components/OpcoTabs'

export default function OpcoMD({ scenario, lockedOpco }) {
  const [opco, setOpco] = useState(lockedOpco || 'Opco_B')
  const oId = lockedOpco || opco
  const fc = useForecastOpco(scenario, oId)
  const wip = useApi(`/wip/${oId}`, [oId])

  const weeks = (fc.data?.weeks || []).map((w) => ({ week: `W${w.forecast_week}`, net: Number(w.net_cashflow) }))
  const net13 = sumKey(fc.data?.weeks || [], 'net_cashflow')
  const s = wip.data?.summary

  return (
    <div className="view anim">
      <OpcoTabs opco={opco} setOpco={setOpco} locked={lockedOpco} />

      <div className="kpi-row k4">
        <Kpi label="WIP value" value={s ? eurK(s.wip_value) : '—'} accent="ink" sub={(s?.active_projects ?? '—') + ' active projects'} />
        <Kpi label="Weekly run-rate" value={s ? eurK(s.weekly_run_rate) : '—'} accent="green" sub="milestone billing" />
        <Kpi label="13-week net" value={fc.data ? signed(net13) : '—'} accent={net13 >= 0 ? 'green' : 'copper'} sub={SCENARIOS[scenario]?.label} />
        <Kpi
          label="Exposure risk"
          value={s ? s.risk_level.toUpperCase() : '—'}
          accent={s?.risk_level === 'high' ? 'copper' : s?.risk_level === 'medium' ? 'amber' : 'green'}
          sub="WIP vs schedule"
        />
      </div>

      <Panel title={'Net cash · 13 weeks · ' + oId} hint={SCENARIOS[scenario]?.label + ' scenario'}>
        <p className="panel-sub">
          Weekly net cash = collections in − (materials + subcontractors) out. Above zero the week
          generates cash; below zero it consumes it.
        </p>
        {fc.loading ? (
          <Skeleton height={250} />
        ) : fc.error ? (
          <Empty tone="error" title="Could not load forecast" hint={errText(fc.error)} />
        ) : (
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={weeks} margin={{ top: 12, right: 12, left: 4, bottom: 0 }}>
              <defs>
                <linearGradient id="opcoFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={COLORS.greenSoft} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={COLORS.greenSoft} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={COLORS.grid} vertical={false} />
              <XAxis dataKey="week" tickLine={false} axisLine={false} />
              <YAxis tickFormatter={eurK} tickLine={false} axisLine={false} width={56} />
              <Tooltip content={<ChartTip unit="net cash · per week" />} cursor={{ stroke: '#cbd5e1', strokeDasharray: '4 4' }} />
              <ReferenceLine y={0} stroke={COLORS.inkFaint} strokeWidth={1} />
              <Area dataKey="net" name="Net cash" stroke={COLORS.greenSoft} fill="url(#opcoFill)" strokeWidth={2.4} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </Panel>

      <Panel title="WIP exposure · top projects">
        {wip.loading ? (
          <Skeleton height={220} />
        ) : wip.error ? (
          <Empty tone="error" title="Could not load WIP exposure" hint={errText(wip.error)} />
        ) : (wip.data?.top_projects || []).length === 0 ? (
          <Empty title="No billing in the last 90 days" />
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>Doc</th>
                <th>Scope</th>
                <th>GL</th>
                <th className="r">Billed to date</th>
                <th className="r">Txns</th>
              </tr>
            </thead>
            <tbody>
              {(wip.data?.top_projects || []).slice(0, 8).map((p, i) => (
                <tr key={i}>
                  <td className="mono">{p.doc_number}</td>
                  <td className="muted">{p.gl_label || '—'}</td>
                  <td className="mono muted">{p.gl_account}</td>
                  <td className="r b">{eur(p.total_billed)}</td>
                  <td className="r muted">{p.transaction_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  )
}
