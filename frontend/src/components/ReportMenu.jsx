import { useState } from 'react'
import { SCENARIOS } from '../altis/format'
import { generateReport } from '../altis/reports'

/** "Reports" button → weekly / monthly PDF download (real data). */
export default function ReportMenu({ scenario = 'base' }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const run = async (kind) => {
    setOpen(false)
    setBusy(true)
    try {
      await generateReport(kind, scenario)
    } catch (e) {
      alert('Could not generate report: ' + (e?.message || e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rpt-menu">
      <button className="rpt-btn" onClick={() => setOpen((o) => !o)} disabled={busy} aria-haspopup="menu" aria-expanded={open}>
        <span className="rpt-ic">⬇</span>
        {busy ? 'Preparing…' : 'Reports'}
      </button>
      {open && (
        <>
          <div className="rpt-scrim" onClick={() => setOpen(false)} />
          <div className="rpt-pop" role="menu">
            <div className="rpt-pop-h">DOWNLOAD AS PDF · {SCENARIOS[scenario].label.toUpperCase()}</div>
            <button onClick={() => run('weekly')} role="menuitem">
              <b>Weekly report</b>
              <span>Week-by-week 13-week detail, drivers &amp; covenant</span>
            </button>
            <button onClick={() => run('monthly')} role="menuitem">
              <b>Monthly report</b>
              <span>Month roll-up, scenario comparison &amp; trends</span>
            </button>
          </div>
        </>
      )}
    </div>
  )
}
