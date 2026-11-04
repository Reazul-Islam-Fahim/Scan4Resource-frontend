import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import useAuth from '../../hooks/useAuth'
import { describeError } from '../../lib/api'
import { logisticsUrl } from '../../lib/auth'
import { formatMoney } from '../../lib/format'
import { CATEGORIES } from '../../lib/materials'
import {
  awardTender,
  cancelTender,
  closeTender,
  createTender,
  deleteTender,
  fetchAllTenders,
  fetchMyTenders,
  fetchOpenTenders,
  fetchTender,
  placeBid,
  publishTender,
  updateTender,
  withdrawBid,
} from '../../lib/tenderApi'
import AddressField from '../AddressField'
import { formatDate } from './format'

// Corporate tenders: the corporate buyer asks for bulk quantities, sellers bid, the buyer awards bids, and each
// awarded bid becomes an order that is delivered and paid like any other.

const STATUS = { draft: 'Draft', open: 'Open for bids', closed: 'Bidding closed', awarded: 'Awarded', fulfilled: 'Delivered', cancelled: 'Cancelled' }
const BID_STATUS = { submitted: 'Bid placed', withdrawn: 'Withdrawn', awarded: 'Won', declined: 'Not chosen' }
const CONDITION = { any: 'any condition', fair: 'fair or better', good: 'good condition' }
const CATEGORY_OPTIONS = [...CATEGORIES.filter(([key]) => key !== 'all'), ['other', 'Other']]
const unitLabel = (unit) => (unit === 'm2' ? 'm²' : 'pc')
const amount = (q, unit) => `${Number(q).toLocaleString('de-CH')} ${unitLabel(unit)}`
const errorText = (err) => err.detail || describeError(err)

function Pill({ status, labels = STATUS }) {
  const tone = ['open', 'awarded', 'fulfilled', 'submitted'].includes(status) ? '' : ['draft', 'closed'].includes(status) ? ' status-pending' : ' status-rejected'
  return <span className={`status-pill${tone}`}>{labels[status] ?? status}</span>
}

function useLoad(load) {
  const { token } = useAuth()
  const [state, setState] = useState({ data: null, error: '' })
  const reload = useCallback(() => {
    load(token)
      .then((data) => setState({ data, error: '' }))
      .catch((err) => setState((s) => ({ ...s, error: errorText(err) })))
  }, [token, load])
  useEffect(reload, [reload])
  return { ...state, reload, token }
}

/** Runs one action at a time and keeps its error. */
function useAction(onDone) {
  const [state, setState] = useState({ busy: false, error: '' })
  const run = async (action) => {
    setState({ busy: true, error: '' })
    try {
      const result = await action()
      setState({ busy: false, error: '' })
      onDone?.(result)
      return result
    } catch (err) {
      setState({ busy: false, error: errorText(err) })
      return null
    }
  }
  return { ...state, run }
}

function TenderFacts({ tender, showSite }) {
  return (
    <p className="note tender-facts">
      <span>Deliver to {showSite && tender.address ? tender.address : tender.city || 'Switzerland'}</span>
      {tender.needed_by && <span>needed by {formatDate(tender.needed_by)}</span>}
      {tender.closes_on && <span>bids until {formatDate(tender.closes_on)}</span>}
      {tender.distance_km != null && <span>{tender.distance_km} km from your pickup</span>}
    </p>
  )
}

function MaterialList({ tender, coverage }) {
  return (
    <ul className="tender-lines">
      {tender.lines.map((line) => {
        const covered = coverage?.find((c) => c.no === line.no)
        const share = covered ? Math.min(1, covered.offered / covered.wanted) : null
        return (
          <li key={line.no}>
            <span>
              <strong>{line.name}</strong>
              <span className="note">
                {CATEGORY_OPTIONS.find(([key]) => key === line.category)?.[1] ?? line.category} · {CONDITION[line.condition]}
                {line.details && ` · ${line.details}`}
              </span>
            </span>
            <span className="tender-qty">
              {amount(line.quantity, line.unit)}
              {share !== null && (
                <span className="cover" title={`${covered.offered} of ${covered.wanted} offered`}>
                  <span style={{ width: `${share * 100}%` }} />
                </span>
              )}
            </span>
          </li>
        )
      })}
    </ul>
  )
}

