import { useCallback, useEffect, useState } from 'react'
import useAuth from '../../hooks/useAuth'
import { describeError } from '../../lib/api'
import {
  adminCreateRole,
  adminCreateUser,
  adminDecide,
  adminDeleteRole,
  adminPermissions,
  adminRoles,
  adminSetUserRole,
  adminUpdateRole,
  adminUsers,
  roleName,
} from '../../lib/auth'
import { passwordProblem } from '../../lib/validation'
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

const loadUsers = (token) => Promise.all([adminUsers(token), adminRoles(token)]).then(([users, roles]) => ({ users, roles }))
const loadPending = (token) => adminUsers(token, { status: 'pending' })

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
              <span className="badge-pill">{r.name || roleName(r.role)}</span>
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

const NEW_ACCOUNT = { name: '', email: '', password: '', role: 'admin', company_name: '' }
const COMPANY_KINDS = ['corporate', 'logistics']
const needsCompany = (role) => role && (role.needs_verification || COMPANY_KINDS.includes(role.kind))

/** One user's role, which only an admin can change. Company roles need a company name. */
function UserRole({ user, roles, token, self, onChanged }) {
  const current = user.roles[0]?.role ?? ''
  const [choice, setChoice] = useState(current)
  const [company, setCompany] = useState(user.roles[0]?.company_name ?? '')
  const [state, setState] = useState({ busy: false, error: '' })
  const target = roles.find((r) => r.key === choice)
  const changed = choice !== current
  const save = async () => {
    setState({ busy: true, error: '' })
    try {
      await adminSetUserRole(token, user.id, { role: choice, company_name: company })
      setState({ busy: false, error: '' })
      onChanged(`${user.email} is now ${target?.name ?? choice}. They need to log in again.`)
    } catch (err) {
      setState({ busy: false, error: err.detail || describeError(err) })
    }
  }
  if (self) return <span className="note">You (ask another admin to change it)</span>
  return (
    <div className="user-role">
      <select className="input input-sm" value={choice} aria-label={`Role of ${user.name}`} onChange={(e) => setChoice(e.target.value)}>
        {!roles.some((r) => r.key === current) && <option value={current}>{current}</option>}
        {roles.map((r) => (
          <option key={r.key} value={r.key}>
            {r.name}
          </option>
        ))}
      </select>
      {changed && needsCompany(target) && (
        <input className="input input-sm" placeholder="Company name" value={company} onChange={(e) => setCompany(e.target.value)} />
      )}
      {changed && (
        <button type="button" className="btn btn-primary btn-sm" disabled={state.busy} onClick={save}>
          {state.busy ? 'Saving…' : 'Change'}
        </button>
      )}
      {user.roles.length > 1 && <span className="note">Holds {user.roles.length} roles; changing keeps one.</span>}
      {state.error && <span className="field-error">{state.error}</span>}
    </div>
  )
}

