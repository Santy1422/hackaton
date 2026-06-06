import { createContext, useContext, useEffect, useState } from 'react'
import { apiGet, apiPost, clearToken, getToken, setToken } from '../api'

const AuthCtx = createContext(null)

/**
 * Provee el usuario autenticado a toda la app.
 * - Al montar, si hay token guardado lo valida contra `/auth/me`.
 * - `login(email, pass)` guarda el JWT y setea el usuario.
 * - `logout()` limpia token + usuario.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  // Sólo arrancamos en "loading" si hay un token que validar contra /auth/me.
  const [loading, setLoading] = useState(() => !!getToken())

  useEffect(() => {
    if (!getToken()) return
    apiGet('/auth/me')
      .then(setUser)
      .catch(() => clearToken()) // token inválido/expirado → fuera
      .finally(() => setLoading(false))
  }, [])

  // Si una request en cualquier parte detecta token muerto, cerramos sesión.
  useEffect(() => {
    const onLogout = () => setUser(null)
    window.addEventListener('auth:logout', onLogout)
    return () => window.removeEventListener('auth:logout', onLogout)
  }, [])

  const login = async (email, password) => {
    const { access_token, user: u } = await apiPost('/auth/login', {
      email,
      password,
    })
    setToken(access_token)
    setUser(u)
    return u
  }

  const logout = () => {
    clearToken()
    setUser(null)
  }

  return (
    <AuthCtx.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthCtx.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthCtx)
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>')
  return ctx
}
