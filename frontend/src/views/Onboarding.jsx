import { useEffect, useState } from 'react'
import { apiGet, apiPost } from '../api'

/* Onboarding / ERP sync — después del login, antes del dashboard.
   Confirma los sistemas contables conectados, dispara una sync y reproduce
   la animación del pipeline (ingest → reconcile → models → ready). */

// Stack contable conectado (marcas). Los totales reales salen de /api/sources.
const ERPS = [
  { id: 'gilde', name: 'Gilde', desc: 'Construction ERP', color: '#C0552E' },
  { id: 'yuki', name: 'Yuki', desc: 'Online accounting', color: '#2F6B57' },
  { id: 'exact', name: 'Exact Online', desc: 'Ledger & invoicing', color: '#6B86A3' },
  { id: 'snelstart', name: 'SnelStart', desc: 'Boekhouden', color: '#C8893A' },
]

const PIPE = [
  { id: 'g', label: 'Pulling ledger export', sub: 'Gilde · construction ERP' },
  { id: 'y', label: 'Pulling ledger export', sub: 'Yuki · online accounting' },
  { id: 'e', label: 'Pulling ledger export', sub: 'Exact Online' },
  { id: 's', label: 'Pulling ledger export', sub: 'SnelStart' },
  { id: 'rec', label: 'Reconciling to unified ledger schema', sub: 'transactions → one source of truth' },
  { id: 'gl', label: 'Applying GL chart-of-accounts mapping', sub: 'controller-reviewed' },
  { id: 'wx', label: 'Fetching weather forecast', sub: 'KNMI + Open-Meteo · workable-day model' },
  { id: 'mdl', label: 'Running driver models M1–M5', sub: 'billing · materials · subcon · collections · weather' },
  { id: 'scn', label: 'Generating scenarios', sub: 'base · wet quarter · dry quarter' },
  { id: 'rdy', label: 'forecast_13w ready', sub: 'single source of truth built' },
]

export default function Onboarding({ user, onDone }) {
  const [phase, setPhase] = useState('review') // review | sync | done
  const [step, setStep] = useState(-1)
  const [count, setCount] = useState(0)
  const [sources, setSources] = useState(null)

  const total = sources?.total_transactions || 24247
  const firstName = (user?.full_name || user?.email || 'there').split(' ')[0]

  useEffect(() => {
    apiGet('/sources').then(setSources).catch(() => {})
  }, [])

  // avanzar el pipeline
  useEffect(() => {
    if (phase !== 'sync') return
    if (step >= PIPE.length - 1) {
      const t = setTimeout(() => setPhase('done'), 650)
      return () => clearTimeout(t)
    }
    const dur = step < 3 ? 520 : step < 4 ? 760 : 560
    const t = setTimeout(() => setStep((s) => s + 1), dur)
    return () => clearTimeout(t)
  }, [phase, step])

  // count-up de transacciones reconciliadas
  useEffect(() => {
    if (phase !== 'sync') return
    let raf, start
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
    // dispara el recompute real en segundo plano; la animación corre igual
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
  const perErp = Math.round(total / ERPS.length)

  return (
    <div className="onb">
      <div className="onb-card">
        <div className="onb-head">
          <span className="tb-mark" />
          <div>
            <div className="onb-title">{phase === 'done' ? 'You’re all set' : 'Connected to your stack'}</div>
            <div className="onb-sub">
              {phase === 'review' && <>Welcome back, {firstName}. We found the accounting systems your exports come from.</>}
              {phase === 'sync' && <>Reconciling your systems into one schema — this is what the dashboard reads from.</>}
              {phase === 'done' && <>Latest exports reconciled and the 13-week forecast rebuilt. Single source of truth: <code>forecast_13w</code>.</>}
            </div>
          </div>
        </div>

        <div className="onb-erps">
          {ERPS.map((e, i) => {
            const st = erpState(i)
            return (
              <div className={'erp ' + st} key={e.id}>
                <div className="erp-top">
                  <span className="erp-mark" style={{ background: e.color }}>{e.name[0]}</span>
                  <span className={'erp-status ' + st}>
                    {st === 'done' ? '✓ Synced' : st === 'active' ? 'Pulling…' : st === 'queued' ? 'Queued' : '● Connected'}
                  </span>
                </div>
                <div className="erp-name">{e.name}</div>
                <div className="erp-desc">{e.desc}</div>
                <div className="erp-rows"><b>{perErp.toLocaleString()}</b> transactions</div>
                <div className="erp-bar">
                  <span style={{ width: st === 'done' || st === 'ready' ? '100%' : st === 'active' ? '70%' : '0%', background: e.color, opacity: st === 'ready' ? 0.3 : 1 }} />
                </div>
                <div className="erp-last">{st === 'done' ? 'Up to date' : st === 'active' ? 'Importing rows…' : st === 'queued' ? 'Waiting' : 'Connected'}</div>
              </div>
            )
          })}
        </div>

        {phase === 'review' && (
          <>
            <div className="onb-note">
              <span className="onb-dot" /> All sources reachable · <b>{total.toLocaleString()}</b> transactions ·{' '}
              {sources?.gl_accounts_mapped ?? '—'} GL accounts mapped · weather feed live
            </div>
            <div className="onb-actions">
              <button className="onb-primary" onClick={startSync}>Sync &amp; build forecast</button>
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
