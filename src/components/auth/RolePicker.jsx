import { BagIcon, BuildingIcon, ScanIcon, ShieldIcon, TruckIcon } from '../Icons'

const ICONS = { buyer: BagIcon, corporate: BuildingIcon, seller: ScanIcon, logistics: TruckIcon, admin: ShieldIcon }

/** The roles people can sign up for, as cards; one is picked. The admin decides which roles are offered. */
export default function RolePicker({ roles, value, onChange }) {
  return (
    <fieldset className="role-picker">
      <legend className="field-label">I am a</legend>
      <div className="role-grid">
        {roles.map(({ role, name, text, kind }) => {
          const Icon = ICONS[kind ?? role] ?? BagIcon
          return (
            <label key={role} className={`role-card${value === role ? ' is-selected' : ''}`}>
              <input type="radio" name="role" value={role} checked={value === role} onChange={() => onChange(role)} className="sr-only" />
              <span className="role-icon">
                <Icon width={20} height={20} />
              </span>
              <span className="role-text">
                <strong>{name}</strong>
                {text && <span>{text}</span>}
              </span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
