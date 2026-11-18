import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import useAuth from '../../hooks/useAuth'
import { describeError } from '../../lib/api'
import { fetchImpact } from '../../lib/auth'
import { fetchEarnings } from '../../lib/financeApi'
import { formatMoney } from '../../lib/format'
import {
  acceptBooking,
  acceptExtension,
  createSpace,
  declineBooking,
  declineExtension,
  deleteSpace,
  fetchCalendar,
  fetchSpaces,
  fetchStorageRequests,
  markBooking,
  saveSpace,
} from '../../lib/storageApi'
import AddressField from '../AddressField'
import { CheckIcon, ClockIcon, CoinIcon, InboxIcon, PlusIcon, WalletIcon, WarehouseIcon } from '../Icons'
import MaterialImage from '../MaterialImage'
import { useWaiting } from './attention'
import { formatDate } from './format'
import { Chip, Co2Card, EmptyState, ListSkeleton, Meter, OverviewSkeleton, PageHead, Panel, StatCard, Step, TodoRow, greeting, useData } from './kit'
import './storage.css'

// The storage space renter's dashboard: an overview, the requests from buyers (and their requests for more days),
// the loads being stored, and the spaces with their size, stacking height, price per m² per day and reach.
// Buyers see a space only when it is within its reach of the seller and has room for the load on every day.

const firstName = (name) => name.split(' ')[0]
const qty = (q, unit) => (unit === 'm2' ? `${q} m²` : `${q}×`)
const m2 = (value) => `${Number(value).toLocaleString('de-CH', { maximumFractionDigits: 1 })} m²`
const day = (iso) => (iso ? formatDate(iso) : '')
const today = () => new Date().toISOString().slice(0, 10)

const BOOKING = {
  requested: ['Waiting for your answer', 'wait'],
  accepted: ['Accepted, load not here yet', ''],
  received: ['In storage', ''],
  released: ['Collected', 'muted'],
  declined: ['You declined', 'muted'],
  withdrawn: ['Withdrawn by the buyer', 'muted'],
  taken: ['Another renter took it', 'muted'],
  cancelled: ['Cancelled', 'muted'],
}

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

function StatusChip({ status }) {
  const [label, tone] = BOOKING[status] ?? [status, 'muted']
  return <Chip tone={tone}>{label}</Chip>
}

function Items({ items }) {
  return (
    <ul className="order-lines">
      {items.map((item, i) => (
        <li key={item.listing_id || i}>
          <MaterialImage kind={item.category} src={item.image} alt="" className="order-thumb" />
          <span>
            <strong>{item.name}</strong>
            <span className="note">
              {qty(item.quantity, item.unit)}
              {item.width_cm && item.height_cm ? ` · ${Math.round(item.width_cm)} × ${Math.round(item.height_cm)}${item.depth_cm ? ` × ${Math.round(item.depth_cm)}` : ''} cm` : ''}
              {item.stackable === false ? ' · not stackable' : item.stackable ? ' · stackable' : ''}
            </span>
          </span>
        </li>
      ))}
    </ul>
  )
}

function Person({ label, person }) {
  if (!person) return null
  return (
    <p className="st-person">
      <span className="note">{label}</span>
      <strong>{person.company || person.name}</strong>
      {person.company && <span className="note">{person.name}</span>}
      <span>
        {person.phone && <a href={`tel:${person.phone}`}>{person.phone}</a>}
        {person.phone && person.email && ' · '}
        {person.email && <a href={`mailto:${person.email}`}>{person.email}</a>}
      </span>
    </p>
  )
}

