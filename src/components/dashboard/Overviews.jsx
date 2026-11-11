import { useCallback } from 'react'
import { Link } from 'react-router-dom'
import useAuth from '../../hooks/useAuth'
import { fetchImpact, hasLogisticsApp, logisticsUrl } from '../../lib/auth'
import { fetchEarnings } from '../../lib/financeApi'
import { formatMoney, formatPrice } from '../../lib/format'
import { CATEGORIES } from '../../lib/materials'
import { fetchListings, fetchMine, fetchOrders, fetchSales, fetchSeller } from '../../lib/marketApi'
import { fetchMyTenders, fetchOpenTenders } from '../../lib/tenderApi'
import {
  BagIcon,
  CoinIcon,
  DocIcon,
  InboxIcon,
  MapIcon,
  PinIcon,
  ReportIcon,
  ScanIcon,
  ShopIcon,
  TruckIcon,
  WalletIcon,
} from '../Icons'
import MaterialImage from '../MaterialImage'
import { useWaiting } from './attention'
import { formatDate } from './format'
import {
  Bars,
  Chip,
  Co2Card,
  EmptyState,
  OverviewSkeleton,
  PageHead,
  Panel,
  PanelLink,
  StatCard,
  Step,
  TodoRow,
  Track,
  Trend,
  AreaChart,
  greeting,
  lastMonths,
  perMonth,
  useData,
} from './kit'

// The first page of each role's dashboard: figures with a trend, the CO₂ that reuse saved, what needs the person
// and their latest orders. Admins have theirs in Console.jsx (AdminInsights).

const kindName = (cat) => CATEGORIES.find(([key]) => key === cat)?.[1] ?? (cat ? cat.charAt(0).toUpperCase() + cat.slice(1) : 'Other')
const firstName = (name) => name.split(' ')[0]
const live = (o) => o.status !== 'cancelled'
const isOpen = (o) => o.status === 'awaiting_delivery' || o.status === 'delivery_booked'
const sum = (rows, value) => rows.reduce((s, r) => s + value(r), 0)
const lastTwo = (series) => ({ now: series[series.length - 1], before: series[series.length - 2] })

const ORDER_STEPS = ['Ordered', 'Delivery booked', 'Delivered']
const stepOf = (order) => ({ awaiting_delivery: 0, delivery_booked: 1, delivered: 2 })[order.status] ?? 0
const STATUS_CHIP = {
  awaiting_delivery: ['Finding a carrier', 'wait'],
  delivery_booked: ['On its way', ''],
  delivered: ['Delivered', ''],
  cancelled: ['Cancelled', 'muted'],
}
const newestFirst = (rows) => [...rows].sort((a, b) => (b.updated_at || b.created_at || '').localeCompare(a.updated_at || a.created_at || ''))

/** An order in a list: its first item's picture, what and where, its status and how far it got. */
function OrderRow({ order, to, seller = false }) {
  const [label, tone] = STATUS_CHIP[order.status] ?? [order.status, 'muted']
  const first = order.items[0]
  const more = order.items.length - 1
  return (
    <Link to={to} className="ds-order">
      <MaterialImage kind={first?.category} src={first?.image} alt="" className="ds-thumb" />
      <span className="ds-todo-text">
        <strong>
          {first?.name ?? 'Order'}
          {more > 0 ? ` and ${more} more` : ''}
        </strong>
        <span className="note">
          {seller ? `${order.buyer_name ?? 'Buyer'} · ${order.city || 'Switzerland'}` : `From ${first?.seller_name ?? 'a seller'}`} · {formatDate(order.created_at)}
        </span>
      </span>
      <span className="ds-todo-end">
        {formatPrice(order.goods_chf)}
        <Chip tone={tone}>{label}</Chip>
      </span>
      {order.status !== 'cancelled' && <Track steps={ORDER_STEPS} at={stepOf(order)} />}
    </Link>
  )
}

