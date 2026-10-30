import { useCallback, useEffect, useState } from 'react'
import useAuth from '../../hooks/useAuth'
import { describeError } from '../../lib/api'
import { roleName } from '../../lib/auth'
import { decidePayout, fetchEarnings, fetchFinance, fetchPayouts, requestPayout } from '../../lib/financeApi'
import { formatMoney } from '../../lib/format'
import { formatDate } from './format'

// Money pages: a seller's balance and payouts, and the admin's commission and payout approvals.

function useLoad(load) {
  const { token } = useAuth()
  const [state, setState] = useState({ data: null, error: '' })
  const reload = useCallback(() => {
    load(token)
      .then((data) => setState({ data, error: '' }))
      .catch((err) => setState((s) => ({ ...s, error: err.detail || describeError(err) })))
  }, [token, load])
  useEffect(reload, [reload])
  return { ...state, reload, token }
}

const PAYOUT_STATUS = { requested: 'Waiting for approval', paid: 'Paid out', rejected: 'Rejected' }
const payoutTone = (status) => (status === 'paid' ? '' : status === 'requested' ? ' status-pending' : ' status-rejected')

function Stat({ label, value, note }) {
  return (
    <div className="dash-card dash-stat">
      <span className="note">{label}</span>
      <strong>{value}</strong>
      {note && <span className="note">{note}</span>}
    </div>
  )
}

