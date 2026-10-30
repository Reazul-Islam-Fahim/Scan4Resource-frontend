import { useMemo, useState } from 'react'
import useListings from '../hooks/useListings'
import { isMock } from '../lib/api'
import { formatPrice } from '../lib/format'
import { SAMPLE_LISTINGS, filterListings, listingsPerCanton } from '../lib/market'
import { CATEGORIES } from '../lib/materials'
import { ChevronRight, ListIcon, LocateIcon, MapIcon, PinIcon, SearchIcon, SlidersIcon } from './Icons'
import FilterSheet from './market/FilterSheet'
import ListingSheet from './market/ListingSheet'
import MarketMap from './market/MarketMap'
import MaterialImage from './MaterialImage'

function SiteCard({ listing, onClick, className = '' }) {
  return (
    <button type="button" className={`site-card ${className}`} onClick={onClick}>
      <MaterialImage kind={listing.category} src={listing.image} className="site-thumb" />
      <span className="site-text">
        <strong>{listing.name}</strong>
        <span>
          {formatPrice(listing.price)} / {listing.priceUnit} · {listing.seller}
        </span>
        <span className="site-where">
          <PinIcon width={15} height={15} />
          {listing.city}, {Math.max(1, Math.round(listing.distanceKm))} km
        </span>
      </span>
      <ChevronRight />
    </button>
  )
}

/** Where the materials are: every published listing on a real map of Switzerland, kept live. */
export default function MapScreen() {
  const live = useListings()
  const all = isMock ? SAMPLE_LISTINGS : live.listings
  const [category, setCategory] = useState('all')
  const [query, setQuery] = useState('')
  const [cantons, setCantons] = useState([])
  const [sheet, setSheet] = useState(false)
  const [view, setView] = useState('map')
  const [selectedId, setSelectedId] = useState(null)
  const [openId, setOpenId] = useState(null)
  const [focus, setFocus] = useState(null)
  const [locError, setLocError] = useState('')

  const listings = useMemo(() => filterListings(all, { category, query, cantons }), [all, category, query, cantons])
  const counts = useMemo(() => listingsPerCanton(all), [all])
  const nearest = useMemo(() => [...listings].sort((a, b) => a.distanceKm - b.distanceKm), [listings])
  const selected = listings.find((l) => l.id === selectedId) ?? null
  const open = all.find((l) => l.id === openId) ?? null
  const shown = selected ?? nearest[0] ?? null

  const pick = (listing) => {
    setSelectedId(listing.id)
    setFocus({ lat: listing.lat, lon: listing.lon, zoom: 12 })
    setView('map')
  }
  const locateMe = async () => {
    setLocError('')
    try {
      const place = await live.locateMe()
      setFocus({ lat: place.lat, lon: place.lon, zoom: 10 })
    } catch (err) {
      setLocError(err.message)
    }
  }

  return (
    <section className="map-page">
      <header className="market-head">
        <h1 className="display">Material sources</h1>
        <button type="button" className="icon-btn icon-btn-light" onClick={() => setView((v) => (v === 'map' ? 'list' : 'map'))} aria-label={view === 'map' ? 'Show as list' : 'Show on map'}>
          {view === 'map' ? <ListIcon /> : <MapIcon />}
        </button>
        <p className="lede">Reusable building materials for sale near you, updated live.</p>
      </header>

      <div className="searchrow">
        <label className="search">
          <SearchIcon />
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search material, town or seller" aria-label="Search listings" />
        </label>
        <button type="button" className="icon-btn icon-btn-light filter-btn" onClick={() => setSheet(true)} aria-label={cantons.length ? 'Filters, 1 active' : 'Filters'}>
          <SlidersIcon />
          {cantons.length > 0 && <span className="filter-badge">1</span>}
        </button>
      </div>

      <div className="chips" role="tablist" aria-label="Categories">
        {CATEGORIES.map(([key, label]) => (
          <button key={key} type="button" role="tab" aria-selected={category === key} className="chip-btn" onClick={() => setCategory(key)}>
            {label}
          </button>
        ))}
      </div>

      {isMock && <p className="sample-note">Demo mode: sample listings.</p>}
      {live.status === 'error' && !isMock && (
        <p className="error" role="alert">
          The listings could not be loaded. {live.error}{' '}
          <button type="button" className="text-btn" onClick={live.reload}>
            Try again
          </button>
        </p>
      )}
      {locError && <p className="error">{locError}</p>}

      {view === 'list' && (
        <div className="site-list">
          {listings.length === 0 && <p className="lede">No listings match. Try a different search or clear the filters.</p>}
          {nearest.map((listing) => (
            <SiteCard key={listing.id} listing={listing} onClick={() => pick(listing)} />
          ))}
        </div>
      )}

      {/* Stays mounted while the list is shown, so the map keeps its position. */}
      <div className="map-stage" hidden={view !== 'map'}>
        <MarketMap listings={listings} selectedId={selectedId} onSelect={setSelectedId} focus={focus} />
        <div className="map-fabs">
          <button type="button" className="fab" onClick={locateMe} aria-label="Show listings near me">
            <LocateIcon />
          </button>
        </div>
        {listings.length === 0 && live.status !== 'loading' && <p className="map-empty">No listings match. Try a different search or filter.</p>}
        {shown && (
          <div className="map-bottom">
            <SiteCard listing={shown} onClick={() => setOpenId(shown.id)} />
          </div>
        )}
      </div>

      {open && <ListingSheet listing={open} demo={isMock} onClose={() => setOpenId(null)} />}

      {sheet && (
        <FilterSheet
          showPrice={false}
          bounds={{ min: 0, max: 10 }}
          initial={{ price: null, cantons }}
          counts={counts}
          countFor={(draft) => filterListings(all, { category, query, cantons: draft.cantons }).length}
          noun="listing"
          onApply={(next) => {
            setCantons(next.cantons)
            setSheet(false)
          }}
          onClose={() => setSheet(false)}
        />
      )}
    </section>
  )
}
