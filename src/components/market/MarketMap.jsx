import 'maplibre-gl/dist/maplibre-gl.css'
import { useEffect, useRef, useState } from 'react'

// The marketplace on a real map: swisstopo's light base map, one point per published listing (at its town,
// rounded to about a kilometre), grouped into clusters until you zoom in.

const STYLE = 'https://vectortiles.geo.admin.ch/styles/ch.swisstopo.lightbasemap.vt/style.json'
const SWITZERLAND = [
  [5.95, 45.82],
  [10.49, 47.81],
]
// When swisstopo cannot be reached the points still show, on a plain background.
const FALLBACK = { version: 8, sources: {}, layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#eef3f1' } }] }
const GREEN = '#018058'
const GREEN_DARK = '#086748'

const toGeoJson = (listings, selectedId) => ({
  type: 'FeatureCollection',
  features: listings
    .filter((l) => Number.isFinite(l.lat) && Number.isFinite(l.lon))
    .map((l) => ({
      type: 'Feature',
      properties: { id: l.id, selected: l.id === selectedId ? 1 : 0 },
      geometry: { type: 'Point', coordinates: [l.lon, l.lat] },
    })),
})

export default function MarketMap({ listings, selectedId, onSelect, focus }) {
  const box = useRef(null)
  const mapRef = useRef(null)
  const latest = useRef({ listings, selectedId, onSelect })
  latest.current = { listings, selectedId, onSelect }
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState('')

  useEffect(() => {
    let cancelled = false
    let map = null
    ;(async () => {
      const mod = await import('maplibre-gl')
      if (cancelled || !box.current) return
      const ml = mod.default ?? mod
      try {
        map = new ml.Map({
          container: box.current,
          style: STYLE,
          bounds: SWITZERLAND,
          fitBoundsOptions: { padding: 24 },
          maxBounds: [
            [3.5, 44.8],
            [12.8, 48.9],
          ],
          attributionControl: { compact: true },
        })
      } catch {
        setFailed('This browser cannot show the map (WebGL is off). Use the list instead.')
        return
      }
      map.addControl(new ml.NavigationControl({ showCompass: false }), 'top-right')
      let loaded = false
      let fellBack = false
      map.on('load', () => {
        loaded = true
        const { listings: current, selectedId: selected } = latest.current
        map.addSource('listings', { type: 'geojson', data: toGeoJson(current, selected), cluster: true, clusterRadius: 44, clusterMaxZoom: 13 })
        map.addLayer({
          id: 'clusters',
          type: 'circle',
          source: 'listings',
          filter: ['has', 'point_count'],
          paint: {
            'circle-color': GREEN,
            'circle-opacity': 0.9,
            'circle-radius': ['step', ['get', 'point_count'], 16, 10, 21, 30, 27],
            'circle-stroke-color': '#ffffff',
            'circle-stroke-width': 3,
          },
        })
        if (!fellBack) {
          map.addLayer({
            id: 'cluster-count',
            type: 'symbol',
            source: 'listings',
            filter: ['has', 'point_count'],
            layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-size': 13, 'text-font': ['Frutiger Neue Bold'] },
            paint: { 'text-color': '#ffffff' },
          })
        }
        map.addLayer({
          id: 'points',
          type: 'circle',
          source: 'listings',
          filter: ['!', ['has', 'point_count']],
          paint: {
            'circle-color': ['case', ['==', ['get', 'selected'], 1], GREEN_DARK, GREEN],
            'circle-radius': ['case', ['==', ['get', 'selected'], 1], 11, 8],
            'circle-stroke-color': '#ffffff',
            'circle-stroke-width': 3,
          },
        })
        map.on('click', 'clusters', async (e) => {
          const feature = e.features[0]
          const zoom = await map.getSource('listings').getClusterExpansionZoom(feature.properties.cluster_id)
          map.easeTo({ center: feature.geometry.coordinates, zoom })
        })
        map.on('click', 'points', (e) => latest.current.onSelect(e.features[0].properties.id))
        for (const layer of ['clusters', 'points']) {
          map.on('mouseenter', layer, () => (map.getCanvas().style.cursor = 'pointer'))
          map.on('mouseleave', layer, () => (map.getCanvas().style.cursor = ''))
        }
        mapRef.current = map
        setReady(true)
      })
      map.on('error', () => {
        if (loaded || fellBack) return // a missing tile later on just leaves a gap
        fellBack = true
        map.setStyle(FALLBACK)
      })
    })()
    return () => {
      cancelled = true
      mapRef.current = null
      map?.remove()
    }
  }, [])

  // Keep the size right when the panel is shown again or the window changes.
  useEffect(() => {
    if (!box.current) return undefined
    const observer = new ResizeObserver(() => mapRef.current?.resize())
    observer.observe(box.current)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (ready) mapRef.current.getSource('listings')?.setData(toGeoJson(listings, selectedId))
  }, [ready, listings, selectedId])

  // Fly to a listing picked from the list, or to the person's position.
  useEffect(() => {
    if (ready && focus && Number.isFinite(focus.lat)) mapRef.current.easeTo({ center: [focus.lon, focus.lat], zoom: Math.max(mapRef.current.getZoom(), focus.zoom ?? 11) })
  }, [ready, focus])

  return (
    <div className="mapgl" ref={box} role="region" aria-label="Map of listings in Switzerland">
      {failed && <p className="map-empty">{failed}</p>}
    </div>
  )
}