/** One request or booking: the space, the days, the floor it takes and the price. */
function BookingCard({ booking, children }) {
  return (
    <article className="dash-card order-card st-card">
      <div className="verify-head">
        <strong>
          {booking.space.name} · {m2(booking.area_m2)}
        </strong>
        <StatusChip status={booking.status} />
      </div>
      <dl className="st-facts">
        <div>
          <dt>Stay</dt>
          <dd>
            {day(booking.start_date)} – {day(booking.end_date)} <span className="note">({booking.days} days)</span>
          </dd>
        </div>
        <div>
          <dt>Comes from</dt>
          <dd>{booking.pickup.address || `${booking.pickup.city} (${booking.pickup.canton})`}</dd>
        </div>
        <div>
          <dt>Goes to</dt>
          <dd>{booking.delivery_town || 'Switzerland'}</dd>
        </div>
        <div>
          <dt>Price</dt>
          <dd>
            <strong>{formatMoney(booking.price_chf)}</strong>{' '}
            <span className="note">({formatMoney(booking.price_per_m2_day_chf)} per m² per day)</span>
          </dd>
        </div>
      </dl>
      <Items items={booking.items} />
      {booking.contacts && (
        <div className="st-people">
          <Person label="Buyer" person={booking.contacts.buyer} />
          <Person label="Seller (the load comes from)" person={booking.contacts.seller} />
        </div>
      )}
      {booking.reason && booking.status !== 'accepted' && <p className="note">{booking.reason}</p>}
      {children}
    </article>
  )
}

// ---- requests ---------------------------------------------------------------------------------------------

function Answer({ onAccept, onDecline, acceptLabel = 'Accept' }) {
  const [declining, setDeclining] = useState(false)
  const [reason, setReason] = useState('')
  const [state, setState] = useState({ busy: false, error: '' })
  const run = async (action) => {
    setState({ busy: true, error: '' })
    try {
      await action()
    } catch (err) {
      setState({ busy: false, error: err.detail || describeError(err) })
    }
  }
  return (
    <>
      {declining ? (
        <div className="st-decline">
          <label className="field grow">
            <span className="field-label">Why not? (the buyer sees this)</span>
            <input className="input" maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Full that week" />
          </label>
          <div className="row-actions start">
            <button type="button" className="btn btn-primary" disabled={state.busy} onClick={() => run(() => onDecline(reason))}>
              Decline
            </button>
            <button type="button" className="btn btn-outline" onClick={() => setDeclining(false)}>
              Back
            </button>
          </div>
        </div>
      ) : (
        <div className="row-actions start">
          <button type="button" className="btn btn-primary" disabled={state.busy} onClick={() => run(onAccept)}>
            <CheckIcon width={17} height={17} /> {state.busy ? 'Saving…' : acceptLabel}
          </button>
          <button type="button" className="btn btn-outline" disabled={state.busy} onClick={() => setDeclining(true)}>
            Decline
          </button>
        </div>
      )}
      {state.error && <p className="error">{state.error}</p>}
    </>
  )
}

export function StorageRequests() {
  const { data, error, reload, token } = useLoad(fetchStorageRequests)
  const { status } = useAuth()
  const waiting = useWaiting()
  const done = () => {
    reload()
    waiting.refresh?.()
  }
  const open = (data ?? []).filter((b) => b.status === 'requested')
  const extensions = (data ?? []).flatMap((b) => b.extensions.filter((e) => e.status === 'requested').map((e) => ({ ...e, booking: b })))
  const closed = (data ?? []).filter((b) => ['declined', 'withdrawn', 'taken', 'cancelled'].includes(b.status))
  return (
    <section className="dash-section">
      <PageHead
        title="Requests"
        lede="Buyers who cannot take their materials by the seller's date ask you to store them. Several renters may be asked; the first to accept gets the load."
      />
      {error && <p className="error">{error}</p>}
      {status !== 'active' && <p className="hint-box">You can accept requests once Scan4Reuse has verified your account.</p>}
      {!data && !error && <ListSkeleton />}
      {extensions.length > 0 && (
        <>
          <h2 className="section-title">More days asked for</h2>
          {extensions.map((ext) => (
            <article key={ext.id} className="dash-card order-card st-card">
              <div className="verify-head">
                <strong>
                  {ext.booking.space.name} · {m2(ext.booking.area_m2)}
                </strong>
                <Chip tone="wait">{ext.days} more days</Chip>
              </div>
              <p>
                Until <strong>{day(ext.new_end)}</strong> instead of {day(ext.old_end)}. You earn{' '}
                <strong>{formatMoney(ext.price_chf)}</strong> more (your rate plus the {ext.late_pct}% late-buyer fee).
              </p>
              <p className="note">The buyer pays it before the load leaves; the trip from your space moves to the new day.</p>
              <Answer
                acceptLabel="Accept the new date"
                onAccept={async () => {
                  await acceptExtension(token, ext.id)
                  done()
                }}
                onDecline={async (reason) => {
                  await declineExtension(token, ext.id, reason)
                  done()
                }}
              />
            </article>
          ))}
        </>
      )}
      {data && open.length === 0 && extensions.length === 0 && (
        <EmptyState icon={InboxIcon} title="No requests right now" text="When a buyer near one of your spaces needs storage, the request shows here.">
          <Link to="/dashboard/spaces" className="btn btn-primary btn-sm">
            Your spaces
          </Link>
        </EmptyState>
      )}
      {open.length > 0 && <h2 className="section-title">New requests</h2>}
      {open.map((booking) => (
        <BookingCard key={booking.id} booking={booking}>
          <p className="note">The street address and the buyer's and seller's contacts appear once you accept.</p>
          <Answer
            onAccept={async () => {
              await acceptBooking(token, booking.id)
              done()
            }}
            onDecline={async (reason) => {
              await declineBooking(token, booking.id, reason)
              done()
            }}
          />
        </BookingCard>
      ))}
      {closed.length > 0 && (
        <details className="st-closed">
          <summary>Closed requests ({closed.length})</summary>
          {closed.map((booking) => (
            <BookingCard key={booking.id} booking={booking} />
          ))}
        </details>
      )}
    </section>
  )
}

