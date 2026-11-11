import { useCallback, useEffect, useState } from 'react'
import useAuth from '../../hooks/useAuth'
import { describeError } from '../../lib/api'
import { roleName } from '../../lib/auth'
import { cancelAdminOrder, fetchAdminListings, fetchAdminOrders, fetchAnalytics, fetchCommission, fetchLedger, fetchLogs, saveCommission } from '../../lib/adminApi'
import { formatMoney, formatPrice, formatTonnes } from '../../lib/format'
import { withdrawListing } from '../../lib/marketApi'
import { BagIcon, ClockIcon, CoinIcon, DocIcon, InboxIcon, PercentIcon, ShieldIcon, ShopIcon, TruckIcon, WalletIcon } from '../Icons'
import MaterialImage from '../MaterialImage'
import { useWaiting } from './attention'
import { AreaChart, Bars, Co2Card, Donut, EmptyState, greeting, ListSkeleton, OverviewSkeleton, PageHead, Panel, PanelLink, StatCard, TodoRow, Trend, useData } from './kit'
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

const ROLE_ORDER = ['buyer', 'corporate', 'seller', 'logistics', 'admin']
const ROLE_COLORS = { buyer: '#018058', corporate: '#5fb594', seller: '#0b4f3b', logistics: '#c08a2b', admin: '#9bb3aa' }
const ORDER_BARS = { awaiting_delivery: 'Not booked', delivery_booked: 'Booked', delivered: 'Delivered', cancelled: 'Cancelled' }