// ---- corporate buyer -------------------------------------------------------------------------------
const blankLine = () => ({ name: '', category: 'doors', unit: 'pc', quantity: '', condition: 'any', details: '' })
const inDays = (days) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10)

function TenderForm({ initial, onSaved, onCancel }) {
  const { token } = useAuth()
  const [form, setForm] = useState(() => ({
    title: initial?.title ?? '',
    description: initial?.description ?? '',
    needed_by: initial?.needed_by ?? inDays(30),
    closes_on: initial?.closes_on ?? inDays(10),
    budget: initial?.budget_chf ?? '',
    lines: initial?.lines?.length ? initial.lines.map((l) => ({ ...l })) : [blankLine()],
  }))
  const [site, setSite] = useState(initial?.address ? { address: initial.address, city: initial.city, canton: initial.canton, lat: initial.lat, lon: initial.lon } : null)
  const action = useAction(onSaved)
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))
  const setLine = (index, key, value) => setForm((f) => ({ ...f, lines: f.lines.map((l, i) => (i === index ? { ...l, [key]: value } : l)) }))

  const submit = (publish) => (e) => {
    e?.preventDefault()
    const body = {
      title: form.title,
      description: form.description,
      ...(site ?? {}),
      needed_by: form.needed_by || null,
      closes_on: form.closes_on || null,
      budget_chf: form.budget === '' ? null : Number(form.budget),
      lines: form.lines.filter((l) => l.name.trim()).map((l) => ({ ...l, quantity: Number(l.quantity) })),
    }
    action.run(async () => {
      const saved = initial ? await updateTender(token, initial.id, body) : await createTender(token, body)
      return publish ? publishTender(token, saved.id) : saved
    })
  }

  return (
    <form className="dash-card dash-form" onSubmit={submit(false)}>
      <h2 className="section-title">{initial ? 'Edit draft' : 'New tender'}</h2>
      <label className="field">
        <span className="field-label">Title</span>
        <input className="input" required value={form.title} onChange={set('title')} placeholder="Doors for the school renovation" />
      </label>
      <label className="field">
        <span className="field-label">What the materials are for (optional)</span>
        <textarea className="input" rows={2} value={form.description} onChange={set('description')} />
      </label>
      <AddressField label="Delivery site" value={site} onChange={setSite} />
      <div className="field-row">
        <label className="field">
          <span className="field-label">Bids until</span>
          <input className="input" type="date" required value={form.closes_on} onChange={set('closes_on')} />
        </label>
        <label className="field">
          <span className="field-label">Needed on site by</span>
          <input className="input" type="date" value={form.needed_by} onChange={set('needed_by')} />
        </label>
        <label className="field">
          <span className="field-label">Budget, CHF (only you see it)</span>
          <input className="input" type="number" min="0" step="1" value={form.budget} onChange={set('budget')} />
        </label>
      </div>

      <h2 className="section-title">Materials</h2>
      {form.lines.map((line, index) => (
        <fieldset key={index} className="tender-line-edit">
          <legend className="sr-only">Material {index + 1}</legend>
          <label className="field grow">
            <span className="field-label">Material {index + 1}</span>
            <input className="input" value={line.name} onChange={(e) => setLine(index, 'name', e.target.value)} placeholder="Interior doors, 82 cm" />
          </label>
          <label className="field">
            <span className="field-label">Category</span>
            <select className="input" value={line.category} onChange={(e) => setLine(index, 'category', e.target.value)}>
              {CATEGORY_OPTIONS.map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="field narrow">
            <span className="field-label">Quantity</span>
            <input className="input" type="number" min="0" step={line.unit === 'm2' ? 0.1 : 1} value={line.quantity} onChange={(e) => setLine(index, 'quantity', e.target.value)} />
          </label>
          <label className="field narrow">
            <span className="field-label">Unit</span>
            <select className="input" value={line.unit} onChange={(e) => setLine(index, 'unit', e.target.value)}>
              <option value="pc">pieces</option>
              <option value="m2">m²</option>
            </select>
          </label>
          <label className="field">
            <span className="field-label">Condition</span>
            <select className="input" value={line.condition} onChange={(e) => setLine(index, 'condition', e.target.value)}>
              {Object.entries(CONDITION).map(([key, label]) => (
                <option key={key} value={key}>
                  {label[0].toUpperCase() + label.slice(1)}
                </option>
              ))}
            </select>
          </label>
          <label className="field grow">
            <span className="field-label">Details (sizes, finish)</span>
            <input className="input" value={line.details} onChange={(e) => setLine(index, 'details', e.target.value)} />
          </label>
          {form.lines.length > 1 && (
            <button type="button" className="text-btn danger" onClick={() => setForm((f) => ({ ...f, lines: f.lines.filter((_, i) => i !== index) }))}>
              Remove
            </button>
          )}
        </fieldset>
      ))}
      <button type="button" className="btn btn-outline" onClick={() => setForm((f) => ({ ...f, lines: [...f.lines, blankLine()] }))}>
        Add a material
      </button>
      {action.error && <p className="error">{action.error}</p>}
      <div className="row-actions start">
        <button type="button" className="btn btn-primary" disabled={action.busy} onClick={submit(true)}>
          Publish for bids
        </button>
        <button type="submit" className="btn btn-secondary" disabled={action.busy}>
          Save draft
        </button>
        <button type="button" className="text-btn" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  )
}

