import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useCart from '../../hooks/useCart'
import { formatPrice, plural } from '../../lib/format'
import { cantonName } from '../../lib/swiss'
import { MinusIcon, PinIcon, PlusIcon, TruckIcon } from '../Icons'
import MaterialImage from '../MaterialImage'
import Sheet from '../Sheet'

const qtyText = (q, unit) => (unit === 'm2' ? `${q} m²` : plural(q, 'piece'))
const day = (iso) => (iso ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(iso)) : '')

/** A listing's details, and how many to put in the cart. */
export default function ListingSheet({ listing, onClose, demo = false }) {
  const navigate = useNavigate()
  const cart = useCart()
  const inCart = cart.lines.find((line) => line.id === listing.id)?.quantity ?? 0
  const left = Math.max(0, (listing.available ?? 0) - inCart)
  const step = listing.unit === 'm2' ? 0.5 : 1
  const [quantity, setQuantity] = useState(Math.min(step, left) || step)
  const [added, setAdded] = useState(false)
  const size = [listing.widthCm, listing.heightCm, listing.depthCm].filter(Number.isFinite).map(Math.round)

  const add = () => {
    cart.add(listing, quantity)
    setAdded(true)
  }

  return (
    <Sheet
      title={listing.name}
      onClose={onClose}
      footer={
        demo ? (
          <p className="sheet-note">This is a sample listing. Connect the app to the Scan4Reuse API to buy.</p>
        ) : added ? (
          <div className="listing-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Keep browsing
            </button>
            <button type="button" className="btn btn-primary" onClick={() => navigate('/cart')}>
              Go to cart
            </button>
          </div>
        ) : (
          <div className="listing-actions">
            <div className="stepper" role="group" aria-label="Quantity">
              <button type="button" className="icon-btn" onClick={() => setQuantity((q) => Math.max(step, q - step))} disabled={quantity <= step} aria-label="Fewer">
                <MinusIcon />
              </button>
              <output aria-live="polite">{listing.unit === 'm2' ? `${quantity} m²` : quantity}</output>
              <button type="button" className="icon-btn" onClick={() => setQuantity((q) => Math.min(left, q + step))} disabled={quantity + step > left} aria-label="More">
                <PlusIcon />
              </button>
            </div>
            <button type="button" className="btn btn-primary" onClick={add} disabled={left <= 0}>
              {left <= 0 ? 'All in your cart' : `Add · ${formatPrice(listing.price * quantity)}`}
            </button>
          </div>
        )
      }
    >
      <MaterialImage kind={listing.category} src={listing.image} alt={listing.name} className="listing-photo" />
      <p className="listing-price">
        {formatPrice(listing.price)} <span className="note">/ {listing.priceUnit}</span>
      </p>
      <dl className="listing-facts">
        <div>
          <dt>Seller</dt>
          <dd>{listing.seller}</dd>
        </div>
        <div>
          <dt>Pickup</dt>
          <dd>
            <PinIcon width={15} height={15} /> {listing.city}
            {listing.canton ? `, ${cantonName(listing.canton)}` : ''} · {Math.max(1, Math.round(listing.distanceKm))} km away
          </dd>
        </div>
        {!demo && (
          <div>
            <dt>Available</dt>
            <dd>
              {qtyText(listing.available, listing.unit)}
              {inCart > 0 && <span className="note"> · {qtyText(inCart, listing.unit)} in your cart</span>}
            </dd>
          </div>
        )}
        {listing.sub && (
          <div>
            <dt>Material</dt>
            <dd>{listing.sub}</dd>
          </div>
        )}
        {size.length > 0 && (
          <div>
            <dt>Size</dt>
            <dd>{size.join(' × ')} cm</dd>
          </div>
        )}
        {Number.isFinite(listing.weightKg) && (
          <div>
            <dt>Weight</dt>
            <dd>{Math.round(listing.weightKg)} kg each</dd>
          </div>
        )}
        {(listing.availableFrom || listing.availableUntil) && (
          <div>
            <dt>Pickup window</dt>
            <dd>
              {listing.availableFrom ? day(listing.availableFrom) : 'Now'} – {listing.availableUntil ? day(listing.availableUntil) : 'open'}
            </dd>
          </div>
        )}
      </dl>
      {listing.description && <p className="listing-desc">{listing.description}</p>}
      {!demo && (
        <p className="hint-box">
          <TruckIcon width={18} height={18} />
          <span>
            Delivery is arranged after you order: {listing.partnerCount > 0 ? plural(listing.partnerCount, 'logistics partner') : 'logistics companies'} offer a price
            for the trip from {listing.city}.
          </span>
        </p>
      )}
    </Sheet>
  )
}
