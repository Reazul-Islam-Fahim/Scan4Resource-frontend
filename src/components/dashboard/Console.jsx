import { useCallback, useEffect, useState } from 'react'
import useAuth from '../../hooks/useAuth'
import { describeError } from '../../lib/api'
import { roleName } from '../../lib/auth'
import { cancelAdminOrder, fetchAdminListings, fetchAdminOrders, fetchAnalytics, fetchCommission, fetchLedger, saveCommission } from '../../lib/adminApi'
import { formatMoney, formatPrice, formatTonnes } from '../../lib/format'
import { withdrawListing } from '../../lib/marketApi'
import MaterialImage from '../MaterialImage'
import { formatDate } from './format'
import { LISTING_STATUS, ORDER_STATUS, OrderCard, Pill } from './Market'

// The admin console: the figures, every order (cancel and refund), listings moderation, commission rates and
// the ledger. Verification, users and the activity log are in Admin.jsx; payouts in Finance.jsx.

function useLoad(load, arg) {
  const { token } = useAuth()
  const [state, setState] = useState({ data: null, error: '' })
  const reload = useCallback(() => {
    load(token, arg)
      .then((data) => setState({ data, error: '' }))
      .catch((err) => setState((s) => ({ ...s, error: err.detail || describeError(err) })))
  }, [token, load, arg])
  useEffect(reload, [reload])
  return { ...state, reload, token }
}

function Stat({ label, value, note }) {
  return (
    <div className="dash-card dash-stat">
      <span className="note">{label}</span>
      <strong>{value}</strong>
      {note && <span className="note">{note}</span>}
    </div>
  )
}

/** Status filter chips; '' means all. */
function StatusChips({ labels, value, onChange }) {
  return (
    <div className="chips dash-chips" role="tablist">
      {[['', 'All'], ...Object.entries(labels)].map(([key, label]) => (
        <button key={key || 'all'} type="button" role="tab" className="chip-btn" aria-selected={value === key} onClick={() => onChange(key)}>
          {label}
        </button>
      ))}
    </div>
  )
}

const MONTH = new Intl.DateTimeFormat('en-CH', { month: 'short' })
const monthLabel = (ym) => MONTH.format(new Date(`${ym}-01T00:00:00`))

