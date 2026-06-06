const OPTS = [
  ['base', 'Base', 'Normal weather — the expected 13-week path'],
  ['wet_qtr', 'Wet', 'Wetter quarter — more rain days defer roof work and billing'],
  ['dry_qtr', 'Dry', 'Drier quarter — fewer weather delays, work pulls forward'],
]

export default function ScenarioToggle({ scenario, onChange }) {
  return (
    <div className="scn-toggle" role="radiogroup" aria-label="Scenario">
      <span className="scn-lab">SCENARIO</span>
      {OPTS.map(([id, l, hint]) => (
        <button
          key={id}
          role="radio"
          aria-checked={scenario === id}
          aria-label={hint}
          title={hint}
          className={scenario === id ? 'on' : ''}
          onClick={() => onChange(id)}
        >
          {l}
        </button>
      ))}
    </div>
  )
}
