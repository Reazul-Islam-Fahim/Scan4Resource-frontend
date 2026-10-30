import { hasLogisticsApp, logisticsUrl } from '../../lib/auth'

/** Where to go after logging in: back to the logistics app when it sent the person here (?app=logistics),
 *  straight to it for logistics companies (their dashboard lives there), else the role's dashboard. */
export function afterLogin(session, params, navigate) {
  const next = params.get('next') || '/'
  if (hasLogisticsApp() && (params.get('app') === 'logistics' || session.role === 'logistics')) {
    window.location.assign(logisticsUrl(session.token, params.get('app') === 'logistics' ? next : '/'))
    return
  }
  navigate(params.get('app') ? '/dashboard' : safeLocal(params.get('next')) || '/dashboard', { replace: true })
}

// Only paths inside this app, never another site.
const safeLocal = (path) => (path && path.startsWith('/') && !path.startsWith('//') ? path : '')
