import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useAuth from '../../hooks/useAuth'
import { describeError } from '../../lib/api'
import { NEEDS_COMPANY, ROLES, roleName } from '../../lib/auth'
import { afterLogin } from '../auth/redirect'

/** The account: details, the roles it holds (switch between them), and adding a role. */
export function AccountPage() {
  const auth = useAuth()
  const navigate = useNavigate()
  const [adding, setAdding] = useState('')
  const [company, setCompany] = useState({ company_name: '', company_uid: '', address: '' })
  const [error, setError] = useState('')
  const held = new Set(auth.user.roles.map((r) => r.role))
  const addable = ROLES.filter((r) => r.role !== 'admin' && !held.has(r.role))

  const switchTo = async (role) => {
    setError('')
    try {
      const session = await auth.switchRole(role)
      afterLogin(session, new URLSearchParams(), navigate)
    } catch (err) {
      setError(err.detail || describeError(err))
    }
  }

  const add = async (event) => {
    event.preventDefault()
    setError('')
    try {
      await auth.addRole({ role: adding, ...(NEEDS_COMPANY.includes(adding) ? company : {}) })
      setAdding('')
    } catch (err) {
      setError(err.detail || describeError(err))
    }
  }
  const set = (key) => (e) => setCompany((c) => ({ ...c, [key]: e.target.value }))

  return (
    <section className="dash-section">
      <h1 className="dash-title">Account</h1>
      <div className="dash-card">
        <dl className="verify-facts">
          <dt>Name</dt>
          <dd>{auth.user.name}</dd>
          <dt>Email</dt>
          <dd>{auth.user.email}</dd>
          <dt>Phone</dt>
          <dd>{auth.user.phone || '—'}</dd>
        </dl>
      </div>

      <div className="dash-card dash-form">
        <h2 className="section-title">Your roles</h2>
        {auth.user.roles.map((r) => (
          <div key={r.role} className="role-row">
            <span>
              <strong>{roleName(r.role)}</strong>
              {r.company_name && <span className="note"> · {r.company_name}</span>}
            </span>
            <span className={`status-pill status-${r.status}`}>{r.status === 'active' ? 'Active' : r.status === 'pending' ? 'Waiting for verification' : 'Not approved'}</span>
            {r.role === auth.role ? (
              <span className="note">In use</span>
            ) : (
              r.status !== 'rejected' && (
                <button type="button" className="text-btn" onClick={() => switchTo(r.role)}>
                  Switch
                </button>
              )
            )}
          </div>
        ))}
      </div>

      {addable.length > 0 && (
        <form className="dash-card dash-form" onSubmit={add}>
          <h2 className="section-title">Add a role</h2>
          <label className="field">
            Role
            <select className="input" value={adding} onChange={(e) => setAdding(e.target.value)} required>
              <option value="">Choose…</option>
              {addable.map((r) => (
                <option key={r.role} value={r.role}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
          {NEEDS_COMPANY.includes(adding) && (
            <>
              <label className="field">
                Company name
                <input className="input" required value={company.company_name} onChange={set('company_name')} />
              </label>
              <div className="field-row">
                <label className="field">
                  UID number
                  <input className="input" placeholder="CHE-123.456.789" value={company.company_uid} onChange={set('company_uid')} />
                </label>
                <label className="field">
                  Company address
                  <input className="input" value={company.address} onChange={set('address')} />
                </label>
              </div>
            </>
          )}
          <button type="submit" className="btn btn-secondary" disabled={!adding}>
            Add role
          </button>
        </form>
      )}
      {error && <p className="error">{error}</p>}
    </section>
  )
}
