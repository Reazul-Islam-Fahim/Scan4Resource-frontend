import { useCallback, useEffect, useRef, useState } from 'react'
import useAuth from '../../hooks/useAuth'
import { describeError } from '../../lib/api'
import { roleName } from '../../lib/auth'
import { fetchLogs } from '../../lib/adminApi'
import { ClockIcon } from '../Icons'
import { EmptyState, ListSkeleton } from './kit'

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
const EMPTY = { q: '', category: '', level: '', role: '', source: '', actor: '', since: '', until: '' }
const RANGES = [
  ['', 'Any time'],
  ['1h', 'Last hour'],
  ['24h', 'Last 24 hours'],
  ['7d', 'Last 7 days'],
  ['30d', 'Last 30 days'],
  ['custom', 'Choose dates…'],
]
const RANGE_MS = { '1h': 3600e3, '24h': 86400e3, '7d': 7 * 86400e3, '30d': 30 * 86400e3 }
const PER_PAGE = [25, 50, 100, 200]
// <input type="datetime-local"> works in local time; the API wants UTC ISO times.
const toIso = (local) => (local ? new Date(local).toISOString() : '')
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

/** Page numbers to show: the first, the last, and a few around the current one, with gaps as null. */
function pageList(page, pages) {
  const wanted = new Set([1, pages, page - 1, page, page + 1].filter((n) => n >= 1 && n <= pages))
  const sorted = [...wanted].sort((a, b) => a - b)
  return sorted.flatMap((n, i) => (i > 0 && n - sorted[i - 1] > 1 ? [null, n] : [n]))
}

function Pager({ page, pages, total, perPage, busy, onPage, onPerPage }) {
  if (!total) return null
  const from = (page - 1) * perPage + 1
  const to = Math.min(page * perPage, total)
  return (
    <nav className="pager" aria-label="Log pages">
      <span className="note pager-count">
        {from.toLocaleString('de-CH')}–{to.toLocaleString('de-CH')} of {total.toLocaleString('de-CH')}
      </span>
      <div className="pager-buttons">
        <button type="button" className="pager-btn" disabled={busy || page <= 1} onClick={() => onPage(page - 1)} aria-label="Newer lines">
          ‹
        </button>
        {pageList(page, pages).map((n, i) =>
          n === null ? (
            <span key={`gap-${i}`} className="pager-gap">
              …
            </span>
          ) : (
            <button
              key={n}
              type="button"
              className={`pager-btn${n === page ? ' is-active' : ''}`}
              aria-current={n === page ? 'page' : undefined}
              disabled={busy}
              onClick={() => onPage(n)}
            >
              {n}
            </button>
          ),
        )}
        <button type="button" className="pager-btn" disabled={busy || page >= pages} onClick={() => onPage(page + 1)} aria-label="Older lines">
          ›
        </button>
      </div>
      <label className="pager-size note">
        Per page
        <select className="input input-sm" value={perPage} onChange={(e) => onPerPage(Number(e.target.value))}>
          {PER_PAGE.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>
    </nav>
  )
}

export function AdminLogs() {
  const { token } = useAuth()
  const [filters, setFilters] = useState(EMPTY)
  const [range, setRange] = useState('')
  const [search, setSearch] = useState('')
  const [actorName, setActorName] = useState('')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(50)
  const [state, setState] = useState({ lines: null, total: 0, pages: 1, reachable: true, error: '', busy: false })
  const [live, setLive] = useState(true)
  const asked = useRef(0)
  const top = useRef(null)

  const load = useCallback(() => {
    const ask = ++asked.current
    setState((s) => ({ ...s, busy: true }))
    // a quick range is counted back from now each time, so live refresh keeps up
    const since = RANGE_MS[range] ? new Date(Date.now() - RANGE_MS[range]).toISOString() : toIso(filters.since)
    const until = RANGE_MS[range] ? '' : toIso(filters.until)
    fetchLogs(token, { ...filters, since, until, page, per_page: perPage })
      .then((data) => {
        if (ask !== asked.current) return // a newer request is on its way
        setState({ lines: data.lines, total: data.total, pages: data.pages, reachable: data.logistics_reachable, error: '', busy: false })
      })
      .catch((err) => ask === asked.current && setState((s) => ({ ...s, error: err.detail || describeError(err), busy: false })))
  }, [token, filters, range, page, perPage])

  useEffect(() => load(), [load])
  // any filter change starts again at the newest page
  useEffect(() => setPage(1), [filters, range, perPage])
  // the search box applies after a short pause in typing
  useEffect(() => {
    const t = setTimeout(() => setFilters((f) => (f.q === search ? f : { ...f, q: search })), 350)
    return () => clearTimeout(t)
  }, [search])
  // live: refresh while the page is open, on the newest page only (older pages would shift under the reader)
  useEffect(() => {
    if (!live || page !== 1) return undefined
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') load()
    }, LIVE_MS)
    return () => clearInterval(t)
  }, [live, load, page])

  const set = (key) => (e) => setFilters((f) => ({ ...f, [key]: e.target.value }))
  const onActor = (line) => {
    setActorName(who(line))
    setFilters((f) => ({ ...f, actor: line.actor_id }))
  }
  const goTo = (n) => {
    setPage(n)
    top.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  const badRange = range === 'custom' && filters.since && filters.until && filters.since >= filters.until
  const filtered = Boolean(range) || Object.entries(filters).some(([, v]) => v)

  return (
    <section className="dash-section" ref={top}>
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
          <span className="field-label">When</span>
          <select className="input" value={range} onChange={(e) => setRange(e.target.value)}>
            {RANGES.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        {range === 'custom' && (
          <>
            <label className="field">
              <span className="field-label">From</span>
              <input className="input" type="datetime-local" value={filters.since} max={filters.until || undefined} onChange={set('since')} />
            </label>
            <label className="field">
              <span className="field-label">Until</span>
              <input className="input" type="datetime-local" value={filters.until} min={filters.since || undefined} onChange={set('until')} />
            </label>
          </>
        )}
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
          <label className="check" title={page !== 1 ? 'Live updates run on the first page' : undefined}>
            <input type="checkbox" checked={live} onChange={(e) => setLive(e.target.checked)} /> Live
          </label>
          {filtered && (
            <button
              type="button"
              className="text-btn"
              onClick={() => {
                setFilters(EMPTY)
                setRange('')
                setSearch('')
              }}
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {badRange && <p className="error">The start time must be before the end time.</p>}
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
      {state.error && !badRange && <p className="error">{state.error}</p>}
      <Pager page={page} pages={state.pages} total={state.total} perPage={perPage} busy={state.busy} onPage={goTo} onPerPage={setPerPage} />
      {!state.lines && !state.error && <ListSkeleton rows={5} />}
      {state.lines && state.lines.length === 0 && <EmptyState icon={ClockIcon} title="Nothing matches" text="Try another level, source or time range." />}
      {state.lines && state.lines.length > 0 && (
        <ul className={`dash-card log-list${state.busy ? ' is-loading' : ''}`} key={`${page}-${perPage}`}>
          {state.lines.map((line) => (
            <LogLine key={`${line.source}-${line.id}`} line={line} onActor={onActor} />
          ))}
        </ul>
      )}
      <Pager page={page} pages={state.pages} total={state.total} perPage={perPage} busy={state.busy} onPage={goTo} onPerPage={setPerPage} />
    </section>
  )
}
