'use client'

import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!

interface Props {
  lat: number
  lng: number
  titulo: string
  publico?: boolean
}

export default function MapaImovel({ lat, lng, titulo, publico = true }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapaRef = useRef<mapboxgl.Map | null>(null)

  useEffect(() => {
    if (!containerRef.current || mapaRef.current) return

    const mapa = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [lng, lat],
      zoom: publico ? 15 : 13,
      interactive: true,
      attributionControl: false,
    })

    mapa.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right')

    mapa.on('load', () => {
      if (publico) {
        // Marcador preciso
        new mapboxgl.Marker({ color: '#0f4c81' })
          .setLngLat([lng, lat])
          .setPopup(new mapboxgl.Popup({ offset: 25 }).setText(titulo))
          .addTo(mapa)
      } else {
        // Círculo aproximado (privacidade)
        mapa.addSource('area-aproximada', {
          type: 'geojson',
          data: {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [lng, lat] },
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
    })

    mapaRef.current = mapa

    return () => {
      mapa.remove()
      mapaRef.current = null
    }
  }, [lat, lng, titulo, publico])

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
}
