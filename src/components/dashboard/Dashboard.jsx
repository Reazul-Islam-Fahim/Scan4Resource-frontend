import { useEffect } from 'react'
import { NavLink, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import useAuth from '../../hooks/useAuth'
import { LogoutIcon } from '../Icons'
import { ROLE_ICONS, pagesFor } from './roles'

/** Every role's dashboard: a sidebar on wide screens, a bottom tab bar on phones, the role's pages inside. */
const TABS_THAT_FIT = 7

export default function Dashboard() {
  const auth = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()

  // On short screens the menu scrolls: keep the open page in sight.
  useEffect(() => {
    document.querySelector('.dash-nav .is-active')?.scrollIntoView({ block: 'nearest' })
  }, [pathname])

  if (!auth.loggedIn) return <Navigate to="/login?next=/dashboard" replace />

  const pages = pagesFor(auth)
  const RoleIcon = ROLE_ICONS[auth.role] ?? ROLE_ICONS.buyer
  const logout = () => {
    auth.logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="dash">
      <aside className="dash-side">
        <NavLink to="/" className="wordmark dash-wordmark">
          scan4reuse
        </NavLink>
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
              to={`/dashboard/${path}`}
              end
              title={label}
              className={({ isActive }) => `dash-link${isActive ? ' is-active' : ''}`}
            >
              <Icon width={20} height={20} />
              <span className="dash-link-label">{label}</span>
            </NavLink>
          ))}
        </nav>
        <button type="button" className="dash-link dash-logout" onClick={logout} title="Log out">
          <LogoutIcon width={20} height={20} />
          <span className="dash-link-label">Log out</span>
        </button>
      </aside>

      <main className="dash-main">
        {auth.status === 'pending' && (
          <p className="hint-box dash-banner">
            Your {auth.roleName.toLowerCase()} account is waiting for verification by the Scan4Reuse team. You can set
            up your profile meanwhile; trading opens once it is verified.
          </p>
        )}
        <Routes>
          {pages.length > 0 && pages[0].path !== '' && <Route index element={<Navigate to={`/dashboard/${pages[0].path}`} replace />} />}
          {pages.map(({ path, element }) => (
            <Route key={path} index={path === ''} path={path || undefined} element={<div className="dash-page">{element}</div>} />
          ))}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </main>

      <nav className="tabbar dash-tabs" aria-label="Dashboard">
        <div
          className={`tabbar-inner${pages.length > TABS_THAT_FIT ? ' is-scrolling' : ''}`}
          style={{ gridTemplateColumns: pages.length > TABS_THAT_FIT ? `repeat(${pages.length}, 72px)` : `repeat(${pages.length}, 1fr)` }}
        >
          {pages.map(({ path, label, icon: Icon }) => (
            <NavLink
              key={path}
              to={`/dashboard/${path}`}
              end
              ref={(el) => el?.classList.contains('is-active') && el.scrollIntoView({ block: 'nearest', inline: 'nearest' })}
              className={({ isActive }) => `tab${isActive ? ' is-active' : ''}`}
            >
              <Icon />
              {label.split(' ')[0]}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
