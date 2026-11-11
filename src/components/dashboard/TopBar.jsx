import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { logisticsUrl } from '../../lib/auth'
import { BellIcon, HomeIcon, LogoutIcon, MapIcon, PlusIcon, ReportIcon, ScanIcon, SearchIcon, ShopIcon, TruckIcon } from '../Icons'

// The bar above every dashboard page: where you are, a search that jumps to any page or action (Ctrl K),
// what waits for you (the bell) and your account.

const WAITING = {
  verification: (n) => `${n} account${n === 1 ? '' : 's'} wait${n === 1 ? 's' : ''} for verification`,
  payouts: (n) => `${n} payout request${n === 1 ? '' : 's'} to decide`,
  listings: (n) => `${n} draft${n === 1 ? '' : 's'} to publish`,
  tenders: (n) => `${n} tender${n === 1 ? '' : 's'} need${n === 1 ? 's' : ''} you`,
  orders: (n) => `${n} order${n === 1 ? '' : 's'} need${n === 1 ? 's' : ''} you`,
}
const waitingText = (page, label, n) => (WAITING[page] ? WAITING[page](n) : `${n} waiting in ${label}`)

const initials = (name) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('')

/** Shortcuts besides the pages, by what the person can do. */
function actionsFor(auth) {
  const can = (perm) => auth.can?.(perm) ?? true
  const list = [{ key: 'home', label: 'Scan4Reuse home', icon: HomeIcon, to: '/', words: 'start' }]
  if (auth.role === 'seller' && can('market.sell')) {
    list.push({ key: 'scan', label: 'Start a scan', icon: ScanIcon, to: '/scan', words: 'camera photo video new' })
    list.push({ key: 'scans', label: 'My scans', icon: ReportIcon, to: '/scans', words: 'report' })
  }
  if (['buyer', 'corporate'].includes(auth.role)) {
    list.push({ key: 'market', label: 'Browse the marketplace', icon: ShopIcon, to: '/market', words: 'buy materials' })
    list.push({ key: 'map', label: 'Materials on the map', icon: MapIcon, to: '/map', words: 'near' })
  }
  if (auth.role === 'corporate' && can('tenders.create')) {
    list.push({ key: 'tender', label: 'Create a tender', icon: PlusIcon, to: '/dashboard/tenders', words: 'new bulk' })
  }
  if (auth.role === 'logistics') {
    const href = logisticsUrl(auth.token, '/company')
    if (href) list.push({ key: 'logistics', label: 'Open the logistics app', icon: TruckIcon, href, words: 'requests jobs map fleet' })
  }
  list.push({ key: 'logout', label: 'Log out', icon: LogoutIcon, logout: true, words: 'sign out exit' })
  return list
}

