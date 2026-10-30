import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import useAuth from '../../hooks/useAuth'
import { describeError } from '../../lib/api'
import { logisticsUrl } from '../../lib/auth'
import { formatPrice } from '../../lib/format'
import {
  cancelOrder,
  deleteListing,
  fetchMine,
  fetchOrders,
  fetchPartners,
  fetchSales,
  fetchSeller,
  publishListing,
  saveSeller,
  updateListing,
  withdrawListing,
} from '../../lib/marketApi'
import AddressField from '../AddressField'
import MaterialImage from '../MaterialImage'
import PartnerPicker from '../sell/PartnerPicker'
import { formatDate } from './format'

// The marketplace pages of the dashboards: a seller's listings, sales and partners; a buyer's orders.

function useLoad(load) {
  const { token } = useAuth()
  const [state, setState] = useState({ data: null, error: '' })
  const reload = useCallback(() => {
    load(token)
      .then((data) => setState({ data, error: '' }))
      .catch((err) => setState((s) => ({ ...s, error: err.detail || describeError(err) })))
  }, [token, load])
  useEffect(reload, [reload])
  return { ...state, reload, token }
}

const LISTING_STATUS = { draft: 'Draft', active: 'Published', sold: 'Sold out', withdrawn: 'Withdrawn' }
const ORDER_STATUS = { awaiting_delivery: 'Delivery not booked yet', delivery_booked: 'Delivery booked', delivered: 'Delivered', cancelled: 'Cancelled' }
const qty = (q, unit) => (unit === 'm2' ? `${q} m²` : `${q}×`)

function Pill({ status, labels }) {
  const tone = ['active', 'delivery_booked', 'delivered'].includes(status) ? '' : status === 'draft' || status === 'awaiting_delivery' ? ' status-pending' : ' status-rejected'
  return <span className={`status-pill${tone}`}>{labels[status] ?? status}</span>
}

