import { request } from './api'

// Storage space renters in the backend (/storage/*): their spaces, the requests buyers send them, and the loads
// they hold. Buyers book storage in the logistics app's checkout. Prices are CHF; space is floor area in m².

const send = (method, body, token) => ({
  method,
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  body: body === undefined ? undefined : JSON.stringify(body),
})
const authed = (token) => ({ headers: { Authorization: `Bearer ${token}` } })
const id = encodeURIComponent

export const fetchSpaces = (token) => request('/storage/spaces', authed(token))
export const createSpace = (token, space) => request('/storage/spaces', send('POST', space, token))
export const saveSpace = (token, spaceId, space) => request(`/storage/spaces/${id(spaceId)}`, send('PUT', space, token))
export const deleteSpace = (token, spaceId) => request(`/storage/spaces/${id(spaceId)}`, send('DELETE', undefined, token))
export const fetchCalendar = (token, spaceId) => request(`/storage/spaces/${id(spaceId)}/calendar`, authed(token))

export const fetchStorageRequests = (token) => request('/storage/requests', authed(token))
export const acceptBooking = (token, bookingId) => request(`/storage/bookings/${id(bookingId)}/accept`, send('POST', undefined, token))
export const declineBooking = (token, bookingId, reason = '') =>
  request(`/storage/bookings/${id(bookingId)}/decline`, send('POST', { reason }, token))
export const markBooking = (token, bookingId, status) => request(`/storage/bookings/${id(bookingId)}/${status}`, send('POST', undefined, token))
export const acceptExtension = (token, extId) => request(`/storage/extensions/${id(extId)}/accept`, send('POST', undefined, token), 20000)
export const declineExtension = (token, extId, reason = '') =>
  request(`/storage/extensions/${id(extId)}/decline`, send('POST', { reason }, token))

export const fetchAdminStorage = (token) => request('/admin/storage', authed(token))
