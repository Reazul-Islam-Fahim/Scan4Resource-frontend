import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import useAuth from '../../hooks/useAuth'
import { describeError, isMock } from '../../lib/api'
import { roleName } from '../../lib/auth'
import { afterLogin } from './redirect'
import RolePicker from './RolePicker'

/** One login page for every role. The role picked here decides which dashboard opens. */
export default function Login() {
  const auth = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [role, setRole] = useState(params.get('role') || 'buyer')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (event) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const session = await auth.login(email, password, role)
      afterLogin(session, params, navigate)
    } catch (err) {
      setError(err.detail || describeError(err))
      setBusy(false)
    }
  }

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={submit}>
        <Link to="/" className="wordmark auth-wordmark">
          scan4reuse
        </Link>
        <div>
          <h1 className="auth-title">Log in</h1>
          <p className="note">Choose how you use Scan4Reuse, then log in with your email.</p>
        </div>
        <RolePicker value={role} onChange={setRole} />
        <label className="field">
          Email
          <input className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="field">
          Password
          <input className="input" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {isMock && <p className="error">Logging in needs the backend. Set VITE_API_URL and restart the app.</p>}
        {error && <p className="error" role="alert">{error}</p>}
        <button type="submit" className="btn btn-primary btn-block" disabled={busy || isMock}>
          {busy ? 'Logging in…' : `Log in as ${roleName(role)}`}
        </button>
        {role !== 'admin' && (
          <p className="note auth-switch">
            New to Scan4Reuse? <Link to={`/signup?${withRole(params, role)}`}>Create an account</Link>
          </p>
        )}
      </form>
    </div>
  )
}

function withRole(params, role) {
  const next = new URLSearchParams(params)
  next.set('role', role)
  return next.toString()
}
