import { useOpcos } from '../altis/hooks'

/** Opco selector — locked badge for scoped roles, data-driven tabs otherwise. */
export default function OpcoTabs({ opco, setOpco, locked }) {
  if (locked) {
    return (
      <div className="opco-locked">
        <span>YOUR OPCO</span>
        {locked}
      </div>
    )
  }
  return <OpcoTabsList opco={opco} setOpco={setOpco} />
}

function OpcoTabsList({ opco, setOpco }) {
  const { opcos } = useOpcos()
  return (
    <div className="opco-tabs">
      {opcos.map((o) => (
        <button key={o.id} className={opco === o.id ? 'on' : ''} onClick={() => setOpco(o.id)}>
          <b>{o.name || o.id}</b>
          <span>{o.transactions ? `${o.transactions.toLocaleString()} txns` : 'operating company'}</span>
        </button>
      ))}
    </div>
  )
}
