const OPTS = [
  ['base', 'Base'],
  ['wet_qtr', 'Wet'],
  ['dry_qtr', 'Dry'],
]

export default function ScenarioToggle({ scenario, onChange }) {
  return (
    <div className="scn-toggle" role="radiogroup" aria-label="Scenario">
      <span className="scn-lab">SCENARIO</span>
      {OPTS.map(([id, l]) => (
        <button
          key={id}
          role="radio"
          aria-checked={scenario === id}
          className={scenario === id ? 'on' : ''}
          onClick={() => onChange(id)}
        >
          {l}
        </button>
      ))}
    </div>
  )
}