// ---- loads in storage -------------------------------------------------------------------------------------

export function StorageBookings() {
  const { data, error, reload, token } = useLoad(fetchStorageRequests)
  const waiting = useWaiting()
  const [state, setState] = useState({ busy: '', error: '' })
  const mark = async (booking, status) => {
    setState({ busy: booking.id, error: '' })
    try {
      await markBooking(token, booking.id, status)
      setState({ busy: '', error: '' })
      reload()
      waiting.refresh?.()
    } catch (err) {
      setState({ busy: '', error: err.detail || describeError(err) })
    }
  }
  const booked = (data ?? []).filter((b) => ['accepted', 'received', 'released'].includes(b.status))
  const groups = [
    ['Coming in', booked.filter((b) => b.status === 'accepted')],
    ['In storage', booked.filter((b) => b.status === 'received')],
    ['Collected', booked.filter((b) => b.status === 'released')],
  ]
  return (
    <section className="dash-section">
      <PageHead title="Bookings" lede="Loads you accepted: when they arrive, how long they stay and who to call. Mark each load when it arrives and when it leaves." />
      {(error || state.error) && <p className="error">{error || state.error}</p>}
      {!data && !error && <ListSkeleton />}
      {data && booked.length === 0 && (
        <EmptyState icon={WarehouseIcon} title="Nothing booked yet" text="Requests you accept become bookings here, with the buyer's and seller's contacts." />
      )}
      {groups.map(([title, rows]) =>
        rows.length ? (
          <div key={title}>
            <h2 className="section-title">
              {title} ({rows.length})
            </h2>
            {rows.map((booking) => (
              <BookingCard key={booking.id} booking={booking}>
                {booking.extensions.some((e) => e.status === 'accepted') && (
                  <p className="note">
                    Extended:{' '}
                    {booking.extensions
                      .filter((e) => e.status === 'accepted')
                      .map((e) => `${e.days} days to ${day(e.new_end)}`)
                      .join(', ')}
                  </p>
                )}
                {booking.status === 'accepted' && (
                  <div className="row-actions start">
                    <button type="button" className="btn btn-primary" disabled={state.busy === booking.id} onClick={() => mark(booking, 'received')}>
                      The load has arrived
                    </button>
                    {booking.start_date > today() && <span className="note">Expected on {day(booking.start_date)}</span>}
                  </div>
                )}
                {booking.status === 'received' && (
                  <div className="row-actions start">
                    <button type="button" className="btn btn-primary" disabled={state.busy === booking.id} onClick={() => mark(booking, 'released')}>
                      The load has left
                    </button>
                    <span className="note">Collected for the buyer on {day(booking.end_date)}</span>
                  </div>
                )}
              </BookingCard>
            ))}
          </div>
        ) : null,
      )}
    </section>
  )
}