function BidCard({ bid, tender, selectable, selected, onToggle, token }) {
  const wanted = Object.fromEntries(tender.lines.map((l) => [l.no, l]))
  const delivery = bid.delivery
  const cheapest = delivery?.offers?.[0]
  return (
    <article className={`dash-card bid-card${selected ? ' is-selected' : ''}`}>
      <div className="verify-head">
        <label className="bid-pick">
          {selectable && <input type="checkbox" checked={selected} onChange={onToggle} />}
          <span>
            <strong>{bid.seller_name}</strong>
            <span className="note block">
              from {bid.pickup.city || 'Switzerland'}
              {bid.ready_from && ` · ready from ${formatDate(bid.ready_from)}`}
            </span>
          </span>
        </label>
        <Pill status={bid.status} labels={BID_STATUS} />
      </div>
      <ul className="order-lines plain">
        {bid.lines.map((l) => (
          <li key={l.no}>
            <span>
              <strong>{wanted[l.no]?.name}</strong>
              <span className="note">
                {amount(l.quantity, wanted[l.no]?.unit)} of {amount(wanted[l.no]?.quantity, wanted[l.no]?.unit)} · {formatMoney(l.price_chf)} / {unitLabel(wanted[l.no]?.unit)} · {l.condition}
              </span>
            </span>
            <span className="order-price">{formatMoney(l.total_chf)}</span>
          </li>
        ))}
      </ul>
      {bid.note && <p className="note">“{bid.note}”</p>}
      <p className="order-pay note">
        <span>Materials</span>
        <span>{formatMoney(bid.goods_chf)}</span>
      </p>
      <p className="order-pay note">
        <span>{cheapest ? `Delivery from ${cheapest.company_name}, ${delivery.distance_km} km` : delivery ? 'No logistics partner can carry this load yet' : 'Delivery priced at checkout'}</span>
        <span>{cheapest ? formatMoney(cheapest.price_chf) : '—'}</span>
      </p>
      <p className="order-total">
        <span>Landed price</span>
        <strong>{bid.landed_chf != null ? formatMoney(bid.landed_chf) : `${formatMoney(bid.goods_chf)} + delivery`}</strong>
      </p>
      {bid.order && (
        <div className="row-actions start">
          <span className="note">Order: {bid.order.status === 'awaiting_delivery' ? 'delivery not booked yet' : bid.order.status.replace('_', ' ')}{bid.order.payment?.status === 'paid' ? ', paid' : ''}</span>
          {bid.order.status !== 'cancelled' && logisticsUrl(token) && (
            <a className={`btn ${bid.order.status === 'awaiting_delivery' || bid.order.payment?.status !== 'paid' ? 'btn-primary' : 'btn-secondary'}`} href={logisticsUrl(token, `/checkout?order=${bid.order.id}`)}>
              {bid.order.status === 'awaiting_delivery' ? 'Book delivery' : bid.order.payment?.status !== 'paid' ? `Pay ${formatMoney(bid.order.payment.total_chf)}` : 'Delivery details'}
            </a>
          )}
        </div>
      )}
    </article>
  )
}

