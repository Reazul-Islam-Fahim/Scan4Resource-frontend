import { Link } from 'react-router-dom'
import useAuth from '../hooks/useAuth'
import { isMock } from '../lib/api'
import { roleName } from '../lib/auth'
import { ReportIcon, UserIcon } from './Icons'

export function Reports({ onGoToScans }) {
  return (
    <section className="stack">
      <h1 className="display">Reports</h1>
      <div className="empty empty-center">
        <span className="empty-icon">
          <ReportIcon width={30} height={30} />
        </span>
        <p className="lede">Reuse reports are created from a scan. Open a scan to view its report or export it as a PDF.</p>
        <button type="button" className="btn btn-primary" onClick={onGoToScans}>
          Go to Scans
        </button>
      </div>
    </section>
  )
}

export function Profile() {
  const auth = useAuth()
  return (
    <section className="stack">
      <h1 className="display">Profile</h1>
      <div className="empty empty-center">
        <span className="empty-icon">
          <UserIcon width={30} height={30} />
        </span>
        {auth.loggedIn ? (
          <>
            <p className="lede">
              Logged in as {auth.user.name} ({roleName(auth.role)}).
            </p>
            <Link to="/dashboard" className="btn btn-primary">
              Open my dashboard
            </Link>
          </>
        ) : (
          <>
            <p className="lede">Log in to buy, sell, deliver or manage Scan4Reuse.</p>
            <Link to="/login" className="btn btn-primary">
              Log in
            </Link>
            <Link to="/signup" className="text-btn">
              Create an account
            </Link>
          </>
        )}
        <p className="note">
          {isMock
            ? 'Demo mode: detections are simulated and scans stay in this browser.'
            : 'Connected to the detection service.'}
        </p>
      </div>
    </section>
  )
}
