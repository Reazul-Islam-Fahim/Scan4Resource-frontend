import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { ApiError } from '../lib/api'
import * as api from '../lib/auth'

const AuthContext = createContext(null)

// `role` is the role's kind (buyer, corporate, seller, logistics, admin): it picks the dashboard. `roleKey` is the
// role itself, which may be one an admin made; `permissions` decide which pages and actions it gets.
const fromSession = (s) => {
  const entry = s.user.roles.find((r) => r.role === (s.role_key || s.role))
  return {
    token: s.token,
    user: s.user,
    role: s.role,
    roleKey: s.role_key || s.role,
    roleName: s.role_name || entry?.name || api.roleName(s.role),
    permissions: s.permissions || entry?.permissions || api.DEFAULT_PERMISSIONS[s.role] || [],
    status: entry?.status ?? 'active',
  }
}

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
      save({
        ...auth,
        user: me.user,
        status: me.status,
        role: me.role ?? auth.role,
        roleKey: me.role_key ?? auth.roleKey,
        roleName: me.role_name ?? auth.roleName,
        permissions: me.permissions ?? auth.permissions,
      })
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
      /** Whether this login's role has the permission (see the Roles page). */
      can(perm) {
        const perms = auth?.permissions ?? api.DEFAULT_PERMISSIONS[auth?.role] ?? []
        return perms.includes(perm)
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