// ---- spaces -------------------------------------------------------------------------------------------------

const EMPTY_SPACE = {
  name: '',
  area_m2: '',
  height_m: '2',
  price_chf: '',
  radius_km: '30',
  indoor: true,
  covered: true,
  hours: '',
  access: '',
  description: '',
  photos: [],
  active: true,
}

function readPhoto(file) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) return reject(new Error('Pick an image.'))
    if (file.size > 2_000_000) return reject(new Error('Each photo must be under 2 MB.'))
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('That photo could not be read.'))
    reader.readAsDataURL(file)
  })
}

function SpaceForm({ space, token, onSaved, onCancel }) {
  const [form, setForm] = useState(() =>
    space
      ? { ...space, area_m2: String(space.area_m2), height_m: String(space.height_m), price_chf: String(space.price_chf), radius_km: String(space.radius_km) }
      : EMPTY_SPACE,
  )
  const [place, setPlace] = useState(space ? { address: space.address, city: space.city, canton: space.canton, lat: space.lat, lon: space.lon } : null)
  const [state, setState] = useState({ busy: false, error: '' })
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))
  const addPhotos = async (e) => {
    const files = [...e.target.files].slice(0, 4 - form.photos.length)
    e.target.value = ''
    try {
      const photos = await Promise.all(files.map(readPhoto))
      setForm((f) => ({ ...f, photos: [...f.photos, ...photos] }))
    } catch (err) {
      setState({ busy: false, error: err.message })
    }
  }
  const submit = async (e) => {
    e.preventDefault()
    if (!place) return setState({ busy: false, error: 'Pick the address from the suggestions.' })
    setState({ busy: true, error: '' })
    const body = {
      ...form,
      ...place,
      area_m2: Number(form.area_m2),
      height_m: Number(form.height_m),
      price_chf: Number(form.price_chf),
      radius_km: Number(form.radius_km),
    }
    try {
      const saved = space ? await saveSpace(token, space.id, body) : await createSpace(token, body)
      onSaved(saved)
    } catch (err) {
      setState({ busy: false, error: err.detail || describeError(err) })
    }
  }
  return (
    <form className="dash-card dash-form" onSubmit={submit}>
      <h2 className="section-title">{space ? `Edit ${space.name}` : 'Add a space'}</h2>
      <label className="field">
        <span className="field-label">Name</span>
        <input className="input" required maxLength={120} value={form.name} onChange={set('name')} placeholder="Hall B, Muttenz" />
      </label>
      <AddressField label="Address" value={place} onChange={setPlace} required />
      <div className="field-row">
        <label className="field">
          <span className="field-label">Floor area (m²)</span>
          <input className="input" type="number" min="1" step="0.5" required value={form.area_m2} onChange={set('area_m2')} />
        </label>
        <label className="field">
          <span className="field-label">Stack up to (m high)</span>
          <input className="input" type="number" min="0.5" max="20" step="0.1" required value={form.height_m} onChange={set('height_m')} />
        </label>
      </div>
      <div className="field-row">
        <label className="field">
          <span className="field-label">Price per m² per day (CHF)</span>
          <input className="input" type="number" min="0.01" step="0.01" required value={form.price_chf} onChange={set('price_chf')} placeholder="0.40" />
        </label>
        <label className="field">
          <span className="field-label">Takes loads from sellers within (km)</span>
          <input className="input" type="number" min="1" max="400" step="1" required value={form.radius_km} onChange={set('radius_km')} />
        </label>
      </div>
      <div className="st-switches">
        <label className="switch-line">
          <input type="checkbox" checked={form.indoor} onChange={set('indoor')} />
          <span>Indoors</span>
        </label>
        <label className="switch-line">
          <input type="checkbox" checked={form.covered} onChange={set('covered')} />
          <span>Covered (out of the rain)</span>
        </label>
        <label className="switch-line">
          <input type="checkbox" checked={form.active} onChange={set('active')} />
          <span>Offer this space to buyers</span>
        </label>
      </div>
      <div className="field-row">
        <label className="field">
          <span className="field-label">Opening hours</span>
          <input className="input" maxLength={200} value={form.hours} onChange={set('hours')} placeholder="Mo–Fr 7:00–17:00" />
        </label>
        <label className="field">
          <span className="field-label">Access</span>
          <input className="input" maxLength={500} value={form.access} onChange={set('access')} placeholder="Loading ramp, forklift, 4 m gate" />
        </label>
      </div>
      <label className="field">
        <span className="field-label">Description (optional)</span>
        <textarea className="input" rows={3} maxLength={2000} value={form.description} onChange={set('description')} />
      </label>
      <div className="field">
        <span className="field-label">Photos (up to 4)</span>
        <div className="st-photos">
          {form.photos.map((photo, i) => (
            <span key={i} className="st-photo">
              <img src={photo} alt={`Photo ${i + 1}`} />
              <button type="button" aria-label="Remove photo" onClick={() => setForm((f) => ({ ...f, photos: f.photos.filter((_, j) => j !== i) }))}>
                ×
              </button>
            </span>
          ))}
          {form.photos.length < 4 && (
            <label className="st-photo st-photo-add">
              <PlusIcon width={20} height={20} />
              <input type="file" accept="image/*" multiple onChange={addPhotos} />
            </label>
          )}
        </div>
      </div>
      <p className="note">
        Buyers see how much floor is free on the days they need and your price per m² per day. Loads lie on their largest side; what
        can be stacked is piled up to the height you set.
      </p>
      {state.error && <p className="error">{state.error}</p>}
      <div className="row-actions start">
        <button type="submit" className="btn btn-primary" disabled={state.busy}>
          {state.busy ? 'Saving…' : space ? 'Save' : 'Add space'}
        </button>
        <button type="button" className="btn btn-outline" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  )
}