function RecentOrders({ orders, to, seller, empty }) {
  const recent = newestFirst(orders).slice(0, 4)
  return (
    <Panel title="Recent orders" sub={orders.length ? `${orders.length} in all` : ''} action={orders.length > 0 && <PanelLink to={to}>See all</PanelLink>}>
      {recent.length === 0 ? (
        empty
      ) : (
        <div className="ds-list">
          {recent.map((o) => (
            <OrderRow key={o.id} order={o} to={to} seller={seller} />
          ))}
        </div>
      )}
    </Panel>
  )
}

/** Money per month: a smooth chart over six months. */
function MoneyChart({ title, rows, date, value, empty }) {
  const values = perMonth(rows, date, value)
  const months = lastMonths().map((month, i) => ({ month, value: values[i] }))
  const total = sum(months, (m) => m.value)
  return (
    <Panel title={title} sub="Last six months">
      {total > 0 ? (
        <>
          <p className="ds-chart-sum">
            <strong>{formatMoney(total)}</strong>
            <Trend {...lastTwo(months.map((m) => m.value))} />
          </p>
          <AreaChart months={months} value={(m) => m.value} format={formatMoney} />
        </>
      ) : (
        empty
      )}
    </Panel>
  )
}

function Failed({ error }) {
  return error ? <p className="error">{error}</p> : null
}

/** Loads several things at once (`loaders` is a constant list); a part that fails comes back as null. */
function useAll(loaders) {
  const load = useCallback((token) => Promise.all(loaders.map((fn) => fn(token).catch(() => null))), [loaders])
  return useData(load)
}

// ---- seller ---------------------------------------------------------------------------------------------

const SELLER = [fetchMine, fetchSales, fetchEarnings, fetchOpenTenders, fetchImpact, fetchSeller]

