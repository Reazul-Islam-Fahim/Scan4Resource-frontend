import { BASE, request } from './api'

// The marketplace in the backend (/market/*): published listings, the seller's own listings and settings,
// logistics partners and orders. Prices are CHF.

const send = (method, body, token) => ({
  method,
  headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  body: body === undefined ? undefined : JSON.stringify(body),
})
const authed = (token) => (token ? { headers: { Authorization: `Bearer ${token}` } } : {})
const id = encodeURIComponent

export const fetchListings = () => request('/market/listings')
export const fetchListing = (listingId, token) => request(`/market/listings/${id(listingId)}`, authed(token))

/** Every listing change as it happens. Returns a function that stops listening. */
export function watchListings(onListing) {
  if (typeof EventSource === 'undefined') return () => {}
  const source = new EventSource(`${BASE}/market/events`)
  source.addEventListener('listing', (event) => {
    try {
      onListing(JSON.parse(event.data))
    } catch {
      // a malformed event is skipped; the next full load corrects the list
    }
  })
  return () => source.close()
}

export const fetchPartners = (token) => request('/market/partners', authed(token))
export const fetchSeller = (token) => request('/market/seller', authed(token))
export const saveSeller = (token, fields) => request('/market/seller', send('PUT', fields, token))

export const fetchMine = (token) => request('/market/mine', authed(token))
export const createListings = (token, listings) => request('/market/listings/bulk', send('POST', { listings }, token), 20000)
export const updateListing = (token, listingId, fields) => request(`/market/listings/${id(listingId)}`, send('PATCH', fields, token))
export const publishListing = (token, listingId) => request(`/market/listings/${id(listingId)}/publish`, send('POST', undefined, token))
export const withdrawListing = (token, listingId) => request(`/market/listings/${id(listingId)}/withdraw`, send('POST', undefined, token))
export const deleteListing = (token, listingId) => request(`/market/listings/${id(listingId)}`, send('DELETE', undefined, token))
export const fetchSales = (token) => request('/market/sales', authed(token))

export const placeOrder = (token, order) => request('/market/orders', send('POST', order, token))
export const fetchOrders = (token) => request('/market/orders', authed(token))
export const cancelOrder = (token, orderId) => request(`/market/orders/${id(orderId)}/cancel`, send('POST', undefined, token))

/** A listing from the API in the shape the marketplace cards use. */
export function toCard(listing, distanceFrom) {
  return {
    id: listing.id,
    category: listing.category,
    name: listing.name,
    sub: [listing.material, listing.condition === 'good' ? 'good condition' : listing.condition ? `${listing.condition} condition` : '']
      .filter(Boolean)
      .join(', '),
    city: listing.city || 'Switzerland',
    canton: listing.canton,
    price: listing.price_chf,
    priceUnit: listing.unit === 'm2' ? 'm²' : 'piece',
    unit: listing.unit,
    seller: listing.seller_name,
    image: listing.image,
    lat: listing.lat,
    lon: listing.lon,
    available: listing.available,
    quantity: listing.quantity,
    status: listing.status,
    widthCm: listing.width_cm,
    heightCm: listing.height_cm,
    depthCm: listing.depth_cm,
    weightKg: listing.weight_kg,
    description: listing.description,
    material: listing.material,
    condition: listing.condition,
    availableFrom: listing.available_from,
    availableUntil: listing.available_until,
    partnerCount: listing.partner_count ?? 0,
    distanceKm: distanceFrom(listing.lat, listing.lon),
    fromScan: false,
  }
}
