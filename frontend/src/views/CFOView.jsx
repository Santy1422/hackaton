import { useState } from 'react'
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useScenarioWeeks } from '../altis/hooks'
import { useCovenant } from '../hooks/useForecast'
import { COLORS, eur, eurK, signed, sumKey } from '../altis/format'
import { Panel, StatBox, DriverChips, Skeleton, Empty, ChartTip } from '../components/primitives'
import SkyBand from '../components/SkyBand'
import AuditModal from '../components/AuditModal'
import BillingDriversPanel from '../components/BillingDriversPanel'

const fmtK = (v) => `${(Number(v) / 1000).toFixed(0)}k`

export default function CFOView({ scenario }) {
  const [week, setWeek] = useState(null)
  const { weeks, loading, error } = useScenarioWeeks(scenario)
  const cov = useCovenant(scenario)
  const cs = cov.data?.summary
  const threshold = cov.data?.covenant_threshold

  if (error) return <Empty tone="error" title="Could not load forecast" hint={error} />
  if (!loading && !weeks.length) return <Empty title="No forecast computed" hint="Run the scenario engine." />

  const last = weeks[weeks.length - 1] || {}
  const totalNet = sumKey(weeks, 'net_cashflow')
  const lowWeek = weeks.reduce((m, w) => (w.cumulative_cf < m.cumulative_cf ? w : m), weeks[0] || {})
  const weatherWeeks = weeks.filter((w) => w.weather_risk !== 'low').length
  const chart = weeks.map((w) => ({
    week: `W${w.week}`,
    forecast_week: w.week,
    inflow: Number(w.gross_inflow),
    outflow: Number(w.gross_outflow),
    cumulative: Number(w.cumulative_cf),
  }))

  return (
    <div className="view anim">
      <SkyBand weeks={weeks} />

      <div className="cfo-hero">
        <div>
          <div className="hero-label">PROJECTED CASH POSITION · END OF WEEK 13</div>
          <div className="hero-big">{loading ? '—' : eur(last.cumulative_cf)}</div>
          <div className="hero-meta">
            Net <b className={totalNet >= 0 ? 'pos' : 'neg'}>{signed(totalNet)}</b> over 13 weeks ·
            covenant floor {threshold != null ? eurK(threshold) : '—'} held with{' '}
            <b className="copper">{cs ? eurK(cs.final_headroom) : '—'}</b> worst-case headroom
          </div>
        </div>
        <StatBox
          rows={[
            { label: 'Lowest point', value: eurK(lowWeek.cumulative_cf), sub: 'week ' + (lowWeek.week || '—') },
            { label: 'Weather-hit weeks', value: weatherWeeks, sub: 'of 13 below par' },
            {
              label: 'Covenant status',
              value: cs?.status ?? '—',
              tone: cs?.status === 'SAFE' ? 'ok' : cs?.status === 'WATCH' ? 'warn' : cs?.status === 'BREACH' ? 'danger' : '',
              sub: 'worst case across horizon',
            },
          ]}
        />
      </div>

      <Panel title="The 13 weeks ahead" hint="click any column → audit trail">
        <p className="panel-sub">
          Customer collections (in) against materials &amp; subcontractor outflows. The line is cash on
          hand; the dashed rule is the bank covenant floor.
        </p>
        {loading ? (
          <Skeleton height={330} />
        ) : (
          <ResponsiveContainer width="100%" height={330}>
            <ComposedChart data={chart} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={COLORS.grid} vertical={false} />
              <XAxis dataKey="week" tickLine={false} axisLine={false} />
              <YAxis tickFormatter={fmtK} tickLine={false} axisLine={false} width={46} />
              <Tooltip content={<ChartTip />} cursor={{ fill: 'rgba(28,37,48,.05)' }} />
              {threshold != null && (
                <ReferenceLine y={threshold} stroke={COLORS.copper} strokeDasharray="5 4"
                  strokeWidth={1.4} ifOverflow="extendDomain" />
              )}
              <Bar dataKey="inflow" name="Collections in" fill={COLORS.green} radius={[3, 3, 0, 0]}
                onClick={(d) => setWeek(d.forecast_week)} cursor="pointer" />
              <Bar dataKey="outflow" name="Materials + subcontractors" fill={COLORS.copper} radius={[0, 0, 3, 3]}
                onClick={(d) => setWeek(d.forecast_week)} cursor="pointer" />
              <Line dataKey="cumulative" name="Cumulative cash" stroke={COLORS.ink} strokeWidth={2.4}
                dot={false} activeDot={{ r: 4 }} />
            </ComposedChart>
          </ResponsiveContainer>
        )}
        <div className="legend">
          <span><i style={{ background: COLORS.green }} />Collections in</span>
          <span><i style={{ background: COLORS.copper }} />Materials + subcontractors out</span>
          <span><i className="ln" style={{ background: COLORS.ink }} />Cumulative cash</span>
          <span><i className="dl" style={{ borderColor: COLORS.copper }} />Covenant floor</span>
        </div>
      </Panel>

      <Panel title="What moves the number" hint="five independently tunable streams">
        {loading ? <Skeleton height={120} /> : <DriverChips weeks={weeks} />}
      </Panel>

      <BillingDriversPanel />

      {week && (
        <AuditModal
          scenario={scenario}
          week={week}
          weekObj={weeks.find((w) => w.week === week)}
          onClose={() => setWeek(null)}
        />
      )}
    </div>
  )
}