export function SellerEarnings() {
  const { data, error, reload, token } = useLoad(fetchEarnings)
  const { status } = useAuth()
  const [form, setForm] = useState(null)
  const [state, setState] = useState({ busy: false, message: '', error: '' })

  useEffect(() => {
    if (data && !form) setForm({ amount: data.available_chf > 0 ? String(data.available_chf) : '', iban: data.bank?.iban || '', holder: data.bank?.holder || '' })
  }, [data, form])

  const submit = async (e) => {
    e.preventDefault()
    setState({ busy: true, message: '', error: '' })
    try {
      await requestPayout(token, { amount_chf: Number(form.amount), iban: form.iban, holder: form.holder })
      setState({ busy: false, message: 'Payout requested. The Scan4Reuse team checks it and sends the bank transfer.', error: '' })
      setForm((f) => ({ ...f, amount: '' }))
      reload()
    } catch (err) {
      setState({ busy: false, message: '', error: err.detail || describeError(err) })
    }
  }

  const canRequest = data && data.available_chf > 0 && status === 'active'
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  return (
    <section className="dash-section">
      <header>
        <h1 className="dash-title">Balance & payouts</h1>
        <p className="lede">
          Each sale is credited once it is delivered and paid, minus the {data?.commission_pct ?? 10}% Scan4Reuse commission. Request a payout to your Swiss bank account at any
          time.
        </p>
      </header>
      {error && <p className="error">{error}</p>}
      {data && (
        <>
          <div className="dash-stats">
            <Stat label="Available" value={formatMoney(data.available_chf)} note={data.requested_chf > 0 ? `${formatMoney(data.requested_chf)} requested` : null} />
            <Stat label="On its way" value={formatMoney(data.on_the_way_chf)} note="Paid by buyers, credited on delivery" />
            <Stat label="Earned so far" value={formatMoney(data.earned_chf)} note={`After ${formatMoney(data.commission_paid_chf)} commission`} />
          </div>

          {form && (
            <form className="dash-card dash-form" onSubmit={submit}>
              <h2 className="section-title">Request a payout</h2>
              <fieldset className="plain-fieldset" disabled={!canRequest}>
                <div className="field-row">
                  <label className="field">
                    <span className="field-label">Amount (CHF)</span>
                    <input className="input" type="number" min="1" step="0.01" max={data.available_chf} required value={form.amount} onChange={set('amount')} />
                  </label>
                  <label className="field">
                    <span className="field-label">IBAN</span>
                    <input className="input" required placeholder="CH93 0076 2011 6238 5295 7" value={form.iban} onChange={set('iban')} />
                  </label>
                </div>
                <label className="field">
                  <span className="field-label">Account holder</span>
                  <input className="input" required value={form.holder} onChange={set('holder')} />
                </label>
              </fieldset>
              {state.error && <p className="error">{state.error}</p>}
              {state.message && <p className="ok-box">{state.message}</p>}
              <button type="submit" className="btn btn-primary" disabled={state.busy || !canRequest}>
                {state.busy ? 'Sending…' : 'Request payout'}
              </button>
            </form>
          )}

          <div className="dash-card">
            <h2 className="section-title">History</h2>
            {data.entries.length === 0 && data.payouts.length === 0 ? (
              <p className="note">Nothing yet. Sales appear here once they are delivered and paid.</p>
            ) : (
              <div className="table-wrap">
                <table className="dash-table ledger">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>What</th>
                      <th className="num">Sale</th>
                      <th className="num">Commission</th>
                      <th className="num">You get</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.payouts
                      .filter((p) => p.status !== 'paid')
                      .map((p) => (
                        <tr key={p.id}>
                          <td>{formatDate(p.created_at)}</td>
                          <td>
                            Payout to …{p.iban.slice(-4)} <span className={`status-pill${payoutTone(p.status)}`}>{PAYOUT_STATUS[p.status]}</span>
                            {p.note && <span className="note block">{p.note}</span>}
                          </td>
                          <td />
                          <td />
                          <td className="num">{formatMoney(p.amount_chf)}</td>
                        </tr>
                      ))}
                    {data.entries.map((e) => (
                      <tr key={e.id}>
                        <td>{formatDate(e.created_at)}</td>
                        <td>{e.kind === 'payout' ? 'Payout (bank transfer)' : e.memo}</td>
                        <td className="num">{e.kind === 'payout' ? '' : formatMoney(e.gross_chf)}</td>
                        <td className="num">{e.kind === 'payout' ? '' : formatMoney(-e.fee_chf)}</td>
                        <td className="num">{formatMoney(e.amount_chf)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </section>
  )
}

const loadAdmin = (token) => Promise.all([fetchFinance(token), fetchPayouts(token)])

export function AdminPayouts() {
  const { data, error, reload, token } = useLoad(loadAdmin)
  const [notes, setNotes] = useState({})
  const [busy, setBusy] = useState('')
  const [failure, setFailure] = useState('')

  const decide = async (payout, status) => {
    if (status === 'paid' && !window.confirm(`Mark ${formatMoney(payout.amount_chf)} to ${payout.holder} as paid? Make the bank transfer first.`)) return
    setBusy(payout.id)
    setFailure('')
    try {
      await decidePayout(token, payout.id, status, notes[payout.id] || '')
      reload()
    } catch (err) {
      setFailure(err.detail || describeError(err))
    } finally {
      setBusy('')
    }
  }

  const [finance, payouts] = data ?? [null, []]
  const waiting = payouts.filter((p) => p.status === 'requested')
  const done = payouts.filter((p) => p.status !== 'requested')

  return (
    <section className="dash-section">
      <header>
        <h1 className="dash-title">Payments & payouts</h1>
        <p className="lede">
          Buyers pay by card through Stripe. Sellers and logistics companies are credited on delivery, minus {finance?.commission_pct ?? 10}% each, and request payouts here.
        </p>
      </header>
      {(error || failure) && <p className="error">{error || failure}</p>}
      {finance && (
        <div className="dash-stats">
          <Stat label="Paid by buyers" value={formatMoney(finance.paid_by_buyers_chf)} note={`${finance.paid_orders} order${finance.paid_orders === 1 ? '' : 's'}`} />
          <Stat label="Commission earned" value={formatMoney(finance.commission_chf)} />
          <Stat label="On its way" value={formatMoney(finance.on_the_way_chf)} note="Paid, not delivered yet" />
          <Stat label="Owed to sellers" value={formatMoney(finance.owed_sellers_chf)} />
          <Stat label="Owed to logistics" value={formatMoney(finance.owed_logistics_chf)} />
          <Stat label="Paid out" value={formatMoney(finance.paid_out_chf)} />
        </div>
      )}

      <h2 className="section-title">Waiting for approval</h2>
      {data && waiting.length === 0 && <p className="dash-card note">No payout requests.</p>}
      {waiting.map((p) => (
        <article key={p.id} className="dash-card verify-card">
          <div className="verify-head">
            <strong>
              {formatMoney(p.amount_chf)} to {p.company || p.name}
            </strong>
            <span className="badge-pill">{roleName(p.role)}</span>
          </div>
          <dl className="verify-facts">
            <dt>IBAN</dt>
            <dd>{p.iban.replace(/(.{4})/g, '$1 ').trim()}</dd>
            <dt>Holder</dt>
            <dd>{p.holder}</dd>
            <dt>Contact</dt>
            <dd>
              {p.name} · {p.email}
            </dd>
            <dt>Balance</dt>
            <dd>{formatMoney(p.balance_chf)}</dd>
            <dt>Requested</dt>
            <dd>{formatDate(p.created_at, true)}</dd>
          </dl>
          <label className="field">
            Note (shown to them)
            <input className="input" value={notes[p.id] || ''} onChange={(e) => setNotes((n) => ({ ...n, [p.id]: e.target.value }))} />
          </label>
          <div className="row-actions">
            <button type="button" className="btn btn-primary" disabled={busy === p.id} onClick={() => decide(p, 'paid')}>
              Transfer made: mark paid
            </button>
            <button type="button" className="btn btn-outline" disabled={busy === p.id} onClick={() => decide(p, 'rejected')}>
              Reject
            </button>
          </div>
        </article>
      ))}

      {done.length > 0 && (
        <div className="dash-card">
          <h2 className="section-title">Decided</h2>
          <div className="table-wrap">
            <table className="dash-table ledger">
              <thead>
                <tr>
                  <th>Requested</th>
                  <th>Who</th>
                  <th>Status</th>
                  <th className="num">Amount</th>
                </tr>
              </thead>
              <tbody>
                {done.map((p) => (
                  <tr key={p.id}>
                    <td>{formatDate(p.created_at)}</td>
                    <td>
                      {p.company || p.name}
                      {p.note && <span className="note block">{p.note}</span>}
                    </td>
                    <td>
                      <span className={`status-pill${payoutTone(p.status)}`}>{PAYOUT_STATUS[p.status]}</span>
                    </td>
                    <td className="num">{formatMoney(p.amount_chf)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {finance && finance.recent_payments.length > 0 && (
        <div className="dash-card">
          <h2 className="section-title">Latest payments</h2>
          <div className="table-wrap">
            <table className="dash-table ledger">
              <thead>
                <tr>
                  <th>Paid</th>
                  <th className="num">Materials</th>
                  <th className="num">Delivery</th>
                  <th className="num">Total</th>
                </tr>
              </thead>
              <tbody>
                {finance.recent_payments.map((p) => (
                  <tr key={p.order_id}>
                    <td>
                      {formatDate(p.paid_at, true)}
                      {p.test && <span className="note"> · test</span>}
                    </td>
                    <td className="num">{formatMoney(p.goods_chf)}</td>
                    <td className="num">{formatMoney(p.delivery_chf)}</td>
                    <td className="num">{formatMoney(p.amount_chf)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  )
}
