import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { ApiError } from '../lib/api'
import * as api from '../lib/auth'

const AuthContext = createContext(null)

const fromSession = (s) => ({ token: s.token, user: s.user, role: s.role, status: s.user.roles.find((r) => r.role === s.role)?.status ?? 'active' })

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(() => api.loadAuth())

  const save = useCallback((next) => {
    api.storeAuth(next)
    setAuth(next)
  }, [])

  const logout = useCallback(() => save(null), [save])

  // Refresh the account (roles, verification status) once on load; an expired login is dropped.
  const refresh = useCallback(async () => {
    if (!auth?.token) return
    try {
      const me = await api.fetchMe(auth.token)
      save({ ...auth, user: me.user, status: me.status })
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) save(null)
    }
  }, [auth, save])

  useEffect(() => {
    refresh()
    // only on first load
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const value = useMemo(
    () => ({
      ...(auth ?? {}),
      loggedIn: !!auth?.token,
      async login(email, password, role) {
        const next = fromSession(await api.login(email, password, role))
        save(next)
        return next
      },
      async register(fields) {
        const next = fromSession(await api.register(fields))
        save(next)
        return next
      },
      async switchRole(role) {
        const next = fromSession(await api.switchRole(auth.token, role))
        save(next)
        return next
      },
      async addRole(fields) {
        const { user } = await api.addRole(auth.token, fields)
        save({ ...auth, user })
        return user
      },
      refresh,
      logout,
    }),
    [auth, save, refresh, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export default function useAuth() {
  return useContext(AuthContext)
}
