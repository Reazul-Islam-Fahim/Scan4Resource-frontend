import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { describeError, isMock } from '../lib/api'
import { loadPlace, locate } from '../lib/geo'
import { fetchListings, toCard, watchListings } from '../lib/marketApi'
import { distanceKm } from '../lib/swiss'

// The published listings, shared by the marketplace and the map, kept live: the backend sends every change
// (new listing, price change, sold out, withdrawn) and the list updates without a reload.

let state = { listings: [], status: 'idle', error: '' }
const listeners = new Set()
let users = 0
let stop = null

function set(next) {
  state = { ...state, ...next }
  listeners.forEach((fn) => fn())
}

async function load() {
  set({ status: state.listings.length ? 'ready' : 'loading', error: '' })
  try {
    set({ listings: await fetchListings(), status: 'ready' })
  } catch (err) {
    set({ status: 'error', error: err.detail || describeError(err) })
  }
}

function onListing(listing) {
  const rest = state.listings.filter((l) => l.id !== listing.id)
  set({ listings: listing.status === 'active' ? [listing, ...rest] : rest })
}

function start() {
  load()
  stop = watchListings(onListing)
  // Coming back to the tab after a while: catch up on anything missed while the connection slept.
  document.addEventListener('visibilitychange', onVisible)
}

function onVisible() {
  if (document.visibilityState === 'visible') load()
}

const subscribe = (fn) => {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/** { listings (as cards, with distance), status, error, reload, place, locateMe } */
export default function useListings() {
  useEffect(() => {
    if (isMock) return undefined
    users += 1
    if (users === 1) start()
    return () => {
      users -= 1
      if (users === 0) {
        stop?.()
        stop = null
        document.removeEventListener('visibilitychange', onVisible)
      }
    }
  }, [])
  const snapshot = useSyncExternalStore(subscribe, () => state)
  const [place, setPlace] = useState(loadPlace)
  const listings = useMemo(
    () => snapshot.listings.map((l) => toCard(l, (lat, lon) => (Number.isFinite(lat) ? distanceKm(lat, lon, place) : 0))),
    [snapshot.listings, place],
  )
  const locateMe = useCallback(async () => {
    const next = await locate()
    setPlace(next)
    return next
  }, [])
  return { listings, status: snapshot.status, error: snapshot.error, reload: load, place, locateMe }
}
