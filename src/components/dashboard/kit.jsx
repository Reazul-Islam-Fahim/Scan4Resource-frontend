import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import useAuth from '../../hooks/useAuth'
import { describeError } from '../../lib/api'
import { ArrowDownIcon, ArrowUpIcon, CheckIcon, ChevronRight, LeafIcon } from '../Icons'

// Building blocks of the dashboards: figures with a trend and a small chart, panels, to-do rows, the CO₂ card,
// charts, loading skeletons and empty states. All of it is styled in dashboard.css.

/** Loads `load(token, arg)`; `data` is undefined while loading, `error` holds a readable message. */
export function useData(load, arg) {
  const { token } = useAuth()
  const [state, setState] = useState({ data: undefined, error: '' })
  const reload = useCallback(() => {
    load(token, arg)
      .then((data) => setState({ data, error: '' }))
      .catch((err) => setState({ data: null, error: err.detail || describeError(err) }))
  }, [token, load, arg])
  useEffect(reload, [reload])
  return { ...state, loading: state.data === undefined && !state.error, reload, token }
}

export function greeting(date = new Date()) {
  const hour = date.getHours()
  return hour < 5 ? 'Good evening' : hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
}

const MONTH = new Intl.DateTimeFormat('en-CH', { month: 'short' })
const MONTH_LONG = new Intl.DateTimeFormat('en-CH', { month: 'long' })
export const monthLabel = (ym, long = false) => (long ? MONTH_LONG : MONTH).format(new Date(`${ym}-01T00:00:00`))
export const monthOf = (iso) => (iso ? iso.slice(0, 7) : '')

