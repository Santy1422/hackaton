import { useState } from 'react'
import { useAuth } from '../auth/AuthContext'

const DEMO_USERS = [
  { email: 'board@altis.com', label: 'PE Board', name: 'Pieter de Vries', opco: '—' },
  { email: 'cfo@altis.com', label: 'CFO', name: 'Sandra Bakker', opco: '—' },
  { email: 'md@altis.com', label: 'Opco MD', name: 'Johan Mulder', opco: 'Opco_A' },
  { email: 'lead@altis.com', label: 'Project Lead', name: 'Eva Janssen', opco: 'Opco_A' },
]
const DEMO_PASSWORD = 'altis2025'

export default function Login() {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e?.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await login(email.trim(), password)
    } catch (err) {
      setError(err.message || 'No se pudo iniciar sesión')
    } finally {
      setBusy(false)
    }
  }

  const pickDemo = (u) => {
    setEmail(u.email)
    setPassword(DEMO_PASSWORD)
    setError(null)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="grid w-full max-w-4xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm md:grid-cols-2">
        {/* Formulario */}
        <div className="p-8">
          <h1 className="text-2xl font-bold text-violet-700">Altis Forecast</h1>
          <p className="mt-1 text-sm text-slate-400">
            13-week cash flow · acceso por perfil
          </p>

          <form onSubmit={submit} className="mt-8 space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium uppercase text-slate-400">
                Email
              </label>
              <input
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="cfo@altis.com"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase text-slate-400">
                Contraseña
              </label>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
                required
              />
            </div>

            {error && (
              <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-lg bg-violet-600 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:opacity-60"
            >
              {busy ? 'Entrando…' : 'Iniciar sesión'}
            </button>
          </form>
        </div>

        {/* Usuarios demo */}
        <div className="border-t border-slate-200 bg-slate-50 p-8 md:border-l md:border-t-0">
          <h2 className="text-sm font-semibold text-slate-700">Usuarios demo</h2>
          <p className="mt-1 text-xs text-slate-400">
            Click para autocompletar · contraseña{' '}
            <code className="rounded bg-slate-200 px-1 py-0.5 text-slate-600">
              {DEMO_PASSWORD}
            </code>
          </p>
          <div className="mt-4 space-y-2">
            {DEMO_USERS.map((u) => (
              <button
                key={u.email}
                onClick={() => pickDemo(u)}
                className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm transition hover:border-violet-400 hover:bg-violet-50"
              >
                <span>
                  <span className="block font-medium text-slate-700">{u.label}</span>
                  <span className="block text-xs text-slate-400">{u.email}</span>
                </span>
                <span className="text-xs text-slate-400">{u.opco}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