/** One listing in the seller's list, with price and quantity editable in place. */
function ListingRow({ listing, token, onChanged }) {
  const [price, setPrice] = useState(listing.price_chf)
  const [quantity, setQuantity] = useState(listing.quantity)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const dirty = Number(price) !== listing.price_chf || Number(quantity) !== listing.quantity

  const run = async (action) => {
    setBusy(true)
    setError('')
    try {
      await action()
      onChanged()
    } catch (err) {
      setError(err.detail || describeError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <article className="dash-card listing-row">
      <MaterialImage kind={listing.category} src={listing.image} alt="" className="editor-thumb" />
      <div className="listing-row-main">
        <div className="verify-head">
          <strong>{listing.name}</strong>
          <Pill status={listing.status} labels={LISTING_STATUS} />
        </div>
        <p className="note">
          {listing.city || 'No pickup address yet'} · {qty(listing.available, listing.unit)} of {qty(listing.quantity, listing.unit)} left
          {listing.partners.length > 0 && ` · ${listing.partners.length} logistics partner${listing.partners.length > 1 ? 's' : ''}`}
        </p>
        {listing.status !== 'sold' && (
          <div className="field-row listing-edit">
            <label className="field">
              <span className="field-label">Price (CHF / {listing.unit === 'm2' ? 'm²' : 'piece'})</span>
              <input className="input" type="number" min="0" step="0.05" value={price} onChange={(e) => setPrice(e.target.value)} />
            </label>
            <label className="field">
              <span className="field-label">Quantity</span>
              <input className="input" type="number" min="0" step={listing.unit === 'm2' ? 0.1 : 1} value={quantity} onChange={(e) => setQuantity(e.target.value)} />
            </label>
          </div>
        )}
        {error && <p className="error">{error}</p>}
        <div className="row-actions">
          {dirty && (
            <button type="button" className="btn btn-primary" disabled={busy} onClick={() => run(() => updateListing(token, listing.id, { price_chf: Number(price), quantity: Number(quantity) }))}>
              Save
            </button>
          )}
          {(listing.status === 'draft' || listing.status === 'withdrawn') && (
            <button type="button" className="btn btn-secondary" disabled={busy || dirty} onClick={() => run(() => publishListing(token, listing.id))}>
              Publish
            </button>
          )}
          {listing.status === 'active' && (
            <button type="button" className="btn btn-outline" disabled={busy} onClick={() => run(() => withdrawListing(token, listing.id))}>
              Withdraw
            </button>
          )}
          {listing.status === 'draft' && (
            <button type="button" className="text-btn" disabled={busy} onClick={() => run(() => deleteListing(token, listing.id))}>
              Delete draft
            </button>
          )}
        </div>
      </div>
    </article>
  )
}

export function SellerListings() {
  const { data, error, reload, token } = useLoad(fetchMine)
  const notice = useLocation().state?.notice
  return (
    <section className="dash-section">
      <header className="dash-head">
        <div>
          <h1 className="dash-title">Listings</h1>
          <p className="lede">Publish the items of a scan report. Buyers see the town and the price; the street stays private.</p>
        </div>
        <Link to="/scans" className="btn btn-secondary">
          Sell from a scan
        </Link>
      </header>
      {notice && <p className="ok-box">{notice}</p>}
      {error && <p className="error">{error}</p>}
      {data && data.length === 0 && (
        <p className="dash-card note">
          No listings yet. Open a scan report and choose <strong>Sell on the marketplace</strong>.
        </p>
      )}
      {(data ?? []).map((listing) => (
        <ListingRow key={`${listing.id}:${listing.updated_at}`} listing={listing} token={token} onChanged={reload} />
      ))}
    </section>
  )
}

function OrderCard({ order, children, showBuyer }) {
  return (
    <article className="dash-card order-card">
      <div className="verify-head">
        <strong>Order of {formatDate(order.created_at, true)}</strong>
        <Pill status={order.status} labels={ORDER_STATUS} />
      </div>
      <p className="note">
        {showBuyer ? `${order.buyer_name} · delivery to ${order.city || 'Switzerland'}` : `Delivery to ${order.address}`}
      </p>
      <ul className="order-lines">
        {order.items.map((item) => (
          <li key={item.listing_id}>
            <MaterialImage kind={item.category} src={item.image} alt="" className="order-thumb" />
            <span>
              <strong>{item.name}</strong>
              <span className="note">
                {qty(item.quantity, item.unit)} · {showBuyer ? `pickup ${item.address}` : `from ${item.seller_name}, ${item.city}`}
              </span>
            </span>
            <span className="order-price">{formatPrice(item.total_chf)}</span>
          </li>
        ))}
      </ul>
      <p className="order-total">
        <span>Materials</span>
        <strong>{formatPrice(order.goods_chf)}</strong>
      </p>
      {children}
    </article>
  )
}

export function SellerSales() {
  const { data, error } = useLoad(fetchSales)
  return (
    <section className="dash-section">
      <header>
        <h1 className="dash-title">Orders</h1>
        <p className="lede">What buyers ordered from you. Once the buyer books delivery, the logistics company contacts you about the pickup.</p>
      </header>
      {error && <p className="error">{error}</p>}
      {data && data.length === 0 && <p className="dash-card note">No orders yet. They appear here as soon as someone buys.</p>}
      {(data ?? []).map((order) => (
        <OrderCard key={order.id} order={order} showBuyer />
      ))}
    </section>
  )
}

export function BuyerOrders() {
  const { data, error, reload, token } = useLoad(fetchOrders)
  const [failure, setFailure] = useState('')
  const placed = useLocation().state?.placed
  const cancel = async (order) => {
    if (!window.confirm('Cancel this order? The materials go back on sale.')) return
    try {
      await cancelOrder(token, order.id)
      reload()
    } catch (err) {
      setFailure(err.detail || describeError(err))
    }
  }
  return (
    <section className="dash-section">
      <header className="dash-head">
        <div>
          <h1 className="dash-title">Orders</h1>
          <p className="lede">Your materials are reserved. Book the delivery: logistics companies offer a price for each pickup.</p>
        </div>
        <Link to="/market" className="btn btn-secondary">
          Browse the marketplace
        </Link>
      </header>
      {placed && <p className="ok-box">Order placed. The materials are reserved for you.</p>}
      {(error || failure) && <p className="error">{error || failure}</p>}
      {data && data.length === 0 && <p className="dash-card note">No orders yet.</p>}
      {(data ?? []).map((order) => (
        <OrderCard key={order.id} order={order}>
          <div className="row-actions">
            {order.status !== 'cancelled' && logisticsUrl(token) && (
              <a className={`btn ${order.status === 'awaiting_delivery' ? 'btn-primary' : 'btn-secondary'}`} href={logisticsUrl(token, `/checkout?order=${order.id}`)}>
                {order.status === 'awaiting_delivery' ? 'Book delivery' : 'Delivery details'}
              </a>
            )}
            {order.status === 'awaiting_delivery' && (
              <button type="button" className="btn btn-outline" onClick={() => cancel(order)}>
                Cancel order
              </button>
            )}
          </div>
        </OrderCard>
      ))}
    </section>
  )
}

const loadSettings = (token) => Promise.all([fetchSeller(token), fetchPartners(token)])

export function SellerPartners() {
  const { data, error, token } = useLoad(loadSettings)
  const [place, setPlace] = useState(null)
  const [chosen, setChosen] = useState([])
  const [state, setState] = useState({ busy: false, message: '', error: '' })

  useEffect(() => {
    if (!data) return
    const [seller] = data
    if (seller.address) setPlace({ address: seller.address, city: seller.city, canton: seller.canton, lat: seller.lat, lon: seller.lon })
    setChosen(seller.partners)
  }, [data])

  const save = async (e) => {
    e.preventDefault()
    setState({ busy: true, message: '', error: '' })
    try {
      await saveSeller(token, { ...(place ?? {}), partners: chosen })
      setState({ busy: false, message: 'Saved. New listings use these settings.', error: '' })
    } catch (err) {
      setState({ busy: false, message: '', error: err.detail || describeError(err) })
    }
  }

  return (
    <section className="dash-section">
      <header>
        <h1 className="dash-title">Pickup & logistics partners</h1>
        <p className="lede">Your usual pickup address and the logistics companies you work with. Each listing can still be changed.</p>
      </header>
      {error && <p className="error">{error}</p>}
      <form className="dash-card dash-form" onSubmit={save}>
        <AddressField label="Usual pickup address" value={place} onChange={setPlace} />
        <h2 className="section-title">Logistics partners</h2>
        <PartnerPicker list={data ? data[1] : null} chosen={chosen} onChange={setChosen} />
        {state.error && <p className="error">{state.error}</p>}
        {state.message && <p className="ok-box">{state.message}</p>}
        <button type="submit" className="btn btn-primary" disabled={state.busy || !data}>
          Save
        </button>
      </form>
    </section>
  )
}
