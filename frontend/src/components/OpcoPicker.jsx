import { OPCOS } from '../api'
import { IconLayers } from './icons'

/**
 * Selector de operating company. Si `lockedOpco` viene del token (roles scoped),
 * muestra un badge fijo en vez del selector.
 */
export default function OpcoPicker({ opco, onChange, lockedOpco }) {
  if (lockedOpco) {
    return (
      <div className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-700">
        <IconLayers size={15} />
        <span className="text-[11px] font-medium uppercase tracking-wide text-indigo-400">
          Tu opco
        </span>
        {lockedOpco}
      </div>
    )
  }

  return (
    <div className="inline-flex flex-wrap items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
      {OPCOS.map((o) => {
        const active = opco === o
        return (
          <button
            key={o}
            onClick={() => onChange(o)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              active
                ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
            }`}
          >
            {o}
          </button>
        )
      })}
    </div>
  )
}
