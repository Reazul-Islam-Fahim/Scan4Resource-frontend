import useAuth from '../../hooks/useAuth'

const STATUS = { active: 'Active', pending: 'Waiting for verification', rejected: 'Not approved' }

/** The account: its details and its role. The role is set at sign-up; only an admin can change it. */
export function AccountPage() {
  const auth = useAuth()
  const entry = auth.user.roles.find((r) => r.role === auth.roleKey) ?? auth.user.roles[0]

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
        <h2 className="section-title">Your role</h2>
        <div className="role-row">
          <span>
            <strong>{auth.roleName}</strong>
            {entry?.company_name && <span className="note"> · {entry.company_name}</span>}
          </span>
          {entry && <span className={`status-pill status-${entry.status}`}>{STATUS[entry.status] ?? entry.status}</span>}
        </div>
        <p className="note">Your role was chosen when the account was created. Only a Scan4Reuse admin can change it.</p>
      </div>
    </section>
  )
}
