import { useState } from 'react'
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
import { useApi, useForecastOpco } from '../hooks/useForecast'
import {
  COLORS,
  WEATHER_GLYPH,
  normalizeWeather,
  errText,
  eur,
} from '../altis/format'
import { Panel, Skeleton, Empty, ChartTip } from '../components/primitives'
import OpcoTabs from '../components/OpcoTabs'
import SkyBand from '../components/SkyBand'

const fmtK = (v) => `${(Number(v) / 1000).toFixed(0)}k`

export default function ProjectLead({ scenario, lockedOpco }) {
  const [opco, setOpco] = useState(lockedOpco || 'Opco_B')
  const oId = lockedOpco || opco
  const fc = useForecastOpco(scenario, oId)
  const weatherApi = useApi('/weather', [])
  const ms = useApi(`/milestones/${oId}`, [oId])

  const weeks = normalizeWeather(weatherApi.data?.weeks || [])
  const next4 = weeks.slice(0, 4)
  const blocked = next4.some((w) => w.weather_risk === 'high')

  const bars = (fc.data?.weeks || []).map((w) => ({
    week: `W${w.forecast_week}`,
    billing: Number(w.d1_milestone_billing),
    materials: Math.abs(Number(w.d2_materials_outflow)),
  }))

  const list = ms.data?.milestones || []
  const next = list[0]

  return (
    <div className="view anim">
      <OpcoTabs opco={opco} setOpco={setOpco} locked={lockedOpco} />
      <SkyBand weeks={weeks} />

      <div className="lead-hero">
        <div className="lh-card">
          <div className="lh-eyebrow">NEXT INVOICEABLE MILESTONE</div>
          {ms.loading ? (
            <Skeleton height={120} />
          ) : ms.error ? (
            <Empty tone="error" title="Could not load milestones" hint={errText(ms.error)} />
          ) : next ? (
            <>
              <div className="lh-val">{eur(next.contract_value)}</div>
              <div className="lh-meta">
                <b>{next.doc_number}</b>
                {next.description ? ` · ${next.description}` : ''} · last billed {next.last_billed_date}
              </div>
              {blocked ? (
                <div className="lh-flag blocked">⚠ Weather window tightening — plan a drier slot</div>
              ) : (
                <div className="lh-flag ok">On schedule</div>
              )}
            </>
          ) : (
            <Empty title="No upcoming milestones" />
          )}
        </div>
        <div className="lh-card alt">
          <div className="lh-eyebrow">SCHEDULE RISK FROM WEATHER · NEXT 4 WEEKS</div>
          <div className="lh-weeks">
            {next4.map((w) => (
              <div className={'lhw ' + w.weather_risk} key={w.week}>
                <span className="lhw-g">{WEATHER_GLYPH[w.weather_risk] || '☀'}</span>
                <b>W{w.week}</b>
                <span>{w.workable_days}/5 days</span>
                <span className="lhw-r">{w.rain_mm}mm</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <Panel title="Materials outflow vs milestone billing" hint="materials are ordered ~2 weeks ahead of execution">
        {fc.loading ? (
          <Skeleton height={250} />
        ) : fc.error ? (
          <Empty tone="error" title="Could not load forecast" hint={errText(fc.error)} />
        ) : (
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={bars} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={COLORS.grid} vertical={false} />
              <XAxis dataKey="week" tickLine={false} axisLine={false} />
              <YAxis tickFormatter={fmtK} tickLine={false} axisLine={false} width={46} />
              <Tooltip content={<ChartTip />} cursor={{ fill: 'rgba(28,37,48,.05)' }} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
              <Bar dataKey="billing" name="Milestone billing" fill={COLORS.green} radius={[3, 3, 0, 0]} />
              <Bar dataKey="materials" name="Materials outflow" fill={COLORS.copper} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Panel>

      <Panel title="Upcoming milestones">
        {ms.loading ? (
          <Skeleton height={200} />
        ) : ms.error ? (
          <Empty tone="error" title="Could not load milestones" hint={errText(ms.error)} />
        ) : list.length === 0 ? (
          <Empty title="No milestones in the next 180 days" />
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>Doc</th>
                <th>Scope</th>
                <th className="r">Value</th>
                <th className="r">Last billed</th>
                <th className="r">Installments</th>
              </tr>
            </thead>
            <tbody>
              {list.slice(0, 8).map((m, i) => (
                <tr key={i}>
                  <td className="mono">{m.doc_number}</td>
                  <td className="muted">{m.description || m.gl_account}</td>
                  <td className="r b">{eur(m.contract_value)}</td>
                  <td className="r mono">{m.last_billed_date}</td>
                  <td className="r muted">{m.installments_billed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  )
}
