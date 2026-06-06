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
import {
  ROLE_ICON,
  IconLogout,
  IconTrending,
  IconWallet,
  IconLayers,
  IconBuilding,
} from './components/icons'

// Mapeo rol (del JWT) → vista. `scenario`: usa toggle. `scoped`: restringido a su opco.
const VIEW_BY_ROLE = {
  pe_board: { Comp: PEBoard, scenario: false, scoped: false },
  cfo: { Comp: CFOView, scenario: true, scoped: false },
  opco_md: { Comp: OpcoMD, scenario: true, scoped: true },
  project_lead: { Comp: ProjectLead, scenario: true, scoped: true },
}

// Etiquetas legibles para las "views" que trae el token (trazabilidad de rol).
const VIEW_LABELS = {
  covenant_headroom: 'Covenant headroom',
  portfolio_consolidated: 'Portfolio consolidado',
  cashflow_13w_by_driver: 'Cashflow 13s por driver',
  scenario_toggles: 'Escenarios',
  cross_opco_comparison: 'Comparación cross-opco',
  wip_exposure: 'Exposición WIP',
  project_risk_signals: 'Señales de riesgo',
  next_milestone: 'Próximo milestone',
  materials_outflow: 'Salida de materiales',
  weather_schedule_risk: 'Riesgo climático',
}

export default function App() {
  const { user, loading, logout } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="flex items-center gap-3 text-slate-400">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
          Cargando…
        </div>
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
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4">
        <p className="text-slate-500">
          Rol desconocido: <code>{user.role}</code>
        </p>
        <button
          onClick={onLogout}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white"
        >
          Salir
        </button>
      </div>
    )
  }

  const { Comp, scenario: usesScenario, scoped } = view
  const RoleIcon = ROLE_ICON[user.role] || IconBuilding
  const rev = stats?.revenue || {}
  const initials = (user.full_name || user.email || '?')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  const compProps = {}
  if (usesScenario) compProps.scenario = scenario
  if (scoped) compProps.lockedOpco = user.opco

  return (
    <div className="min-h-dvh text-slate-900">
      {/* ── Top bar ─────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-500 text-white shadow-sm shadow-indigo-600/30">
              <IconBuilding size={19} />
            </span>
            <div className="leading-tight">
              <h1 className="text-base font-bold tracking-tight text-slate-900">
                Altis <span className="text-indigo-600">Forecast</span>
              </h1>
              <p className="hidden text-[11px] text-slate-400 sm:block">
                Weather-aware 13-week cash flow
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {usesScenario && <ScenarioToggle scenario={scenario} onChange={setScenario} />}

            <div className="hidden h-8 w-px bg-slate-200 sm:block" />

            <div className="flex items-center gap-2.5">
              <div className="hidden text-right sm:block">
                <p className="text-sm font-semibold leading-tight text-slate-800">
                  {user.full_name}
                </p>
                <p className="text-[11px] text-slate-400">{user.email}</p>
              </div>
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
                {initials}
              </span>
              <button
                onClick={onLogout}
                aria-label="Cerrar sesión"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition hover:border-rose-300 hover:text-rose-600"
              >
                <IconLogout size={17} />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {/* ── Role banner ───────────────────────────────────── */}
        <div className="animate-fade-in mb-6 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3.5">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                <RoleIcon size={22} />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold tracking-tight text-slate-900">
                    {user.role_label}
                  </h2>
                  {user.opco && (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                      {user.opco}
                    </span>
                  )}
                </div>
                <p className="mt-0.5 max-w-2xl text-sm text-slate-500">{user.description}</p>
              </div>
            </div>
            {user.views?.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {user.views.map((v) => (
                  <span
                    key={v}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-500"
                  >
                    {VIEW_LABELS[v] || v}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── KPIs consolidados: sólo roles no restringidos ─── */}
        {!scoped && (
          <div className="animate-fade-in mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <KpiCard
              label="Revenue 2025"
              value={eur(rev.total_2025)}
              accent="green"
              icon={IconTrending}
              delta={
                rev.total_2024
                  ? ((rev.total_2025 - rev.total_2024) / rev.total_2024) * 100
                  : undefined
              }
              sub="vs 2024"
            />
            <KpiCard label="Revenue 2024" value={eur(rev.total_2024)} accent="slate" icon={IconWallet} />
            <KpiCard
              label="Transacciones"
              value={stats?.transactions?.total_rows?.toLocaleString() || '—'}
              accent="indigo"
              icon={IconLayers}
              sub="4 sistemas reconciliados"
            />
            <KpiCard
              label="GL mapeadas"
              value={stats?.transactions?.gl_accounts_mapped ?? '—'}
              accent="amber"
              icon={IconBuilding}
            />
          </div>
        )}

        <div className="animate-fade-in">
          <Comp {...compProps} />
        </div>
      </main>

      <footer className="mx-auto max-w-7xl px-6 py-8 text-center text-xs text-slate-400">
        Altis Groep · DuckDB-free Postgres + FastAPI + React · single source of truth:{' '}
        <code className="rounded bg-slate-100 px-1 py-0.5 text-slate-500">forecast_13w</code>
      </footer>
    </div>
  )
}
