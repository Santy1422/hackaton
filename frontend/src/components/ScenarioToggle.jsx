import { SCENARIOS } from '../api'

export default function ScenarioToggle({ scenario, onChange }) {
  return (
    <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1">
      {SCENARIOS.map((s) => (
        <button
          key={s.id}
          onClick={() => onChange(s.id)}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
            scenario === s.id
              ? 'bg-violet-600 text-white'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          {s.label}
        </button>
      ))}
    </div>
  )
}
