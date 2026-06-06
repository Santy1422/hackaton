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
  const [srcErr, setSrcErr] = useState(null)
  const [reload, setReload] = useState(0)

  useEffect(() => {
    let on = true
    apiGet('/sources')
      .then((d) => {
        if (!on) return
        setSources(d)
        setSrcErr(null)
      })
      .catch((e) => on && setSrcErr(e.hint || e.message || 'Could not reach accounting systems.'))
    return () => {
      on = false
    }
  }, [reload])

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

        {srcErr ? (
          <div className="onb-note onb-note-err" style={{ justifyContent: 'space-between' }}>
            <span>⚠ {srcErr}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="onb-skip" onClick={() => setReload((n) => n + 1)}>Retry</button>
              <button className="onb-skip" onClick={onDone}>Skip</button>
            </div>
          </div>
        ) : !ready ? (
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

        {phase === 'review' && !srcErr && ready && (
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

/* ---- WhatsApp activation -------------------------------------------------
   Sin template aprobado no enviamos por API (eso mostraba "dry-run / no
   configurado" y parecía roto). En su lugar abrimos WhatsApp directo al número
   de Altis con el primer mensaje ya escrito (wa.me): un toque y a enviar.
   ------------------------------------------------------------------------- */
// Número del asistente de Altis (E.164). Override con VITE_WA_NUMBER si hace falta.
const WA_NUMBER = (import.meta.env.VITE_WA_NUMBER || '+15559919064').replace(/\D/g, '')
const WA_DISPLAY = '+1 555 991 9064'

function WhatsAppActivate() {
  const base = useApi('/covenant/base', [])

  // Crons 100% del backend: catálogo + estado persistido por usuario.
  const autos = useApi('/notify/automations', [])
  const [crons, setCrons] = useState([])
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (autos.data?.automations) setCrons(autos.data.automations)
  }, [autos.data])
  const toggle = (id) => {
    const next = !crons.find((c) => c.id === id)?.enabled
    setCrons((cs) => cs.map((c) => (c.id === id ? { ...c, enabled: next } : c)))
    apiPost('/notify/automations', { id, enabled: next }).catch(() => {})
  }

  // Primer mensaje pre-cargado: lleva el headroom real para arrancar la charla.
  const s = base.data?.summary
  const firstMsg = s
    ? `Hi Altis Forecast 👋 Connect me to the 13-week cash forecast. Covenant (base) is ${eurK(s.final_headroom)} headroom — ${s.status}. What changed this week?`
    : 'Hi Altis Forecast 👋 Connect me to the 13-week cash forecast.'
  const waUrl = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(firstMsg)}`

  return (
    <div className="wa">
      <div className="wa-head">
        <span className="wa-ic">💬</span>
        <div>
          <div className="wa-title">Get it on WhatsApp <span className="wa-tag">LIVE</span></div>
          <div className="wa-sub">
            Ask the forecast in plain language and schedule automatic pushes. Powered by an MCP
            wired straight to <code>forecast_13w</code> — same single source of truth.
          </div>
        </div>
      </div>
      <ul className="wa-feats">
        <li>Ask: <i>“covenant headroom this week?”</i> → instant answer with the trace</li>
        <li>Schedule a cron: weekly digest, covenant alerts, monthly PDF</li>
        <li>Read-only &amp; role-scoped — it never writes back to the ledgers</li>
      </ul>

      <div className="wa-preview">
        <span className="wa-preview-lab">YOUR FIRST MESSAGE</span>
        <div className="wb out">{firstMsg}</div>
      </div>

      <a className="wa-cta" href={waUrl} target="_blank" rel="noopener noreferrer">
        <span className="wa-cta-ic" aria-hidden="true">💬</span>
        Open WhatsApp — one tap to send
      </a>
      <div className="wa-cta-note">
        Opens a chat with Altis Forecast (<b>{WA_DISPLAY}</b>) with the message ready — just hit send.
      </div>

      {crons.length > 0 && (
        <div className="wa-cron" style={{ marginTop: 16 }}>
          <div className="wa-cron-h">SCHEDULED AUTOMATIONS</div>
          {crons.map((c) => (
            <button key={c.id} className={'cron ' + (c.enabled ? 'on' : '')} onClick={() => toggle(c.id)}>
              <span className="cron-sw"><span /></span>
              <span className="cron-txt"><b>{c.label}</b><span>{c.schedule}</span></span>
            </button>
          ))}
          <div className="wa-cron-note">Crons run server-side against the latest sync. Editable any time from Settings.</div>
        </div>
      )}
    </div>
  )
}