export function SellerOverview() {
  const { user, can } = useAuth()
  const waiting = useWaiting().pages
  const { data, error } = useAll(SELLER)
  if (!data) return (
    <section className="dash-section">
      <PageHead title={`${greeting()}, ${firstName(user.name)}`} lede="Scan a building, publish what can be reused, and get paid when it is delivered." />
      <Failed error={error} />
      {!error && <OverviewSkeleton />}
    </section>
  )
  const [mine = [], sales = [], earnings, tenders = [], impact, seller] = data.map((d, i) => d ?? [[], [], null, [], null, null][i])
  const liveListings = mine.filter((l) => l.status === 'active')
  const drafts = mine.filter((l) => l.status === 'draft')
  const toPrepare = sales.filter(isOpen)
  const invited = tenders.filter((t) => t.status === 'open' && t.invited && !t.my_bid)
  const credits = (earnings?.entries ?? []).filter((e) => e.kind !== 'payout')
  const earnedSeries = perMonth(credits, (e) => e.created_at, (e) => e.amount_chf)
  const salesSeries = perMonth(sales.filter(live), (o) => o.created_at)
  const listedSeries = perMonth(mine, (l) => l.published_at)
  const setup = [
    { done: Boolean(seller?.address), to: '/dashboard/partners', text: 'Set your pickup address' },
    { done: (seller?.partners ?? []).length > 0, to: '/dashboard/partners', text: 'Choose your logistics partners' },
    { done: mine.length > 0, to: '/scan', text: 'Scan a building and create listings' },
    { done: liveListings.length > 0 || sales.length > 0, to: '/dashboard/listings', text: 'Publish your first listing' },
    { done: sales.length > 0, text: 'Get your first order' },
  ]
  const setupLeft = setup.filter((s) => !s.done).length

  const todos = [
    drafts.length > 0 && { icon: ShopIcon, title: `${drafts.length} draft${drafts.length > 1 ? 's' : ''} to publish`, text: 'Check the price and stock, then publish', to: '/dashboard/listings' },
    toPrepare.length > 0 && { icon: BagIcon, title: `${toPrepare.length} order${toPrepare.length > 1 ? 's' : ''} to prepare`, text: waiting.orders ? `${waiting.orders} new since your last visit` : 'Have the materials ready for pickup', to: '/dashboard/orders' },
    invited.length > 0 && can('tenders.bid') && { icon: DocIcon, title: `${invited.length} tender${invited.length > 1 ? 's' : ''} invite${invited.length > 1 ? '' : 's'} you`, text: 'Bulk requests near your pickup', to: '/dashboard/tenders' },
    earnings?.available_chf > 0 && { icon: WalletIcon, title: `${formatMoney(earnings.available_chf)} ready to pay out`, text: 'Request a payout to your bank', to: '/dashboard/payouts' },
  ].filter(Boolean)

  return (
    <section className="dash-section">
      <PageHead title={`${greeting()}, ${firstName(user.name)}`} lede="Scan a building, publish what can be reused, and get paid when it is delivered.">
        {can('market.sell') && (
          <Link to="/scan" className="btn btn-primary btn-sm">
            <ScanIcon width={18} height={18} /> Start a scan
          </Link>
        )}
      </PageHead>
      <Failed error={error} />
      <div className="ds-row ds-row-even is-stretch">
        <div className="dash-card ds-hero">
          <span className="ds-stat-label">Available balance</span>
          <strong className="ds-stat-value">{formatMoney(earnings?.available_chf ?? 0)}</strong>
          <span className="note">
            {earnings?.on_the_way_chf > 0 ? `${formatMoney(earnings.on_the_way_chf)} more once orders are delivered` : 'Credited when an order is delivered'}
            {earnings?.requested_chf > 0 ? ` · ${formatMoney(earnings.requested_chf)} requested` : ''}
          </span>
          {can('payouts.request') && (
            <Link to="/dashboard/payouts" className="btn btn-sm">
              <WalletIcon width={17} height={17} /> {earnings?.available_chf > 0 ? 'Request payout' : 'Balance & payouts'}
            </Link>
          )}
        </div>
        <Co2Card impact={impact} scope="selling" what="sold for reuse" />
      </div>
      <div className="ds-stats is-3">
        <StatCard icon={ShopIcon} label="Live listings" value={liveListings.length} spark={listedSeries} trend={<Trend {...lastTwo(listedSeries)} />} note={drafts.length ? `${drafts.length} draft${drafts.length > 1 ? 's' : ''}` : ''} to="/dashboard/listings" />
        <StatCard icon={BagIcon} label="Orders to prepare" value={toPrepare.length} spark={salesSeries} trend={<Trend {...lastTwo(salesSeries)} />} note={`${sales.filter(live).length} orders in all`} to="/dashboard/orders" />
        <StatCard icon={CoinIcon} label="Earned so far" value={formatMoney(earnings?.earned_chf ?? 0)} spark={earnedSeries} trend={<Trend {...lastTwo(earnedSeries)} />} note="after commission" to="/dashboard/payouts" />
      </div>
      <div className="ds-row ds-row-2">
        <MoneyChart
          title="Earnings"
          rows={credits}
          date={(e) => e.created_at}
          value={(e) => e.amount_chf}
          empty={<EmptyState icon={CoinIcon} title="No earnings yet" text="Each delivered order adds what you earned, after commission, here." />}
        />
        <Panel title="Needs your attention" count={todos.length}>
          <div className="ds-list">
            {todos.length ? todos.map((t) => <TodoRow key={t.title} {...t} />) : <TodoRow icon={InboxIcon} title="You are all caught up" text="New orders and tenders show up here" done />}
          </div>
        </Panel>
      </div>
      <div className="ds-row ds-row-even">
        {setupLeft > 0 ? (
          <Panel title="Get started" sub={`${setup.length - setupLeft} of ${setup.length} done`}>
            <div className="ds-list">
              {setup.map((s, i) => (
                <Step key={s.text} n={i + 1} done={s.done} to={s.to}>
                  {s.text}
                </Step>
              ))}
            </div>
          </Panel>
        ) : (
          <Panel title="Shortcuts">
            <div className="ds-tiles">
              <Tile main to="/scan" icon={ScanIcon} title="Start a scan" text="Photos or a video walkthrough" />
              <Tile to="/scans" icon={ReportIcon} title="My scans" text="Open a report, publish its items" />
              <Tile to="/dashboard/listings" icon={ShopIcon} title="Listings" text="Prices, stock, what is live" />
              <Tile to="/dashboard/partners" icon={TruckIcon} title="Pickup & partners" text="Who may pick up" />
            </div>
          </Panel>
        )}
        <RecentOrders
          orders={sales}
          to="/dashboard/orders"
          seller
          empty={<EmptyState icon={BagIcon} title="No orders yet" text="When a buyer orders your materials, the order and its delivery show here." />}
        />
      </div>
    </section>
  )
}

