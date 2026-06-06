import { useState } from 'react'
import { eur } from './api'
import { useAuth } from './auth/AuthContext'
import { useStats } from './hooks/useForecast'
import ScenarioToggle from './components/ScenarioToggle'
import KpiCard from './components/KpiCard'
import Login from './views/Login'
import PEBoard from './views/PEBoard'
import CFOView from './views/CFOView'
import OpcoMD from './views/OpcoMD'
import ProjectLead from './views/ProjectLead'

// Mapeo rol (del JWT) → vista. `scenario`: usa toggle de escenarios.
// `scoped`: la vista se restringe al opco del usuario.
const VIEW_BY_ROLE = {
  pe_board: { Comp: PEBoard, scenario: false, scoped: false },
  cfo: { Comp: CFOView, scenario: true, scoped: false },
  opco_md: { Comp: OpcoMD, scenario: true, scoped: true },
  project_lead: { Comp: ProjectLead, scenario: true, scoped: true },
}

export default function App() {
  const { user, loading, logout } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-400">
        Cargando…
      </div>
    )
  }

  if (!user) return <Login />

  return <Dashboard user={user} onLogout={logout} />
}

function Dashboard({ user, onLogout }) {
  const [scenario, setScenario] = useState('base')
  const { data: stats } = useStats()

  const view = VIEW_BY_ROLE[user.role]

  if (!view) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50">
        <p className="text-slate-500">
          Rol desconocido: <code>{user.role}</code>
        </p>
        <button
          onClick={onLogout}
          className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white"
        >
          Salir
        </button>
      </div>
    )
  }

  const { Comp, scenario: usesScenario, scoped } = view
  const rev = stats?.revenue || {}

  const compProps = {}
  if (usesScenario) compProps.scenario = scenario
  if (scoped) compProps.lockedOpco = user.opco

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-4">
          <div>
            <h1 className="text-xl font-bold text-violet-700">Altis Forecast</h1>
            <p className="text-xs text-slate-400">
              {user.role_label}
              {user.opco ? ` · ${user.opco}` : ''} ·{' '}
              {stats?.transactions?.total_rows?.toLocaleString() || '—'} txns
            </p>
          </div>

          <div className="flex items-center gap-4">
            {usesScenario && (
              <ScenarioToggle scenario={scenario} onChange={setScenario} />
            )}
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-sm font-medium text-slate-700">
                  {user.full_name}
                </p>
                <p className="text-xs text-slate-400">{user.email}</p>
              </div>
              <button
                onClick={onLogout}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-500 transition hover:border-rose-300 hover:text-rose-600"
              >
                Salir
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-6">
        <div className="mb-2">
          <h2 className="text-lg font-semibold text-slate-700">
            {user.role_label}
          </h2>
          <p className="text-sm text-slate-400">{user.description}</p>
        </div>

        {/* KPIs consolidados: sólo para roles no restringidos a un opco. */}
        {!scoped && (
          <div className="mb-6 mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
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
        )}

        <div className={scoped ? 'mt-4' : ''}>
          <Comp {...compProps} />
        </div>
      </main>

      <footer className="mx-auto max-w-6xl px-6 py-6 text-center text-xs text-slate-400">
        Altis Groep · DuckDB + FastAPI + React · single source of truth: forecast_13w
      </footer>
    </div>
  )
}
