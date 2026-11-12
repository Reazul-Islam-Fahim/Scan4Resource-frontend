import { useEffect, useState } from 'react'
import { NavLink, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import useAttention from '../../hooks/useAttention'
import useAuth from '../../hooks/useAuth'
import { ChevronLeft, ChevronRight, GridIcon, LogoutIcon, ScanIcon } from '../Icons'
import { AttentionContext } from './attention'
import { ROLE_ICONS, pagesFor } from './roles'
import Toasts from './Toasts'
import TopBar from './TopBar'
import './dashboard.css'

/** Every role's dashboard: a side menu on PC, laptop and tablet (open or collapsed to icons), a bottom tab bar on
 *  phones, a top bar (where you are, search, what waits, your account) and the role's pages inside. Pages with
 *  something waiting carry a number. */
const TABS_THAT_FIT = 7
const MENU_KEY = 's4r.menu'

function storedCollapsed() {
  try {
    return localStorage.getItem(MENU_KEY) === 'collapsed'
  } catch {
    return false
  }
}

const Count = ({ n, label }) =>
  n > 0 ? (
    <span className="dash-count" aria-label={`${n} waiting in ${label}`}>
      {n > 99 ? '99+' : n}
    </span>
  ) : null

export default function Dashboard() {
  const auth = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const page = pathname.replace(/^\/dashboard\/?/, '').split('/')[0]
  const attention = useAttention(auth.token, page)
  const [collapsed, setCollapsed] = useState(storedCollapsed)
  const [more, setMore] = useState(false)
  useEffect(() => setMore(false), [pathname])
  const toggle = () =>
    setCollapsed((was) => {
      try {
        localStorage.setItem(MENU_KEY, was ? 'open' : 'collapsed')
      } catch {
        // private mode: remembered until the tab is closed
      }
      return !was
    })

  // On short screens the menu scrolls: keep the open page in sight.
  useEffect(() => {
    document.querySelector('.dash-nav .is-active')?.scrollIntoView({ block: 'nearest' })
  }, [pathname])

  if (!auth.loggedIn) return <Navigate to="/login?next=/dashboard" replace />

  const pages = pagesFor(auth)
  // A seller's phone tab bar has the scan button in the middle: two pages either side of it, the rest under More.
  const scanTab = auth.role === 'seller' && auth.can('market.sell')
  const fitsBeside = pages.length <= 4 ? pages : pages.slice(0, 3)
  const extra = scanTab && pages.length > 4 ? pages.slice(3) : []
  const moreTab = { path: '__more', label: 'More', icon: GridIcon, more: true }
  const tabs = scanTab
    ? [...fitsBeside.slice(0, 2), { path: '__scan', scan: true }, ...fitsBeside.slice(2), ...(extra.length ? [moreTab] : [])]
    : pages
  const extraWaiting = extra.reduce((sum, p) => sum + (attention.pages[p.path] || 0), 0)
  const RoleIcon = ROLE_ICONS[auth.role] ?? ROLE_ICONS.buyer
  const logout = () => {
    auth.logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className={`dash${collapsed ? ' is-collapsed' : ''}`}>
      <aside className="dash-side">
        <div className="dash-menu-head">
          <span className="wordmark dash-wordmark">scan4reuse</span>
          <button
            type="button"
            className="dash-toggle"
            onClick={toggle}
            aria-expanded={!collapsed}
            aria-label={collapsed ? 'Expand menu' : 'Collapse menu'}
            title={collapsed ? 'Expand menu' : 'Collapse menu'}
          >
            {collapsed ? <ChevronRight width={16} height={16} /> : <ChevronLeft width={16} height={16} />}
          </button>
        </div>
        <div className="dash-who">
          <span className="role-icon">
            <RoleIcon width={20} height={20} />
          </span>
          <span>
            <strong>{auth.user.name}</strong>
            <span className="note">{auth.roleName}</span>
          </span>
        </div>
        <nav className="dash-nav" aria-label="Dashboard">
          {pages.map(({ path, label, icon: Icon }) => (
            <NavLink
              key={path}
              to={path ? `/dashboard/${path}` : '/dashboard'}
              end
              title={label}
              className={({ isActive }) => `dash-link${isActive ? ' is-active' : ''}`}
            >
              <span className="dash-icon">
                <Icon width={20} height={20} />
                <Count n={attention.pages[path]} label={label} />
              </span>
              <span className="dash-link-label">{label}</span>
              <Count n={attention.pages[path]} label={label} />
            </NavLink>
          ))}
        </nav>
        <button type="button" className="dash-link dash-logout" onClick={logout} title="Log out">
          <LogoutIcon width={20} height={20} />
          <span className="dash-link-label">Log out</span>
        </button>
      </aside>

      <main className="dash-main">
        <TopBar pages={pages} page={page} attention={attention} auth={auth} onLogout={logout} />
        {auth.status === 'pending' && (
          <p className="hint-box dash-banner">
            Your {auth.roleName.toLowerCase()} account is waiting for verification by the Scan4Reuse team. You can set
            up your profile meanwhile; trading opens once it is verified.
          </p>
        )}
        <AttentionContext.Provider value={attention}>
        <Routes>
          {pages.length > 0 && pages[0].path !== '' && <Route index element={<Navigate to={`/dashboard/${pages[0].path}`} replace />} />}
          {pages.map(({ path, element }) => (
            <Route key={path} index={path === ''} path={path || undefined} element={<div className="dash-page">{element}</div>} />
          ))}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
        </AttentionContext.Provider>
      </main>

      <Toasts />

      {more && (
        <div className="ds-more-scrim" onClick={() => setMore(false)}>
          <nav className="ds-more" aria-label="More pages" onClick={(e) => e.stopPropagation()}>
            {extra.map(({ path, label, icon: Icon }) => (
              <NavLink key={path} to={`/dashboard/${path}`} end className={({ isActive }) => `ds-more-item${isActive ? ' is-active' : ''}`}>
                <span className="ds-well">
                  <Icon width={19} height={19} />
                </span>
                <span>{label}</span>
                <Count n={attention.pages[path]} label={label} />
              </NavLink>
            ))}
            <button type="button" className="ds-more-item" onClick={logout}>
              <span className="ds-well">
                <LogoutIcon width={19} height={19} />
              </span>
              <span>Log out</span>
            </button>
          </nav>
        </div>
      )}

      <nav className="tabbar dash-tabs" aria-label="Dashboard">
        <div
          className={`tabbar-inner${tabs.length > TABS_THAT_FIT ? ' is-scrolling' : ''}`}
          style={{ gridTemplateColumns: tabs.length > TABS_THAT_FIT ? `repeat(${tabs.length}, 72px)` : `repeat(${tabs.length}, 1fr)` }}
        >
          {tabs.map(({ path, label, icon: Icon, scan, more: isMore }) => scan ? (
            <NavLink key="scan" to="/scan" className="tab ds-fab-tab" aria-label="Start a scan">
              <span className="ds-fab">
                <ScanIcon width={24} height={24} />
              </span>
            </NavLink>
          ) : isMore ? (
            <button
              key="more"
              type="button"
              className={`tab${more || extra.some((p) => p.path === page) ? ' is-active' : ''}`}
              aria-expanded={more}
              onClick={() => setMore((open) => !open)}
            >
              <span className="dash-icon">
                <Icon />
                <Count n={extraWaiting} label="More" />
              </span>
              More
            </button>
          ) : (
            <NavLink
              key={path}
              to={path ? `/dashboard/${path}` : '/dashboard'}
              end
              ref={(el) => el?.classList.contains('is-active') && el.scrollIntoView({ block: 'nearest', inline: 'nearest' })}
              className={({ isActive }) => `tab${isActive ? ' is-active' : ''}`}
            >
              <span className="dash-icon">
                <Icon />
                <Count n={attention.pages[path]} label={label} />
              </span>
              {label.split(' ')[0]}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
