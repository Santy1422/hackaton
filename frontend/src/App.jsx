import { useState } from 'react'
import { eur } from './api'
import { useStats } from './hooks/useForecast'
import ScenarioToggle from './components/ScenarioToggle'
import KpiCard from './components/KpiCard'
import PEBoard from './views/PEBoard'
import CFOView from './views/CFOView'
import OpcoMD from './views/OpcoMD'
import ProjectLead from './views/ProjectLead'

const ROLES = [
  { id: 'pe', label: 'PE Board', Comp: PEBoard, scoped: false },
  { id: 'cfo', label: 'CFO', Comp: CFOView, scoped: true },
  { id: 'opco', label: 'Opco MD', Comp: OpcoMD, scoped: true },
  { id: 'lead', label: 'Project Lead', Comp: ProjectLead, scoped: true },
]

export default function App() {
  const [role, setRole] = useState('pe')
  const [scenario, setScenario] = useState('base')
  const { data: stats } = useStats()

  const active = ROLES.find((r) => r.id === role)
  const Comp = active.Comp
  const rev = stats?.revenue || {}

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-4">
          <div>
            <h1 className="text-xl font-bold text-violet-700">Altis Forecast</h1>
            <p className="text-xs text-slate-400">
              13-week cash flow · {stats?.transactions?.total_rows?.toLocaleString() || '—'} txns
            </p>
          </div>
          <ScenarioToggle scenario={scenario} onChange={setScenario} />
        </div>

        <div className="mx-auto flex max-w-6xl gap-1 px-6">
          {ROLES.map((r) => (
            <button
              key={r.id}
              onClick={() => setRole(r.id)}
              className={`border-b-2 px-4 py-2 text-sm font-medium transition ${
                role === r.id
                  ? 'border-violet-600 text-violet-700'
                  : 'border-transparent text-slate-400 hover:text-slate-700'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-6">
        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <KpiCard label="Revenue 2025" value={eur(rev.total_2025)} accent="green" />
          <KpiCard label="Revenue 2024" value={eur(rev.total_2024)} accent="slate" />
          <KpiCard
            label="Transacciones"
            value={stats?.transactions?.total_rows?.toLocaleString() || '—'}
            accent="slate"
          />
          <KpiCard
            label="GL mapeadas"
            value={stats?.transactions?.gl_accounts_mapped ?? '—'}
            accent="violet"
          />
        </div>

        {active.scoped ? <Comp scenario={scenario} /> : <Comp />}
      </main>

      <footer className="mx-auto max-w-6xl px-6 py-6 text-center text-xs text-slate-400">
        Altis Groep · DuckDB + FastAPI + React · single source of truth: forecast_13w
      </footer>
    </div>
  )
}
