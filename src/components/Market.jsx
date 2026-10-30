import { useCallback, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import useCart from '../hooks/useCart'
import useListings from '../hooks/useListings'
import { isMock } from '../lib/api'
import { buildListings, filterListings, listingsPerCanton, priceBounds } from '../lib/market'
import { CATEGORIES } from '../lib/materials'
import { BagIcon, SearchIcon, SlidersIcon } from './Icons'
import FilterSheet from './market/FilterSheet'
import ListingSheet from './market/ListingSheet'
import ProductCard from './market/ProductCard'

const FAV_KEY = 's4r.favourites'

function loadFavourites() {
  try {
    const list = JSON.parse(localStorage.getItem(FAV_KEY) || '[]')
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

/** The published listings, live: a new listing, a price change or a sell-out shows up without a reload.
 *  Without a backend (demo mode) the sample marketplace is shown instead. */
export default function Market({ report }) {
  const live = useListings()
  const cart = useCart()
  const samples = useMemo(() => (isMock ? buildListings(report) : []), [report])
  const listings = isMock ? samples : live.listings
  const bounds = useMemo(() => priceBounds(listings), [listings])
  const counts = useMemo(() => listingsPerCanton(listings), [listings])

  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const [filters, setFilters] = useState({ price: null, cantons: [] })
  const [sheet, setSheet] = useState(false)
  const [favourites, setFavourites] = useState(loadFavourites)
  const [openId, setOpenId] = useState(null)
  const open = listings.find((l) => l.id === openId) ?? null

  const results = useMemo(
    () => filterListings(listings, { query, category, price: filters.price, cantons: filters.cantons }),
    [listings, query, category, filters],
  )
  const countFor = useCallback(
    (draft) => filterListings(listings, { query, category, price: draft.price, cantons: draft.cantons }).length,
    [listings, query, category],
  )

  const activeFilters = (filters.price ? 1 : 0) + (filters.cantons.length > 0 ? 1 : 0)
  const narrowed = query.trim() !== '' || category !== 'all' || activeFilters > 0

  const toggleFavourite = (id) =>
    setFavourites((list) => {
      const next = list.includes(id) ? list.filter((x) => x !== id) : [...list, id]
      try {
        localStorage.setItem(FAV_KEY, JSON.stringify(next))
      } catch {
        /* favourites just won't survive a reload */
      }
      return next
    })

  const clearAll = () => {
    setQuery('')
    setCategory('all')
    setFilters({ price: null, cantons: [] })
  }

  return (
    <section className="market">
      <header className="market-head">
        <h1 className="display">
          Reuse <span className="accent">Marketplace</span>
        </h1>
        <Link to="/cart" className="icon-btn icon-btn-light filter-btn" aria-label={cart.count ? `Cart, ${cart.count} items` : 'Cart'}>
          <BagIcon />
          {cart.count > 0 && <span className="filter-badge">{cart.count}</span>}
        </Link>
        <p className="lede">Give building materials a second life.</p>
      </header>
      {isMock && <p className="sample-note">Demo mode: sample listings. Set VITE_API_URL to show the live marketplace.</p>}
      {live.status === 'error' && !isMock && (
        <p className="error" role="alert">
          The marketplace could not be loaded. {live.error}{' '}
          <button type="button" className="text-btn" onClick={live.reload}>
            Try again
          </button>
        </p>
      )}

      <div className="searchrow">
        <label className="search">
          <SearchIcon />
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search for materials, locations, or sellers" aria-label="Search listings" />
        </label>
        <button type="button" className="icon-btn icon-btn-light filter-btn" onClick={() => setSheet(true)} aria-label={activeFilters ? `Filters, ${activeFilters} active` : 'Filters'}>
          <SlidersIcon />
          {activeFilters > 0 && <span className="filter-badge">{activeFilters}</span>}
        </button>
      </div>

      <div className="chips" role="tablist" aria-label="Categories">
        {CATEGORIES.map(([key, label]) => (
          <button key={key} type="button" role="tab" aria-selected={category === key} className="chip-btn" onClick={() => setCategory(key)}>
            {label}
          </button>
        ))}
      </div>

      {narrowed && (
        <p className="result-line" role="status">
          {results.length === 1 ? '1 listing' : `${results.length} listings`}
          <button type="button" className="text-btn" onClick={clearAll}>
            Clear all
          </button>
        </p>
      )}

      {live.status === 'loading' && !isMock ? (
        <p className="lede">Loading listings…</p>
      ) : listings.length === 0 && !isMock ? (
        <div className="empty empty-center">
          <p className="lede">Nothing is listed yet. Sellers publish materials from their scan reports.</p>
          <Link to="/dashboard" className="btn btn-secondary">
            Sell materials
          </Link>
        </div>
      ) : results.length === 0 ? (
        <div className="empty empty-center">
          <p className="lede">No listings match. Try a different search or clear the filters.</p>
          <button type="button" className="btn btn-secondary" onClick={clearAll}>
            Clear all
          </button>
        </div>
      ) : (
        <div className="grid">
          {results.map((listing) => (
            <ProductCard key={listing.id} listing={listing} favourite={favourites.includes(listing.id)} onToggle={toggleFavourite} onOpen={() => setOpenId(listing.id)} />
          ))}
        </div>
      )}

      {open && <ListingSheet listing={open} demo={isMock} onClose={() => setOpenId(null)} />}

      {sheet && (
        <FilterSheet
          bounds={bounds}
          initial={filters}
          counts={counts}
          countFor={countFor}
          noun="listing"
          onApply={(next) => {
            setFilters(next)
            setSheet(false)
          }}
          onClose={() => setSheet(false)}
        />
      )}
    </section>
  )
}
