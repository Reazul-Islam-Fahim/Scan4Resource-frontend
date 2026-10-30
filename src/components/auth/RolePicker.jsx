import { ROLES } from '../../lib/auth'
import { BagIcon, BuildingIcon, ScanIcon, ShieldIcon, TruckIcon } from '../Icons'

const ICONS = { buyer: BagIcon, corporate: BuildingIcon, seller: ScanIcon, logistics: TruckIcon, admin: ShieldIcon }

/** The five roles as cards; one is picked. Sign-up leaves admin out (admins are added by an admin). */
export default function RolePicker({ value, onChange, withAdmin = true }) {
  const roles = withAdmin ? ROLES : ROLES.filter((r) => r.role !== 'admin')
  return (
    <fieldset className="role-picker">
      <legend className="field-label">I am a</legend>
      <div className="role-grid">
        {roles.map(({ role, name, text }) => {
          const Icon = ICONS[role]
          return (
            <label key={role} className={`role-card${value === role ? ' is-selected' : ''}`}>
              <input type="radio" name="role" value={role} checked={value === role} onChange={() => onChange(role)} className="sr-only" />
              <span className="role-icon">
                <Icon width={20} height={20} />
              </span>
              <span className="role-text">
                <strong>{name}</strong>
                <span>{text}</span>
              </span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