function Tile({ to, href, icon: Icon, title, text, main }) {
  const body = (
    <>
      <span className="ds-well">
        <Icon width={20} height={20} />
      </span>
      <strong>{title}</strong>
      <span className="note">{text}</span>
    </>
  )
  const cls = `dash-card ds-tile${main ? ' is-main' : ''}`
  return href ? (
    <a className={cls} href={href}>
      {body}
    </a>
  ) : (
    <Link className={cls} to={to}>
      {body}
    </Link>
  )
}

// ---- buyer ----------------------------------------------------------------------------------------------

const BUYER = [fetchOrders, fetchImpact, fetchListings]

/** The order closest to arriving, in the green card. */
function OnItsWay({ order }) {
  if (!order) {
    return (
      <div className="dash-card ds-hero">
        <span className="ds-stat-label">Nothing on its way</span>
        <strong className="ds-stat-value">Find materials</strong>
        <span className="note">Reclaimed materials scanned by sellers across Switzerland, delivered to your site.</span>
        <Link to="/market" className="btn btn-sm">
          <ShopIcon width={17} height={17} /> Browse the marketplace
        </Link>
      </div>
    )
  }
  const first = order.items[0]
  return (
    <Link to="/dashboard/orders" className="dash-card ds-hero">
      <span className="ds-stat-label">{order.status === 'delivery_booked' ? 'On its way to you' : 'Finding a carrier'}</span>
      <strong className="ds-stat-value">
        {first?.name}
        {order.items.length > 1 ? ` +${order.items.length - 1}` : ''}
      </strong>
      <span className="note">
        To {order.city || order.address} · {formatPrice(order.goods_chf)} · ordered {formatDate(order.created_at)}
      </span>
      <Track steps={ORDER_STEPS} at={stepOf(order)} />
      <span className="ds-hero-steps">
        {ORDER_STEPS.map((s) => (
          <span key={s}>{s}</span>
        ))}
      </span>
    </Link>
  )
}

function NewListings({ listings }) {
  const newest = [...(listings ?? [])].sort((a, b) => (b.published_at || '').localeCompare(a.published_at || '')).slice(0, 4)
  return (
    <Panel title="New on the marketplace" action={<PanelLink to="/market">Browse all</PanelLink>}>
      {newest.length === 0 ? (
        <EmptyState icon={ShopIcon} title="Nothing listed right now" text="New materials show up here as sellers publish them." />
      ) : (
        <div className="ds-list">
          {newest.map((l) => (
            <Link key={l.id} to="/market" className="ds-todo is-link">
              <MaterialImage kind={l.category} src={l.image} alt="" className="ds-thumb" />
              <span className="ds-todo-text">
                <strong>{l.name}</strong>
                <span className="note">
                  {kindName(l.category)} · {l.city}
                </span>
              </span>
              <span className="ds-todo-end">
                {formatPrice(l.price_chf)}
                <span className="note">per {l.unit === 'm2' ? 'm²' : 'piece'}</span>
              </span>
            </Link>
          ))}
        </div>
      )}
    </Panel>
  )
}

function buyerFigures(orders) {
  const kept = orders.filter(live)
  const spentSeries = perMonth(kept, (o) => o.created_at, (o) => o.goods_chf)
  const orderSeries = perMonth(kept, (o) => o.created_at)
  const deliveredSeries = perMonth(kept.filter((o) => o.status === 'delivered'), (o) => o.updated_at)
  return { kept, spentSeries, orderSeries, deliveredSeries }
}