export function AdminUsers() {
  const auth = useAuth()
  const { data, error, reload, token } = useAdminData(loadUsers)
  const [form, setForm] = useState(NEW_ACCOUNT)
  const [message, setMessage] = useState({ text: '', error: false })
  const [query, setQuery] = useState('')
  const roles = data?.roles ?? []
  const picked = roles.find((r) => r.key === form.role)

  const create = async (event) => {
    event.preventDefault()
    const weak = passwordProblem(form.password, form.email)
    if (weak) return setMessage({ text: weak, error: true })
    try {
      await adminCreateUser(token, { ...form, company_name: needsCompany(picked) ? form.company_name : '' })
      setForm(NEW_ACCOUNT)
      setMessage({ text: `${form.email} can now log in as ${picked?.name ?? roleName(form.role)}.`, error: false })
      reload()
    } catch (err) {
      setMessage({ text: err.detail || describeError(err), error: true })
    }
  }
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))
  const changed = (text) => {
    setMessage({ text, error: false })
    reload()
  }
  const needle = query.trim().toLowerCase()
  const users = (data?.users ?? []).filter((u) => !needle || `${u.name} ${u.email}`.toLowerCase().includes(needle))

  return (
    <section className="dash-section">
      <header className="dash-head">
        <h1 className="dash-title">Users</h1>
        <input className="input dash-search" type="search" placeholder="Search name or email" value={query} onChange={(e) => setQuery(e.target.value)} />
      </header>
      {error && <p className="error">{error}</p>}
      {message.text && <p className={message.error ? 'error' : 'hint-box'}>{message.text}</p>}
      <div className="dash-card table-wrap">
        <table className="dash-table table-cards">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Status</th>
              <th>Role</th>
              <th>Joined</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td data-label="Name">{user.name}</td>
                <td data-label="Email">{user.email}</td>
                <td data-label="Status">
                  {user.roles.map((r) => (
                    <span key={r.role} className={`status-pill status-${r.status}`}>
                      {r.status}
                    </span>
                  ))}
                </td>
                <td data-label="Role">
                  <UserRole user={user} roles={roles} token={token} self={user.id === auth.user.id} onChanged={changed} />
                </td>
                <td data-label="Joined">{formatDate(user.created_at)}</td>
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
              {roles.map((r) => (
                <option key={r.key} value={r.key}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        {needsCompany(picked) && (
          <label className="field">
            Company name
            <input className="input" required value={form.company_name} onChange={set('company_name')} />
          </label>
        )}
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
        <button type="submit" className="btn btn-primary">
          Add account
        </button>
      </form>
    </section>
  )
}

// ---- roles and permissions ------------------------------------------------------------------------------
const loadRoles = (token) => Promise.all([adminRoles(token), adminPermissions(token)]).then(([roles, catalog]) => ({ roles, ...catalog }))
const NEW_ROLE = { name: '', kind: 'buyer', description: '', permissions: ['market.buy'], self_signup: false, needs_verification: false }

function PermissionBoxes({ kind, catalog, value, onChange, locked }) {
  const fits = catalog.filter((p) => p.kinds.includes(kind))
  const toggle = (key) => onChange(value.includes(key) ? value.filter((p) => p !== key) : [...value, key])
  if (fits.length === 0) return <p className="note">No permissions fit this kind.</p>
  return (
    <div className="perm-grid">
      {fits.map((p) => (
        <label key={p.key} className={`perm${value.includes(p.key) ? ' is-on' : ''}`}>
          <input type="checkbox" checked={value.includes(p.key)} disabled={locked} onChange={() => toggle(p.key)} />
          <span>
            <strong>{p.label}</strong>
            <span className="note">{p.text}</span>
          </span>
        </label>
      ))}
    </div>
  )
}

function RoleCard({ role, catalog, kinds, token, onDone, index }) {
  const [draft, setDraft] = useState(role)
  const [state, setState] = useState({ busy: false, error: '', saved: false })
  const dirty = JSON.stringify(draft) !== JSON.stringify(role)
  const kindName = kinds.find((k) => k.kind === role.kind)?.name ?? role.kind
  const set = (key, value) => setDraft((d) => ({ ...d, [key]: value }))

  const save = async () => {
    setState({ busy: true, error: '', saved: false })
    const changes = {}
    for (const key of ['name', 'description', 'permissions', 'self_signup', 'needs_verification']) {
      if (JSON.stringify(draft[key]) !== JSON.stringify(role[key])) changes[key] = draft[key]
    }
    try {
      await adminUpdateRole(token, role.key, changes)
      setState({ busy: false, error: '', saved: true })
      onDone()
    } catch (err) {
      setState({ busy: false, error: err.detail || describeError(err), saved: false })
    }
  }
  const remove = async () => {
    if (!window.confirm(`Delete the role "${role.name}"? This cannot be undone.`)) return
    setState({ busy: true, error: '', saved: false })
    try {
      await adminDeleteRole(token, role.key)
      onDone()
    } catch (err) {
      setState({ busy: false, error: err.detail || describeError(err), saved: false })
    }
  }

  return (
    <article className="dash-card role-def" style={{ '--i': index }}>
      <div className="role-def-head">
        <input className="input role-def-name" aria-label="Role name" value={draft.name} onChange={(e) => set('name', e.target.value)} />
        <span className="badge-pill">{kindName}</span>
        {role.builtin && <span className="badge-pill">Built-in</span>}
        <span className="note">
          {role.users} account{role.users === 1 ? '' : 's'}
        </span>
      </div>
      <input
        className="input"
        aria-label="Description"
        placeholder="What this role is for"
        value={draft.description}
        onChange={(e) => set('description', e.target.value)}
      />
      {role.locked && <p className="note">The Admin role always has every permission and cannot be deleted, so there is always a way in.</p>}
      <PermissionBoxes kind={role.kind} catalog={catalog} value={draft.permissions} locked={role.locked} onChange={(v) => set('permissions', v)} />
      <div className="role-def-flags">
        {role.kind !== 'admin' && (
          <label className="check">
            <input type="checkbox" checked={draft.self_signup} onChange={(e) => set('self_signup', e.target.checked)} /> Offered at sign-up
          </label>
        )}
        {role.kind !== 'admin' && (
          <label className="check">
            <input type="checkbox" checked={draft.needs_verification} onChange={(e) => set('needs_verification', e.target.checked)} /> Needs verification
          </label>
        )}
      </div>
      {state.error && <p className="error">{state.error}</p>}
      <div className="row-actions">
        <button type="button" className="btn btn-primary" disabled={!dirty || state.busy} onClick={save}>
          {state.busy ? 'Saving…' : state.saved && !dirty ? 'Saved' : 'Save changes'}
        </button>
        {dirty && (
          <button type="button" className="btn btn-outline" onClick={() => setDraft(role)}>
            Undo
          </button>
        )}
        {!role.locked && (
          <button type="button" className="btn btn-outline btn-danger" disabled={state.busy} onClick={remove} title={role.users ? 'Give its accounts another role first' : ''}>
            Delete
          </button>
        )}
      </div>
    </article>
  )
}

export function AdminRoles() {
  const { data, error, reload, token } = useAdminData(loadRoles)
  const [form, setForm] = useState(NEW_ROLE)
  const [message, setMessage] = useState({ text: '', error: false })
  const catalog = data?.permissions ?? []
  const kinds = data?.kinds ?? []

  const setKind = (kind) =>
    setForm((f) => ({ ...f, kind, permissions: catalog.filter((p) => p.kinds.includes(kind)).map((p) => p.key), self_signup: kind === 'admin' ? false : f.self_signup }))
  const create = async (event) => {
    event.preventDefault()
    try {
      const role = await adminCreateRole(token, form)
      setForm(NEW_ROLE)
      setMessage({ text: `The role ${role.name} is ready. Give it to accounts on the Users page.`, error: false })
      reload()
    } catch (err) {
      setMessage({ text: err.detail || describeError(err), error: true })
    }
  }

  return (
    <section className="dash-section">
      <header>
        <h1 className="dash-title">Roles</h1>
        <p className="lede">
          Each role has a kind, which decides its dashboard, and permissions, which decide what it may do. Changes apply at once in this app and
          at the next login in the logistics app.
        </p>
      </header>
      {error && <p className="error">{error}</p>}
      {message.text && <p className={message.error ? 'error' : 'hint-box'}>{message.text}</p>}
      {(data?.roles ?? []).map((role, i) => (
        <RoleCard key={`${role.key}-${role.updated_at}`} role={role} catalog={catalog} kinds={kinds} token={token} onDone={reload} index={i} />
      ))}

      {data && (
        <form className="dash-card dash-form" onSubmit={create}>
          <h2 className="section-title">New role</h2>
          <div className="field-row">
            <label className="field">
              Name
              <input className="input" required maxLength={60} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </label>
            <label className="field">
              Kind
              <select className="input" value={form.kind} onChange={(e) => setKind(e.target.value)}>
                {kinds.map((k) => (
                  <option key={k.kind} value={k.kind}>
                    {k.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="field">
            Description
            <input className="input" maxLength={300} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          </label>
          <PermissionBoxes kind={form.kind} catalog={catalog} value={form.permissions} onChange={(v) => setForm((f) => ({ ...f, permissions: v }))} />
          {form.kind !== 'admin' && (
            <div className="role-def-flags">
              <label className="check">
                <input type="checkbox" checked={form.self_signup} onChange={(e) => setForm((f) => ({ ...f, self_signup: e.target.checked }))} /> Offered at sign-up
              </label>
              <label className="check">
                <input type="checkbox" checked={form.needs_verification} onChange={(e) => setForm((f) => ({ ...f, needs_verification: e.target.checked }))} /> Needs
                verification
              </label>
            </div>
          )}
          <button type="submit" className="btn btn-primary">
            Create role
          </button>
        </form>
      )}
    </section>
  )
}