/** The last `count` months as 'YYYY-MM', oldest first, like the API's series. */
export function lastMonths(count = 6, now = new Date()) {
  const months = []
  for (let i = count - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return months
}

/** Sums `value(row)` per month of `date(row)` over the last six months. */
export function perMonth(rows, date, value = () => 1) {
  const months = lastMonths()
  const totals = Object.fromEntries(months.map((m) => [m, 0]))
  for (const row of rows) {
    const m = monthOf(date(row))
    if (m in totals) totals[m] += value(row)
  }
  return months.map((m) => totals[m])
}

/** "1,8 t" or "640 kg". */
export function tonnes(kg) {
  if (kg >= 1000) return `${(kg / 1000).toFixed(1)} t`
  return `${Math.round(kg).toLocaleString('de-CH')} kg`
}

export function PageHead({ title, lede, children }) {
  return (
    <header className="ds-head">
      <div>
        <h1 className="dash-title">{title}</h1>
        {lede && <p className="lede">{lede}</p>}
      </div>
      {children && <div className="ds-head-actions">{children}</div>}
    </header>
  )
}

/** A small line chart with a soft fill and a dot on the latest value. */
export function Sparkline({ values, className = 'ds-spark' }) {
  const id = useId().replace(/:/g, '')
  if (!values || values.length < 2 || values.every((v) => !v)) return null
  const w = 96
  const h = 34
  const max = Math.max(...values)
  const min = Math.min(...values)
  const span = max - min || 1
  const points = values.map((v, i) => [(i * w) / (values.length - 1), h - 4 - ((v - min) / span) * (h - 8)])
  const line = points.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')
  const [lx, ly] = points[points.length - 1]
  return (
    <svg className={className} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <defs>
        <linearGradient id={`sp${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="currentColor" stopOpacity=".28" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line} L${w} ${h} L0 ${h}Z`} fill={`url(#sp${id})`} />
      <path d={line} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={Math.min(lx, w - 3.5)} cy={ly} r="3.2" fill="currentColor" />
    </svg>
  )
}

/** "▲ 24.7%" against last month; nothing when there is nothing to compare with. */
export function Trend({ now, before, text }) {
  if (text) return <span className="ds-trend">{text}</span>
  if (!before && !now) return null
  if (!before) return <span className="ds-trend"><ArrowUpIcon />new</span>
  const change = ((now - before) / before) * 100
  if (Math.abs(change) < 0.5) return <span className="ds-trend is-flat">same as last month</span>
  const up = change > 0
  return (
    <span className={`ds-trend${up ? '' : ' is-down'}`} title="Against last month">
      {up ? <ArrowUpIcon /> : <ArrowDownIcon />}
      {Math.abs(change) >= 100 ? `${Math.round(Math.abs(change))}%` : `${Math.abs(change).toFixed(1)}%`}
    </span>
  )
}

/** A figure: icon, label, value, a trend or note underneath, and a small chart of the last months. */
export function StatCard({ icon: Icon, label, value, spark, trend, note, to }) {
  const body = (
    <>
      <div className="ds-stat-top">
        {Icon && (
          <span className="ds-well">
            <Icon width={20} height={20} />
          </span>
        )}
        <Sparkline values={spark} />
      </div>
      <span className="ds-stat-label">{label}</span>
      <strong className="ds-stat-value">{value}</strong>
      {(trend || note) && (
        <span className="ds-stat-foot">
          {trend}
          {note && <span className="note">{note}</span>}
        </span>
      )}
    </>
  )
  return to ? (
    <Link to={to} className="dash-card ds-stat">
      {body}
    </Link>
  ) : (
    <div className="dash-card ds-stat">{body}</div>
  )
}

export function Panel({ title, sub, count, action, className = '', children }) {
  return (
    <section className={`dash-card ds-panel ${className}`}>
      <div className="ds-panel-head">
        <div>
          <h2 className="ds-panel-title">{title}</h2>
          {sub && <p className="note">{sub}</p>}
        </div>
        {count > 0 && <span className="dash-count">{count}</span>}
        {action}
      </div>
      {children}
    </section>
  )
}

export function PanelLink({ to, href, children }) {
  return href ? (
    <a className="ds-link" href={href}>
      {children}
    </a>
  ) : (
    <Link className="ds-link" to={to}>
      {children}
    </Link>
  )
}

/** One thing to do (or a quiet "all good" when `done`). */
export function TodoRow({ icon: Icon, title, text, to, href, done }) {
  const body = (
    <>
      <span className="ds-well">
        <Icon width={19} height={19} />
      </span>
      <span className="ds-todo-text">
        <strong>{title}</strong>
        {text && <span className="note">{text}</span>}
      </span>
      {done ? <span className="ds-pill">All good</span> : <ChevronRight className="ds-go" width={18} height={18} />}
    </>
  )
  if (done || (!to && !href)) return <div className="ds-todo">{body}</div>
  return href ? (
    <a className="ds-todo is-link" href={href}>
      {body}
    </a>
  ) : (
    <Link className="ds-todo is-link" to={to}>
      {body}
    </Link>
  )
}

/** A status chip: tone '' (green), 'wait' (amber) or 'muted'. */
export function Chip({ tone = '', children }) {
  return <span className={`ds-pill${tone ? ` is-${tone}` : ''}`}>{children}</span>
}

/** Steps of an order, filled up to `at` (0-based). */
export function Track({ steps, at }) {
  return (
    <span className="ds-track" role="img" aria-label={`${steps[Math.max(at, 0)]}, step ${at + 1} of ${steps.length}`}>
      {steps.map((s, i) => (
        <i key={s} className={i <= at ? 'is-on' : ''} />
      ))}
    </span>
  )
}

// An average Swiss car emits about 0.17 kg CO2 per km driven (fleet average, including older cars).
const CAR_KG_PER_KM = 0.17

const HOW = { buying: 'by buying reused', selling: 'by selling', transporting: 'by transporting reused materials', platform: 'on Scan4Reuse' }

/** CO₂ that reuse saved: the figure, the material behind it, a car comparison and the last six months. */
export function Co2Card({ impact, scope, compact = false, what }) {
  if (!impact) return null
  const kg = impact.co2_saved_kg
  const months = impact.months ?? []
  const top = Math.max(...months.map((m) => m.co2_kg), 1)
  const km = Math.round(kg / CAR_KG_PER_KM / 100) * 100
  return (
    <section className={`dash-card ds-co2${compact ? ' is-compact' : ''}`} aria-label="CO₂ saved">
      <span className="ds-co2-ring">
        <span>
          <LeafIcon width={compact ? 22 : 26} height={compact ? 22 : 26} />
        </span>
      </span>
      <div className="ds-co2-text">
        <span className="ds-stat-label">CO₂ saved {HOW[scope ?? impact.scope] ?? ''}</span>
        <strong className="ds-co2-value">{tonnes(kg)}</strong>
        <span className="note">
          {kg > 0
            ? `${tonnes(impact.reused_kg)} of materials ${what ?? 'reused'}${km >= 100 ? ` · about the same as driving ${km.toLocaleString('de-CH')} km by car` : ''}`
            : 'Counts once your first order is delivered.'}
        </span>
      </div>
      {!compact && months.length > 0 && (
        <div className="ds-co2-bars" aria-hidden="true">
          <span className="note">Last six months</span>
          <div>
            {months.map((m, i) => (
              <i
                key={m.month}
                title={`${monthLabel(m.month)}: ${tonnes(m.co2_kg)}`}
                className={i === months.length - 1 ? 'is-now' : ''}
                style={{ height: `${Math.max((m.co2_kg / top) * 100, 8)}%` }}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

/** A smooth area chart of six months; hover or focus a month to read it. */
export function AreaChart({ months, value, format, detail }) {
  const [active, setActive] = useState(months.length - 1)
  // drawn at the size it is shown, so its labels stay readable on a phone
  const box = useRef(null)
  const [W, setW] = useState(760)
  useEffect(() => {
    const el = box.current
    if (!el || typeof ResizeObserver === 'undefined') return undefined
    const watch = new ResizeObserver(([entry]) => setW(Math.max(Math.round(entry.contentRect.width), 260)))
    watch.observe(el)
    return () => watch.disconnect()
  }, [])
  const H = W < 520 ? 190 : 230
  const pad = W < 520 ? 22 : 30
  const values = months.map(value)
  const top = Math.max(...values, 1) * 1.12
  const xy = values.map((v, i) => [pad + (i * (W - 2 * pad)) / Math.max(months.length - 1, 1), H - pad - (v / top) * (H - 2 * pad)])
  let d = `M${xy[0][0]} ${xy[0][1]}`
  for (let i = 1; i < xy.length; i += 1) {
    const [x0, y0] = xy[i - 1]
    const [x1, y1] = xy[i]
    const cx = (x0 + x1) / 2
    d += ` C${cx} ${y0}, ${cx} ${y1}, ${x1} ${y1}`
  }
  const [hx, hy] = xy[active]
  const tipX = Math.min(Math.max(hx - 74, 0), W - 148)
  const tipY = Math.max(hy - 64, 2)
  return (
    <div className="ds-area" ref={box}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${monthLabel(months[active].month, true)}: ${format(values[active])}`}>
        <defs>
          <linearGradient id="ds-area-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--green)" stopOpacity=".3" />
            <stop offset="1" stopColor="var(--green)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 1, 2, 3].map((i) => (
          <line key={i} className="ds-grid" x1={pad} x2={W - pad} y1={H - pad - i * ((H - 2 * pad) / 3)} y2={H - pad - i * ((H - 2 * pad) / 3)} />
        ))}
        <path className="ds-area-fill" d={`${d} L${xy[xy.length - 1][0]} ${H - pad} L${xy[0][0]} ${H - pad}Z`} fill="url(#ds-area-fill)" />
        <path className="ds-area-glow" d={d} />
        <path className="ds-area-line" d={d} />
        <line className="ds-area-cursor" x1={hx} x2={hx} y1={hy} y2={H - pad} />
        <circle className="ds-area-dot" cx={hx} cy={hy} r="8" />
        <g transform={`translate(${tipX},${tipY})`} className="ds-area-tip">
          <rect width="148" height="48" rx="13" />
          <text x="14" y="20" className="ds-area-tip-sub">
            {monthLabel(months[active].month, true)}
            {detail ? ` · ${detail(months[active])}` : ''}
          </text>
          <text x="14" y="38" className="ds-area-tip-value">
            {format(values[active])}
          </text>
        </g>
        {months.map((m, i) => (
          <text key={m.month} x={xy[i][0]} y={H - 8} textAnchor="middle" className="ds-axis">
            {monthLabel(m.month)}
          </text>
        ))}
      </svg>
      <div className="ds-area-hits">
        {months.map((m, i) => (
          <button
            key={m.month}
            type="button"
            aria-label={`${monthLabel(m.month, true)}: ${format(values[i])}`}
            aria-pressed={i === active}
            onMouseEnter={() => setActive(i)}
            onFocus={() => setActive(i)}
            onClick={() => setActive(i)}
          />
        ))}
      </div>
    </div>
  )
}

/** A ring split by part, with the total in the middle. */
export function Donut({ parts, label }) {
  const total = parts.reduce((s, p) => s + p.value, 0)
  const r = 54
  const c = 2 * Math.PI * r
  let offset = 0
  return (
    <svg className="ds-donut" viewBox="0 0 160 160" role="img" aria-label={`${total} ${label}`}>
      <circle cx="80" cy="80" r={r} className="ds-donut-track" />
      {total > 0 &&
        parts
          .filter((p) => p.value > 0)
          .map((p) => {
            const len = Math.max((p.value / total) * c - (parts.length > 1 ? 4 : 0), 1)
            const el = (
              <circle
                key={p.label}
                cx="80"
                cy="80"
                r={r}
                fill="none"
                stroke={p.color}
                strokeWidth="18"
                strokeLinecap="round"
                strokeDasharray={`${len} ${c - len}`}
                strokeDashoffset={-offset}
                transform="rotate(-90 80 80)"
              />
            )
            offset += (p.value / total) * c
            return el
          })}
      <text x="80" y="80" textAnchor="middle" className="ds-donut-total">
        {total}
      </text>
      <text x="80" y="99" textAnchor="middle" className="ds-donut-label">
        {label}
      </text>
    </svg>
  )
}

/** Vertical bars with names; the largest is solid green. */
export function Bars({ items, format }) {
  const top = Math.max(...items.map((i) => i.value), 1)
  const biggest = items.reduce((best, item, i) => (item.value > items[best].value ? i : best), 0)
  return (
    <div className="ds-bars">
      {items.map((item, i) => (
        <div key={item.label} className="ds-bar" title={`${item.label}: ${format(item.value)}`}>
          <span className="ds-bar-value">{format(item.value)}</span>
          <span className="ds-bar-track">
            <i className={i === biggest && item.value > 0 ? 'is-top' : ''} style={{ height: `${Math.max((item.value / top) * 100, 4)}%` }} />
          </span>
          <span className="ds-bar-name">{item.label}</span>
        </div>
      ))}
    </div>
  )
}

/** A progress bar. */
export function Meter({ value, max, label }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return (
    <span className="ds-meter" role="meter" aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} aria-label={label}>
      <i style={{ width: `${pct}%` }} />
    </span>
  )
}

/** Shapes that shimmer while a page loads. */
export function Skeleton({ w = '100%', h = 14, round, className = '' }) {
  return <span className={`ds-sk${round ? ' is-round' : ''} ${className}`} style={{ width: w, height: h }} aria-hidden="true" />
}

export function StatsSkeleton({ count = 4 }) {
  return (
    <div className="ds-stats">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="dash-card ds-stat">
          <div className="ds-stat-top">
            <Skeleton w={42} h={42} className="is-box" />
            <Skeleton w={90} h={28} />
          </div>
          <Skeleton w="55%" h={12} />
          <Skeleton w="80%" h={26} />
          <Skeleton w="45%" h={18} className="is-box" />
        </div>
      ))}
    </div>
  )
}

/** A whole overview's shape while it loads. */
export function OverviewSkeleton() {
  return (
    <div className="ds-skeleton" role="status" aria-label="Loading">
      <StatsSkeleton />
      <div className="ds-row ds-row-2">
        <div className="dash-card ds-panel">
          <Skeleton w={160} h={16} />
          <Skeleton w={110} h={11} />
          <Skeleton h={200} className="is-box" />
        </div>
        <div className="dash-card ds-panel">
          <Skeleton w={190} h={16} />
          <ListSkeleton rows={3} bare />
        </div>
      </div>
    </div>
  )
}

/** Rows of a list while it loads. */
export function ListSkeleton({ rows = 3, bare = false }) {
  const list = Array.from({ length: rows }, (_, i) => (
    <div key={i} className="ds-sk-row">
      <Skeleton w={44} h={44} className="is-box" />
      <span>
        <Skeleton w="70%" h={13} />
        <Skeleton w="45%" h={11} />
      </span>
    </div>
  ))
  if (bare) return <div className="ds-sk-list">{list}</div>
  return (
    <div className="dash-card ds-sk-list" role="status" aria-label="Loading">
      {list}
    </div>
  )
}

/** A page with nothing in it: what will appear here, and a next step. */
export function EmptyState({ icon: Icon, title, text, children }) {
  return (
    <div className="dash-card ds-empty">
      <span className="ds-empty-ring">
        <span>
          <Icon width={28} height={28} />
        </span>
      </span>
      <strong>{title}</strong>
      {text && <p>{text}</p>}
      {children && <div className="ds-empty-actions">{children}</div>}
    </div>
  )
}

/** A step of a setup list. */
export function Step({ done, to, children, n }) {
  const body = (
    <>
      <span className="ds-step-dot">{done ? <CheckIcon width={13} height={13} /> : n}</span>
      <span>{children}</span>
      {!done && to && <ChevronRight className="ds-go" width={18} height={18} />}
    </>
  )
  return !done && to ? (
    <Link to={to} className="ds-step">
      {body}
    </Link>
  ) : (
    <div className={`ds-step${done ? ' is-done' : ''}`}>{body}</div>
  )
}
