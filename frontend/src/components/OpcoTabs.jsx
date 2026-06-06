import { OPCOS, opcoMeta } from '../altis/format'

/** Opco selector — locked badge for scoped roles, tab grid otherwise. */
export default function OpcoTabs({ opco, setOpco, locked }) {
  if (locked) {
    const o = opcoMeta(locked)
    return (
      <div className="opco-locked">
        <span>YOUR OPCO</span>
        {o.name} · {o.city}
      </div>
    )
  }
  return (
    <div className="opco-tabs">
      {OPCOS.map((o) => (
        <button key={o.id} className={opco === o.id ? 'on' : ''} onClick={() => setOpco(o.id)}>
          <b>{o.name}</b>
          <span>{o.city}</span>
        </button>
      ))}
    </div>
  )
}
