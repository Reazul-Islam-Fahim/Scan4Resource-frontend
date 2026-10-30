import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

// The cart lives in this browser (localStorage) until the order is placed; the backend checks stock and
// prices again when it is.

const KEY = 's4r.cart'
const CartContext = createContext(null)

function loadCart() {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) || '[]')
    return Array.isArray(list) ? list.filter((line) => line?.id && line.quantity > 0) : []
  } catch {
    return []
  }
}

/** What a cart line keeps of a listing, so the cart can be shown without asking the server. */
const snapshot = (card) => ({
  id: card.id,
  name: card.name,
  sub: card.sub,
  category: card.category,
  image: card.image,
  city: card.city,
  seller: card.seller,
  price: card.price,
  unit: card.unit,
  priceUnit: card.priceUnit,
  available: card.available,
})

export function CartProvider({ children }) {
  const [lines, setLines] = useState(loadCart)

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(lines))
    } catch {
      // private mode: the cart lasts until the tab is closed
    }
  }, [lines])

  const add = useCallback((card, quantity) => {
    setLines((current) => {
      const existing = current.find((line) => line.id === card.id)
      const total = Math.min(card.available ?? Infinity, (existing?.quantity ?? 0) + quantity)
      const line = { ...snapshot(card), quantity: total }
      return existing ? current.map((l) => (l.id === card.id ? line : l)) : [...current, line]
    })
  }, [])
  const setQuantity = useCallback(
    (id, quantity) => setLines((current) => current.map((line) => (line.id === id ? { ...line, quantity: Math.max(0, quantity) } : line)).filter((l) => l.quantity > 0)),
    [],
  )
  const remove = useCallback((id) => setLines((current) => current.filter((line) => line.id !== id)), [])
  const clear = useCallback(() => setLines([]), [])

  const value = useMemo(
    () => ({
      lines,
      count: lines.length,
      total: Math.round(lines.reduce((sum, line) => sum + line.price * line.quantity, 0) * 100) / 100,
      add,
      setQuantity,
      remove,
      clear,
    }),
    [lines, add, setQuantity, remove, clear],
  )
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export default function useCart() {
  return useContext(CartContext)
}