function Palette({ pages, attention, auth, onClose, onLogout }) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [at, setAt] = useState(0)
  const input = useRef(null)
  const groups = useMemo(() => {
    const q = query.trim().toLowerCase()
    const match = (item) => !q || `${item.label} ${item.words ?? ''}`.toLowerCase().includes(q)
    const pageItems = pages.map((p) => ({
      key: `page-${p.path}`,
      label: p.label,
      icon: p.icon,
      to: `/dashboard/${p.path}`,
      hint: attention[p.path] ? `${attention[p.path]} waiting` : '',
    }))
    return [
      ['Pages', pageItems.filter(match)],
      ['Actions', actionsFor(auth).filter(match)],
    ].filter(([, items]) => items.length)
  }, [query, pages, attention, auth])
  const flat = groups.flatMap(([, items]) => items)

  useEffect(() => input.current?.focus(), [])
  useEffect(() => setAt(0), [query])

  const go = (item) => {
    onClose()
    if (item.logout) onLogout()
    else if (item.href) window.location.href = item.href
    else navigate(item.to)
  }
  const onKey = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setAt((i) => Math.min(i + 1, flat.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setAt((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && flat[at]) {
      e.preventDefault()
      go(flat[at])
    } else if (e.key === 'Escape') {
      onClose()
    }
  }

  let index = -1
  return (
    <div className="ds-scrim" onMouseDown={onClose}>
      <div className="ds-palette" role="dialog" aria-modal="true" aria-label="Search pages and actions" onMouseDown={(e) => e.stopPropagation()}>
        <label className="ds-palette-input">
          <SearchIcon width={20} height={20} />
          <input
            ref={input}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKey}
            placeholder="Search pages and actions"
            aria-label="Search pages and actions"
            aria-controls="ds-palette-list"
            aria-activedescendant={flat[at] ? `ds-pal-${flat[at].key}` : undefined}
          />
          <kbd>Esc</kbd>
        </label>
        <div id="ds-palette-list" role="listbox" className="ds-palette-list">
          {groups.map(([name, items]) => (
            <div key={name} role="group" aria-label={name}>
              <p className="ds-palette-group">{name}</p>
              {items.map((item) => {
                index += 1
                const mine = index
                const Icon = item.icon
                return (
                  <button
                    key={item.key}
                    id={`ds-pal-${item.key}`}
                    type="button"
                    role="option"
                    aria-selected={mine === at}
                    className={`ds-palette-item${mine === at ? ' is-on' : ''}`}
                    onMouseEnter={() => setAt(mine)}
                    onClick={() => go(item)}
                  >
                    <Icon width={19} height={19} />
                    <span>{item.label}</span>
                    {item.hint && <span className="note">{item.hint}</span>}
                  </button>
                )
              })}
            </div>
          ))}
          {flat.length === 0 && <p className="ds-palette-none note">Nothing matches “{query}”.</p>}
        </div>
      </div>
    </div>
  )
}

export default function TopBar({ pages, page, attention, auth, onLogout }) {
  const [palette, setPalette] = useState(false)
  const [bell, setBell] = useState(false)
  const bellRef = useRef(null)
  const current = pages.find((p) => p.path === page) ?? pages[0]
  const waiting = pages.filter((p) => attention.pages[p.path] > 0)

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPalette((open) => !open)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (!bell) return undefined
    const close = (e) => {
      if (e.type === 'keydown' ? e.key === 'Escape' : !bellRef.current?.contains(e.target)) setBell(false)
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', close)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', close)
    }
  }, [bell])

  const mac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
  return (
    <div className="ds-top">
      <nav className="ds-crumb" aria-label="You are here">
        <span>Dashboard</span>
        <span aria-hidden="true">/</span>
        <strong aria-current="page">{current?.label}</strong>
      </nav>
      <button type="button" className="ds-search" onClick={() => setPalette(true)} aria-label="Search pages and actions">
        <SearchIcon width={18} height={18} />
        <span>Search or jump to…</span>
        <kbd>{mac ? '⌘ K' : 'Ctrl K'}</kbd>
      </button>
      <div className="ds-bell-wrap" ref={bellRef}>
        <button
          type="button"
          className={`ds-round${attention.total > 0 ? ' has-dot' : ''}`}
          aria-label={attention.total > 0 ? `${attention.total} things waiting` : 'Nothing waiting'}
          aria-expanded={bell}
          onClick={() => setBell((open) => !open)}
        >
          <BellIcon width={19} height={19} />
        </button>
        {bell && (
          <div className="ds-pop" role="dialog" aria-label="Waiting for you">
            <p className="ds-pop-title">Waiting for you</p>
            {waiting.length === 0 ? (
              <p className="note ds-pop-none">Nothing waits for you right now.</p>
            ) : (
              waiting.map((p) => {
                const Icon = p.icon
                return (
                  <Link key={p.path} to={`/dashboard/${p.path}`} className="ds-pop-item" onClick={() => setBell(false)}>
                    <span className="ds-well">
                      <Icon width={17} height={17} />
                    </span>
                    <span>{waitingText(p.path, p.label, attention.pages[p.path])}</span>
                  </Link>
                )
              })
            )}
          </div>
        )}
      </div>
      <Link to="/dashboard/account" className="ds-avatar" title={`${auth.user.name} · Account`} aria-label="Your account">
        {initials(auth.user.name) || '?'}
      </Link>
      {palette && <Palette pages={pages} attention={attention.pages} auth={auth} onClose={() => setPalette(false)} onLogout={onLogout} />}
    </div>
  )
}
