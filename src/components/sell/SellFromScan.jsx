import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import useAuth from '../../hooks/useAuth'
import { describeError } from '../../lib/api'
import { formatPrice } from '../../lib/format'
import { createListings, fetchPartners, fetchSeller, publishListing, saveSeller } from '../../lib/marketApi'
import { CATEGORIES, catalogFor } from '../../lib/materials'
import AddressField from '../AddressField'
import MaterialImage from '../MaterialImage'
import PageHeader from '../PageHeader'
import PartnerPicker from './PartnerPicker'

const CONDITIONS = [
  ['good', 'Good'],
  ['fair', 'Fair'],
  ['poor', 'Poor'],
]
const COMMISSION = 0.1

/** One draft listing per report row, with the catalog's suggested price. */
const draftsFrom = (report) =>
  report.rows.map((row) => {
    const entry = catalogFor(row.label)
    return {
      key: row.key,
      include: true,
      name: entry.market ?? row.name,
      category: entry.category ?? 'other',
      material: row.material || entry.material || '',
      condition: row.condition || 'good',
      unit: row.unit === 'm2' ? 'm2' : 'pc',
      quantity: row.quantity,
      price: entry.listUnit ?? 0,
      image: row.image,
    }
  })

function NeedSeller() {
  const auth = useAuth()
  const navigate = useNavigate()
  const holds = auth.loggedIn && auth.user.roles.some((r) => r.role === 'seller' && r.status === 'active')
  return (
    <div className="dash-card empty empty-center">
      <p className="lede">
        {holds ? 'You are logged in as another role. Switch to your seller role to publish.' : 'Log in as a seller to publish these materials to the marketplace.'}
      </p>
      {holds ? (
        <button type="button" className="btn btn-primary" onClick={() => auth.switchRole('seller')}>
          Switch to seller
        </button>
      ) : (
        <button type="button" className="btn btn-primary" onClick={() => navigate('/login?role=seller&next=/sell')}>
          Log in as a seller
        </button>
      )}
    </div>
  )
}

