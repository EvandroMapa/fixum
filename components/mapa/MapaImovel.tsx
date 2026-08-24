'use client'

import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || ''

interface Props {
  lat: number | string | null | undefined
  lng: number | string | null | undefined
  titulo: string
  publico?: boolean
}

export default function MapaImovel({ lat, lng, titulo, publico = true }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapaRef = useRef<mapboxgl.Map | null>(null)

  const numLat = typeof lat === 'string' ? parseFloat(lat) : Number(lat)
  const numLng = typeof lng === 'string' ? parseFloat(lng) : Number(lng)

  const coordenadasValidas =
    !isNaN(numLat) &&
    !isNaN(numLng) &&
    (numLat !== 0 || numLng !== 0) &&
    numLat >= -90 &&
    numLat <= 90 &&
    numLng >= -180 &&
    numLng <= 180

  const finalLat = coordenadasValidas ? numLat : -21.135
  const finalLng = coordenadasValidas ? numLng : -44.260

  useEffect(() => {
    if (!containerRef.current || mapaRef.current) return

    const mapa = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [finalLng, finalLat],
      zoom: publico ? 15 : 13,
      interactive: true,
      attributionControl: false,
    })

    mapa.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right')

    mapa.on('load', () => {
      mapa.resize()

      if (coordenadasValidas) {
        if (publico) {
          // Marcador preciso
          new mapboxgl.Marker({ color: '#0f4c81' })
            .setLngLat([finalLng, finalLat])
            .setPopup(new mapboxgl.Popup({ offset: 25 }).setText(titulo))
            .addTo(mapa)
        } else {
          // Círculo aproximado (privacidade)
          mapa.addSource('area-aproximada', {
            type: 'geojson',
            data: {
              type: 'Feature',
              geometry: { type: 'Point', coordinates: [finalLng, finalLat] },
              properties: {},
            },
          })

          mapa.addLayer({
            id: 'area-aproximada-fill',
            type: 'circle',
            source: 'area-aproximada',
            paint: {
              'circle-radius': 80,
              'circle-color': '#0f4c81',
              'circle-opacity': 0.15,
              'circle-stroke-width': 2,
              'circle-stroke-color': '#0f4c81',
              'circle-stroke-opacity': 0.4,
            },
          })
        }
      }
    })

    // Garante recalculo de layout no mobile WebKit
    const timer = setTimeout(() => {
      if (mapaRef.current) {
        mapaRef.current.resize()
      }
    }, 400)

    const handleResize = () => {
      if (mapaRef.current) {
        mapaRef.current.resize()
      }
    }

    window.addEventListener('resize', handleResize)
    window.addEventListener('orientationchange', handleResize)

    mapaRef.current = mapa

    return () => {
      clearTimeout(timer)
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('orientationchange', handleResize)
      mapa.remove()
      mapaRef.current = null
    }
  }, [finalLat, finalLng, titulo, publico, coordenadasValidas])

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        minHeight: '300px',
        borderRadius: 'inherit',
      }}
    />
  )
}

