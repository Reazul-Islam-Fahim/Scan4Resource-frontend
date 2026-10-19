// CO2 savings and resale value of one item, from its kind, size, material and condition.
//
// CO2 savings = the greenhouse gas emissions of making a new replacement, which reuse avoids.
// The factors are the production ("Herstellung") column of the Swiss KBOB list, Ökobilanzdaten im
// Baubereich 2009/1:2014 (kg CO2-eq). Doors and windows use KBOB's own per-m² elements; everything else
// is estimated weight × KBOB factor of its material.
//
// Resale value = typical new price × the share a reused item fetches in its condition. The new prices
// are rough Swiss retail averages, not market data: replace them with real sales once there are some.

const cm2m = (cm) => (Number.isFinite(cm) && cm > 0 ? cm / 100 : null)

// KBOB, kg CO2-eq per kg of material (production).
const PER_KG = {
  wood: 0.4, // 07.014 Spanplatte (most furniture is board); solid timber 07.010 is 0.105
  metal: 1.83, // 06.010 Stahlblech
  aluminium: 8.25, // 06.001 Aluminiumblech
  glass: 0.976, // 03.006 Flachglas
  pvc: 2.38, // 13.004 PVC
  plastic: 2.38, // as PVC
  composite: 0.65, // 07.012 MDF
  ceramic: 0.77, // 03.010 Keramik-/Steinzeugplatte
  stone: 0.0662, // 03.017 Kalkstein
  concrete: 0.0867, // 01.009 Hochbaubeton
  clay: 0.238, // 02.001 Backstein
  fabric: 2.0, // not in KBOB: an assumption for upholstery (foam and textile)
}

// KBOB per m² of door leaf (12.003 Innentür Holz, 12.004 mit Glaseinsatz, 12.001 Aussentür aluminiumbeplankt).
const DOOR_PER_M2 = { wood: 35.8, glass: 47.3, metal: 83.7 }
// KBOB per m² of window frame (05.005 Holz, 05.004 Aluminium, 05.006 Holz-Aluminium, 05.007 Kunststoff)
// and of glazing (05.001 2-fach-Verglasung). A frame is taken as 30% of the window's area.
const FRAME_PER_M2 = { wood: 125, metal: 450, composite: 230, pvc: 244, plastic: 244 }
const GLAZING_PER_M2 = 30.5
const FRAME_SHARE = 0.3

// Share of the new price a reused item fetches, by the condition set on the review screen.
const RESALE_SHARE = { good: 0.4, fair: 0.25, poor: 0.1 }
const RESALE_SHARE_UNSET = 0.3

// Objects measured in the scan: a typical size [width, height, depth] in cm, weight in kg, main material and new
// price in CHF. A scanned object's weight is the typical weight scaled by its size (within 0.4x to 2.5x).
const OBJECTS = {
  chair: { size: [45, 85, 50], kg: 6, material: 'wood', price: 150 },
  armchair: { size: [80, 90, 85], kg: 20, material: 'fabric', price: 500 },
  sofa: { size: [200, 85, 90], kg: 45, material: 'fabric', price: 1200 },
  table: { size: [140, 75, 80], kg: 30, material: 'wood', price: 500 },
  cabinet: { size: [80, 90, 45], kg: 40, material: 'wood', price: 500 },
  wardrobe: { size: [100, 200, 60], kg: 70, material: 'wood', price: 900 },
  shelf: { size: [80, 180, 30], kg: 20, material: 'wood', price: 200 },
  bed: { size: [160, 50, 205], kg: 50, material: 'wood', price: 700 },
  lamp: { size: [30, 50, 30], kg: 3, material: 'metal', price: 100 },
  mirror: { size: [60, 80, 3], kg: 8, material: 'glass', price: 120 },
  radiator: { size: [100, 60, 10], kg: 30, material: 'metal', price: 400 },
  sink: { size: [60, 20, 45], kg: 20, material: 'ceramic', price: 250 },
  toilet: { size: [40, 75, 65], kg: 25, material: 'ceramic', price: 350 },
  bathtub: { size: [170, 55, 75], kg: 40, material: 'metal', price: 600 },
}
const OTHER = { size: null, kg: 10, material: 'wood', price: 50 }