/** Floor booked per day for the next 60 days, as small bars. */
function Occupancy({ spaceId, token }) {
  const [days, setDays] = useState(null)
  useEffect(() => {
    fetchCalendar(token, spaceId).then(setDays).catch(() => setDays([]))
  }, [token, spaceId])
  if (!days?.length) return null
  const busiest = Math.max(...days.map((d) => d.used_m2))
  return (
    <div className="st-calendar" role="img" aria-label={`Booked floor over the next 60 days; at most ${m2(busiest)} on one day`}>
      {days.map((d) => (
        <i key={d.date} title={`${day(d.date)}: ${m2(d.used_m2)} booked`} style={{ height: `${Math.max(4, (d.used_m2 / d.area_m2) * 100)}%` }} className={d.used_m2 > 0 ? 'is-used' : ''} />
      ))}
    </div>
  )
}

export function StorageSpaces() {
  const { data, error, reload, token } = useLoad(fetchSpaces)
  const [editing, setEditing] = useState(null) // null, 'new' or a space
  const [message, setMessage] = useState('')
  const remove = async (space) => {
    if (!window.confirm(`Remove ${space.name}? A space with bookings is switched off instead.`)) return
    try {
      const result = await deleteSpace(token, space.id)
      setMessage(result.deleted ? `${space.name} was removed.` : `${space.name} has bookings, so it was switched off instead.`)
      reload()
    } catch (err) {
      setMessage(err.detail || describeError(err))
    }
  }
  return (
    <section className="dash-section">
      <PageHead title="Spaces" lede="Where you store loads, how much floor there is and what a day costs.">
        {!editing && (
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setEditing('new')}>
            <PlusIcon width={17} height={17} /> Add a space
          </button>
        )}
      </PageHead>
      {error && <p className="error">{error}</p>}
      {message && <p className="ok-box">{message}</p>}
      {editing && (
        <SpaceForm
          space={editing === 'new' ? null : editing}
          token={token}
          onCancel={() => setEditing(null)}
          onSaved={(saved) => {
            setEditing(null)
            setMessage(`${saved.name} is saved.`)
            reload()
          }}
        />
      )}
      {!data && !error && <ListSkeleton />}
      {data && data.length === 0 && !editing && (
        <EmptyState icon={WarehouseIcon} title="No spaces yet" text="Add a hall, a yard or a room. Buyers near it can then ask you to store their materials.">
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setEditing('new')}>
            Add a space
          </button>
        </EmptyState>
      )}
      {(data ?? []).map((space) => (
        <article key={space.id} className="dash-card order-card st-card">
          <div className="verify-head">
            <strong>{space.name}</strong>
            {space.active ? <Chip>Offered to buyers</Chip> : <Chip tone="muted">Switched off</Chip>}
          </div>
          <p className="note">{space.address}</p>
          <div className="st-space">
            {space.photos[0] && <img className="st-space-photo" src={space.photos[0]} alt="" />}
            <dl className="st-facts">
              <div>
                <dt>Free today</dt>
                <dd>
                  {m2(space.free_today_m2)} of {m2(space.area_m2)}
                  <Meter value={space.area_m2 - space.free_today_m2} max={space.area_m2} label="Booked today" />
                </dd>
              </div>
              <div>
                <dt>Price</dt>
                <dd>{formatMoney(space.price_chf)} per m² per day</dd>
              </div>
              <div>
                <dt>Stacking</dt>
                <dd>up to {space.height_m} m</dd>
              </div>
              <div>
                <dt>Reach</dt>
                <dd>sellers within {space.radius_km} km</dd>
              </div>
              <div>
                <dt>Kind</dt>
                <dd>
                  {space.indoor ? 'Indoors' : 'Outdoors'}, {space.covered ? 'covered' : 'not covered'}
                </dd>
              </div>
              {space.hours && (
                <div>
                  <dt>Open</dt>
                  <dd>{space.hours}</dd>
                </div>
              )}
            </dl>
          </div>
          <span className="note">Booked floor, next 60 days</span>
          <Occupancy spaceId={space.id} token={token} />
          <div className="row-actions start">
            <button type="button" className="btn btn-secondary" onClick={() => setEditing(space)}>
              Edit
            </button>
            <button type="button" className="btn btn-outline" onClick={() => remove(space)}>
              Remove
            </button>
          </div>
        </article>
      ))}
    </section>
  )
}