/** The buyer's (or an admin's) view of one tender: materials and how far bids cover them, the bids side by side
 *  with their landed price, and the award. */
function TenderDetail({ tenderId, onBack, admin }) {
  const { token } = useAuth()
  const [tender, setTender] = useState(null)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(false)
  const [chosen, setChosen] = useState([])
  const load = useCallback(() => {
    fetchTender(token, tenderId)
      .then(setTender)
      .catch((err) => setError(errorText(err)))
  }, [token, tenderId])
  useEffect(load, [load])
  const action = useAction((result) => {
    if (result?.id) setTender((t) => ({ ...t, ...result }))
    setChosen([])
    load()
  })

  if (error) return <p className="error">{error}</p>
  if (!tender) return <p className="note">Loading the tender…</p>
  if (editing) return <TenderForm initial={tender} onSaved={() => { setEditing(false); load() }} onCancel={() => setEditing(false)} />

  const standing = tender.bids.filter((b) => b.status === 'submitted')
  const canAward = !admin && ['open', 'closed'].includes(tender.status) && standing.length > 0
  const picked = tender.bids.filter((b) => chosen.includes(b.id))
  const pickedTotal = picked.reduce((sum, b) => sum + (b.landed_chf ?? b.goods_chf), 0)
  const shown = [...tender.bids].sort((a, b) => (a.status === 'declined') - (b.status === 'declined') || (a.landed_chf ?? a.goods_chf) - (b.landed_chf ?? b.goods_chf))
  const cancel = () => {
    const reason = window.prompt(admin ? 'Why is this tender taken down? The buyer sees the reason.' : 'Cancel this tender? Sellers see it is called off. Reason (optional):', '')
    if (reason !== null) action.run(() => cancelTender(token, tender.id, reason))
  }

  return (
    <section className="dash-section">
      <button type="button" className="text-btn back-link" onClick={onBack}>
        ← All tenders
      </button>
      <header className="dash-head">
        <div>
          <h1 className="dash-title">{tender.title}</h1>
          <p className="lede">
            <Pill status={tender.status} />
            {admin && `${tender.buyer_name} · `}
            {tender.budget_chf != null && `Budget ${formatMoney(tender.budget_chf)}`}
          </p>
        </div>
      </header>
      {tender.status === 'cancelled' && tender.reason && <p className="hint-box">Cancelled: {tender.reason}</p>}
      <div className="dash-card">
        <TenderFacts tender={tender} showSite />
        {tender.description && <p className="note">{tender.description}</p>}
        <MaterialList tender={tender} coverage={tender.status === 'draft' ? null : tender.coverage} />
      </div>
      {action.error && <p className="error">{action.error}</p>}
      <div className="row-actions start">
        {tender.status === 'draft' && !admin && (
          <>
            <button type="button" className="btn btn-primary" disabled={action.busy} onClick={() => action.run(() => publishTender(token, tender.id))}>
              Publish for bids
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setEditing(true)}>
              Edit
            </button>
            <button type="button" className="text-btn danger" disabled={action.busy} onClick={() => action.run(async () => { await deleteTender(token, tender.id); onBack(true) })}>
              Delete draft
            </button>
          </>
        )}
        {tender.status === 'open' && !admin && (
          <button type="button" className="btn btn-secondary" disabled={action.busy} onClick={() => action.run(() => closeTender(token, tender.id))}>
            Stop bids now
          </button>
        )}
        {['draft', 'open', 'closed'].includes(tender.status) && (
          <button type="button" className="btn btn-outline" disabled={action.busy} onClick={cancel}>
            {admin ? 'Take down' : 'Cancel tender'}
          </button>
        )}
      </div>

      {tender.status !== 'draft' && (
        <>
          <h2 className="section-title">
            Bids {tender.bids.length > 0 && <span className="note">· sorted by landed price (materials and the cheapest delivery)</span>}
          </h2>
          {!tender.estimates && <p className="hint-box">Delivery prices are not available right now; they are worked out again at checkout.</p>}
          {tender.bids.length === 0 && (
            <p className="dash-card note">{tender.status === 'open' ? 'No bids yet. Sellers with matching materials near the site are invited; bids appear here as they come in.' : 'No bids.'}</p>
          )}
          {shown.map((bid) => (
            <BidCard
              key={bid.id}
              bid={bid}
              tender={tender}
              token={token}
              selectable={canAward && bid.status === 'submitted'}
              selected={chosen.includes(bid.id)}
              onToggle={() => setChosen((c) => (c.includes(bid.id) ? c.filter((x) => x !== bid.id) : [...c, bid.id]))}
            />
          ))}
          {canAward && (
            <div className="dash-card award-bar">
              <span>
                <strong>{picked.length === 0 ? 'Pick one or more bids to award' : `${picked.length} bid${picked.length > 1 ? 's' : ''} · ${formatMoney(pickedTotal)}`}</strong>
                <span className="note block">
                  {tender.budget_chf != null && picked.length > 0 && pickedTotal > tender.budget_chf ? `Over your budget by ${formatMoney(pickedTotal - tender.budget_chf)}. ` : ''}
                  Each awarded bid becomes an order; you then book delivery and pay as usual. The other bids are told they were not chosen.
                </span>
              </span>
              <button
                type="button"
                className="btn btn-primary"
                disabled={action.busy || picked.length === 0}
                onClick={() => window.confirm('Award these bids? This cannot be undone, though you can still cancel an order before delivery is booked.') && action.run(() => awardTender(token, tender.id, chosen))}
              >
                Award
              </button>
            </div>
          )}
        </>
      )}
    </section>
  )
}