/** Paid by buyers per month: one series, so one green and no legend; hover or focus a bar for its figures. */
function MonthlyChart({ months }) {
  const [active, setActive] = useState(months.length - 1)
  const top = Math.max(...months.map((m) => m.paid_chf), 1)
  const shown = months[active]
  return (
    <div className="dash-card month-chart">
      <div className="verify-head">
        <h2 className="section-title">Paid by buyers, last six months</h2>
      </div>
      <p className="month-readout" aria-live="polite">
        <strong>{formatMoney(shown.paid_chf)}</strong>
        <span className="note">
          {monthLabel(shown.month)} · {shown.orders} order{shown.orders === 1 ? '' : 's'} placed · {shown.delivered} delivered
        </span>
      </p>
      <div className="month-bars">
        {months.map((m, i) => (
          <button
            key={m.month}
            type="button"
            className="month-col"
            aria-pressed={i === active}
            aria-label={`${monthLabel(m.month)}: ${formatMoney(m.paid_chf)}`}
            onMouseEnter={() => setActive(i)}
            onFocus={() => setActive(i)}
            onClick={() => setActive(i)}
          >
            <span className="month-track">
              <span className="month-bar" style={{ height: `${m.paid_chf > 0 ? Math.max((m.paid_chf / top) * 100, 3) : 0}%` }} />
            </span>
            <span className="month-name">{monthLabel(m.month)}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

const ROLE_ORDER = ['buyer', 'corporate', 'seller', 'logistics', 'admin']
const TENDER_STATUS = { draft: 'Drafts', open: 'Open', closed: 'Closed', awarded: 'Awarded', cancelled: 'Cancelled' }

export function AdminInsights() {
  const { data, error } = useLoad(fetchAnalytics)
  const { data: rates } = useLoad(fetchCommission)
  const pending = data ? Object.values(data.users).reduce((sum, r) => sum + (r.pending || 0), 0) : 0
  return (
    <section className="dash-section">
      <header>
        <h1 className="dash-title">Platform overview</h1>
        <p className="lede">
          {rates
            ? `Scan4Reuse keeps ${rates.seller_pct}% from each sale and ${rates.logistics_pct}% from each delivery.`
            : 'Sales, deliveries and the CO₂ that reuse saved.'}
        </p>
      </header>
      {error && <p className="error">{error}</p>}
      {data && (
        <>
          <div className="dash-stats">
            <Stat label="Paid by buyers" value={formatMoney(data.gmv_chf)} note={`${formatMoney(data.goods_chf)} materials · ${formatMoney(data.delivery_chf)} delivery`} />
            <Stat label="Commission earned" value={formatMoney(data.commission_chf)} note="Credited on delivery" />
            <Stat label="Orders" value={data.orders} note={`${data.deliveries} delivered`} />
            <Stat label="CO₂ saved" value={formatTonnes(data.co2_saved_kg)} note={`${formatTonnes(data.reused_kg)} of materials reused`} />
            <Stat label="Live listings" value={data.listings_live} note={`${data.listings} published so far`} />
            <Stat label="Refunded" value={formatMoney(data.refunded_chf)} />
          </div>
          <MonthlyChart months={data.months} />
          <div className="console-split">
            <div className="dash-card">
              <h2 className="section-title">People</h2>
              <table className="dash-table">
                <thead>
                  <tr>
                    <th>Role</th>
                    <th className="num">Active</th>
                    <th className="num">Waiting</th>
                  </tr>
                </thead>
                <tbody>
                  {ROLE_ORDER.filter((r) => data.users[r]).map((r) => (
                    <tr key={r}>
                      <td>{roleName(r)}</td>
                      <td className="num">{data.users[r].active || 0}</td>
                      <td className="num">{data.users[r].pending || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {pending > 0 && <p className="note">{pending} waiting for verification.</p>}
            </div>
            <div className="dash-card">
              <h2 className="section-title">Orders and tenders</h2>
              <table className="dash-table">
                <tbody>
                  {Object.entries(ORDER_STATUS).map(([key, label]) => (
                    <tr key={key}>
                      <td>{label}</td>
                      <td className="num">{data.orders_by_status[key] || 0}</td>
                    </tr>
                  ))}
                  {Object.entries(TENDER_STATUS).map(([key, label]) => (
                    <tr key={key}>
                      <td>Tenders: {label.toLowerCase()}</td>
                      <td className="num">{data.tenders_by_status[key] || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <p className="note">
            CO₂ saved is what making the delivered materials new would have emitted, from the Swiss KBOB data (production). Materials without a weight count with a typical weight
            for their kind.
          </p>
        </>
      )}
    </section>
  )
}

export function AdminOrders() {
  const [status, setStatus] = useState('')
  const { data, error, reload, token } = useLoad(fetchAdminOrders, status)
  const [open, setOpen] = useState('')
  const [reason, setReason] = useState('')
  const [state, setState] = useState({ busy: false, message: '', error: '' })

  const cancel = async (order) => {
    setState({ busy: true, message: '', error: '' })
    try {
      const done = await cancelAdminOrder(token, order.id, reason)
      setState({
        busy: false,
        error: '',
        message: done.refund ? `Order cancelled and ${formatMoney(done.refund.amount_chf)} refunded to ${order.buyer_name}.` : 'Order cancelled. The materials are back on sale.',
      })
      setOpen('')
      setReason('')
      reload()
    } catch (err) {
      setState({ busy: false, message: '', error: err.detail || describeError(err) })
    }
  }

  return (
    <section className="dash-section">
      <header>
        <h1 className="dash-title">Orders</h1>
        <p className="lede">Every order on the marketplace. You can cancel one until it is picked up; a paid order is refunded to the buyer's card.</p>
      </header>
      <StatusChips labels={ORDER_STATUS} value={status} onChange={setStatus} />
      {(error || state.error) && <p className="error">{error || state.error}</p>}
      {state.message && <p className="ok-box">{state.message}</p>}
      {data && data.length === 0 && <p className="dash-card note">No orders here.</p>}
      {(data ?? []).map((order) => (
        <OrderCard key={order.id} order={order} showBuyer full>
          <p className="note mono">{order.id}</p>
          {!['cancelled', 'delivered'].includes(order.status) &&
            (open === order.id ? (
              <div className="cancel-box">
                <label className="field">
                  <span className="field-label">Reason (kept in the logs)</span>
                  <input className="input" value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} />
                </label>
                <p className="note">
                  {order.payment.status === 'paid'
                    ? `${formatMoney(order.payment.total_chf)} goes back to the buyer's card. The logistics companies are told and the materials go back on sale.`
                    : 'The logistics companies are told and the materials go back on sale.'}
                </p>
                <div className="row-actions">
                  <button type="button" className="btn btn-danger" disabled={state.busy} onClick={() => cancel(order)}>
                    {state.busy ? 'Cancelling…' : order.payment.status === 'paid' ? 'Cancel and refund' : 'Cancel order'}
                  </button>
                  <button type="button" className="btn btn-outline" disabled={state.busy} onClick={() => setOpen('')}>
                    Keep it
                  </button>
                </div>
              </div>
            ) : (
              <div className="row-actions">
                <button type="button" className="btn btn-outline" onClick={() => { setOpen(order.id); setReason('') }}>
                  {order.payment.status === 'paid' ? 'Cancel and refund…' : 'Cancel order…'}
                </button>
              </div>
            ))}
        </OrderCard>
      ))}
    </section>
  )
}

const qty = (q, unit) => (unit === 'm2' ? `${q} m²` : `${q}×`)

export function AdminListings() {
  const [status, setStatus] = useState('active')
  const { data, error, reload, token } = useLoad(fetchAdminListings, status)
  const [failure, setFailure] = useState('')
  const [busy, setBusy] = useState('')

  const withdraw = async (listing) => {
    if (!window.confirm(`Take "${listing.name}" off the marketplace? ${listing.seller_name} can publish it again after changing it.`)) return
    setBusy(listing.id)
    setFailure('')
    try {
      await withdrawListing(token, listing.id)
      reload()
    } catch (err) {
      setFailure(err.detail || describeError(err))
    } finally {
      setBusy('')
    }
  }

  return (
    <section className="dash-section">
      <header>
        <h1 className="dash-title">Listings</h1>
        <p className="lede">Every listing, drafts included. Withdraw one that breaks the rules; it is recorded in the logs.</p>
      </header>
      <StatusChips labels={LISTING_STATUS} value={status} onChange={setStatus} />
      {(error || failure) && <p className="error">{error || failure}</p>}
      {data && data.length === 0 && <p className="dash-card note">No listings here.</p>}
      {(data ?? []).map((listing) => (
        <article key={listing.id} className="dash-card listing-row">
          <MaterialImage kind={listing.category} src={listing.image} alt="" className="editor-thumb" />
          <div className="listing-row-main">
            <div className="verify-head">
              <strong>{listing.name}</strong>
              <Pill status={listing.status} labels={LISTING_STATUS} />
            </div>
            <p className="note">
              {listing.seller_name} · {listing.city || 'no pickup address'} · {formatPrice(listing.price_chf)} / {listing.unit === 'm2' ? 'm²' : 'piece'} ·{' '}
              {qty(listing.available, listing.unit)} of {qty(listing.quantity, listing.unit)} left
            </p>
            {listing.description && <p className="note clamp-2">{listing.description}</p>}
            {listing.status === 'active' && (
              <div className="row-actions">
                <button type="button" className="btn btn-outline" disabled={busy === listing.id} onClick={() => withdraw(listing)}>
                  Withdraw
                </button>
              </div>
            )}
          </div>
        </article>
      ))}
    </section>
  )
}

export function AdminCommission() {
  const { data, error, reload, token } = useLoad(fetchCommission)
  const [form, setForm] = useState(null)
  const [state, setState] = useState({ busy: false, message: '', error: '' })

  useEffect(() => {
    if (data && !form) setForm({ seller_pct: String(data.seller_pct), logistics_pct: String(data.logistics_pct), note: '' })
  }, [data, form])

  const submit = async (e) => {
    e.preventDefault()
    const rates = { seller_pct: Number(form.seller_pct), logistics_pct: Number(form.logistics_pct), note: form.note }
    if (!window.confirm(`Charge sellers ${rates.seller_pct}% and logistics companies ${rates.logistics_pct}% on orders paid from now on?`)) return
    setState({ busy: true, message: '', error: '' })
    try {
      await saveCommission(token, rates)
      setState({ busy: false, message: 'New rates saved. Orders already paid keep the rates they were paid at.', error: '' })
      setForm(null)
      reload()
    } catch (err) {
      setState({ busy: false, message: '', error: err.detail || describeError(err) })
    }
  }
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  return (
    <section className="dash-section">
      <header>
        <h1 className="dash-title">Commission</h1>
        <p className="lede">What Scan4Reuse keeps from each sale and each delivery. A change applies to orders paid after it; paid orders keep their rates.</p>
      </header>
      {error && <p className="error">{error}</p>}
      {data && (
        <div className="dash-stats">
          <Stat label="From sellers" value={`${data.seller_pct}%`} note="of the materials price" />
          <Stat label="From logistics companies" value={`${data.logistics_pct}%`} note="of the delivery price" />
        </div>
      )}
      {form && (
        <form className="dash-card dash-form" onSubmit={submit}>
          <h2 className="section-title">Change the rates</h2>
          <div className="field-row">
            <label className="field">
              <span className="field-label">Sellers (%)</span>
              <input className="input" type="number" min="0" max="50" step="0.5" required value={form.seller_pct} onChange={set('seller_pct')} />
            </label>
            <label className="field">
              <span className="field-label">Logistics companies (%)</span>
              <input className="input" type="number" min="0" max="50" step="0.5" required value={form.logistics_pct} onChange={set('logistics_pct')} />
            </label>
          </div>
          <label className="field">
            <span className="field-label">Why (kept with the change)</span>
            <input className="input" maxLength={300} value={form.note} onChange={set('note')} placeholder="Launch offer for the first three months" />
          </label>
          {state.error && <p className="error">{state.error}</p>}
          {state.message && <p className="ok-box">{state.message}</p>}
          <button type="submit" className="btn btn-primary" disabled={state.busy}>
            {state.busy ? 'Saving…' : 'Save new rates'}
          </button>
        </form>
      )}
      {!form && state.message && <p className="ok-box">{state.message}</p>}
      {data && (
        <div className="dash-card">
          <h2 className="section-title">History</h2>
          <div className="table-wrap">
            <table className="dash-table ledger">
              <thead>
                <tr>
                  <th>From</th>
                  <th className="num">Sellers</th>
                  <th className="num">Logistics</th>
                  <th>Set by</th>
                </tr>
              </thead>
              <tbody>
                {data.history.map((h, i) => (
                  <tr key={`${h.set_at}-${i}`}>
                    <td>
                      {formatDate(h.set_at, true)}
                      {i === 0 && <span className="status-pill">In force</span>}
                    </td>
                    <td className="num">{h.seller_pct}%</td>
                    <td className="num">{h.logistics_pct}%</td>
                    <td>
                      {h.set_by_name}
                      {h.note && <span className="note block">{h.note}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  )
}

const KIND = { sale: 'Sale', delivery: 'Delivery', payout: 'Payout' }

export function AdminLedger() {
  const { data, error } = useLoad(fetchLedger)
  return (
    <section className="dash-section">
      <header>
        <h1 className="dash-title">Ledger</h1>
        <p className="lede">Every credit to a seller or logistics company and every payout, newest first. Commission is the fee column.</p>
      </header>
      {error && <p className="error">{error}</p>}
      {data && data.length === 0 && <p className="dash-card note">Nothing yet. Lines appear when a paid order is delivered.</p>}
      {data && data.length > 0 && (
        <div className="dash-card table-wrap">
          <table className="dash-table ledger">
            <thead>
              <tr>
                <th>Date</th>
                <th>Account</th>
                <th>What</th>
                <th className="num">Gross</th>
                <th className="num">Fee</th>
                <th className="num">Amount</th>
              </tr>
            </thead>
            <tbody>
              {data.map((line) => (
                <tr key={line.id}>
                  <td>{formatDate(line.created_at, true)}</td>
                  <td>
                    {line.name}
                    <span className="note block">{roleName(line.role)}</span>
                  </td>
                  <td>
                    {KIND[line.kind] ?? line.kind}
                    {line.memo && <span className="note block">{line.memo}</span>}
                  </td>
                  <td className="num">{line.kind === 'payout' ? '' : formatMoney(line.gross_chf)}</td>
                  <td className="num">{line.kind === 'payout' ? '' : formatMoney(line.fee_chf)}</td>
                  <td className="num">{formatMoney(line.amount_chf)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
