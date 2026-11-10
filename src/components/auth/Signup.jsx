import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import useAuth from '../../hooks/useAuth'
import { describeError, isMock } from '../../lib/api'
import { NEEDS_COMPANY, ROLES, signupRoles } from '../../lib/auth'
import { PASSWORD_MAX, PASSWORD_MIN, emailProblem, normalizeEmail, passwordProblem } from '../../lib/validation'
import { afterLogin } from './redirect'
import RolePicker from './RolePicker'

// Until the server answers (or if it cannot): the built-in roles.
const FALLBACK = ROLES.filter((r) => r.role !== 'admin').map((r) => ({
  ...r,
  kind: r.role,
  needs_company: NEEDS_COMPANY.includes(r.role),
  needs_verification: NEEDS_COMPANY.includes(r.role),
}))

const EMPTY = { name: '', email: '', phone: '', password: '', company_name: '', company_uid: '', address: '' }

export default function Signup() {
  const auth = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const initial = params.get('role')
  const [roles, setRoles] = useState(FALLBACK)
  const [role, setRole] = useState(initial && initial !== 'admin' ? initial : 'buyer')
  const [fields, setFields] = useState(EMPTY)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [touched, setTouched] = useState({})
  const picked = roles.find((r) => r.role === role) ?? roles[0]
  const company = Boolean(picked?.needs_company)

  useEffect(() => {
    signupRoles()
      .then((list) => {
        if (!Array.isArray(list) || list.length === 0) return
        setRoles(list)
        setRole((current) => (list.some((r) => r.role === current) ? current : list[0].role))
      })
      .catch(() => {}) // keep the built-in list; sign-up itself will say if the server is away
  }, [])

  const set = (key) => (event) => setFields((f) => ({ ...f, [key]: event.target.value }))
  const touch = (key) => () => setTouched((t) => ({ ...t, [key]: true }))
  const problems = {
    name: fields.name.trim() ? '' : 'Enter your name.',
    email: emailProblem(fields.email),
    password: passwordProblem(fields.password, fields.email),
    company_name: company && !fields.company_name.trim() ? 'Enter the company name.' : '',
  }
  const shown = (key) => (touched[key] ? problems[key] : '')
  const invalid = (key) => `input${shown(key) ? ' is-invalid' : ''}`

  const submit = async (event) => {
    event.preventDefault()
    setTouched({ name: true, email: true, password: true, company_name: true })
    if (Object.values(problems).some(Boolean)) return
    setBusy(true)
    setError('')
    try {
      const body = { ...fields, name: fields.name.trim(), email: normalizeEmail(fields.email), role: picked.role }
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
      <form className="auth-card" onSubmit={submit} noValidate>
        <Link to="/" className="wordmark auth-wordmark">
          scan4reuse
        </Link>
        <div>
          <h1 className="auth-title">Create an account</h1>
          <p className="note">Pick the role you will use. Only a Scan4Reuse admin can change it later.</p>
        </div>
        <RolePicker roles={roles} value={picked?.role} onChange={setRole} />
        <label className="field">
          Full name
          <input className={invalid('name')} autoComplete="name" required maxLength={120} value={fields.name} onChange={set('name')} onBlur={touch('name')} aria-invalid={Boolean(shown('name'))} />
          {shown('name') && <span className="field-error">{shown('name')}</span>}
        </label>
        <div className="field-row">
          <label className="field">
            Email
            <input className={invalid('email')} type="email" inputMode="email" autoComplete="email" required maxLength={254} value={fields.email} onChange={set('email')} onBlur={touch('email')} aria-invalid={Boolean(shown('email'))} />
            {shown('email') && <span className="field-error">{shown('email')}</span>}
          </label>
          <label className="field">
            Phone
            <input className="input" type="tel" autoComplete="tel" placeholder="+41 …" value={fields.phone} onChange={set('phone')} />
          </label>
        </div>
        <label className="field">
          Password
          <input className={invalid('password')} type="password" autoComplete="new-password" minLength={PASSWORD_MIN} maxLength={PASSWORD_MAX} required value={fields.password} onChange={set('password')} onBlur={touch('password')} aria-invalid={Boolean(shown('password'))} />
          {shown('password') ? (
            <span className="field-error">{shown('password')}</span>
          ) : (
            <span className="field-hint">At least {PASSWORD_MIN} characters, with a letter and a number, space or symbol.</span>
          )}
        </label>
        {company && (
          <>
            <label className="field">
              Company name
              <input className={invalid('company_name')} autoComplete="organization" required value={fields.company_name} onChange={set('company_name')} onBlur={touch('company_name')} aria-invalid={Boolean(shown('company_name'))} />
              {shown('company_name') && <span className="field-error">{shown('company_name')}</span>}
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
          </>
        )}
        {picked?.needs_verification !== false && company && (
          <p className="hint-box">
            {picked.name} accounts are checked by the Scan4Reuse team before they can trade. You can log in and set up
            your profile while you wait.
          </p>
        )}
        {isMock && <p className="error">Creating an account needs the backend. Set VITE_API_URL and restart the app.</p>}
        {error && <p className="error" role="alert">{error}</p>}
        <button type="submit" className="btn btn-primary btn-block" disabled={busy || isMock}>
          {busy ? 'Creating your account…' : `Sign up as ${picked?.name ?? 'Buyer'}`}
        </button>
        <p className="note auth-switch">
          Already have an account? <Link to={`/login?${new URLSearchParams({ ...Object.fromEntries(params), role })}`}>Log in</Link>
        </p>
      </form>
    </div>
  )
}
