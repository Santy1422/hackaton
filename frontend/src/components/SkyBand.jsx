import { WEATHER_GLYPH, RISK_TONE } from '../altis/format'

/** Weather → workable days band. The shared "this is roofing, not generic BI" DNA. */
export default function SkyBand({ weeks, compact }) {
  if (!weeks?.length) return null
  return (
    <div className={'sky' + (compact ? ' compact' : '')}>
      <span className="sky-lab">FORECAST WEATHER → WORKABLE DAYS</span>
      <div className="sky-row">
        {weeks.map((w) => {
          const tone = RISK_TONE[w.weather_risk] || RISK_TONE.low
          return (
            <div
              key={w.week}
              className="sky-cell"
              style={{ background: `linear-gradient(180deg, ${tone}, ${tone}00)` }}
              title={`Week ${w.week} · ${w.rain_mm}mm rain · ${w.weather_risk} risk`}
            >
              <span className="sky-gl">{WEATHER_GLYPH[w.weather_risk] || '☀'}</span>
              <span className="sky-wd">{w.workable_days}</span>
              <span className="sky-wk">W{w.week}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
