import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useCovenant, useApi, useStats } from '../hooks/useForecast'
import { useOpcos } from '../altis/hooks'
import { COLORS, errText, eurK, sharePct } from '../altis/format'
import { Panel, StatBox, Skeleton, Empty, ChartTip } from '../components/primitives'
import CovenantCard from '../components/CovenantCard'
import SavingsPanel from '../components/SavingsPanel'

export default function PEBoard() {
  const base = useCovenant('base')
  const wet = useCovenant('wet_qtr')
  const dry = useCovenant('dry_qtr')
  const { data: stats } = useStats()
  const { data: sources } = useApi('/sources', [])
  const systemsLabel = sources?.systems?.length
    ? sources.systems.map((s) => s.system).join(' · ')
    : 'reconciled into one schema'

  if (base.error)
    return <Empty tone="error" title="Could not load covenant data" hint={errText(base.error)} />

  const all = base.data?.all_scenarios
  const threshold = base.data?.covenant_threshold
  const worst = all
    ? Math.min(all.base?.final_headroom ?? 0, all.wet_qtr?.final_headroom ?? 0, all.dry_qtr?.final_headroom ?? 0)
    : null

  const merged = (base.data?.weeks || []).map((w, i) => ({
    week: `W${w.forecast_week}`,
    base: Number(w.cumulative_cf),
    wet_qtr: Number(wet.data?.weeks?.[i]?.cumulative_cf || 0),
    dry_qtr: Number(dry.data?.weeks?.[i]?.cumulative_cf || 0),
  }))

  // Años de revenue derivados de /stats (no hardcodeados): toma los dos más recientes.
  const rev = stats?.revenue || {}
  const revYears = Object.keys(rev)
    .map((k) => Number(k.replace('total_', '')))
    .filter(Boolean)
    .sort((a, b) => a - b)
  const yLatest = revYears[revYears.length - 1]
  const yPrior = revYears[revYears.length - 2]
  const revLatest = yLatest != null ? rev[`total_${yLatest}`] : null
  const revPrior = yPrior != null ? rev[`total_${yPrior}`] : null
  const delta =
    revPrior ? `${revLatest >= revPrior ? '+' : ''}${(((revLatest - revPrior) / revPrior) * 100).toFixed(1)}% vs ${yPrior}` : ''

  return (
    <div className="view anim">
      <div className="board-head">
        <div>
          <div className="hero-label">CONSOLIDATED COVENANT HEADROOM · WORST CASE</div>
          <div className="hero-big">{worst == null ? '—' : eurK(worst)}</div>
          <div className="hero-meta">
            Across all three scenarios · 4 operating companies ·{' '}
            {stats?.transactions?.total_rows?.toLocaleString() || '—'} reconciled transactions · single
            source of truth
          </div>
        </div>
        <StatBox
          rows={[
            { label: `Portfolio revenue ${yLatest ?? ''}`, value: revLatest != null ? eurK(revLatest) : '—', sub: delta },
            { label: 'Reconciled transactions', value: stats?.transactions?.total_rows?.toLocaleString() || '—', sub: systemsLabel },
            { label: 'GL accounts mapped', value: stats?.transactions?.gl_accounts_mapped ?? '—', sub: 'controller-reviewed' },
          ]}
        />
      </div>

      <div className="cov-grid">
        {all
          ? [
              ['Base scenario', 'base'],
              ['Wet quarter', 'wet_qtr'],
              ['Dry quarter', 'dry_qtr'],
            ].map(([label, id]) => (
              <Panel key={id} title={label}>
                <CovenantCard headroom={all[id]?.final_headroom || 0} status={all[id]?.status} threshold={threshold} />
              </Panel>
            ))
          : Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} height={210} />)}
      </div>

      <Panel title="Cumulative cash · 13 weeks · three scenarios" hint={`covenant floor ${eurK(threshold)}`}>
        <p className="panel-sub">
          Running cash balance week by week under each weather scenario. As long as every line stays
          above the dashed floor, the bank covenant holds.
        </p>
        {base.loading ? (
          <Skeleton height={300} />
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={merged} margin={{ top: 14, right: 12, left: 4, bottom: 0 }}>
              <CartesianGrid stroke={COLORS.grid} vertical={false} />
              <XAxis dataKey="week" tickLine={false} axisLine={false} />
              <YAxis tickFormatter={eurK} tickLine={false} axisLine={false} width={56} />
              <Tooltip content={<ChartTip unit="cumulative cash · end of week" />} cursor={{ stroke: '#cbd5e1', strokeDasharray: '4 4' }} />
              {threshold != null && (
                <ReferenceLine y={threshold} stroke={COLORS.copper} strokeDasharray="5 4" strokeWidth={1.4}
                  label={{ value: `Covenant floor ${eurK(threshold)}`, position: 'insideBottomRight', fill: COLORS.copper, fontSize: 10 }} />
              )}
              <Line dataKey="base" name="Base (normal weather)" stroke={COLORS.ink} strokeWidth={2.4} dot={false} />
              <Line dataKey="wet_qtr" name="Wet quarter (more rain)" stroke={COLORS.rain} strokeWidth={2.2} dot={false} />
              <Line dataKey="dry_qtr" name="Dry quarter (fewer delays)" stroke={COLORS.green} strokeWidth={2.2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
        <div className="legend">
          <span><i className="ln" style={{ background: COLORS.ink }} />Base · normal weather</span>
          <span><i className="ln" style={{ background: COLORS.rain }} />Wet quarter · more rain delays</span>
          <span><i className="ln" style={{ background: COLORS.green }} />Dry quarter · fewer delays</span>
          <span><i className="dl" style={{ borderColor: COLORS.copper }} />Covenant floor · bank minimum</span>
        </div>
      </Panel>

      <Panel title="Operating companies">
        <OpcoCards />
      </Panel>

      <SavingsPanel />
    </div>
  )
}

function OpcoCards() {
  const { opcos } = useOpcos()
  return (
    <div className="opco-cards">
      {opcos.map((o) => (
        <OpcoCard key={o.id} opco={o} />
      ))}
    </div>
  )
}

function OpcoCard({ opco }) {
  const { data } = useApi(`/wip/${opco.id}`, [opco.id])
  const s = data?.summary
  return (
    <div className="opco-card">
      <div className="oc-name">{opco.name || opco.id}</div>
      <div className="oc-city">{sharePct(opco.share) || `${(opco.transactions || 0).toLocaleString()} txns`}</div>
      <div className="oc-stats">
        <div>
          <span>WIP</span>
          <b>{s ? eurK(s.wip_value) : '—'}</b>
        </div>
        <div>
          <span>Projects</span>
          <b>{s?.active_projects ?? '—'}</b>
        </div>
        <div>
          <span>Risk</span>
          <b className={s ? 'risk-' + s.risk_level : ''}>{s?.risk_level || '—'}</b>
        </div>
      </div>
    </div>
  )
}
