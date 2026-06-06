import ScenarioToggle from './ScenarioToggle'
import ReportMenu from './ReportMenu'

export default function TopBar({ user, scenario, setScenario, showScenario, onSignOut }) {
  const initials = (user.full_name || user.email || '?')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <header className="topbar">
      <div className="tb-brand">
        <span className="tb-mark" />
        <div>
          <div className="tb-name">
            ALTIS <span>FORECAST</span>
          </div>
          <div className="tb-tag">WEATHER-AWARE 13-WEEK LIQUIDITY · ROOFING PORTFOLIO</div>
        </div>
      </div>

      <div className="tb-right">
        <span className="tb-rolechip">
          <span className="dot" />
          {user.role_label}
          {user.opco ? ` · ${user.opco}` : ''}
        </span>
        {showScenario && <ScenarioToggle scenario={scenario} onChange={setScenario} />}
        <ReportMenu scenario={scenario} />
        <div className="tb-user">
          <span className="tb-avatar">{initials}</span>
          <div className="tb-u-meta">
            <b>{user.full_name}</b>
            <span>{user.email}</span>
          </div>
          <button className="tb-signout" onClick={onSignOut} title="Sign out" aria-label="Sign out">
            ⏻
          </button>
        </div>
      </div>
    </header>
  )
}
