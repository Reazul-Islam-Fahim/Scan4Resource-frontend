import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import useAuth from '../../hooks/useAuth'
import { describeError, isMock } from '../../lib/api'
import { emailProblem, loginPasswordProblem, normalizeEmail } from '../../lib/validation'
import { afterLogin } from './redirect'

/** One login page for every role: email and password only. The account decides which dashboard opens
 *  (a link like /login?role=seller asks for that role when the account has it). Roles are picked at sign-up. */
export default function Login() {
  const auth = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [touched, setTouched] = useState({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const problems = { email: emailProblem(email), password: loginPasswordProblem(password) }
  const shown = (key) => (touched[key] ? problems[key] : '')
  const touch = (key) => () => setTouched((t) => ({ ...t, [key]: true }))

  const submit = async (event) => {
    event.preventDefault()
    setTouched({ email: true, password: true })
    if (problems.email || problems.password) return
    setBusy(true)
    setError('')
    try {
      const session = await auth.login(normalizeEmail(email), password, params.get('role') || undefined)
      afterLogin(session, params, navigate)
    } catch (err) {
      setError(err.detail || describeError(err))
      setBusy(false)
    }
  }

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={submit} noValidate>
        <Link to="/" className="wordmark auth-wordmark">
          scan4reuse
        </Link>
        <div>
          <h1 className="auth-title">Log in</h1>
          <p className="note">Log in with the email and password of your Scan4Reuse account.</p>
        </div>
        <label className="field">
          Email
          <input
            className={`input${shown('email') ? ' is-invalid' : ''}`}
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            maxLength={254}
            value={email}
            aria-invalid={Boolean(shown('email'))}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={touch('email')}
          />
          {shown('email') && <span className="field-error">{shown('email')}</span>}
        </label>
        <label className="field">
          Password
          <input
            className={`input${shown('password') ? ' is-invalid' : ''}`}
            type="password"
            autoComplete="current-password"
            required
            value={password}
            aria-invalid={Boolean(shown('password'))}
            onChange={(e) => setPassword(e.target.value)}
            onBlur={touch('password')}
          />
          {shown('password') && <span className="field-error">{shown('password')}</span>}
        </label>
        {isMock && <p className="error">Logging in needs the backend. Set VITE_API_URL and restart the app.</p>}
        {error && <p className="error" role="alert">{error}</p>}
        <button type="submit" className="btn btn-primary btn-block" disabled={busy || isMock}>
          {busy ? 'Logging in…' : 'Log in'}
        </button>
        <p className="note auth-switch">
          New to Scan4Reuse? <Link to={`/signup?${params}`}>Create an account</Link>
        </p>
      </form>
    </div>
  )
}
