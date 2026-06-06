import { SCENARIOS } from '../api'
import { SCENARIO_ICON } from './icons'

export default function ScenarioToggle({ scenario, onChange }) {
  return (
    <div className="inline-flex flex-col gap-1">
      <div
        role="radiogroup"
        aria-label="Escenario climático"
        className="inline-flex items-center gap-0.5 rounded-xl border border-slate-200 bg-white p-1 shadow-sm"
      >
        {SCENARIOS.map((s) => {
          const Icon = SCENARIO_ICON[s.id]
          const active = scenario === s.id
          return (
            <button
              key={s.id}
              role="radio"
              aria-checked={active}
              onClick={() => onChange(s.id)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                active
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
              }`}
            >
              {Icon && <Icon size={15} />}
              {s.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
