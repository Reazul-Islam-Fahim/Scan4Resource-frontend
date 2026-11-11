import { useEffect, useRef, useState } from 'react'
import { CHANGED } from '../../lib/api'
import { CheckIcon } from '../Icons'

// A short note in the corner after something is saved ("Listing published"). It listens for the event every
// successful change sends (lib/api.js) and names the change from its address; other changes say "Saved".

const SAID = [
  [/^POST \/market\/listings\/bulk$/, 'Listings created', 'They are drafts until you publish them'],
  [/^POST \/market\/listings\/[^/]+\/publish$/, 'Listing published', 'Buyers can see it now'],
  [/^POST \/market\/listings\/[^/]+\/withdraw$/, 'Listing withdrawn', 'It is no longer on the marketplace'],
  [/^PATCH \/market\/listings\//, 'Listing saved'],
  [/^DELETE \/market\/listings\//, 'Listing deleted'],
  [/^PUT \/market\/seller$/, 'Pickup and partners saved', 'New listings use these settings'],
  [/^POST \/market\/orders\/[^/]+\/cancel$/, 'Order cancelled', 'The materials are back on sale'],
  [/^POST \/market\/orders$/, 'Order placed'],
  [/^POST \/payouts$/, 'Payout requested', 'The Scan4Reuse team pays it to your bank'],
  [/^POST \/admin\/payouts\//, 'Payout updated'],
  [/^PUT \/admin\/commission$/, 'Commission saved', 'It applies to orders paid from now on'],
  [/^POST \/admin\/orders\/[^/]+\/cancel$/, 'Order cancelled'],
  [/^POST \/admin\/users$/, 'Account added'],
  [/^POST \/admin\/users\/[^/]+\/roles\//, 'Verification saved'],
  [/^PUT \/admin\/users\/[^/]+\/role$/, 'Role changed', 'It applies at their next login'],
  [/^POST \/admin\/roles$/, 'Role created'],
  [/^PATCH \/admin\/roles\//, 'Role saved'],
  [/^DELETE \/admin\/roles\//, 'Role deleted'],
  [/^POST \/tenders$/, 'Tender saved'],
  [/^PATCH \/tenders\//, 'Tender saved'],
  [/^DELETE \/tenders\//, 'Tender deleted'],
  [/^POST \/tenders\/[^/]+\/publish$/, 'Tender published', 'Sellers near the site are invited'],
  [/^POST \/tenders\/[^/]+\/close$/, 'Tender closed', 'Compare the bids and award'],
  [/^POST \/tenders\/[^/]+\/cancel$/, 'Tender cancelled'],
  [/^POST \/tenders\/[^/]+\/award$/, 'Tender awarded', 'The winning bids became orders'],
  [/^PUT \/tenders\/[^/]+\/bid$/, 'Bid sent'],
  [/^POST \/bids\/[^/]+\/withdraw$/, 'Bid withdrawn'],
]
const QUIET = [/^POST \/scans/, /^POST \/reconstructions/, /^POST \/detect/] // uploads show their own progress

export function describeChange(method, path) {
  const key = `${method} ${path.split('?')[0]}`
  if (QUIET.some((re) => re.test(key))) return null
  const found = SAID.find(([re]) => re.test(key))
  return found ? { title: found[1], text: found[2] ?? '' } : { title: 'Saved', text: '' }
}

const SHOW_MS = 3800

export default function Toasts() {
  const [toasts, setToasts] = useState([])
  const next = useRef(0)
  useEffect(() => {
    const onChange = (event) => {
      const { method, path } = event.detail ?? {}
      if (!method || !path) return
      const said = describeChange(method, path)
      if (!said) return
      const id = (next.current += 1)
      setToasts((list) => [...list.filter((t) => t.title !== said.title).slice(-2), { id, ...said }])
      setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), SHOW_MS)
    }
    window.addEventListener(CHANGED, onChange)
    return () => window.removeEventListener(CHANGED, onChange)
  }, [])
  return (
    <div className="ds-toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className="ds-toast">
          <span className="ds-toast-ok">
            <CheckIcon width={15} height={15} />
          </span>
          <span>
            <strong>{t.title}</strong>
            {t.text && <span className="note">{t.text}</span>}
          </span>
        </div>
      ))}
    </div>
  )
}