function TenderRow({ tender, onOpen, extra }) {
  return (
    <button type="button" className="dash-card dash-step tender-row" onClick={onOpen}>
      <span>
        <span className="verify-head">
          <strong>{tender.title}</strong>
          <span className="pill-row">
            {extra}
            <Pill status={tender.status} />
          </span>
        </span>
        <span className="note">
          {tender.lines.map((l) => `${amount(l.quantity, l.unit)} ${l.name}`).join(' · ')}
        </span>
        <span className="note">
          {tender.city || 'No delivery site yet'}
          {tender.closes_on && ` · bids until ${formatDate(tender.closes_on)}`}
          {tender.bid_count != null && ` · ${tender.bid_count} bid${tender.bid_count === 1 ? '' : 's'}`}
        </span>
      </span>
    </button>
  )
}

export function CorporateTenders() {
  const { data, error, reload } = useLoad(fetchMyTenders)
  const [params, setParams] = useSearchParams()
  const [creating, setCreating] = useState(false)
  const open = params.get('tender')
  const show = (id) => setParams(id ? { tender: id } : {})

  if (open) return <TenderDetail tenderId={open} onBack={() => { show(null); reload() }} />
  return (
    <section className="dash-section">
      <header className="dash-head">
        <div>
          <h1 className="dash-title">Tenders</h1>
          <p className="lede">Ask for bulk quantities. Sellers bid with their materials; you compare the landed price, delivery included, and award.</p>
        </div>
        {!creating && (
          <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
            New tender
          </button>
        )}
      </header>
      {creating && (
        <TenderForm
          onSaved={(saved) => {
            setCreating(false)
            reload()
            if (saved?.id) show(saved.id)
          }}
          onCancel={() => setCreating(false)}
        />
      )}
      {error && <p className="error">{error}</p>}
      {data && data.length === 0 && !creating && <p className="dash-card note">No tenders yet. Start one with the materials, quantities and delivery site you need.</p>}
      {(data ?? []).map((tender) => (
        <TenderRow key={tender.id} tender={tender} onOpen={() => show(tender.id)} />
      ))}
    </section>
  )
}

