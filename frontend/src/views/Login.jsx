import { useState } from 'react'
import { useAuth } from '../auth/AuthContext'

const DEMO_USERS = [
  { email: 'cfo@altis.com', title: 'Group CFO', initials: 'SB', scope: 'Consolidated · all opcos' },
  { email: 'board@altis.com', title: 'PE Board · Investment Director', initials: 'PdV', scope: 'Portfolio · covenant oversight' },
  { email: 'md@altis.com', title: 'Managing Director', initials: 'JM', scope: 'Opco_A · operating company' },
  { email: 'lead@altis.com', title: 'Project Lead', initials: 'EJ', scope: 'Opco_A · field' },
]
const DEMO_PASSWORD = 'altis2025'

const SKY = [
  ['☀', '4.6'],
  ['⛅', '3.1'],
  ['🌧', '2.4'],
  ['⛅', '3.6'],
  ['☀', '4.7'],
  ['☀', '4.4'],
]

export default function Login() {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [pwd, setPwd] = useState('')
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(false)

  const pick = (u) => {
    setEmail(u.email)
    setPwd(DEMO_PASSWORD)
    setErr(null)
  }

  const submit = async (e) => {
    e?.preventDefault()
    setErr(null)
    setBusy(true)
    try {
      await login(email.trim(), pwd)
    } catch (e2) {
      setErr(e2.message || 'Invalid credentials — pick a demo profile on the right.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login">
      <aside className="login-brand">
        <div className="lb-top">
          <span className="tb-mark" />
          <div className="lb-name">ALTIS <span>FORECAST</span></div>
        </div>
        <div className="lb-mid">
          <div className="lb-eyebrow">WEATHER-AWARE 13-WEEK LIQUIDITY</div>
          <h1>The forecast the finance team opens on a Monday — not a spreadsheet.</h1>
          <p>
            One reconciled data foundation across your accounting systems. Five cash drivers. Three
            scenarios. Every figure traces back to its source.
          </p>
        </div>
        <div className="lb-weather">
          {SKY.map(([g, d], i) => (
            <div className="lbw" key={i}>
              <span>{g}</span>
              <b>{d}</b>
            </div>
          ))}
        </div>
        <div className="lb-foot">Anonymised demo data · hackathon use only</div>
      </aside>

      <div className="login-form">
        <div className="lf-inner">
          <h2>Sign in</h2>
          <p className="lf-sub">Role-based access — you'll land on the view built for your seat.</p>
          <form onSubmit={submit}>
            <label htmlFor="email">Email</label>
            <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="cfo@altis.com" autoComplete="username" />
            <label htmlFor="pwd">Password</label>
            <input id="pwd" type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} placeholder="••••••••" autoComplete="current-password" />
            {err && <div className="lf-err">{err}</div>}
            <button type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
          </form>

          <div className="lf-demo">
            <div className="lf-demo-h">
              Demo profiles <span>click to autofill · {DEMO_PASSWORD}</span>
            </div>
            <div className="lf-demo-grid">
              {DEMO_USERS.map((u) => (
                <button
                  key={u.email}
                  className={'lf-user' + (email === u.email ? ' on' : '')}
                  onClick={() => pick(u)}
                  type="button"
                  aria-pressed={email === u.email}
                >
                  <span className="lf-av">{u.initials}</span>
                  <span className="lf-u-meta">
                    <b>{u.title.split(' · ')[0]}</b>
                    <span>{u.scope}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
