// The materials the app knows about. Listing prices and places are illustrative: they drive the sample
// marketplace. CO2 and resale values of scanned items are calculated in impact.js.

export const CATALOG = {
  bricks: {
    name: 'Bricks', market: 'Reclaimed bricks', category: 'bricks', unit: 'pc', priceUnit: 'pc',
    material: 'Clay', listUnit: 0.5, city: 'Zürich',
    aliases: ['brick'],
  },
  concrete_beams: {
    name: 'Concrete beams', market: 'Concrete beams', category: 'concrete', unit: 'pc', priceUnit: 'piece',
    material: 'Reinforced concrete', listUnit: 80, city: 'Basel',
    aliases: ['concrete', 'concrete_beam'],
  },
  wooden_beams: {
    name: 'Wooden beams', market: 'Wooden beams', category: 'wood', unit: 'pc', priceUnit: 'piece',
    material: 'Solid wood', listUnit: 40, city: 'Bern',
    aliases: ['wooden_beam', 'wood_beam', 'timber', 'beam', 'beams'],
  },
  window_frames: {
    name: 'Window frames', market: 'Window frames', category: 'windows', unit: 'pc', priceUnit: 'piece',
    material: 'Wood', marketSub: 'Wood, double glazing', listUnit: 120, city: 'Lucerne',
    aliases: ['window', 'windows', 'window_frame'],
  },
  doors: {
    name: 'Doors', market: 'Doors', category: 'doors', unit: 'pc', priceUnit: 'piece',
    material: 'Wood', listUnit: 90, city: 'Winterthur',
    aliases: ['door', 'glass_door', 'glass_doors'],
  },
  floor_tiles: {
    name: 'Floor tiles', market: 'Floor tiles', category: 'tiles', unit: 'm2', priceUnit: 'm²',
    material: 'Ceramic', listUnit: 22, city: 'Lugano',
    aliases: ['tile', 'tiles', 'floor_tile', 'ceramic_tile'],
  },
  stone_slabs: {
    name: 'Stone slabs', market: 'Stone slabs', category: 'stone', unit: 'm2', priceUnit: 'm²',
    material: 'Natural stone', listUnit: 25, city: 'St. Gallen',
    aliases: ['stone', 'stone_slab'],
  },
}

// Category chips of the marketplace, in display order.
export const CATEGORIES = [
  ['all', 'All'],
  ['bricks', 'Bricks'],
  ['concrete', 'Concrete'],
  ['wood', 'Wood'],
  ['windows', 'Windows'],
  ['doors', 'Doors'],
  ['tiles', 'Tiles'],
  ['stone', 'Stone'],
  ['steel', 'Steel'],
]

const titleCase = (text) => text.replace(/\b\w/g, (c) => c.toUpperCase())

/** Map whatever label the backend sends ("door", "Window frame", ...) onto a catalog key. */
export function resolveLabel(raw) {
  const norm = String(raw ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_')
  if (!norm) return 'unknown'
  if (CATALOG[norm]) return norm
  for (const [key, entry] of Object.entries(CATALOG)) {
    if (entry.aliases.includes(norm)) return key
  }
  return norm
}

export function catalogFor(label) {
  if (CATALOG[label]) return CATALOG[label]
  const name = titleCase(String(label || 'unknown').replace(/_/g, ' '))
  return {
    name, market: name, category: 'other', unit: 'pc', priceUnit: 'piece',
    material: '', listUnit: 20, city: 'Zürich', aliases: [],
  }
}

export const catalogOrder = (label) => {
  const index = Object.keys(CATALOG).indexOf(label)
  return index === -1 ? 999 : index
}
