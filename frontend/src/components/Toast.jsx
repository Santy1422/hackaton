import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'

/**
 * Toasts in-app — reemplazan los alert()/confirm() del navegador con feedback
 * que habla el lenguaje visual del dashboard. useToast() devuelve helpers:
 *   const toast = useToast()
 *   toast.success('Sent ✓')
 *   toast.error('Could not send', 'Check the number format')
 */
const ToastCtx = createContext(null)

let _id = 0

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const timers = useRef(new Map())

  const dismiss = useCallback((id) => {
    setToasts((ts) => ts.filter((t) => t.id !== id))
    const tm = timers.current.get(id)
    if (tm) {
      clearTimeout(tm)
      timers.current.delete(id)
    }
  }, [])

  const push = useCallback(
    (tone, title, hint, ttl = 5200) => {
      const id = ++_id
      setToasts((ts) => [...ts, { id, tone, title, hint }])
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), ttl)
      )
      return id
    },
    [dismiss]
  )

  // Limpia timers pendientes al desmontar.
  useEffect(() => {
    const map = timers.current
    return () => map.forEach((t) => clearTimeout(t))
  }, [])

  const api = useMemo(
    () => ({
      success: (title, hint) => push('success', title, hint),
      error: (title, hint) => push('error', title, hint, 7000),
      info: (title, hint) => push('info', title, hint),
      show: push,
      dismiss,
    }),
    [push, dismiss]
  )

  return (
    <ToastCtx.Provider value={api}>
      {children}
      <div className="toast-wrap" role="region" aria-live="polite" aria-label="Notifications">
        {toasts.map((t) => (
          <div key={t.id} className={'toast ' + t.tone} role="status">
            <span className="toast-ic" aria-hidden="true">
              {t.tone === 'success' ? '✓' : t.tone === 'error' ? '!' : 'i'}
            </span>
            <div className="toast-txt">
              <b>{t.title}</b>
              {t.hint && <span>{t.hint}</span>}
            </div>
            <button className="toast-x" onClick={() => dismiss(t.id)} aria-label="Dismiss">
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast() {
  const ctx = useContext(ToastCtx)
  if (!ctx) throw new Error('useToast must be used within <ToastProvider>')
  return ctx
}
