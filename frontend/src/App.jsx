import { useState } from 'react'
import { useAuth } from './auth/AuthContext'
import TopBar from './components/TopBar'
import Assistant from './components/Assistant'
import Login from './views/Login'
import Onboarding from './views/Onboarding'
import CFOView from './views/CFOView'
import PEBoard from './views/PEBoard'
import OpcoMD from './views/OpcoMD'
import ProjectLead from './views/ProjectLead'

const VIEW_BY_ROLE = {
  pe_board: { Comp: PEBoard, scenario: false, scoped: false },
  cfo: { Comp: CFOView, scenario: true, scoped: false },
  opco_md: { Comp: OpcoMD, scenario: true, scoped: true },
  project_lead: { Comp: ProjectLead, scenario: true, scoped: true },
}

export default function App() {
  const { user, loading, logout } = useAuth()
  // El onboarding (sync de ERPs) es "humo" de la demo: sale SIEMPRE tras login y
  // en cada recarga. Estado sólo en memoria → no se persiste a propósito.
  const [synced, setSynced] = useState(false)

  const finishSync = () => setSynced(true)
  const signOut = () => {
    setSynced(false)
    logout()
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', color: 'var(--ink-faint)', fontFamily: 'var(--mono)', fontSize: 13 }}>
        Loading…
      </div>
    )
  }
  if (!user) return <Login />
  if (!synced) return <Onboarding user={user} onDone={finishSync} />
  return <Dashboard user={user} onLogout={signOut} />
}

function Dashboard({ user, onLogout }) {
  const [scenario, setScenario] = useState('base')
  const view = VIEW_BY_ROLE[user.role]

  if (!view) {
    return (
      <div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', gap: 16 }}>
        <p>Unknown role: <code>{user.role}</code></p>
        <button className="rpt-btn" onClick={onLogout}>Sign out</button>
      </div>
    )
  }

  const { Comp, scenario: usesScenario, scoped } = view
  const props = {}
  if (usesScenario) props.scenario = scenario
  if (scoped) props.lockedOpco = user.opco

  return (
    <div>
      <TopBar
        user={user}
        scenario={scenario}
        setScenario={setScenario}
        showScenario={usesScenario}
        onSignOut={onLogout}
      />
      <main className="main">
        <div className="main-head">
          <h1>{user.role_label}</h1>
          <p>{user.description}</p>
        </div>
        <Comp {...props} />
      </main>
      <footer className="foot">
        Altis Groep · ingestion → reconciliation → driver model → scenario engine → role-based
        presentation · single source of truth: <code>forecast_13w</code>
      </footer>
      <Assistant scenario={scenario} />
    </div>
  )
}
