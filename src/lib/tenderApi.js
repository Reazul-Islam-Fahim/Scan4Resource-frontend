import { request } from './api'

// Corporate tenders in the backend (/tenders/*): the corporate buyer's tenders and awards, sellers' bids, the
// admin's list. Prices are CHF.

const send = (method, body, token) => ({
  method,
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  body: body === undefined ? undefined : JSON.stringify(body),
})
const authed = (token) => ({ headers: { Authorization: `Bearer ${token}` } })
const id = encodeURIComponent

export const fetchMyTenders = (token) => request('/tenders/mine', authed(token))
export const fetchTender = (token, tenderId) => request(`/tenders/${id(tenderId)}`, authed(token), 20000)
export const createTender = (token, tender) => request('/tenders', send('POST', tender, token))
export const updateTender = (token, tenderId, tender) => request(`/tenders/${id(tenderId)}`, send('PATCH', tender, token))
export const deleteTender = (token, tenderId) => request(`/tenders/${id(tenderId)}`, send('DELETE', undefined, token))
export const publishTender = (token, tenderId) => request(`/tenders/${id(tenderId)}/publish`, send('POST', undefined, token))
export const closeTender = (token, tenderId) => request(`/tenders/${id(tenderId)}/close`, send('POST', undefined, token))
export const cancelTender = (token, tenderId, reason = '') => request(`/tenders/${id(tenderId)}/cancel`, send('POST', { reason }, token))
export const awardTender = (token, tenderId, bidIds) => request(`/tenders/${id(tenderId)}/award`, send('POST', { bid_ids: bidIds }, token), 20000)

export const fetchOpenTenders = (token) => request('/tenders', authed(token))
export const placeBid = (token, tenderId, bid) => request(`/tenders/${id(tenderId)}/bid`, send('PUT', bid, token))
export const withdrawBid = (token, bidId) => request(`/bids/${id(bidId)}/withdraw`, send('POST', undefined, token))

export const fetchAllTenders = (token) => request('/admin/tenders', authed(token))
