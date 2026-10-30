import { useCallback, useEffect, useState } from 'react'
import useAuth from '../../hooks/useAuth'
import { describeError } from '../../lib/api'
import { adminActions, adminCreateUser, adminDecide, adminUsers, roleName } from '../../lib/auth'
import { formatDate } from './format'

function useAdminData(load) {
  const { token } = useAuth()
  const [state, setState] = useState({ data: null, error: '' })
  const reload = useCallback(() => {
    load(token)
      .then((data) => setState({ data, error: '' }))
      .catch((err) => setState({ data: null, error: err.detail || describeError(err) }))
  }, [token, load])
  useEffect(reload, [reload])
  return { ...state, reload, token }
}

const loadUsers = (token) => adminUsers(token)
const loadPending = (token) => adminUsers(token, { status: 'pending' })

export function AdminOverview() {
  const { data, error } = useAdminData(loadUsers)
  const count = (fn) => (data ? data.filter(fn).length : '…')
  const holds = (role) => (u) => u.roles.some((r) => r.role === role && r.status === 'active')
  return (
    <section className="dash-section">
      <header>
        <h1 className="dash-title">Platform overview</h1>
        <p className="lede">Scan4Reuse keeps 10% from each sale and 10% from each delivery.</p>
      </header>
      {error && <p className="error">{error}</p>}
      <div className="dash-stats">
        {[
          ['Waiting for verification', count((u) => u.roles.some((r) => r.status === 'pending'))],
          ['Buyers', count(holds('buyer'))],
          ['Corporate buyers', count(holds('corporate'))],
          ['Sellers', count(holds('seller'))],
          ['Logistics companies', count(holds('logistics'))],
          ['Commission earned', 'CHF 0.00'],
        ].map(([label, value]) => (
          <div key={label} className="dash-card dash-stat">
            <span className="note">{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
    </section>
  )
}

export function AdminVerification() {
  const { data, error, reload, token } = useAdminData(loadPending)
  const [notes, setNotes] = useState({})
  const [busy, setBusy] = useState('')
  const [failure, setFailure] = useState('')

  const decide = async (user, role, status) => {
    const key = `${user.id}:${role}`
    setBusy(key)
    setFailure('')
    try {
      await adminDecide(token, user.id, role, status, notes[key] || '')
      reload()
    } catch (err) {
      setFailure(err.detail || describeError(err))
    } finally {
      setBusy('')
    }
  }

  const pending = (data ?? []).flatMap((user) => user.roles.filter((r) => r.status === 'pending').map((r) => ({ user, r })))

  return (
    <section className="dash-section">
      <header>
        <h1 className="dash-title">Verification</h1>
        <p className="lede">Corporate buyers and logistics companies trade only after you verify their company.</p>
      </header>
      {(error || failure) && <p className="error">{error || failure}</p>}
      {data && pending.length === 0 && <p className="dash-card note">Nobody is waiting for verification.</p>}
      {pending.map(({ user, r }) => {
        const key = `${user.id}:${r.role}`
        return (
          <article key={key} className="dash-card verify-card">
            <div className="verify-head">
              <strong>{r.company_name}</strong>
              <span className="badge-pill">{roleName(r.role)}</span>
            </div>
            <dl className="verify-facts">
              <dt>UID</dt>
              <dd>{r.company_uid || '—'}</dd>
              <dt>Address</dt>
              <dd>{r.address || '—'}</dd>
              <dt>Contact</dt>
              <dd>
                {user.name} · {user.email}
                {user.phone && ` · ${user.phone}`}
              </dd>
              <dt>Applied</dt>
              <dd>{formatDate(r.created_at)}</dd>
            </dl>
            <label className="field">
              Note (shown to them if rejected)
              <input className="input" value={notes[key] || ''} onChange={(e) => setNotes((n) => ({ ...n, [key]: e.target.value }))} />
            </label>
            <div className="row-actions">
              <button type="button" className="btn btn-primary" disabled={busy === key} onClick={() => decide(user, r.role, 'active')}>
                Verify
              </button>
              <button type="button" className="btn btn-outline" disabled={busy === key} onClick={() => decide(user, r.role, 'rejected')}>
                Reject
              </button>
            </div>
          </article>
        )
      })}
    </section>
  )
}

const NEW_ADMIN = { name: '', email: '', password: '', role: 'admin' }

export function AdminUsers() {
  const { data, error, reload, token } = useAdminData(loadUsers)
  const [form, setForm] = useState(NEW_ADMIN)
  const [message, setMessage] = useState({ text: '', error: false })

  const create = async (event) => {
    event.preventDefault()
    try {
      await adminCreateUser(token, form)
      setForm(NEW_ADMIN)
      setMessage({ text: `${form.email} can now log in as ${roleName(form.role)}.`, error: false })
      reload()
    } catch (err) {
      setMessage({ text: err.detail || describeError(err), error: true })
    }
  }
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  return (
    <section className="dash-section">
      <h1 className="dash-title">Users</h1>
      {error && <p className="error">{error}</p>}
      <div className="dash-card table-wrap">
        <table className="dash-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Roles</th>
              <th>Joined</th>
            </tr>
          </thead>
          <tbody>
            {(data ?? []).map((user) => (
              <tr key={user.id}>
                <td>{user.name}</td>
                <td>{user.email}</td>
                <td>
                  {user.roles.map((r) => (
                    <span key={r.role} className={`status-pill status-${r.status}`}>
                      {roleName(r.role)}
                      {r.status !== 'active' && ` · ${r.status}`}
                    </span>
                  ))}
                </td>
                <td>{formatDate(user.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <form className="dash-card dash-form" onSubmit={create}>
        <h2 className="section-title">Add an account</h2>
        <p className="note">Admins can only be added here. Accounts you add are active straight away.</p>
        <div className="field-row">
          <label className="field">
            Name
            <input className="input" required value={form.name} onChange={set('name')} />
          </label>
          <label className="field">
            Role
            <select className="input" value={form.role} onChange={set('role')}>
              <option value="admin">Admin</option>
              <option value="buyer">Buyer</option>
              <option value="seller">Seller</option>
            </select>
          </label>
        </div>
        <div className="field-row">
          <label className="field">
            Email
            <input className="input" type="email" required value={form.email} onChange={set('email')} />
          </label>
          <label className="field">
            Temporary password
            <input className="input" type="text" minLength={8} required value={form.password} onChange={set('password')} />
          </label>
        </div>
        {message.text && <p className={message.error ? 'error' : 'hint-box'}>{message.text}</p>}
        <button type="submit" className="btn btn-primary">
          Add account
        </button>
      </form>
    </section>
  )
}

export function AdminActivity() {
  const { data, error } = useAdminData(adminActions)
  return (
    <section className="dash-section">
      <h1 className="dash-title">Activity</h1>
      <p className="lede">Every admin action is recorded here.</p>
      {error && <p className="error">{error}</p>}
      {data && data.length === 0 && <p className="dash-card note">No admin actions yet.</p>}
      {data && data.length > 0 && (
        <div className="dash-card table-wrap">
          <table className="dash-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Action</th>
                <th>Target</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              {data.map((a) => (
                <tr key={a.id}>
                  <td>{formatDate(a.at, true)}</td>
                  <td>{a.action}</td>
                  <td className="mono">{a.target}</td>
                  <td>{a.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
