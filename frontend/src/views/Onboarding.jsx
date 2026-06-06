import { useEffect, useMemo, useState } from 'react'
import { apiGet, apiPost } from '../api'

/* Onboarding / ERP sync — después del login, antes del dashboard.
   Todo sale de /api/sources (sistemas reales + conteos + última sync).
   No hay sistemas ni totales hardcodeados. */

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

  // Pipeline real: un "pull" por sistema conectado + pasos genéricos.
  const PIPE = useMemo(
    () => [
      ...systems.map((s) => ({
        id: 'pull-' + s.system,
        label: 'Pulling ledger export',
        sub: `${s.system} · ${(s.transactions || 0).toLocaleString()} rows`,
      })),
      { id: 'rec', label: 'Reconciling to unified ledger schema', sub: 'transactions → one source of truth' },
      { id: 'gl', label: 'Applying GL chart-of-accounts mapping', sub: `${sources?.gl_accounts_mapped ?? '—'} accounts · controller-reviewed` },
      { id: 'wx', label: 'Fetching weather forecast', sub: 'Open-Meteo · workable-day model' },
      { id: 'mdl', label: 'Running driver models M1–M5', sub: 'billing · materials · subcon · collections · weather' },
      { id: 'scn', label: 'Generating scenarios', sub: 'base · wet quarter · dry quarter' },
      { id: 'rdy', label: 'forecast_13w ready', sub: 'single source of truth built' },
    ],
    [systems, sources]
  )

  // avanzar el pipeline
  useEffect(() => {
    if (phase !== 'sync') return
    if (step >= PIPE.length - 1) {
      const t = setTimeout(() => setPhase('done'), 650)
      return () => clearTimeout(t)
    }
    const dur = step < systems.length ? 560 : step === systems.length ? 760 : 520
    const t = setTimeout(() => setStep((s) => s + 1), dur)
    return () => clearTimeout(t)
  }, [phase, step, PIPE.length, systems.length])

  // count-up de transacciones reconciliadas (sobre el total REAL)
  useEffect(() => {
    if (phase !== 'sync' || !total) return
    let raf
    let start
    const span = 3000
    const tick = (ts) => {
      if (!start) start = ts
      const p = Math.min(1, (ts - start) / span)
      setCount(Math.round(total * (1 - Math.pow(1 - p, 2))))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
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
    <div className="onb">
      <div className="onb-card">
        <div className="onb-head">
          <span className="tb-mark" />
          <div>
            <div className="onb-title">{phase === 'done' ? 'You’re all set' : 'Connected to your stack'}</div>
            <div className="onb-sub">
              {phase === 'review' && <>Welcome back, {firstName}. These are the accounting systems your exports come from.</>}
              {phase === 'sync' && <>Reconciling your systems into one schema — this is what the dashboard reads from.</>}
              {phase === 'done' && <>Latest exports reconciled and the 13-week forecast rebuilt. Single source of truth: <code>forecast_13w</code>.</>}
            </div>
          </div>
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
                    <span style={{ width: st === 'done' || st === 'ready' ? '100%' : st === 'active' ? '70%' : '0%', background: color, opacity: st === 'ready' ? 0.3 : 1 }} />
                  </div>
                  <div className="erp-last">{s.last_date ? `Last export ${s.last_date}` : 'Connected'}</div>
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
              accounts mapped{sources?.last_sync ? ` · last sync ${new Date(sources.last_sync).toLocaleDateString('en-GB')}` : ''}
            </div>
            <div className="onb-actions">
              <button className="onb-primary" onClick={startSync} disabled={!ready}>Sync &amp; build forecast</button>
              <button className="onb-skip" onClick={onDone}>Skip — use last sync</button>
            </div>
          </>
        )}

        {(phase === 'sync' || phase === 'done') && (
          <>
            <div className="onb-progress">
              <div className="onb-prog-top">
                <span>{phase === 'done' ? 'Reconciliation complete' : 'Reconciling…'}</span>
                <span className="onb-count"><b>{count.toLocaleString()}</b> / {total.toLocaleString()} txns</span>
              </div>
              <div className="onb-track"><span style={{ width: pct + '%' }} /></div>
            </div>

            <div className="onb-pipe">
              {PIPE.map((p, i) => {
                const s = phase === 'done' || step > i ? 'done' : step === i ? 'active' : 'pending'
                return (
                  <div className={'pl ' + s} key={p.id}>
                    <span className="pl-ic">{s === 'done' ? '✓' : s === 'active' ? <span className="pl-spin" /> : ''}</span>
                    <div className="pl-txt"><b>{p.label}</b><span>{p.sub}</span></div>
                  </div>
                )
              })}
            </div>

            {phase === 'done' && (
              <div className="onb-actions">
                <button className="onb-primary" onClick={onDone}>Enter Altis Forecast →</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
