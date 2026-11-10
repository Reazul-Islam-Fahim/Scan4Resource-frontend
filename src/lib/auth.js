import { request } from './api'

// Accounts live in the backend (/auth/*). The token is kept in localStorage so a login survives a reload,
// and it is handed to the logistics app when someone opens it (see logisticsUrl).

const KEY = 's4r.auth'
const LOGISTICS_URL = (import.meta.env.VITE_LOGISTICS_URL || '').trim().replace(/\/+$/, '')

export const ROLES = [
  { role: 'buyer', name: 'Buyer', text: 'Buy reclaimed materials and have them delivered.' },
  { role: 'corporate', name: 'Corporate buyer', text: 'Buy in bulk and run tenders for your company.' },
  { role: 'seller', name: 'Seller', text: 'Scan buildings and sell what can be reused.' },
  { role: 'logistics', name: 'Logistics company', text: 'Pick up and deliver materials for sellers and buyers.' },
  { role: 'admin', name: 'Admin', text: 'Run the platform: accounts, payouts and commissions.' },
]
export const NEEDS_COMPANY = ['corporate', 'logistics']
export const roleName = (role) => ROLES.find((r) => r.role === role)?.name ?? role

// What each kind of role can do by default; the admin can change a role's permissions (Roles page). Used only
// when a stored login predates permissions.
export const DEFAULT_PERMISSIONS = {
  buyer: ['market.buy'],
  corporate: ['market.buy', 'tenders.create'],
  seller: ['market.sell', 'tenders.bid', 'payouts.request'],
  logistics: ['deliveries.handle', 'payouts.request'],
  admin: ['admin.verify', 'admin.users', 'admin.roles', 'admin.market', 'admin.finance', 'admin.analytics', 'admin.logs'],
}

export function loadAuth() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || 'null')
    return saved?.token ? saved : null
  } catch {
    return null
  }
}

export function storeAuth(auth) {
  try {
    if (auth) localStorage.setItem(KEY, JSON.stringify(auth))
    else localStorage.removeItem(KEY)
  } catch {
    // private mode: the login lasts until the tab is closed
  }
}

const json = (body, token) => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  body: JSON.stringify(body),
})
const authed = (token) => ({ headers: { Authorization: `Bearer ${token}` } })

export const login = (email, password, role) => request('/auth/login', json({ email, password, role }))
export const register = (fields) => request('/auth/register', json(fields))
export const fetchMe = (token) => request('/auth/me', authed(token))
/** The roles people can sign up for (the admin decides which). */
export const signupRoles = () => request('/auth/roles')

export const adminUsers = (token, params = {}) =>
  request(`/admin/users?${new URLSearchParams(Object.entries(params).filter(([, v]) => v))}`, authed(token))
export const adminDecide = (token, userId, role, status, note = '') =>
  request(`/admin/users/${encodeURIComponent(userId)}/roles/${role}`, json({ status, note }, token))
export const adminCreateUser = (token, fields) => request('/admin/users', json(fields, token))
export const adminActions = (token) => request('/admin/actions', authed(token))
export const adminSetUserRole = (token, userId, fields) =>
  request(`/admin/users/${encodeURIComponent(userId)}/role`, { ...json(fields, token), method: 'PUT' })

// roles and permissions
export const adminRoles = (token) => request('/admin/roles', authed(token))
export const adminPermissions = (token) => request('/admin/permissions', authed(token))
export const adminCreateRole = (token, fields) => request('/admin/roles', json(fields, token))
export const adminUpdateRole = (token, key, fields) =>
  request(`/admin/roles/${encodeURIComponent(key)}`, { ...json(fields, token), method: 'PATCH' })
export const adminDeleteRole = (token, key) =>
  request(`/admin/roles/${encodeURIComponent(key)}`, { method: 'DELETE', ...authed(token) })

/** The logistics app, opened already logged in: the token travels in the URL once and the app keeps it. */
export function logisticsUrl(token, next = '/') {
  if (!LOGISTICS_URL) return ''
  const query = new URLSearchParams({ next })
  if (token) query.set('token', token)
  return `${LOGISTICS_URL}/#/auth?${query}`
}
export const hasLogisticsApp = () => LOGISTICS_URL !== ''