export function BuyerOverview() {
  const { user } = useAuth()
  const waiting = useWaiting().pages
  const { data, error } = useAll(BUYER)
  const lede = 'Find reclaimed materials near you and have them delivered.'
  if (!data) return (
    <section className="dash-section">
      <PageHead title={`${greeting()}, ${firstName(user.name)}`} lede={lede} />
      <Failed error={error} />
      {!error && <OverviewSkeleton />}
    </section>
  )
  const [orders = [], impact, listings] = data.map((d, i) => d ?? [[], null, []][i])
  const { kept, spentSeries, orderSeries, deliveredSeries } = buyerFigures(orders)
  const open = kept.filter(isOpen)
  const coming = newestFirst(open).sort((a, b) => stepOf(b) - stepOf(a))[0]
  const todos = [
    waiting.orders > 0 && { icon: BagIcon, title: `${waiting.orders} order update${waiting.orders > 1 ? 's' : ''}`, text: 'A delivery was booked or completed', to: '/dashboard/orders' },
    open.some((o) => o.status === 'awaiting_delivery') && { icon: TruckIcon, title: 'Carriers are looking at your order', text: 'You are told when the pickup is booked', to: '/dashboard/orders' },
  ].filter(Boolean)
  return (
    <section className="dash-section">
      <PageHead title={`${greeting()}, ${firstName(user.name)}`} lede={lede}>
        <Link to="/market" className="btn btn-primary btn-sm">
          <ShopIcon width={18} height={18} /> Marketplace
        </Link>
        <Link to="/map" className="btn btn-outline btn-sm">
          <MapIcon width={18} height={18} /> Map
        </Link>
      </PageHead>
      <Failed error={error} />
      <div className="ds-row ds-row-even is-stretch">
        <OnItsWay order={coming} />
        <Co2Card impact={impact} scope="buying" />
      </div>
      <div className="ds-stats is-3">
        <StatCard icon={BagIcon} label="Open orders" value={open.length} spark={orderSeries} trend={<Trend {...lastTwo(orderSeries)} />} note={`${kept.length} in all`} to="/dashboard/orders" />
        <StatCard icon={TruckIcon} label="Delivered" value={kept.filter((o) => o.status === 'delivered').length} spark={deliveredSeries} trend={<Trend {...lastTwo(deliveredSeries)} />} to="/dashboard/orders" />
        <StatCard icon={CoinIcon} label="Spent on materials" value={formatPrice(sum(kept, (o) => o.goods_chf))} spark={spentSeries} trend={<Trend {...lastTwo(spentSeries)} />} note="without delivery" />
      </div>
      <div className="ds-row ds-row-even">
        <NewListings listings={listings} />
        <Panel title="Needs your attention" count={todos.length}>
          <div className="ds-list">
            {todos.length ? todos.map((t) => <TodoRow key={t.title} {...t} />) : <TodoRow icon={InboxIcon} title="You are all caught up" text="Order updates show up here" done />}
            <TodoRow icon={PinIcon} title="Materials near your site" text="See what is closest on the map" to="/map" />
          </div>
        </Panel>
      </div>
      <RecentOrders
        orders={orders}
        to="/dashboard/orders"
        empty={
          <EmptyState icon={BagIcon} title="No orders yet" text="When you order materials, you can follow their delivery here.">
            <Link to="/market" className="btn btn-primary btn-sm">
              Browse the marketplace
            </Link>
          </EmptyState>
        }
      />
    </section>
  )
}

// ---- corporate buyer ------------------------------------------------------------------------------------

const CORPORATE = [fetchOrders, fetchMyTenders, fetchImpact]
const TENDER_CHIP = { draft: ['Draft', 'muted'], open: ['Open', ''], closed: ['Ready to award', 'wait'], awarded: ['Awarded', ''], cancelled: ['Cancelled', 'muted'] }

function timeLeft(closesOn) {
  if (!closesOn) return ''
  const days = Math.ceil((new Date(`${closesOn}T23:59:59`) - new Date()) / 86_400_000)
  return days < 0 ? 'closed' : days === 0 ? 'closes today' : `${days} day${days > 1 ? 's' : ''} left`
}

