import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import useAuth from '../../hooks/useAuth'
import { describeError, isMock } from '../../lib/api'
import { NEEDS_COMPANY, roleName } from '../../lib/auth'
import { afterLogin } from './redirect'
import RolePicker from './RolePicker'

const EMPTY = { name: '', email: '', phone: '', password: '', company_name: '', company_uid: '', address: '' }

export default function Signup() {
  const auth = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const initial = params.get('role')
  const [role, setRole] = useState(initial && initial !== 'admin' ? initial : 'buyer')
  const [fields, setFields] = useState(EMPTY)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const company = NEEDS_COMPANY.includes(role)

  const set = (key) => (event) => setFields((f) => ({ ...f, [key]: event.target.value }))

  const submit = async (event) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const body = { ...fields, role }
      if (!company) Object.assign(body, { company_name: '', company_uid: '', address: '' })
      const session = await auth.register(body)
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
          <h1 className="auth-title">Create an account</h1>
          <p className="note">You can add more roles to the same account later, from your profile.</p>
        </div>
        <RolePicker value={role} onChange={setRole} withAdmin={false} />
        <label className="field">
          Full name
          <input className="input" autoComplete="name" required value={fields.name} onChange={set('name')} />
        </label>
        <div className="field-row">
          <label className="field">
            Email
            <input className="input" type="email" autoComplete="email" required value={fields.email} onChange={set('email')} />
          </label>
          <label className="field">
            Phone
            <input className="input" type="tel" autoComplete="tel" placeholder="+41 …" value={fields.phone} onChange={set('phone')} />
          </label>
        </div>
        <label className="field">
          Password
          <input className="input" type="password" autoComplete="new-password" minLength={8} required value={fields.password} onChange={set('password')} />
          <span className="field-hint">At least 8 characters.</span>
        </label>
        {company && (
          <>
            <label className="field">
              Company name
              <input className="input" autoComplete="organization" required value={fields.company_name} onChange={set('company_name')} />
            </label>
            <div className="field-row">
              <label className="field">
                UID number
                <input className="input" placeholder="CHE-123.456.789" value={fields.company_uid} onChange={set('company_uid')} />
              </label>
              <label className="field">
                Company address
                <input className="input" autoComplete="street-address" value={fields.address} onChange={set('address')} />
              </label>
            </div>
            <p className="hint-box">
              {roleName(role)} accounts are checked by the Scan4Reuse team before they can trade. You can log in and
              set up your profile while you wait.
            </p>
          </>
        )}
        {isMock && <p className="error">Creating an account needs the backend. Set VITE_API_URL and restart the app.</p>}
        {error && <p className="error" role="alert">{error}</p>}
        <button type="submit" className="btn btn-primary btn-block" disabled={busy || isMock}>
          {busy ? 'Creating your account…' : `Sign up as ${roleName(role)}`}
        </button>
        <p className="note auth-switch">
          Already have an account? <Link to={`/login?${new URLSearchParams({ ...Object.fromEntries(params), role })}`}>Log in</Link>
        </p>
      </form>
    </div>
  )
}
