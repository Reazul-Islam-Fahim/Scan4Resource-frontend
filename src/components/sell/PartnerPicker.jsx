/** Which verified logistics companies may pick up this seller's materials. None picked = any of them. */
export default function PartnerPicker({ list, chosen, onChange }) {
  if (list === null) return <p className="note">Loading logistics companies…</p>
  if (list.length === 0)
    return <p className="note">No logistics company is verified yet. Any company that joins can offer to deliver your listings.</p>
  const toggle = (id) => onChange(chosen.includes(id) ? chosen.filter((x) => x !== id) : [...chosen, id])
  return (
    <>
      <p className="note">Only the companies you tick are asked for a delivery price. Leave all unticked to let every verified company offer.</p>
      <ul className="partner-list">
        {list.map((p) => (
          <li key={p.id}>
            <label className="switch-line">
              <input type="checkbox" checked={chosen.includes(p.id)} onChange={() => toggle(p.id)} />
              <span>
                <strong>{p.name}</strong>
                {p.city && <span className="note"> · {p.city}</span>}
              </span>
            </label>
          </li>
        ))}
      </ul>
    </>
  )
}