function TenderRow({ tender }) {
  const [label, tone] = TENDER_CHIP[tender.status] ?? [tender.status, 'muted']
  return (
    <Link to={`/dashboard/tenders?tender=${encodeURIComponent(tender.id)}`} className="ds-todo is-link">
      <span className="ds-well">
        <DocIcon width={19} height={19} />
      </span>
      <span className="ds-todo-text">
        <strong>{tender.title}</strong>
        <span className="note">
          {tender.city ? `${tender.city} · ` : ''}
          {tender.bid_count ?? 0} bid{tender.bid_count === 1 ? '' : 's'}
          {tender.status === 'open' && tender.closes_on ? ` · ${timeLeft(tender.closes_on)}` : ''}
        </span>
      </span>
      <Chip tone={tone}>{label}</Chip>
    </Link>
  )
}

export function CorporateOverview() {
  const { user, can } = useAuth()
  const waiting = useWaiting().pages
  const { data, error } = useAll(CORPORATE)
  const lede = 'Buy in bulk, or let sellers bid on a tender.'
  if (!data) return (
    <section className="dash-section">
      <PageHead title={`${greeting()}, ${firstName(user.name)}`} lede={lede} />
      <Failed error={error} />
      {!error && <OverviewSkeleton />}
    </section>
  )
  const [orders = [], tenders = [], impact] = data.map((d, i) => d ?? [[], [], null][i])
  const { kept, spentSeries, orderSeries } = buyerFigures(orders)
  const active = tenders.filter((t) => t.status === 'open' || t.status === 'closed')
  const toAward = tenders.filter((t) => t.status === 'closed')
  const drafts = tenders.filter((t) => t.status === 'draft')
  const bids = sum(active, (t) => t.bid_count ?? 0)
  const bidSeries = perMonth(tenders, (t) => t.opened_at, (t) => t.bid_count ?? 0)
  const byMaterial = {}
  for (const o of kept) for (const i of o.items) byMaterial[i.category] = (byMaterial[i.category] ?? 0) + i.total_chf
  const materials = Object.entries(byMaterial)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([cat, value]) => ({ label: kindName(cat), value }))
  const todos = [
    toAward.length > 0 && { icon: DocIcon, title: `${toAward.length} tender${toAward.length > 1 ? 's' : ''} ready to award`, text: 'Compare the bids and pick the best', to: `/dashboard/tenders?tender=${encodeURIComponent(toAward[0].id)}` },
    drafts.length > 0 && { icon: DocIcon, title: `${drafts.length} draft tender${drafts.length > 1 ? 's' : ''}`, text: 'Publish to invite sellers near the site', to: '/dashboard/tenders' },
    waiting.tenders > 0 && !toAward.length && { icon: InboxIcon, title: `${waiting.tenders} new bid${waiting.tenders > 1 ? 's' : ''}`, text: 'Since your last visit', to: '/dashboard/tenders' },
    waiting.orders > 0 && { icon: BagIcon, title: `${waiting.orders} order update${waiting.orders > 1 ? 's' : ''}`, text: 'A delivery was booked or completed', to: '/dashboard/orders' },
  ].filter(Boolean)
  return (
    <section className="dash-section">
      <PageHead title={`${greeting()}, ${firstName(user.name)}`} lede={lede}>
        {can('tenders.create') && (
          <Link to="/dashboard/tenders" className="btn btn-primary btn-sm">
            <DocIcon width={18} height={18} /> New tender
          </Link>
        )}
        <Link to="/market" className="btn btn-outline btn-sm">
          <ShopIcon width={18} height={18} /> Marketplace
        </Link>
      </PageHead>
      <Failed error={error} />
      <div className="ds-stats">
        <StatCard icon={DocIcon} label="Open tenders" value={active.length} note={toAward.length ? `${toAward.length} ready to award` : `${tenders.length} in all`} to="/dashboard/tenders" />
        <StatCard icon={InboxIcon} label="Bids received" value={bids} spark={bidSeries} note="on open tenders" to="/dashboard/tenders" />
        <StatCard icon={BagIcon} label="Open orders" value={kept.filter(isOpen).length} spark={orderSeries} trend={<Trend {...lastTwo(orderSeries)} />} to="/dashboard/orders" />
        <StatCard icon={CoinIcon} label="Spent on materials" value={formatPrice(sum(kept, (o) => o.goods_chf))} spark={spentSeries} trend={<Trend {...lastTwo(spentSeries)} />} />
      </div>
      <Co2Card impact={impact} scope="buying" />
      <div className="ds-row ds-row-2">
        <Panel title="Your tenders" sub={tenders.length ? 'Newest first' : ''} action={tenders.length > 0 && <PanelLink to="/dashboard/tenders">See all</PanelLink>}>
          {tenders.length === 0 ? (
            <EmptyState icon={DocIcon} title="No tenders yet" text="Describe what a project needs; sellers near the site bid, and you award the best offers.">
              {can('tenders.create') && (
                <Link to="/dashboard/tenders" className="btn btn-primary btn-sm">
                  Create a tender
                </Link>
              )}
            </EmptyState>
          ) : (
            <div className="ds-list">
              {[...tenders]
                .sort((a, b) => (b.opened_at || b.created_at || '').localeCompare(a.opened_at || a.created_at || ''))
                .slice(0, 5)
                .map((t) => (
                  <TenderRow key={t.id} tender={t} />
                ))}
            </div>
          )}
        </Panel>
        <Panel title="Needs your attention" count={todos.length}>
          <div className="ds-list">
            {todos.length ? todos.map((t) => <TodoRow key={t.title} {...t} />) : <TodoRow icon={InboxIcon} title="You are all caught up" text="Bids and order updates show up here" done />}
          </div>
        </Panel>
      </div>
      <div className="ds-row ds-row-even">
        <Panel title="Spending by material" sub="Orders not cancelled, without delivery">
          {materials.length ? (
            <Bars items={materials} format={(v) => formatPrice(v)} />
          ) : (
            <EmptyState icon={CoinIcon} title="Nothing bought yet" text="What you spend per material shows here once you order." />
          )}
        </Panel>
        <RecentOrders
          orders={orders}
          to="/dashboard/orders"
          empty={<EmptyState icon={BagIcon} title="No orders yet" text="Orders from the marketplace and awarded tenders show here." />}
        />
      </div>
    </section>
  )
}