// Building materials, per piece or per m²: weight in kg, material, new price in CHF.
const BUILDING = {
  bricks: { kg: 2.5, material: 'clay', price: 1.5 },
  concrete_beams: { kg: 600, material: 'concrete', price: 300 }, // about 0.25 m³
  wooden_beams: { kg: 18, material: 'wood', perKg: 0.105, price: 120 }, // about 0.04 m³ of solid timber (07.010)
  floor_tiles: { kg: 20, material: 'ceramic', price: 50 }, // per m²
  stone_slabs: { kg: 78, material: 'stone', price: 120 }, // per m², 3 cm
}

const known = (material, fallback) => (material && material !== 'unknown' ? material : fallback)
const resaleShare = (condition) => RESALE_SHARE[condition] ?? RESALE_SHARE_UNSET
const clamp = (value, lo, hi) => Math.min(hi, Math.max(lo, value))
const quantityOf = (item) => (Number.isFinite(item.quantity) && item.quantity > 0 ? item.quantity : 1)

function door(item) {
  const material = known(item.material, 'wood')
  const area = (cm2m(item.widthCm) ?? 0.9) * (cm2m(item.heightCm) ?? 2.0)
  const perM2 = DOOR_PER_M2[material] ?? DOOR_PER_M2.wood
  const pricePerM2 = material === 'metal' ? 400 : material === 'glass' ? 350 : 250
  return { co2Kg: area * perM2, newPrice: area * pricePerM2 }
}

function window_(item) {
  const material = known(item.material, 'wood')
  const area = (cm2m(item.widthCm) ?? 1.2) * (cm2m(item.heightCm) ?? 1.2)
  const frame = FRAME_PER_M2[material] ?? FRAME_PER_M2.wood
  return { co2Kg: area * (FRAME_SHARE * frame + (1 - FRAME_SHARE) * GLAZING_PER_M2), newPrice: area * 700 }
}

function object(item, entry) {
  const material = known(item.material, entry.material)
  let scale = 1
  const dims = [item.widthCm, item.heightCm, item.depthCm]
  if (entry.size && dims.every((d) => Number.isFinite(d) && d > 0)) {
    const volume = dims[0] * dims[1] * dims[2]
    const typical = entry.size[0] * entry.size[1] * entry.size[2]
    scale = clamp(volume / typical, 0.4, 2.5)
  }
  const kg = entry.kg * scale
  return { co2Kg: kg * (PER_KG[material] ?? PER_KG[entry.material]), newPrice: entry.price }
}

function building(item, entry) {
  const material = known(item.material, entry.material)
  const perKg = material === entry.material && entry.perKg ? entry.perKg : (PER_KG[material] ?? PER_KG[entry.material])
  return { co2Kg: entry.kg * perKg, newPrice: entry.price }
}

/** CO2 savings (kg CO2-eq) and resale value (CHF) of one item, for its whole quantity. */
export function itemImpact(item) {
  let one
  if (item.label === 'doors') one = door(item)
  else if (item.label === 'window_frames') one = window_(item)
  else if (BUILDING[item.label]) one = building(item, BUILDING[item.label])
  else one = object(item, OBJECTS[item.label] ?? OTHER)

  const quantity = quantityOf(item)
  return {
    co2Kg: one.co2Kg * quantity,
    resale: one.newPrice * resaleShare(item.condition) * quantity,
  }
}

export const METHOD_NOTE =
  'CO2 savings: emissions of making new replacements, from each item\'s size and material (Swiss KBOB list 2009/1:2014). ' +
  'Resale value: typical new price x share by condition (good 40%, fair 25%, poor 10%, not set 30%). Both are estimates.'
