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
import { useApi } from '../hooks/useForecast'
import { COLORS, eur, eurK } from '../altis/format'
import { Panel, Kpi, Skeleton, Empty, ChartTip } from './primitives'

/** ROI of the system: annual savings per opco (DSO + cash buffer + weather). */
export default function SavingsPanel() {
  const { data, loading, error } = useApi('/savings', [])

  if (error) return null // optional analysis — hide if endpoint absent

  const rows = (data?.opcos || []).map((o) => ({
    opco: o.opco,
    DSO: o.dso_annual_saving,
    Buffer: o.buffer_annual_saving,
    Weather: o.weather_annual_saving,
  }))
  const p = data?.portfolio

  return (
    <Panel title="Estimated annual savings by opco" hint="ROI · DSO + cash buffer + weather (calibrated)">
      <p className="panel-sub">
        Yearly cash benefit per operating company from acting on the forecast: collecting faster (DSO),
        holding a thinner safety buffer, and planning around weather. Taller bar = bigger upside.
      </p>
      {loading ? (
        <Skeleton height={300} />
      ) : rows.length === 0 ? (
        <Empty title="No savings model available" />
      ) : (
        <>
          {p && (
            <div className="kpi-row k4" style={{ gridTemplateColumns: 'repeat(3,1fr)', marginBottom: 14 }}>
              <Kpi label="Portfolio annual saving" value={eur(p.total_annual_saving)} accent="green" />
              <Kpi label="Cash released · DSO" value={eur(p.dso_cash_released)} accent="ink" />
              <Kpi label="Buffer reduced" value={eur(p.buffer_cash_released)} accent="amber" />
            </div>
          )}
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={rows} margin={{ top: 10, right: 12, left: 4, bottom: 0 }}>
              <CartesianGrid stroke={COLORS.grid} vertical={false} />
              <XAxis dataKey="opco" tickLine={false} axisLine={false} />
              <YAxis tickFormatter={eurK} tickLine={false} axisLine={false} width={56} />
              <Tooltip content={<ChartTip unit="estimated saving · per year" />} cursor={{ fill: 'rgba(28,37,48,.05)' }} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
              <Bar dataKey="DSO" name="Faster collections (DSO)" stackId="s" fill={COLORS.green} />
              <Bar dataKey="Buffer" name="Thinner cash buffer" stackId="s" fill={COLORS.ink} />
              <Bar dataKey="Weather" name="Weather planning" stackId="s" fill={COLORS.rain} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          {data?.assumptions && (
            <p className="panel-sub" style={{ marginTop: 12, marginBottom: 0, fontSize: 11.5 }}>
              Assumptions: cost of capital {Math.round(data.assumptions.cost_of_capital * 100)}% · buffer
              reduction {Math.round(data.assumptions.forecast_buffer_reduction * 100)}% · weather calibrated to
              empirical confidence (R²≈{data.assumptions.weather_signal_calibration}).
            </p>
          )}
        </>
      )}
    </Panel>
  )
}
