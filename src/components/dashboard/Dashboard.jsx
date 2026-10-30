import { NavLink, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import useAuth from '../../hooks/useAuth'
import { roleName } from '../../lib/auth'
import { LogoutIcon } from '../Icons'
import { DASHBOARDS, ROLE_ICONS } from './roles'

/** Every role's dashboard: a sidebar on wide screens, a bottom tab bar on phones, the role's pages inside. */
export default function Dashboard() {
  const auth = useAuth()
  const navigate = useNavigate()
  if (!auth.loggedIn) return <Navigate to="/login?next=/dashboard" replace />

  const pages = DASHBOARDS[auth.role] ?? DASHBOARDS.buyer
  const RoleIcon = ROLE_ICONS[auth.role]
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
            <span className="note">{roleName(auth.role)}</span>
          </span>
        </div>
        <nav className="dash-nav" aria-label="Dashboard">
          {pages.map(({ path, label, icon: Icon }) => (
            <NavLink key={path} to={`/dashboard/${path}`} end className={({ isActive }) => `dash-link${isActive ? ' is-active' : ''}`}>
              <Icon width={20} height={20} />
              {label}
            </NavLink>
          ))}
        </nav>
        <button type="button" className="dash-link dash-logout" onClick={logout}>
          <LogoutIcon width={20} height={20} />
          Log out
        </button>
      </aside>

      <main className="dash-main">
        {auth.status === 'pending' && (
          <p className="hint-box dash-banner">
            Your {roleName(auth.role).toLowerCase()} account is waiting for verification by the Scan4Reuse team. You can set
            up your profile meanwhile; trading opens once it is verified.
          </p>
        )}
        <Routes>
          {pages.map(({ path, element }) => (
            <Route key={path} index={path === ''} path={path || undefined} element={element} />
          ))}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </main>

      <nav className="tabbar dash-tabs" aria-label="Dashboard">
        <div className="tabbar-inner" style={{ gridTemplateColumns: `repeat(${pages.length}, 1fr)` }}>
          {pages.map(({ path, label, icon: Icon }) => (
            <NavLink key={path} to={`/dashboard/${path}`} end className={({ isActive }) => `tab${isActive ? ' is-active' : ''}`}>
              <Icon />
              {label.split(' ')[0]}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
