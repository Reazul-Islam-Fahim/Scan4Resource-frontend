import { REFERENCE_POINT } from './swiss'

// Swiss address lookup through geo.admin.ch (free, no key), and where the person is.

const strip = (html) => html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()

/** "Hafenstrasse 25 <b>4057 Basel</b>" + detail "... ch bs" -> { address, city, canton, lat, lon }. */
export function readAddress(attrs) {
  const label = strip(attrs.label ?? '')
  const town = /<b>(.*?)<\/b>/.exec(attrs.label ?? '')?.[1] ?? ''
  const street = strip((attrs.label ?? '').replace(/<b>.*?<\/b>/, ''))
  const city = town.replace(/^\d{4}\s+/, '').trim()
  const canton = /\b([a-z]{2})$/i.exec((attrs.detail ?? '').trim())?.[1]?.toUpperCase() ?? ''
  return {
    address: street && town ? `${street}, ${strip(town)}` : label,
    city,
    canton,
    lat: attrs.lat,
    lon: attrs.lon,
  }
}

export async function searchAddress(text, limit = 6) {
  const query = new URLSearchParams({ searchText: text.trim(), type: 'locations', origins: 'address', sr: '4326', limit: String(limit) })
  const response = await fetch(`https://api3.geo.admin.ch/rest/services/api/SearchServer?${query}`)
  if (!response.ok) throw new Error('The address service is not answering.')
  const data = await response.json()
  return (data.results ?? []).flatMap((item) =>
    item.attrs && Number.isFinite(item.attrs.lat) && Number.isFinite(item.attrs.lon) ? [readAddress(item.attrs)] : [],
  )
}

const PLACE_KEY = 's4r.place'

/** Where distances are measured from: the person's last known position, else Zürich. */
export function loadPlace() {
  try {
    const saved = JSON.parse(localStorage.getItem(PLACE_KEY) || 'null')
    return Number.isFinite(saved?.lat) && Number.isFinite(saved?.lon) ? saved : REFERENCE_POINT
  } catch {
    return REFERENCE_POINT
  }
}

export function locate() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('This browser cannot share its location.'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const place = { name: 'your location', lat: pos.coords.latitude, lon: pos.coords.longitude }
        try {
          localStorage.setItem(PLACE_KEY, JSON.stringify(place))
        } catch {
          // fine: it is used for this visit only
        }
        resolve(place)
      },
      () => reject(new Error('Location access was not allowed.')),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 },
    )
  })
}
