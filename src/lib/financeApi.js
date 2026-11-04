import { request } from './api'

// Money in the backend: earnings and payouts for sellers and logistics companies, the admin's finance view.
// Paying an order happens in the logistics app's checkout, after delivery is booked.

const authed = (token) => ({ headers: { Authorization: `Bearer ${token}` } })
const json = (body, token) => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  body: JSON.stringify(body),
})

export const fetchEarnings = (token) => request('/earnings', authed(token))
export const requestPayout = (token, body) => request('/payouts', json(body, token))
export const fetchFinance = (token) => request('/admin/finance', authed(token))
export const fetchPayouts = (token, status) => request(`/admin/payouts${status ? `?status=${status}` : ''}`, authed(token))
export const decidePayout = (token, payoutId, status, note = '') => request(`/admin/payouts/${encodeURIComponent(payoutId)}`, json({ status, note }, token))
