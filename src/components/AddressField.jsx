import { useEffect, useId, useRef, useState } from 'react'
import { searchAddress } from '../lib/geo'

/** A Swiss address, picked from geo.admin.ch suggestions so it always has coordinates.
 *  `value` is { address, city, canton, lat, lon } or null. */
export default function AddressField({ label, value, onChange, placeholder = 'Street, number, postcode, town', required = false }) {
  const [text, setText] = useState(value?.address ?? '')
  const [results, setResults] = useState([])
  const [error, setError] = useState('')
  const [open, setOpen] = useState(false)
  const timer = useRef(null)
  const listId = useId()

  useEffect(() => setText(value?.address ?? ''), [value?.address])

  const type = (next) => {
    setText(next)
    setOpen(true)
    if (value && next !== value.address) onChange(null)
    clearTimeout(timer.current)
    if (next.trim().length < 3) {
      setResults([])
      return
    }
    timer.current = setTimeout(async () => {
      try {
        setResults(await searchAddress(next))
        setError('')
      } catch (err) {
        setError(err.message)
      }
    }, 250)
  }

  const choose = (place) => {
    onChange(place)
    setText(place.address)
    setResults([])
    setOpen(false)
  }

  return (
    <div className="field address-field">
      <label className="field-label" htmlFor={`${listId}-input`}>
        {label}
      </label>
      <input
        id={`${listId}-input`}
        className="input"
        value={text}
        onChange={(e) => type(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
        autoComplete="off"
        role="combobox"
        aria-expanded={open && results.length > 0}
        aria-controls={listId}
        required={required}
      />
      {open && results.length > 0 && (
        <ul className="address-list" id={listId} role="listbox">
          {results.map((place) => (
            <li key={`${place.lat},${place.lon},${place.address}`} role="option" aria-selected="false">
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => choose(place)}>
                {place.address}
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && <span className="field-hint error">{error}</span>}
      {text && !value && !error && <span className="field-hint">Pick the address from the suggestions.</span>}
    </div>
  )
}