const lastTwo = (series) => ({ now: series[series.length - 1], before: series[series.length - 2] })
const stamp = (iso) => new Date(iso).toLocaleString('en-CH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
const loadActivity = (token) => fetchLogs(token, { per_page: 6 })

function Activity() {
  const { data, error } = useData(loadActivity)
  return (
    <Panel title="Latest activity" action={<PanelLink to="/dashboard/logs">All logs</PanelLink>}>
      {error && <p className="error">{error}</p>}
      {data === undefined && <ListSkeleton rows={4} bare />}
      {data && data.lines.length === 0 && <EmptyState icon={ClockIcon} title="Nothing happened yet" text="Sign-ups, orders and payouts show up here." />}
      {data && data.lines.length > 0 && (
        <div className="ds-list">
          {data.lines.slice(0, 6).map((line, i) => (
            <div key={`${line.at}-${i}`} className="ds-todo">
              <span className="ds-well">
                <ClockIcon width={17} height={17} />
              </span>
              <span className="ds-todo-text">
                <strong>{line.text}</strong>
                <span className="note">
                  {line.actor_name || 'Service'} · {stamp(line.at)}
                </span>
              </span>
            </div>
          ))}
        </div>
      )}
    </Panel>
  )
}

export function AdminInsights() {
  const { user, can } = useAuth()
  const waiting = useWaiting().pages
  const { data, error } = useData(fetchAnalytics)
  const { data: rates } = useData(fetchCommission)
  const lede = rates
    ? `Scan4Reuse keeps ${rates.seller_pct}% from each sale and ${rates.logistics_pct}% from each delivery.`
    : 'Sales, deliveries and the CO₂ that reuse saved.'
  const head = <PageHead title={`${greeting()}, ${user.name.split(' ')[0]}`} lede={lede} />
  if (!data) {
    return (
      <section className="dash-section">
        {head}
        {error ? <p className="error">{error}</p> : <OverviewSkeleton />}
      </section>
    )
  }
  const months = data.months
  const series = (key) => months.map((m) => m[key])
  const pendingUsers = Object.values(data.users).reduce((sum, r) => sum + (r.pending || 0), 0)
  const people = ROLE_ORDER.filter((r) => data.users[r]).map((r) => ({
    key: r,
    label: roleName(r),
    value: data.users[r].active || 0,
    pending: data.users[r].pending || 0,
    color: ROLE_COLORS[r],
  }))
  const notBooked = data.orders_by_status.awaiting_delivery || 0
  const toAward = data.tenders_by_status.closed || 0
  const todos = [
    waiting.verification > 0 && { icon: ShieldIcon, title: `${waiting.verification} account${waiting.verification > 1 ? 's' : ''} to verify`, text: 'Companies wait before they can trade', to: '/dashboard/verification' },
    waiting.payouts > 0 && { icon: WalletIcon, title: `${waiting.payouts} payout request${waiting.payouts > 1 ? 's' : ''}`, text: 'Approve and pay, or reject', to: '/dashboard/payouts' },
    notBooked > 0 && can('admin.market') && { icon: TruckIcon, title: `${notBooked} order${notBooked > 1 ? 's' : ''} without a carrier`, text: 'No logistics company has accepted yet', to: '/dashboard/orders' },
    toAward > 0 && can('admin.market') && { icon: DocIcon, title: `${toAward} tender${toAward > 1 ? 's' : ''} waiting to be awarded`, text: 'Closed for bids', to: '/dashboard/tenders' },
  ].filter(Boolean)
  const impact = { scope: 'platform', co2_saved_kg: data.co2_saved_kg, reused_kg: data.reused_kg, months: months.map((m) => ({ month: m.month, co2_kg: m.co2_kg })) }
  return (
    <section className="dash-section">
      {head}
      <div className="ds-stats">
        <StatCard icon={CoinIcon} label="Paid by buyers" value={formatMoney(data.gmv_chf)} spark={series('paid_chf')} trend={<Trend {...lastTwo(series('paid_chf'))} />} note={`${formatMoney(data.delivery_chf)} delivery`} />
        <StatCard icon={PercentIcon} label="Commission earned" value={formatMoney(data.commission_chf)} spark={series('commission_chf')} trend={<Trend {...lastTwo(series('commission_chf'))} />} note="on delivery" to={can('admin.finance') ? '/dashboard/ledger' : undefined} />
        <StatCard icon={BagIcon} label="Orders" value={data.orders} spark={series('orders')} trend={<Trend {...lastTwo(series('orders'))} />} note={`${data.deliveries} delivered`} to={can('admin.market') ? '/dashboard/orders' : undefined} />
        <StatCard icon={ShopIcon} label="Live listings" value={data.listings_live} note={`${data.listings} published so far`} to={can('admin.market') ? '/dashboard/listings' : undefined} />
      </div>
      <Co2Card impact={impact} scope="platform" />
      <div className="ds-row ds-row-2">
        <Panel title="Paid by buyers" sub="Last six months, materials and delivery">
          <AreaChart months={months} value={(m) => m.paid_chf} format={formatMoney} detail={(m) => `${m.orders} order${m.orders === 1 ? '' : 's'}`} />
        </Panel>
        <Panel title="Needs your attention" count={todos.length}>
          <div className="ds-list">
            {todos.length ? todos.map((t) => <TodoRow key={t.title} {...t} />) : <TodoRow icon={InboxIcon} title="You are all caught up" text="Verifications and payout requests show up here" done />}
            {data.refunded_chf > 0 && <TodoRow icon={CoinIcon} title={`${formatMoney(data.refunded_chf)} refunded`} text="To buyers of cancelled orders" to={can('admin.finance') ? '/dashboard/ledger' : undefined} />}
          </div>
        </Panel>
      </div>
      <div className="ds-row ds-row-3">
        <Panel title="People" sub={pendingUsers ? `${pendingUsers} waiting for verification` : 'Active accounts by role'} action={can('admin.users') && <PanelLink to="/dashboard/users">Users</PanelLink>}>
          <div className="ds-ring-row">
            <Donut parts={people} label="active" />
            <ul className="ds-legend">
              {people.map((p) => (
                <li key={p.key}>
                  <span className="ds-dot" style={{ background: p.color }} />
                  <span>{p.label}</span>
                  <b>{p.value}</b>
                </li>
              ))}
            </ul>
          </div>
        </Panel>
        <Panel title="Orders by status" sub={`${Object.values(data.tenders_by_status).reduce((a, b) => a + b, 0)} tenders · ${data.tenders_by_status.open || 0} open`}>
          <Bars items={Object.entries(ORDER_BARS).map(([key, label]) => ({ label, value: data.orders_by_status[key] || 0 }))} format={(v) => String(v)} />
        </Panel>
        {can('admin.logs') ? (
          <Activity />
        ) : (
          <Panel title="Materials reused">
            <p className="ds-chart-sum">
              <strong>{formatTonnes(data.reused_kg)}</strong>
            </p>
            <p className="note">Delivered for reuse instead of being thrown away.</p>
          </Panel>
        )}
      </div>
      <p className="note">
        CO₂ saved is what making the delivered materials new would have emitted, from the Swiss KBOB data (production). Materials without a weight count with a typical weight
        for their kind.
      </p>
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
      {!data && !error && <ListSkeleton />}
      {data && data.length === 0 && <EmptyState icon={BagIcon} title="No orders here" text={status ? 'Try another status.' : 'Orders appear as soon as a buyer checks out.'} />}
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
      {!data && !error && <ListSkeleton />}
      {data && data.length === 0 && <EmptyState icon={ShopIcon} title="No listings here" text={status ? 'Try another status.' : 'Listings appear when sellers publish items from their scans.'} />}
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
      {!data && !error && <ListSkeleton />}
      {data && data.length === 0 && <EmptyState icon={CoinIcon} title="The ledger is empty" text="Lines appear when a paid order is delivered." />}
      {data && data.length > 0 && (
        <div className="dash-card table-wrap">
          <table className="dash-table ledger table-cards">
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
                  <td data-label="Date">{formatDate(line.created_at, true)}</td>
                  <td data-label="Account">
                    <span>
                      {line.name}
                      <span className="note block">{roleName(line.role)}</span>
                    </span>
                  </td>
                  <td data-label="What">
                    <span>
                      {KIND[line.kind] ?? line.kind}
                      {line.memo && <span className="note block">{line.memo}</span>}
                    </span>
                  </td>
                  <td className="num" data-label="Gross">{line.kind === 'payout' ? '' : formatMoney(line.gross_chf)}</td>
                  <td className="num" data-label="Fee">{line.kind === 'payout' ? '' : formatMoney(line.fee_chf)}</td>
                  <td className="num" data-label="Amount">{formatMoney(line.amount_chf)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
