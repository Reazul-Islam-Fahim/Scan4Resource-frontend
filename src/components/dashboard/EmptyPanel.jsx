import { Link } from 'react-router-dom'

/** A dashboard page with nothing in it yet: what will be here, and where to go meanwhile. */
export default function EmptyPanel({ icon: Icon, title, text, to, action }) {
  return (
    <section className="dash-section">
      <h1 className="dash-title">{title}</h1>
      <div className="dash-card empty empty-center">
        <span className="empty-icon">
          <Icon width={30} height={30} />
        </span>
        <p className="lede">{text}</p>
        {to && (
          <Link to={to} className="btn btn-secondary">
            {action}
          </Link>
        )}
      </div>
    </section>
  )
}