// ---- seller ---------------------------------------------------------------------------------------
function BidForm({ tender, onSaved }) {
  const { token } = useAuth()
  const mine = tender.my_bid?.status === 'submitted' ? tender.my_bid : null
  const [lines, setLines] = useState(() =>
    tender.lines.map((line) => {
      const offered = mine?.lines.find((l) => l.no === line.no)
      return { no: line.no, quantity: offered?.quantity ?? '', price: offered?.price_chf ?? '', listing: offered?.listing_id ?? '', condition: offered?.condition ?? 'good', weight: offered?.weight_kg ?? '' }
    }),
  )
  const [note, setNote] = useState(mine?.note ?? '')
  const [ready, setReady] = useState(mine?.ready_from ?? '')
  const action = useAction(onSaved)
  const setLine = (no, key, value) => setLines((ls) => ls.map((l) => (l.no === no ? { ...l, [key]: value } : l)))
  const total = lines.reduce((sum, l) => sum + (Number(l.quantity) || 0) * (Number(l.price) || 0), 0)

  const submit = (e) => {
    e.preventDefault()
    const body = {
      note,
      ready_from: ready || null,
      lines: lines
        .filter((l) => Number(l.quantity) > 0)
        .map((l) => ({ no: l.no, quantity: Number(l.quantity), price_chf: Number(l.price), listing_id: l.listing || null, condition: l.condition, weight_kg: l.weight === '' ? null : Number(l.weight) })),
    }
    action.run(() => placeBid(token, tender.id, body))
  }

  return (
    <form className="dash-card dash-form" onSubmit={submit}>
      <h2 className="section-title">{mine ? 'Your bid' : 'Place a bid'}</h2>
      <p className="note">Offer some or all of each material. The buyer sees your price plus the delivery from your logistics partners, and your town, not your street.</p>
      {tender.lines.map((line) => {
        const value = lines.find((l) => l.no === line.no)
        const listings = tender.matching_listings.filter((l) => l.category === line.category && l.unit === line.unit)
        return (
          <fieldset key={line.no} className="tender-line-edit">
            <legend className="bid-line-title">
              <strong>{line.name}</strong> <span className="note">· {amount(line.quantity, line.unit)} wanted, {CONDITION[line.condition]}</span>
            </legend>
            <label className="field narrow">
              <span className="field-label">You supply ({unitLabel(line.unit)})</span>
              <input className="input" type="number" min="0" max={line.quantity} step={line.unit === 'm2' ? 0.1 : 1} value={value.quantity} onChange={(e) => setLine(line.no, 'quantity', e.target.value)} />
            </label>
            <label className="field narrow">
              <span className="field-label">CHF / {unitLabel(line.unit)}</span>
              <input className="input" type="number" min="0" step="0.05" value={value.price} onChange={(e) => setLine(line.no, 'price', e.target.value)} />
            </label>
            <label className="field grow">
              <span className="field-label">From</span>
              <select className="input" value={value.listing} onChange={(e) => setLine(line.no, 'listing', e.target.value)}>
                <option value="">Stock not listed</option>
                {listings.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name} ({amount(l.available, l.unit)} left)
                  </option>
                ))}
              </select>
            </label>
            {!value.listing && (
              <>
                <label className="field narrow">
                  <span className="field-label">Condition</span>
                  <select className="input" value={value.condition} onChange={(e) => setLine(line.no, 'condition', e.target.value)}>
                    <option value="good">Good</option>
                    <option value="fair">Fair</option>
                    <option value="poor">Poor</option>
                  </select>
                </label>
                <label className="field narrow">
                  <span className="field-label">kg / {unitLabel(line.unit)}</span>
                  <input className="input" type="number" min="0" step="0.1" value={value.weight} onChange={(e) => setLine(line.no, 'weight', e.target.value)} />
                </label>
              </>
            )}
          </fieldset>
        )
      })}
      <div className="field-row">
        <label className="field">
          <span className="field-label">Ready for pickup from</span>
          <input className="input" type="date" value={ready} onChange={(e) => setReady(e.target.value)} />
        </label>
        <label className="field grow">
          <span className="field-label">Note to the buyer</span>
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Pine, painted white; frames included" />
        </label>
      </div>
      <p className="order-total">
        <span>Your bid for the materials</span>
        <strong>{formatMoney(total)}</strong>
      </p>
      {action.error && <p className="error">{action.error}</p>}
      <div className="row-actions start">
        <button type="submit" className="btn btn-primary" disabled={action.busy}>
          {mine ? 'Update bid' : 'Place bid'}
        </button>
        {mine && (
          <button type="button" className="btn btn-outline" disabled={action.busy} onClick={() => action.run(() => withdrawBid(token, mine.id))}>
            Withdraw bid
          </button>
        )}
      </div>
    </form>
  )
}

