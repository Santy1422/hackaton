import { useEffect, useRef, useState } from 'react'
import { apiPost } from '../api'

/**
 * Asistente in-app (Claude sobre forecast_13w) vía POST /api/notify/ask.
 * Mismo motor que el bot de WhatsApp; aquí responde dentro del dashboard.
 * Sin `to` → solo devuelve la respuesta (no envía WhatsApp).
 */
const SUGGESTIONS = [
  'What is the covenant headroom in the base case?',
  'Which week is the cash low point and why?',
  'How does the wet quarter change the forecast?',
]

export default function Assistant() {
  const [open, setOpen] = useState(false)
  const [msgs, setMsgs] = useState([])
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const bodyRef = useRef(null)

  // Mantén la conversación pegada al fondo: al enviar, al responder y al escribir.
  useEffect(() => {
    bodyRef.current?.scrollTo(0, 1e6)
  }, [msgs, busy])

  const ask = async (question) => {
    const text = (question ?? q).trim()
    if (!text || busy) return
    setQ('')
    setMsgs((m) => [...m, { role: 'user', text }])
    setBusy(true)
    try {
      const res = await apiPost('/notify/ask', { question: text })
      setMsgs((m) => [...m, { role: 'bot', text: res.answer || '—' }])
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
            {msgs.map((m, i) => (
              <div key={i} className={`asst-msg ${m.role}${m.err ? ' err' : ''}`}>{m.text}</div>
            ))}
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
