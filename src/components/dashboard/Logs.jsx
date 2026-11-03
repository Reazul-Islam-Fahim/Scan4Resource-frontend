import { useCallback, useEffect, useRef, useState } from 'react'
import useAuth from '../../hooks/useAuth'
import { describeError } from '../../lib/api'
import { roleName } from '../../lib/auth'
import { fetchLogs } from '../../lib/adminApi'

// Everything that happened on the platform, from both APIs: who did what, when, and whether it worked.

const CATEGORIES = [
  ['', 'Everything'],
  ['accounts', 'Accounts and logins'],
  ['scans', 'Scans'],
  ['listings', 'Listings'],
  ['orders', 'Orders'],
  ['payments', 'Payments'],
  ['payouts', 'Payouts'],
  ['tenders', 'Tenders'],
  ['deliveries', 'Deliveries'],
  ['companies', 'Logistics companies'],
  ['admin', 'Admin actions'],
]
const LEVELS = [
  ['', 'Any result'],
  ['warning', 'Refused or failed'],
  ['error', 'Server errors'],
]
const ROLES = ['buyer', 'corporate', 'seller', 'logistics', 'admin', 'service']
const SOURCES = [
  ['', 'Both apps'],
  ['scan4reuse', 'Scan4Reuse'],
  ['logistics', 'Logistics'],
]
const EMPTY = { q: '', category: '', level: '', role: '', source: '', actor: '' }
const LIVE_MS = 10000
const STAMP = new Intl.DateTimeFormat('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })
const stamp = (iso) => STAMP.format(new Date(iso))

const who = (line) => line.actor_name || (line.actor_role === 'service' ? 'Service' : 'Someone not logged in')
const roleLabel = (role) => (role === 'service' ? 'Service' : role ? roleName(role) : '')

function LogLine({ line, onActor }) {
  const [open, setOpen] = useState(false)
  return (
    <li className={`log-line log-${line.level}`}>
      <button type="button" className="log-main" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className="log-time">{stamp(line.at)}</span>
        <span className="log-what">
          <strong>{line.text}</strong>
          {line.detail && <span className="log-detail">{line.detail}</span>}
        </span>
        <span className="log-tags">
          {line.level !== 'info' && <span className={`status-pill ${line.level === 'error' ? 'status-rejected' : 'status-pending'}`}>{line.status || 'error'}</span>}
          <span className="badge-pill">{line.source === 'logistics' ? 'Logistics' : 'Scan4Reuse'}</span>
        </span>
      </button>
      <p className="log-who note">
        {line.actor_id ? (
          <button type="button" className="text-btn" onClick={() => onActor(line)}>
            {who(line)}
          </button>
        ) : (
          who(line)
        )}
        {line.actor_role && ` · ${roleLabel(line.actor_role)}`}
        {line.target && <span className="mono"> · {line.target}</span>}
      </p>
      {open && (
        <dl className="log-facts">
          <dt>Request</dt>
          <dd className="mono">
            {line.method} {line.path}
          </dd>
          <dt>Result</dt>
          <dd>
            {line.status} in {line.ms} ms
          </dd>
          {line.actor_id && (
            <>
              <dt>Account</dt>
              <dd className="mono">{line.actor_id}</dd>
            </>
          )}
          {line.ip && (
            <>
              <dt>From</dt>
              <dd className="mono">{line.ip}</dd>
            </>
          )}
        </dl>
      )}
    </li>
  )
}

export function AdminLogs() {
  const { token } = useAuth()
  const [filters, setFilters] = useState(EMPTY)
  const [search, setSearch] = useState('')
  const [actorName, setActorName] = useState('')
  const [state, setState] = useState({ lines: null, next: null, reachable: true, error: '', busy: false })
  const [live, setLive] = useState(true)
  const asked = useRef(0)
  const paged = useRef(false) // older lines were loaded: live refresh would drop them, so it pauses

  const load = useCallback(
    (before) => {
      const ask = ++asked.current
      paged.current = Boolean(before)
      setState((s) => ({ ...s, busy: true }))
      fetchLogs(token, { ...filters, before, limit: 100 })
        .then((data) => {
          if (ask !== asked.current) return // a newer request is on its way
          setState((s) => ({
            lines: before ? [...(s.lines ?? []), ...data.lines] : data.lines,
            next: data.next,
            reachable: data.logistics_reachable,
            error: '',
            busy: false,
          }))
        })
        .catch((err) => ask === asked.current && setState((s) => ({ ...s, error: err.detail || describeError(err), busy: false })))
    },
    [token, filters],
  )

  useEffect(() => load(), [load])
  // the search box applies after a short pause in typing
  useEffect(() => {
    const t = setTimeout(() => setFilters((f) => (f.q === search ? f : { ...f, q: search })), 350)
    return () => clearTimeout(t)
  }, [search])
  // live: refresh the newest lines while the page is open (not after paging back)
  useEffect(() => {
    if (!live) return undefined
    const t = setInterval(() => {
      if (document.visibilityState === 'visible' && !paged.current) load()
    }, LIVE_MS)
    return () => clearInterval(t)
  }, [live, load])

  const set = (key) => (e) => setFilters((f) => ({ ...f, [key]: e.target.value }))
  const onActor = (line) => {
    setActorName(who(line))
    setFilters((f) => ({ ...f, actor: line.actor_id }))
  }
  const filtered = Object.entries(filters).some(([, v]) => v)

  return (
    <section className="dash-section">
      <header>
        <h1 className="dash-title">Logs</h1>
        <p className="lede">Everything people and services did on Scan4Reuse and the logistics app: every change, every refused request and every error.</p>
      </header>

      <div className="dash-card log-filters">
        <label className="field log-search">
          <span className="field-label">Search</span>
          <input className="input" type="search" value={search} placeholder="Name, email, order number, text…" onChange={(e) => setSearch(e.target.value)} />
        </label>
        <label className="field">
          <span className="field-label">What</span>
          <select className="input" value={filters.category} onChange={set('category')}>
            {CATEGORIES.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field-label">Result</span>
          <select className="input" value={filters.level} onChange={set('level')}>
            {LEVELS.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field-label">Role</span>
          <select className="input" value={filters.role} onChange={set('role')}>
            <option value="">Every role</option>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {roleLabel(r)}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field-label">App</span>
          <select className="input" value={filters.source} onChange={set('source')}>
            {SOURCES.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <div className="log-actions">
          <label className="check">
            <input type="checkbox" checked={live} onChange={(e) => setLive(e.target.checked)} /> Live
          </label>
          {filtered && (
            <button
              type="button"
              className="text-btn"
              onClick={() => {
                setFilters(EMPTY)
                setSearch('')
              }}
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {filters.actor && (
        <p className="pill-row">
          <span className="badge-pill">
            Only {actorName}{' '}
            <button type="button" className="text-btn" aria-label="Show everyone" onClick={() => setFilters((f) => ({ ...f, actor: '' }))}>
              ×
            </button>
          </span>
        </p>
      )}
      {!state.reachable && <p className="warn-box">The logistics API cannot be reached, so its lines are missing. Showing Scan4Reuse only.</p>}
      {state.error && <p className="error">{state.error}</p>}
      {state.lines && state.lines.length === 0 && <p className="dash-card note">Nothing matches.</p>}
      {state.lines && state.lines.length > 0 && (
        <ul className="dash-card log-list">
          {state.lines.map((line) => (
            <LogLine key={`${line.source}-${line.id}`} line={line} onActor={onActor} />
          ))}
        </ul>
      )}
      {state.next && (
        <button type="button" className="btn btn-outline" disabled={state.busy} onClick={() => load(state.next)}>
          {state.busy ? 'Loading…' : 'Show older'}
        </button>
      )}
    </section>
  )
}