/** The seller's step after a report: turn its items into marketplace listings. */
export default function SellFromScan({ report, scanId, title, onBack }) {
  const auth = useAuth()
  const navigate = useNavigate()
  const isSeller = auth.loggedIn && auth.role === 'seller'
  const [drafts, setDrafts] = useState(() => draftsFrom(report))
  const [place, setPlace] = useState(null)
  const [saveDefault, setSaveDefault] = useState(true)
  const [window_, setWindow] = useState({ from: '', until: '' })
  const [partners, setPartners] = useState({ list: null, chosen: [] })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isSeller) return
    Promise.all([fetchSeller(auth.token), fetchPartners(auth.token)])
      .then(([seller, list]) => {
        if (seller.address) setPlace({ address: seller.address, city: seller.city, canton: seller.canton, lat: seller.lat, lon: seller.lon })
        setPartners({ list, chosen: seller.partners })
      })
      .catch((err) => setError(err.detail || describeError(err)))
  }, [isSeller, auth.token])

  const included = drafts.filter((d) => d.include)
  const total = useMemo(() => included.reduce((sum, d) => sum + Number(d.price || 0) * Number(d.quantity || 0), 0), [included])
  const edit = (key, patch) => setDrafts((list) => list.map((d) => (d.key === key ? { ...d, ...patch } : d)))

  const submit = async (publish) => {
    setError('')
    if (included.length === 0) return setError('Pick at least one item to list.')
    if (publish && !place) return setError('Add the pickup address before publishing.')
    setBusy(true)
    try {
      if (place && saveDefault) await saveSeller(auth.token, { ...place, partners: partners.chosen })
      const created = await createListings(
        auth.token,
        included.map((d) => ({
          name: d.name,
          category: d.category,
          material: d.material,
          condition: d.condition,
          unit: d.unit,
          quantity: Number(d.quantity),
          price_chf: Number(d.price),
          image: d.image,
          scan_id: scanId,
          item_key: d.key,
          available_from: window_.from || null,
          available_until: window_.until || null,
          partners: place && saveDefault ? null : partners.chosen, // null: follow the seller's saved partners
          ...(place ?? {}),
        })),
      )
      if (publish) for (const listing of created) await publishListing(auth.token, listing.id)
      navigate('/dashboard/listings', { state: { notice: publish ? `${created.length} listings published.` : `${created.length} drafts saved.` } })
    } catch (err) {
      setError(err.detail || describeError(err))
      setBusy(false)
    }
  }

  return (
    <section className="flow sell">
      <PageHeader title="Sell on the marketplace" onBack={onBack} />
      <p className="lede">
        {title}: check each item, set a price and the pickup address. Buyers see the town, not the street, until a delivery is booked.
      </p>

      {report.isSample ? (
        <div className="dash-card empty empty-center">
          <p className="lede">This report has no scanned items yet. Scan a building first.</p>
          <Link to="/" className="btn btn-secondary">
            Start a scan
          </Link>
        </div>
      ) : !isSeller ? (
        <NeedSeller />
      ) : (
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault()
            submit(true)
          }}
        >
          <div className="editor-list">
            {drafts.map((d) => (
              <fieldset key={d.key} className={`dash-card sell-item${d.include ? '' : ' is-off'}`}>
                <legend className="sr-only">{d.name}</legend>
                <div className="sell-head">
                  <MaterialImage kind={d.category} src={d.image} alt="" className="editor-thumb" />
                  <label className="field sell-name">
                    <span className="field-label">Listing title</span>
                    <input className="input" value={d.name} onChange={(e) => edit(d.key, { name: e.target.value })} required={d.include} disabled={!d.include} />
                  </label>
                  <label className="switch-line">
                    <input type="checkbox" checked={d.include} onChange={(e) => edit(d.key, { include: e.target.checked })} />
                    <span>List</span>
                  </label>
                </div>
                {d.include && (
                  <div className="field-row sell-grid">
                    <label className="field">
                      <span className="field-label">Category</span>
                      <select className="input" value={d.category} onChange={(e) => edit(d.key, { category: e.target.value })}>
                        {CATEGORIES.filter(([k]) => k !== 'all').map(([k, label]) => (
                          <option key={k} value={k}>
                            {label}
                          </option>
                        ))}
                        <option value="other">Other</option>
                      </select>
                    </label>
                    <label className="field">
                      <span className="field-label">Material</span>
                      <input className="input" value={d.material} onChange={(e) => edit(d.key, { material: e.target.value })} />
                    </label>
                    <label className="field">
                      <span className="field-label">Condition</span>
                      <select className="input" value={d.condition} onChange={(e) => edit(d.key, { condition: e.target.value })}>
                        {CONDITIONS.map(([k, label]) => (
                          <option key={k} value={k}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="field">
                      <span className="field-label">Quantity ({d.unit === 'm2' ? 'm²' : 'pieces'})</span>
                      <input className="input" type="number" min={d.unit === 'm2' ? 0.1 : 1} step={d.unit === 'm2' ? 0.1 : 1} value={d.quantity} onChange={(e) => edit(d.key, { quantity: e.target.value })} required />
                    </label>
                    <label className="field">
                      <span className="field-label">Price per {d.unit === 'm2' ? 'm²' : 'piece'} (CHF)</span>
                      <input className="input" type="number" min="0" step="0.05" value={d.price} onChange={(e) => edit(d.key, { price: e.target.value })} required />
                    </label>
                  </div>
                )}
              </fieldset>
            ))}
          </div>

          <div className="dash-card dash-form">
            <h2 className="section-title">Pickup</h2>
            <AddressField label="Pickup address" value={place} onChange={setPlace} />
            <label className="switch-line">
              <input type="checkbox" checked={saveDefault} onChange={(e) => setSaveDefault(e.target.checked)} />
              <span>Use this address and these partners for my next listings too</span>
            </label>
            <div className="field-row">
              <label className="field">
                <span className="field-label">Available from</span>
                <input className="input" type="date" value={window_.from} onChange={(e) => setWindow((w) => ({ ...w, from: e.target.value }))} />
              </label>
              <label className="field">
                <span className="field-label">Must be collected by</span>
                <input className="input" type="date" min={window_.from || undefined} value={window_.until} onChange={(e) => setWindow((w) => ({ ...w, until: e.target.value }))} />
              </label>
            </div>
          </div>

          <div className="dash-card dash-form">
            <h2 className="section-title">Logistics partners</h2>
            <PartnerPicker list={partners.list} chosen={partners.chosen} onChange={(chosen) => setPartners((p) => ({ ...p, chosen }))} />
          </div>

          <div className="dash-card sell-total">
            <span>
              <span className="note">If everything sells</span>
              <strong>{formatPrice(total)}</strong>
            </span>
            <span>
              <span className="note">You receive, after the 10% commission</span>
              <strong>{formatPrice(total * (1 - COMMISSION))}</strong>
            </span>
          </div>

          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <div className="sell-actions">
            <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => submit(false)}>
              Save as drafts
            </button>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? 'Publishing…' : `Publish ${included.length === 1 ? '1 listing' : `${included.length} listings`}`}
            </button>
          </div>
        </form>
      )}
    </section>
  )
}
