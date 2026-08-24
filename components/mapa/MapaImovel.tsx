'use client'

import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { type PontoInteresse } from '@/lib/types'

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || ''

interface Props {
  lat: number | string | null | undefined
  lng: number | string | null | undefined
  titulo: string
  publico?: boolean
  pois?: PontoInteresse[]
  poiSelecionadoId?: string | null
  onSelecionarPoi?: (poi: PontoInteresse) => void
}

export default function MapaImovel({
  lat,
  lng,
  titulo,
  publico = true,
  pois = [],
  poiSelecionadoId = null,
  onSelecionarPoi,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapaRef = useRef<mapboxgl.Map | null>(null)
  const marcadoresPoisRef = useRef<Map<string, { marker: mapboxgl.Marker; popup: mapboxgl.Popup }>>(new Map())

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

  // 1. Inicializar Mapa
  useEffect(() => {
    if (!containerRef.current || mapaRef.current) return

    const mapa = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [finalLng, finalLat],
      zoom: 14.5,
      interactive: true,
      scrollZoom: true, // Zoom suave com a roda do mouse
      dragRotate: false,
      attributionControl: false,
    })

    mapa.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right')

    mapa.on('load', () => {
      mapa.resize()

      if (coordenadasValidas) {
        if (publico === true) {
          // Marcador preciso do Imóvel
          new mapboxgl.Marker({ color: '#0f4c81' })
            .setLngLat([finalLng, finalLat])
            .setPopup(new mapboxgl.Popup({ offset: 25 }).setText(titulo))
            .addTo(mapa)
        } else {
          // Círculo de Área Aproximada (Privacidade total)
          mapa.addSource('area-aproximada', {
            type: 'geojson',
            data: {
              type: 'Feature',
              geometry: { type: 'Point', coordinates: [finalLng, finalLat] },
              properties: {
                title: 'Região aproximada do imóvel',
              },
            },
          })

          // Preenchimento da área com raio responsivo ao zoom
          mapa.addLayer({
            id: 'area-aproximada-fill',
            type: 'circle',
            source: 'area-aproximada',
            paint: {
              'circle-radius': [
                'interpolate',
                ['exponential', 2],
                ['zoom'],
                10, 15,
                12, 30,
                14, 65,
                16, 130,
                18, 260,
              ],
              'circle-color': '#2563eb',
              'circle-opacity': 0.16,
              'circle-stroke-width': 2,
              'circle-stroke-color': '#1d4ed8',
              'circle-stroke-opacity': 0.55,
            },
          })

          // Ponto central suave indicando o centro da região
          mapa.addLayer({
            id: 'area-aproximada-center',
            type: 'circle',
            source: 'area-aproximada',
            paint: {
              'circle-radius': 6,
              'circle-color': '#1d4ed8',
              'circle-stroke-width': 2.5,
              'circle-stroke-color': '#ffffff',
              'circle-opacity': 0.9,
            },
          })
        }
      }
    })

    const timer = setTimeout(() => {
      if (mapaRef.current) mapaRef.current.resize()
    }, 400)

    const handleResize = () => {
      if (mapaRef.current) mapaRef.current.resize()
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

  // 2. Gerenciar Marcadores de POIs (Conveniências do Entorno)
  useEffect(() => {
    if (!mapaRef.current) return
    const mapa = mapaRef.current

    // Limpar marcadores anteriores
    marcadoresPoisRef.current.forEach(({ marker }) => marker.remove())
    marcadoresPoisRef.current.clear()

    if (!pois || pois.length === 0) {
      // Se não houver POIs, recentraliza no imóvel
      mapa.flyTo({ center: [finalLng, finalLat], zoom: 14.5, duration: 600 })
      return
    }

    // Criar novos marcadores para os POIs
    pois.forEach((poi) => {
      // Wrapper para receber a posição calculada do Mapbox
      const wrapper = document.createElement('div')
      wrapper.style.cssText = 'cursor: pointer;'

      // Inner element para aplicar o estilo visual e hover sem conflitar com o transform do Mapbox
      const inner = document.createElement('div')
      inner.style.cssText = `
        background: #ffffff;
        border: 2px solid #2563eb;
        border-radius: 20px;
        padding: 4px 9px;
        font-size: 12px;
        font-weight: 800;
        color: #1e293b;
        box-shadow: 0 4px 14px rgba(0,0,0,0.18);
        display: flex;
        align-items: center;
        gap: 5px;
        transition: transform 0.18s ease, background 0.18s ease, border-color 0.18s ease;
        white-space: nowrap;
      `
      inner.innerHTML = `<span>${poi.icone}</span> <span>${poi.distanciaFormatada}</span>`

      wrapper.appendChild(inner)

      wrapper.addEventListener('mouseenter', () => {
        inner.style.transform = 'scale(1.12)'
        inner.style.borderColor = '#1d4ed8'
        inner.style.background = '#f8fafc'
      })
      wrapper.addEventListener('mouseleave', () => {
        inner.style.transform = 'scale(1)'
        inner.style.borderColor = '#2563eb'
        inner.style.background = '#ffffff'
      })

      const popup = new mapboxgl.Popup({ offset: 20, closeButton: false }).setHTML(`
        <div style="font-family: system-ui, sans-serif; padding: 4px; max-width: 220px;">
          <div style="font-size: 13px; font-weight: 800; color: #0f172a; line-height: 1.2;">
            ${poi.icone} ${poi.nome}
          </div>
          <div style="font-size: 11px; color: #475569; margin-top: 4px; font-weight: 600;">
            📍 ${poi.distanciaFormatada} · 🚶 ${poi.tempoPe}
          </div>
        </div>
      `)

      wrapper.addEventListener('click', (e) => {
        e.stopPropagation()
        onSelecionarPoi?.(poi)
      })

      const marker = new mapboxgl.Marker({ element: wrapper })
        .setLngLat([poi.lng, poi.lat])
        .setPopup(popup)
        .addTo(mapa)

      marcadoresPoisRef.current.set(poi.id, { marker, popup })
    })

    // Enquadramento inteligente: Imóvel + POIs próximos
    const bounds = new mapboxgl.LngLatBounds()
    bounds.extend([finalLng, finalLat])
    pois.slice(0, 5).forEach((p) => bounds.extend([p.lng, p.lat]))

    mapa.fitBounds(bounds, {
      padding: { top: 50, bottom: 50, left: 50, right: 50 },
      maxZoom: 15.5,
      duration: 800,
    })
  }, [pois, finalLat, finalLng, onSelecionarPoi])

  // 3. Destacar POI selecionado externamente (ao clicar no card da lista)
  useEffect(() => {
    if (!mapaRef.current || !poiSelecionadoId) return
    const item = marcadoresPoisRef.current.get(poiSelecionadoId)
    if (item) {
      // Abre o popup do marcador
      if (!item.popup.isOpen()) {
        item.marker.togglePopup()
      }
      // Centraliza suavemente
      const lngLat = item.marker.getLngLat()
      mapaRef.current.flyTo({ center: [lngLat.lng, lngLat.lat], zoom: 15.5, duration: 600 })
    }
  }, [poiSelecionadoId])

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        minHeight: '320px',
        borderRadius: 'inherit',
      }}
    />
  )
}
