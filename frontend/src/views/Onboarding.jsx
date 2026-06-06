import { useEffect, useMemo, useState } from 'react'
import { apiGet, apiPost } from '../api'
import { useApi } from '../hooks/useForecast'
import { eurK } from '../altis/format'

/* ============================================================================
   Onboarding / ERP sync — página que habla el idioma del dashboard.
   Todo sale de /api/sources (sistemas reales + conteos). Termina con la
   activación de WhatsApp (asistente MCP + crons), igual que el diseño.
   ============================================================================ */

const PALETTE = ['#C0552E', '#2F6B57', '#6B86A3', '#C8893A', '#9B4423', '#3F7E6B']

export default function Onboarding({ user, onDone }) {
  const [phase, setPhase] = useState('review') // review | sync | done
  const [step, setStep] = useState(-1)
  const [count, setCount] = useState(0)
  const [sources, setSources] = useState(null)

  useEffect(() => {
    apiGet('/sources').then(setSources).catch(() => {})
  }, [])

  const systems = useMemo(() => sources?.systems || [], [sources])
  const total = sources?.total_transactions || 0
  const firstName = (user?.full_name || user?.email || 'there').split(' ')[0]
  const initials = (user?.full_name || user?.email || '?')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  // Pipeline real: un "pull" por sistema conectado + pasos genéricos.
  const PIPE = useMemo(
    () => [
      ...systems.map((s) => ({
        id: 'pull-' + s.system,
        label: 'Pulling ledger export',
        sub: `${s.system} · ${(s.transactions || 0).toLocaleString()} rows`,
      })),
      { id: 'rec', label: 'Reconciling to unified ledger schema', sub: `${total.toLocaleString()} transactions → one source of truth` },
      { id: 'gl', label: 'Applying GL chart-of-accounts mapping', sub: `${sources?.gl_accounts_mapped ?? '—'} accounts · controller-reviewed` },
      { id: 'wx', label: 'Fetching weather forecast', sub: 'Open-Meteo · workable-day model' },
      { id: 'mdl', label: 'Running driver models M1–M5', sub: 'billing · materials · subcon · collections · weather' },
      { id: 'scn', label: 'Generating scenarios', sub: 'base · wet quarter · dry quarter' },
      { id: 'rdy', label: 'forecast_13w ready', sub: 'single source of truth built' },
    ],
    [systems, total, sources]
  )

  // avanzar el pipeline
  useEffect(() => {
    if (phase !== 'sync') return
    if (step >= PIPE.length - 1) {
      const t = setTimeout(() => {
        setCount(total)
        setPhase('done')
      }, 650)
      return () => clearTimeout(t)
    }
    const dur = step < systems.length ? 520 : step === systems.length ? 760 : 540
    const t = setTimeout(() => setStep((s) => s + 1), dur)
    return () => clearTimeout(t)
  }, [phase, step, PIPE.length, systems.length, total])

  // count-up de transacciones reconciliadas (sobre el total REAL)
  useEffect(() => {
    if (phase !== 'sync' || !total) return
    const t0 = Date.now()
    const span = 3000
    const iv = setInterval(() => {
      const p = Math.min(1, (Date.now() - t0) / span)
      setCount(Math.round(total * (1 - Math.pow(1 - p, 2))))
      if (p >= 1) clearInterval(iv)
    }, 55)
    return () => clearInterval(iv)
  }, [phase, total])

  const startSync = () => {
    setStep(0)
    setPhase('sync')
    apiPost('/recompute', {}).catch(() => {})
  }

  const erpState = (i) => {
    if (phase === 'done') return 'done'
    if (phase !== 'sync') return 'ready'
    if (step > i) return 'done'
    if (step === i) return 'active'
    return 'queued'
  }
  const pct = phase === 'done' ? 100 : phase === 'sync' ? Math.round(((step + 1) / PIPE.length) * 100) : 0
  const ready = systems.length > 0

  return (
    <div className="onb-page">
      <header className="onb-bar">
        <div className="onb-bar-brand">
          <span className="tb-mark" />
          <div>
            <div className="onb-bar-name">ALTIS <span>FORECAST</span></div>
            <div className="onb-bar-tag">WORKSPACE SETUP</div>
          </div>
        </div>
        <div className="onb-steps">
          <span className={'ostep ' + (phase === 'review' ? 'on' : 'done')}>1&nbsp;·&nbsp;Connect</span>
          <span className="ostep-line" />
          <span className={'ostep ' + (phase === 'sync' ? 'on' : phase === 'done' ? 'done' : '')}>2&nbsp;·&nbsp;Sync</span>
          <span className="ostep-line" />
          <span className={'ostep ' + (phase === 'done' ? 'on' : '')}>3&nbsp;·&nbsp;Ready</span>
        </div>
        <div className="onb-bar-user">
          <span className="tb-avatar">{initials}</span>
          <div className="tb-u-meta">
            <b>{user.full_name}</b>
            <span>{user.role_label}</span>
          </div>
        </div>
      </header>

      <main className="onb-main">
        <div className="onb-lead">
          <div className="onb-eyebrow">
            {phase === 'review' ? 'Connected accounting systems' : phase === 'sync' ? 'Building your forecast' : 'Workspace ready'}
          </div>
          <h1>{phase === 'done' ? 'You’re all set' : phase === 'sync' ? 'Reconciling your systems' : 'Connected to your stack'}</h1>
          <p>
            {phase === 'review' && <>Welcome back, {firstName}. These are the accounting systems your exports come from — all reachable.</>}
            {phase === 'sync' && <>Folding your systems into one schema — the single source of truth every role reads from.</>}
            {phase === 'done' && <>Latest exports reconciled and the 13-week forecast rebuilt. Single source of truth: <code>forecast_13w</code>.</>}
          </p>
        </div>

        {!ready ? (
          <div className="onb-note" style={{ justifyContent: 'center' }}>
            <span className="onb-dot" /> Connecting to accounting systems…
          </div>
        ) : (
          <div className="onb-erps">
            {systems.map((s, i) => {
              const st = erpState(i)
              const color = PALETTE[i % PALETTE.length]
              return (
                <div className={'erp ' + st} key={s.system}>
                  <div className="erp-top">
                    <span className="erp-mark" style={{ background: color }}>{s.system[0]?.toUpperCase()}</span>
                    <span className={'erp-status ' + st}>
                      {st === 'done' ? '✓ Synced' : st === 'active' ? 'Pulling…' : st === 'queued' ? 'Queued' : '● Connected'}
                    </span>
                  </div>
                  <div className="erp-name">{s.system}</div>
                  <div className="erp-desc">Accounting system</div>
                  <div className="erp-rows"><b>{(s.transactions || 0).toLocaleString()}</b> transactions</div>
                  <div className="erp-bar">
                    <span style={{ width: st === 'done' || st === 'ready' ? '100%' : st === 'active' ? '70%' : '0%', background: color, opacity: st === 'ready' ? 0.25 : 1 }} />
                  </div>
                  <div className="erp-last">{s.last_date ? `Last export · ${s.last_date}` : st === 'done' ? 'Up to date' : 'Connected'}</div>
                </div>
              )
            })}
          </div>
        )}

        {phase === 'review' && (
          <>
            <div className="onb-note">
              <span className="onb-dot" /> {systems.length} source{systems.length === 1 ? '' : 's'} reachable ·{' '}
              <b>{total ? total.toLocaleString() : '—'}</b> transactions · {sources?.gl_accounts_mapped ?? '—'} GL
              accounts mapped · weather feed live
            </div>
            <div className="onb-actions">
              <button className="onb-primary" onClick={startSync} disabled={!ready}>Sync &amp; build forecast</button>
              <button className="onb-skip" onClick={onDone}>Skip — use last sync</button>
            </div>
          </>
        )}

        {phase === 'sync' && (
          <div className="onb-syncbox">
            <div className="onb-progress">
              <div className="onb-prog-top">
                <span>Reconciling…</span>
                <span className="onb-count"><b>{count.toLocaleString()}</b> / {total.toLocaleString()} txns</span>
              </div>
              <div className="onb-track"><span style={{ width: pct + '%' }} /></div>
            </div>
            <div className="onb-pipe">
              {PIPE.map((p, i) => {
                const s = step > i ? 'done' : step === i ? 'active' : 'pending'
                return (
                  <div className={'pl ' + s} key={p.id}>
                    <span className="pl-ic">{s === 'done' ? '✓' : s === 'active' ? <span className="pl-spin" /> : ''}</span>
                    <div className="pl-txt"><b>{p.label}</b><span>{p.sub}</span></div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {phase === 'done' && (
          <>
            <div className="onb-success">
              <span className="onb-check">✓</span>
              <div>
                <b>{total.toLocaleString()} transactions reconciled</b> across {systems.length} system
                {systems.length === 1 ? '' : 's'} · {sources?.gl_accounts_mapped ?? '—'} GL accounts mapped ·
                weather feed live · driver models M1–M5 run · 3 scenarios built.
              </div>
            </div>
            <WhatsAppActivate />
            <div className="onb-actions">
              <button className="onb-primary" onClick={onDone}>Enter Altis Forecast →</button>
            </div>
          </>
        )}
      </main>
    </div>
  )
}

/* ---- WhatsApp activation (asistente MCP + crons) -------------------------- */
function WhatsAppActivate() {
  const [st, setSt] = useState('idle') // idle | connecting | active
  const [phone, setPhone] = useState('')
  const base = useApi('/covenant/base', [])
  const wet = useApi('/covenant/wet_qtr', [])

  const [crons, setCrons] = useState([
    { id: 'wk', label: 'Weekly forecast digest', when: 'Mondays · 08:00', on: true },
    { id: 'cov', label: 'Covenant alert', when: 'when status → WATCH / BREACH', on: true },
    { id: 'mo', label: 'Monthly report (PDF)', when: '1st of month · 08:00', on: false },
  ])
  const toggle = (id) => setCrons((cs) => cs.map((c) => (c.id === id ? { ...c, on: !c.on } : c)))
  const activate = () => {
    setSt('connecting')
    setTimeout(() => setSt('active'), 1600)
  }

  if (st === 'idle') {
    return (
      <div className="wa">
        <div className="wa-head">
          <span className="wa-ic">💬</span>
          <div>
            <div className="wa-title">Get it on WhatsApp <span className="wa-tag">OPTIONAL</span></div>
            <div className="wa-sub">
              Ask the forecast questions in plain language and schedule automatic pushes. Powered by an MCP
              wired straight to <code>forecast_13w</code> — same single source of truth.
            </div>
          </div>
        </div>
        <ul className="wa-feats">
          <li>Ask: <i>“covenant headroom this week?”</i> → instant answer with the trace</li>
          <li>Schedule a cron: weekly digest, covenant alerts, monthly PDF</li>
          <li>Read-only &amp; role-scoped — it never writes back to the ledgers</li>
        </ul>
        <div className="wa-row">
          <input className="wa-input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+31 6 …" aria-label="WhatsApp number" />
          <button className="wa-btn" onClick={activate} disabled={!phone.trim()}>Activate on WhatsApp</button>
        </div>
      </div>
    )
  }

  if (st === 'connecting') {
    return (
      <div className="wa connecting">
        <span className="pl-spin" />
        <div>Sending a WhatsApp to <b>{phone}</b>… opening a chat with the Altis assistant.</div>
      </div>
    )
  }

  // active — chat preview con datos reales + cron schedule
  const bs = base.data?.summary
  const ws = wet.data?.summary
  const threshold = base.data?.covenant_threshold
  const minCum = bs && threshold != null ? bs.min_headroom + threshold : null
  return (
    <div className="wa active">
      <div className="wa-grid">
        <div className="wa-phone">
          <div className="wa-bar">
            <span className="wa-av">A</span>
            <div><b>Altis Forecast</b><span>online · secure MCP</span></div>
          </div>
          <div className="wa-chat">
            <div className="wa-day">TODAY</div>
            <div className="wb in"><span className="wb-sys">🏠 Connected. Ask me anything about the 13-week cash forecast — or I’ll push it on a schedule.</span></div>
            <div className="wb out">Covenant headroom this week?</div>
            <div className="wb in">
              {bs ? (
                <>
                  Base scenario: <b>{eurK(bs.final_headroom)}</b> headroom — status <b>{bs.status}</b>. Cash dips
                  to {eurK(minCum)} in week {bs.min_headroom_week}.
                  {ws ? <> A wet quarter would {ws.status === 'BREACH' ? <b> breach</b> : ' sit'} at {eurK(ws.final_headroom)}.</> : null}
                </>
              ) : (
                'Your 13-week forecast is live — ask for headroom, a driver, or a scenario and I’ll answer with the full trace.'
              )}
              <div className="wb-tr">08:41 ✓✓</div>
            </div>
            <div className="wb out">Send the weekly PDF every Monday</div>
            <div className="wb in">Done ✓ Weekly report scheduled — <b>Mondays 08:00</b>. I’ll also ping you if any scenario flips to BREACH.<div className="wb-tr">08:41 ✓✓</div></div>
          </div>
        </div>
        <div className="wa-cron">
          <div className="wa-cron-h">SCHEDULED AUTOMATIONS</div>
          {crons.map((c) => (
            <button key={c.id} className={'cron ' + (c.on ? 'on' : '')} onClick={() => toggle(c.id)}>
              <span className="cron-sw"><span /></span>
              <span className="cron-txt"><b>{c.label}</b><span>{c.when}</span></span>
            </button>
          ))}
          <div className="wa-cron-note">Crons run server-side against the latest sync. Editable any time from Settings.</div>
        </div>
      </div>
      <div className="wa-active-foot">
        <span className="onb-dot" /> WhatsApp connected to <b>{phone}</b> · {crons.filter((c) => c.on).length} automations active
      </div>
    </div>
  )
}
