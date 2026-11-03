import { request } from './api'

// The admin console: commission rates, every listing, order and ledger line, cancelling orders, the figures.
// Accounts and verification are in auth.js, payouts in financeApi.js, tenders in tenderApi.js.

const authed = (token) => ({ headers: { Authorization: `Bearer ${token}` } })
const send = (method, body, token) => ({
  method,
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  body: JSON.stringify(body),
})
const query = (status) => (status ? `?status=${encodeURIComponent(status)}` : '')

export const fetchCommission = (token) => request('/admin/commission', authed(token))
export const saveCommission = (token, rates) => request('/admin/commission', send('PUT', rates, token))
export const fetchAdminListings = (token, status) => request(`/admin/listings${query(status)}`, authed(token))
export const fetchAdminOrders = (token, status) => request(`/admin/orders${query(status)}`, authed(token))
export const cancelAdminOrder = (token, orderId, reason) =>
  request(`/admin/orders/${encodeURIComponent(orderId)}/cancel`, send('POST', { reason }, token), 20000)
export const fetchLedger = (token) => request('/admin/ledger', authed(token))
export const fetchAnalytics = (token) => request('/admin/analytics', authed(token))
