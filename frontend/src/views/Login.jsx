import { useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import {
  IconBuilding,
  IconShield,
  IconTrending,
  IconLayers,
  IconHardHat,
  IconChevronRight,
  IconAlert,
} from '../components/icons'

const DEMO_USERS = [
  { email: 'board@altis.com', label: 'PE Board', name: 'Pieter de Vries', opco: '—', icon: IconShield },
  { email: 'cfo@altis.com', label: 'CFO', name: 'Sandra Bakker', opco: '—', icon: IconTrending },
  { email: 'md@altis.com', label: 'Opco MD', name: 'Johan Mulder', opco: 'Opco_A', icon: IconLayers },
  { email: 'lead@altis.com', label: 'Project Lead', name: 'Eva Janssen', opco: 'Opco_A', icon: IconHardHat },
]
const DEMO_PASSWORD = 'altis2025'

const HIGHLIGHTS = [
  'Forecast de cash flow a 13 semanas, weather-aware',
  'Una sola fuente de verdad reconciliada de 4 sistemas',
  'Trazabilidad: cada cifra → driver → assumption → fuente',
]

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
    <div className="flex min-h-dvh items-center justify-center p-4">
      <div className="animate-scale-in grid w-full max-w-5xl overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-2xl shadow-slate-300/40 lg:grid-cols-[1.05fr_1fr]">
        {/* ── Panel de marca ──────────────────────────────── */}
        <div className="relative hidden flex-col justify-between overflow-hidden bg-slate-900 p-9 text-white lg:flex">
          <div
            className="pointer-events-none absolute inset-0 opacity-80"
            style={{
              backgroundImage:
                'radial-gradient(600px 300px at 80% 0%, rgba(99,102,241,0.35), transparent 60%), radial-gradient(500px 300px at 0% 100%, rgba(14,165,233,0.25), transparent 55%)',
            }}
          />
          <div className="relative">
            <div className="flex items-center gap-2.5">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-400 shadow-lg shadow-indigo-900/40">
                <IconBuilding size={21} />
              </span>
              <div className="leading-tight">
                <p className="text-lg font-bold tracking-tight">Altis Forecast</p>
                <p className="text-xs text-slate-400">Altis Groep · roofing portfolio</p>
              </div>
            </div>

            <h2 className="mt-10 text-2xl font-bold leading-snug tracking-tight">
              Decisiones de tesorería que el CFO abre un lunes,
              <span className="text-indigo-300"> no una hoja de cálculo.</span>
            </h2>

            <ul className="mt-7 space-y-3">
              {HIGHLIGHTS.map((h) => (
                <li key={h} className="flex items-start gap-2.5 text-sm text-slate-300">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-500/20 text-indigo-300">
                    <IconChevronRight size={13} />
                  </span>
                  {h}
                </li>
              ))}
            </ul>
          </div>

          <p className="relative text-xs text-slate-500">
            Datos anonimizados · licenciados solo para el hackathon
          </p>
        </div>

        {/* ── Formulario ──────────────────────────────────── */}
        <div className="p-8 sm:p-10">
          <div className="mb-7 lg:hidden">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-500 text-white">
              <IconBuilding size={21} />
            </span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Iniciar sesión</h1>
          <p className="mt-1 text-sm text-slate-400">Acceso por perfil al panel de forecast</p>

          <form onSubmit={submit} className="mt-7 space-y-4">
            <div>
              <label htmlFor="email" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="cfo@altis.com"
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                required
              />
            </div>
            <div>
              <label htmlFor="password" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Contraseña
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                required
              />
            </div>

            {error && (
              <div
                role="alert"
                className="flex items-center gap-2 rounded-xl bg-rose-50 px-3 py-2.5 text-sm text-rose-700 ring-1 ring-inset ring-rose-600/15"
              >
                <IconAlert size={16} />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white shadow-sm shadow-indigo-600/30 transition hover:bg-indigo-700 disabled:opacity-60"
            >
              {busy && (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              )}
              {busy ? 'Entrando…' : 'Entrar'}
            </button>
          </form>

          {/* Usuarios demo */}
          <div className="mt-7">
            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-slate-100" />
              <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                Usuarios demo
              </span>
              <div className="h-px flex-1 bg-slate-100" />
            </div>
            <p className="mt-2 text-center text-[11px] text-slate-400">
              Click para autocompletar · contraseña{' '}
              <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-slate-600">
                {DEMO_PASSWORD}
              </code>
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {DEMO_USERS.map((u) => (
                <button
                  key={u.email}
                  onClick={() => pickDemo(u)}
                  className="group flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left transition hover:border-indigo-300 hover:bg-indigo-50/40"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 transition group-hover:bg-indigo-100 group-hover:text-indigo-600">
                    <u.icon size={16} />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-semibold text-slate-700">
                      {u.label}
                    </span>
                    <span className="block truncate text-[11px] text-slate-400">{u.opco}</span>
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
