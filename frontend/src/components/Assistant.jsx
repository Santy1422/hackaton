import { useEffect, useRef, useState } from 'react'
import { apiDownload, apiPost } from '../api'

/**
 * Asistente in-app (Claude sobre forecast_13w) vía POST /api/notify/ask.
 * Mismo motor que el bot de WhatsApp. Cuando piden un informe, genera y descarga
 * el PDF de verdad (mismo generador que el botón Reports).
 */
const SUGGESTIONS = [
  'What is the covenant headroom in the base case?',
  'Which week is the cash low point and why?',
  'Download the weekly PDF report',
]

// Intención de informe + cadencia desde la pregunta.
const wantsReport = (t) => /\b(pdf|report|informe|reporte|download|descarg)\w*/i.test(t)
const isMonthly = (t) => /\b(month|monthly|mensual|mes)\w*/i.test(t)

/** Mini-markdown: *bold* / **bold** + saltos de línea → nodos React. */
function rich(text) {
  return String(text)
    .split('\n')
    .map((line, li) => (
      <span key={li} className="asst-line">
        {line.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).map((part, pi) => {
          const m = part.match(/^\*\*?([^*]+?)\*\*?$/)
          return m ? <strong key={pi}>{m[1]}</strong> : <span key={pi}>{part}</span>
        })}
      </span>
    ))
}

export default function Assistant({ scenario = 'base' }) {
  const [open, setOpen] = useState(false)
  const [msgs, setMsgs] = useState([])
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const bodyRef = useRef(null)

  useEffect(() => {
    bodyRef.current?.scrollTo(0, 1e6)
  }, [msgs, busy])

  // Descarga directa del PDF server-side (sin mensaje nuevo).
  const downloadPdf = () =>
    apiDownload(`/reports/download/${scenario}`, `altis-forecast-${scenario}.pdf`)

  // Primera generación con estado visible en el chat.
  const runReport = async (kind) => {
    const at = { i: 0 }
    setMsgs((m) => {
      at.i = m.length
      return [...m, { role: 'bot', report: kind, scenario, status: 'working' }]
    })
    try {
      await downloadPdf()
      setMsgs((m) => m.map((x, i) => (i === at.i ? { ...x, status: 'done' } : x)))
    } catch (e) {
      setMsgs((m) => m.map((x, i) => (i === at.i ? { ...x, status: 'error', err: e.message } : x)))
    }
  }

  const ask = async (question) => {
    const text = (question ?? q).trim()
    if (!text || busy) return
    setQ('')
    setMsgs((m) => [...m, { role: 'user', text }])
    setBusy(true)
    try {
      const res = await apiPost('/notify/ask', { question: text })
      setMsgs((m) => [...m, { role: 'bot', text: res.answer || '—' }])
      if (wantsReport(text)) await runReport(isMonthly(text) ? 'monthly' : 'weekly')
    } catch (e) {
      const msg = e.hint ? `${e.message} — ${e.hint}` : e.message || 'assistant unavailable'
      setMsgs((m) => [...m, { role: 'bot', text: `⚠ ${msg}`, err: true }])
    } finally {
      setBusy(false)
      requestAnimationFrame(() => bodyRef.current?.scrollTo(0, 1e6))
    }
  }

  return (
    <>
      <button className="asst-fab" onClick={() => setOpen((o) => !o)} aria-label="Ask the assistant">
        {open ? '×' : 'Ask AI'}
      </button>

      {open && (
        <div className="asst-panel anim">
          <div className="asst-head">
            <b>Forecast assistant</b>
            <span>Claude · grounded in forecast_13w</span>
          </div>

          <div className="asst-body" ref={bodyRef}>
            {msgs.length === 0 && (
              <div className="asst-empty">
                <p>Ask anything about the 13-week forecast, covenant or drivers.</p>
                {SUGGESTIONS.map((s) => (
                  <button key={s} className="asst-chip" onClick={() => ask(s)}>{s}</button>
                ))}
              </div>
            )}

            {msgs.map((m, i) =>
              m.report ? (
                <ReportMsg key={i} m={m} onDownload={downloadPdf} onRetry={() => runReport(m.report)} />
              ) : (
                <div key={i} className={`asst-msg ${m.role}${m.err ? ' err' : ''}`}>
                  {m.role === 'bot' ? rich(m.text) : m.text}
                  {m.role === 'bot' && !m.err && (
                    <button className="asst-pdf" onClick={() => runReport('weekly')}>
                      📄 Download PDF report
                    </button>
                  )}
                </div>
              )
            )}
            {busy && <div className="asst-msg bot typing">…</div>}
          </div>

          <form className="asst-input" onSubmit={(e) => { e.preventDefault(); ask() }}>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Ask the forecast…"
              disabled={busy}
            />
            <button type="submit" disabled={busy || !q.trim()}>Send</button>
          </form>
        </div>
      )}
    </>
  )
}

function ReportMsg({ m, onDownload, onRetry }) {
  const label = m.report === 'monthly' ? 'Monthly' : 'Weekly'
  return (
    <div className={`asst-msg bot report${m.status === 'error' ? ' err' : ''}`}>
      {m.status === 'working' && <>📄 Generating the {label.toLowerCase()} PDF report…</>}
      {m.status === 'done' && (
        <>
          ✓ {label} PDF report ready.
          <button className="asst-pdf" onClick={onDownload}>📄 Download PDF</button>
        </>
      )}
      {m.status === 'error' && (
        <>
          ⚠ Could not generate the report{m.err ? ` — ${m.err}` : ''}.
          <button className="asst-pdf" onClick={onRetry}>Retry</button>
        </>
      )}
    </div>
  )
}