function SellerTenderDetail({ tenderId, onBack }) {
  const { token } = useAuth()
  const [tender, setTender] = useState(null)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState('')
  useEffect(() => {
    fetchTender(token, tenderId)
      .then(setTender)
      .catch((err) => setError(errorText(err)))
  }, [token, tenderId])

  if (error) return <p className="error">{error}</p>
  if (!tender) return <p className="note">Loading the tender…</p>
  const bid = tender.my_bid
  return (
    <section className="dash-section">
      <button type="button" className="text-btn back-link" onClick={onBack}>
        ← All tenders
      </button>
      <header>
        <h1 className="dash-title">{tender.title}</h1>
        <p className="lede">
          <Pill status={tender.status} />
          {tender.invited && tender.status === 'open' && <span className="status-pill">Invited</span>}
          {tender.buyer_name} · {tender.bid_count} bid{tender.bid_count === 1 ? '' : 's'} so far
        </p>
      </header>
      <div className="dash-card">
        <TenderFacts tender={tender} />
        {tender.description && <p className="note">{tender.description}</p>}
        <MaterialList tender={tender} />
      </div>
      {saved && <p className="ok-box">{saved}</p>}
      {bid && bid.status !== 'submitted' && (
        <p className={bid.status === 'awarded' ? 'ok-box' : 'hint-box'}>
          {bid.status === 'awarded' && (
            <>
              You won this tender with {formatMoney(bid.goods_chf)}. It is now an order: see <Link to="/dashboard/orders">Orders</Link>.
            </>
          )}
          {bid.status === 'declined' && 'Your bid was not chosen.'}
          {bid.status === 'withdrawn' && 'You withdrew your bid.'}
        </p>
      )}
      {tender.status === 'open' ? (
        <BidForm
          key={`${bid?.id}:${bid?.updated_at}`}
          tender={tender}
          onSaved={(next) => {
            setTender(next)
            setSaved(next.my_bid?.status === 'withdrawn' ? 'Bid withdrawn.' : 'Bid sent. You can change it until bidding closes.')
          }}
        />
      ) : (
        tender.status !== 'awarded' && tender.status !== 'fulfilled' && <p className="hint-box">Bidding has closed.</p>
      )}
    </section>
  )
}

export function SellerTenders() {
  const { data, error, reload } = useLoad(fetchOpenTenders)
  const [params, setParams] = useSearchParams()
  const open = params.get('tender')
  const show = (id) => setParams(id ? { tender: id } : {})

  if (open) return <SellerTenderDetail tenderId={open} onBack={() => { show(null); reload() }} />
  return (
    <section className="dash-section">
      <header>
        <h1 className="dash-title">Tenders</h1>
        <p className="lede">Companies asking for bulk quantities. You are invited when your listings match and your pickup is near the site; any seller may bid.</p>
      </header>
      {error && <p className="error">{error}</p>}
      {data && data.length === 0 && <p className="dash-card note">No open tenders right now. New ones appear here.</p>}
      {(data ?? []).map((tender) => (
        <TenderRow
          key={tender.id}
          tender={tender}
          onOpen={() => show(tender.id)}
          extra={
            <>
              {tender.invited && tender.status === 'open' && !tender.my_bid && <span className="status-pill">Invited</span>}
              {tender.my_bid && <Pill status={tender.my_bid.status} labels={BID_STATUS} />}
            </>
          }
        />
      ))}
    </section>
  )
}

// ---- admin -----------------------------------------------------------------------------------------
export function AdminTenders() {
  const { data, error, reload } = useLoad(fetchAllTenders)
  const [params, setParams] = useSearchParams()
  const open = params.get('tender')
  const show = (id) => setParams(id ? { tender: id } : {})

  if (open) return <TenderDetail admin tenderId={open} onBack={() => { show(null); reload() }} />
  return (
    <section className="dash-section">
      <header>
        <h1 className="dash-title">Tenders</h1>
        <p className="lede">Every corporate tender, its bids and awards. Take down a tender that breaks the rules; the buyer and bidders see it was cancelled.</p>
      </header>
      {error && <p className="error">{error}</p>}
      {data && data.length === 0 && <p className="dash-card note">No tenders yet.</p>}
      {(data ?? []).map((tender) => (
        <TenderRow key={tender.id} tender={tender} onOpen={() => show(tender.id)} extra={<span className="note">{tender.buyer_name}</span>} />
      ))}
    </section>
  )
}