// ---- overview ----------------------------------------------------------------------------------------------

const loadOverview = (token) => Promise.all([fetchSpaces, fetchStorageRequests, fetchEarnings, fetchImpact].map((fn) => fn(token).catch(() => null)))

export function StorageOverview() {
  const { user, status, can } = useAuth()
  const { data, error } = useData(loadOverview)
  const lede = 'Rent out floor where bought materials wait until the buyer can take them.'
  if (!data)
    return (
      <section className="dash-section">
        <PageHead title={`${greeting()}, ${firstName(user.name)}`} lede={lede} />
        {error && <p className="error">{error}</p>}
        {!error && <OverviewSkeleton />}
      </section>
    )
  const [spaces = [], bookings = [], earnings, impact] = data.map((d, i) => d ?? [[], [], null, null][i])
  const active = spaces.filter((s) => s.active)
  const area = active.reduce((sum, s) => sum + s.area_m2, 0)
  const free = active.reduce((sum, s) => sum + s.free_today_m2, 0)
  const open = bookings.filter((b) => b.status === 'requested')
  const extensions = bookings.flatMap((b) => b.extensions.filter((e) => e.status === 'requested'))
  const arriving = bookings.filter((b) => b.status === 'accepted' && b.start_date <= today())
  const leaving = bookings.filter((b) => b.status === 'received' && b.end_date <= today())
  const stored = bookings.filter((b) => b.status === 'received')
  const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`
  const todos = [
    open.length > 0 && { icon: InboxIcon, title: `${plural(open.length, 'request')} to answer`, text: 'The first renter to accept gets the load', to: '/dashboard/requests' },
    extensions.length > 0 && { icon: ClockIcon, title: `${plural(extensions.length, 'buyer')} asking for more days`, text: 'Accept or decline the new date', to: '/dashboard/requests' },
    arriving.length > 0 && { icon: WarehouseIcon, title: `${plural(arriving.length, 'load')} due to arrive`, text: 'Mark each one when it is in', to: '/dashboard/bookings' },
    leaving.length > 0 && { icon: WarehouseIcon, title: `${plural(leaving.length, 'load')} due to leave`, text: 'Mark each one when it is collected', to: '/dashboard/bookings' },
    earnings?.available_chf > 0 && { icon: WalletIcon, title: `${formatMoney(earnings.available_chf)} ready to pay out`, text: 'Request a payout to your bank', to: '/dashboard/payouts' },
  ].filter(Boolean)
  const setup = [
    { done: status === 'active', text: 'Wait for Scan4Reuse to verify your account' },
    { done: spaces.length > 0, to: '/dashboard/spaces', text: 'Add your first space with its price per m² per day' },
    { done: bookings.some((b) => b.status !== 'requested'), to: '/dashboard/requests', text: 'Accept your first request' },
  ]
  const setupLeft = setup.filter((s) => !s.done).length
  return (
    <section className="dash-section">
      <PageHead title={`${greeting()}, ${firstName(user.name)}`} lede={lede}>
        <Link to="/dashboard/spaces" className="btn btn-primary btn-sm">
          <WarehouseIcon width={18} height={18} /> Your spaces
        </Link>
      </PageHead>
      <div className="ds-row ds-row-even is-stretch">
        <div className="dash-card ds-hero">
          <span className="ds-stat-label">Available balance</span>
          <strong className="ds-stat-value">{formatMoney(earnings?.available_chf ?? 0)}</strong>
          <span className="note">
            {earnings?.on_the_way_chf > 0 ? `${formatMoney(earnings.on_the_way_chf)} more once the buyers have their materials` : 'Credited when the buyer has the materials'}
          </span>
          {can('payouts.request') && (
            <Link to="/dashboard/payouts" className="btn btn-sm">
              <WalletIcon width={17} height={17} /> Balance & payouts
            </Link>
          )}
        </div>
        <Co2Card impact={impact} scope="storing" what="kept for reuse" />
      </div>
      <div className="ds-stats is-3">
        <StatCard icon={WarehouseIcon} label="Free floor today" value={m2(free)} note={area ? `of ${m2(area)} offered` : 'Add a space to start'} to="/dashboard/spaces" />
        <StatCard icon={InboxIcon} label="Loads in storage" value={stored.length} note={`${plural(open.length, 'request')} waiting`} to="/dashboard/bookings" />
        <StatCard icon={CoinIcon} label="Earned so far" value={formatMoney(earnings?.earned_chf ?? 0)} note="after commission" to="/dashboard/payouts" />
      </div>
      <div className="ds-row ds-row-even">
        <Panel title="Needs your attention" count={todos.length}>
          <div className="ds-list">
            {todos.length ? todos.map((t) => <TodoRow key={t.title} {...t} />) : <TodoRow icon={InboxIcon} title="You are all caught up" text="New requests show up here" done />}
          </div>
        </Panel>
        {setupLeft > 0 ? (
          <Panel title="Get started" sub={`${setup.length - setupLeft} of ${setup.length} done`}>
            <div className="ds-list">
              {setup.map((s, i) => (
                <Step key={s.text} n={i + 1} done={s.done} to={s.to}>
                  {s.text}
                </Step>
              ))}
            </div>
          </Panel>
        ) : (
          <Panel title="Your spaces" action={<Link className="ds-link" to="/dashboard/spaces">See all</Link>}>
            <div className="ds-list">
              {active.map((s) => (
                <div key={s.id} className="st-mini">
                  <strong>{s.name}</strong>
                  <span className="note">
                    {m2(s.free_today_m2)} free of {m2(s.area_m2)} · {formatMoney(s.price_chf)}/m²/day
                  </span>
                  <Meter value={s.area_m2 - s.free_today_m2} max={s.area_m2} label={`${s.name} booked today`} />
                </div>
              ))}
            </div>
          </Panel>
        )}
      </div>
    </section>
  )
}
