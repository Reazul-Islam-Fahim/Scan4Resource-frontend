import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import useAuth from '../hooks/useAuth'
import useCart from '../hooks/useCart'
import { describeError } from '../lib/api'
import { formatPrice } from '../lib/format'
import { placeOrder } from '../lib/marketApi'
import AddressField from './AddressField'
import { MinusIcon, PlusIcon, TrashIcon, TruckIcon } from './Icons'
import MaterialImage from './MaterialImage'
import PageHeader from './PageHeader'

const BUYER_ROLES = ['buyer', 'corporate']

/** The cart, grouped by seller, and the order: materials are reserved, delivery is booked next. */
export default function Cart() {
  const cart = useCart()
  const auth = useAuth()
  const navigate = useNavigate()
  const [delivery, setDelivery] = useState(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const sellers = [...new Set(cart.lines.map((line) => line.seller))]
  const canBuy = auth.loggedIn && BUYER_ROLES.includes(auth.role)
  const heldBuyerRole = auth.loggedIn && auth.user.roles.find((r) => BUYER_ROLES.includes(r.role) && r.status === 'active')

  const order = async (e) => {
    e.preventDefault()
    if (!delivery) return setError('Pick the delivery address from the suggestions.')
    setBusy(true)
    setError('')
    try {
      await placeOrder(auth.token, {
        items: cart.lines.map((line) => ({ listing_id: line.id, quantity: line.quantity })),
        delivery,
        note,
      })
      cart.clear()
      navigate('/dashboard/orders', { state: { placed: true } })
    } catch (err) {
      setError(err.detail || describeError(err))
      setBusy(false)
    }
  }

  const step = (line) => (line.unit === 'm2' ? 0.5 : 1)

  return (
    <section className="flow cart">
      <PageHeader title="Cart" badge={cart.count || undefined} onBack={() => navigate(-1)} />
      {cart.count === 0 ? (
        <div className="empty empty-center">
          <p className="lede">Your cart is empty.</p>
          <Link to="/market" className="btn btn-secondary">
            Browse the marketplace
          </Link>
        </div>
      ) : (
        <form className="stack" onSubmit={order}>
          {sellers.map((seller) => (
            <div key={seller} className="dash-card cart-group">
              <h2 className="section-title">{seller}</h2>
              <ul className="order-lines">
                {cart.lines
                  .filter((line) => line.seller === seller)
                  .map((line) => (
                    <li key={line.id}>
                      <MaterialImage kind={line.category} src={line.image} alt="" className="order-thumb" />
                      <span>
                        <strong>{line.name}</strong>
                        <span className="note">
                          {formatPrice(line.price)} / {line.priceUnit} · from {line.city}
                        </span>
                        <span className="stepper stepper-sm" role="group" aria-label={`Quantity of ${line.name}`}>
                          <button type="button" className="icon-btn" onClick={() => cart.setQuantity(line.id, line.quantity - step(line))} aria-label="Fewer">
                            <MinusIcon />
                          </button>
                          <output>{line.unit === 'm2' ? `${line.quantity} m²` : line.quantity}</output>
                          <button
                            type="button"
                            className="icon-btn"
                            onClick={() => cart.setQuantity(line.id, line.quantity + step(line))}
                            disabled={line.available !== undefined && line.quantity + step(line) > line.available}
                            aria-label="More"
                          >
                            <PlusIcon />
                          </button>
                          <button type="button" className="icon-btn" onClick={() => cart.remove(line.id)} aria-label={`Remove ${line.name}`}>
                            <TrashIcon />
                          </button>
                        </span>
                      </span>
                      <span className="order-price">{formatPrice(line.price * line.quantity)}</span>
                    </li>
                  ))}
              </ul>
            </div>
          ))}

          <div className="dash-card dash-form">
            <h2 className="section-title">Delivery</h2>
            <AddressField label="Deliver to" value={delivery} onChange={setDelivery} required />
            <label className="field">
              <span className="field-label">Note for the seller and the driver (optional)</span>
              <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Site access, opening hours, crane on site…" />
            </label>
            <p className="hint-box">
              <TruckIcon width={18} height={18} />
              <span>The delivery price is added in the next step, when logistics companies offer to bring your order from {sellers.length > 1 ? `${sellers.length} sellers` : 'the seller'}.</span>
            </p>
          </div>

          <div className="dash-card order-total">
            <span>Materials</span>
            <strong>{formatPrice(cart.total)}</strong>
          </div>

          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          {canBuy ? (
            <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
              {busy ? 'Placing the order…' : 'Order and reserve the materials'}
            </button>
          ) : heldBuyerRole ? (
            <button type="button" className="btn btn-primary btn-block" onClick={() => auth.switchRole(heldBuyerRole.role)}>
              Switch to your buyer role to order
            </button>
          ) : (
            <button type="button" className="btn btn-primary btn-block" onClick={() => navigate('/login?role=buyer&next=/cart')}>
              Log in as a buyer to order
            </button>
          )}
        </form>
      )}
    </section>
  )
}