// ---- logistics company ----------------------------------------------------------------------------------

export function LogisticsOverview() {
  const { user, token } = useAuth()
  const { data: impact } = useData(fetchImpact)
  const at = (path) => logisticsUrl(token, path)
  const url = at('/company')
  return (
    <section className="dash-section">
      <PageHead title={`${greeting()}, ${firstName(user.name)}`} lede="Requests, jobs, the live map and your earnings are in the logistics app." />
      <div className="ds-row ds-row-even is-stretch">
        <div className="dash-card ds-hero">
          <span className="ds-stat-label">Logistics app</span>
          <strong className="ds-stat-value">Pick up and deliver</strong>
          <span className="note">Accept requests, plan pickups for your fleet and follow every delivery on the map.</span>
          {url ? (
            <a href={url} className="btn btn-sm">
              <TruckIcon width={17} height={17} /> Open the logistics app
            </a>
          ) : (
            <span className="note">The logistics app is not configured. Set VITE_LOGISTICS_URL to its address and restart this app.</span>
          )}
        </div>
        {impact === undefined ? <div className="dash-card ds-co2" aria-busy="true" /> : <Co2Card impact={impact} scope="transporting" what="moved to a new use" />}
      </div>
      {url && (
        <div className="ds-tiles">
          <Tile main href={at('/company')} icon={InboxIcon} title="Requests" text="New pickups to accept" />
          <Tile href={at('/company')} icon={TruckIcon} title="Jobs" text="Today's pickups and drops" />
          <Tile href={at('/company')} icon={MapIcon} title="Live map" text="Where every load is" />
          <Tile href={at('/company')} icon={WalletIcon} title="Earnings" text="Balance and payouts" />
        </div>
      )}
      {!hasLogisticsApp() && <p className="note">Locally the logistics app usually runs at http://localhost:5174.</p>}
    </section>
  )
}
