import { Link } from 'react-router-dom'
import useAuth from '../../hooks/useAuth'
import { hasLogisticsApp, logisticsUrl } from '../../lib/auth'
import { ChevronRight } from '../Icons'

function Greeting({ children }) {
  const { user } = useAuth()
  return (
    <header>
      <h1 className="dash-title">Hello, {user.name.split(' ')[0]}</h1>
      {children && <p className="lede">{children}</p>}
    </header>
  )
}

/** Figures that will fill in as orders come in; zero until then. */
function Stats({ items }) {
  return (
    <div className="dash-stats">
      {items.map(([label, value]) => (
        <div key={label} className="dash-card dash-stat">
          <span className="note">{label}</span>
          <strong>{value}</strong>
        </div>
      ))}
    </div>
  )
}

function Step({ to, href, title, text }) {
  const body = (
    <>
      <span>
        <strong>{title}</strong>
        <span className="note">{text}</span>
      </span>
      <ChevronRight width={20} height={20} />
    </>
  )
  return href ? <a className="dash-card dash-step" href={href}>{body}</a> : <Link className="dash-card dash-step" to={to}>{body}</Link>
}

export function BuyerOverview() {
  return (
    <section className="dash-section">
      <Greeting>Find reclaimed materials near you and have them delivered.</Greeting>
      <Stats items={[['Open orders', 0], ['Deliveries on the way', 0], ['Spent', 'CHF 0.00']]} />
      <Step to="/market" title="Browse the marketplace" text="Materials scanned by sellers across Switzerland" />
      <Step to="/map" title="See materials on the map" text="Find what is closest to your site" />
    </section>
  )
}

export function CorporateOverview() {
  return (
    <section className="dash-section">
      <Greeting>Buy in bulk, or let sellers bid on a tender.</Greeting>
      <Stats items={[['Open tenders', 0], ['Open orders', 0], ['Spent', 'CHF 0.00']]} />
      <Step to="/dashboard/tenders" title="Tenders" text="Request large quantities for a project" />
      <Step to="/market" title="Browse the marketplace" text="Buy listed materials straight away" />
    </section>
  )
}

export function SellerOverview() {
  return (
    <section className="dash-section">
      <Greeting>Scan a building, publish what can be reused, and get paid when it is delivered.</Greeting>
      <Stats items={[['Live listings', 0], ['Orders to prepare', 0], ['Available balance', 'CHF 0.00']]} />
      <Step to="/scan" title="Start a scan" text="Photos or a video walkthrough of the site" />
      <Step to="/scans" title="My scans" text="Open a report and publish its items" />
      <Step to="/dashboard/partners" title="Choose logistics partners" text="Who may pick up your materials" />
    </section>
  )
}

export function LogisticsOverview() {
  const { token } = useAuth()
  const url = logisticsUrl(token, '/')
  return (
    <section className="dash-section">
      <Greeting>Your requests, jobs, live map and earnings are in the logistics app.</Greeting>
      {url ? (
        <Step href={url} title="Open the logistics app" text="Accept requests, plan pickups and track deliveries" />
      ) : (
        <p className="hint-box">The logistics app is not configured. Set VITE_LOGISTICS_URL to its address and restart this app.</p>
      )}
      {!hasLogisticsApp() && <p className="note">Locally the logistics app usually runs at http://localhost:5174.</p>}
    </section>
  )
}
