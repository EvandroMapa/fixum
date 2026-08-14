'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { type Imovel } from '@/lib/types'
import styles from './MapaExplorar.module.css'

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!

interface Props {
  imoveis: Imovel[]
  imovelHover?: string | null
  onMapaMoveu?: (bounds: mapboxgl.LngLatBounds) => void
  centroInicial?: [number, number]
}

function precoLabel(preco: number): string {
  if (!preco) return ''
  if (preco >= 1_000_000) return 'R$' + (preco / 1_000_000).toFixed(1) + 'M'
  if (preco >= 1_000) return 'R$' + Math.round(preco / 1_000) + 'k'
  return 'R$' + preco
}

const SOURCE_ID = 'imoveis-source'

export default function MapaExplorar({ imoveis, imovelHover, onMapaMoveu, centroInicial }: Props) {
  const mapaRef = useRef<mapboxgl.Map | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const marcadoresRef = useRef<mapboxgl.Marker[]>([])
  const [pesquisarNaArea, setPesquisarNaArea] = useState(false)
  const [mapaPronto, setMapaPronto] = useState(false)

  // Inicializar mapa
  useEffect(() => {
    if (!containerRef.current || mapaRef.current) return
    const mapa = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: centroInicial ?? [-43.7867, -20.6603],
      zoom: 13,
      attributionControl: false,
    })
    mapa.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right')
    mapa.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-right')

    mapa.on('load', () => {
      // Source com clustering
      mapa.addSource(SOURCE_ID, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
        cluster: true,
        clusterMaxZoom: 16,
        clusterRadius: 60,
      })

      // Layer: circulos dos clusters
      mapa.addLayer({
        id: 'clusters',
        type: 'circle',
        source: SOURCE_ID,
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': [
            'step', ['get', 'point_count'],
            '#1565c0',
            5, '#0d47a1',
            15, '#0a3d91',
          ],
          'circle-radius': [
            'step', ['get', 'point_count'],
            22,
            5, 28,
            15, 34,
          ],
          'circle-stroke-width': 3,
          'circle-stroke-color': 'rgba(255,255,255,0.7)',
        },
      })

      // Layer: texto do count nos clusters
      mapa.addLayer({
        id: 'cluster-count',
        type: 'symbol',
        source: SOURCE_ID,
        filter: ['has', 'point_count'],
        layout: {
          'text-field': '{point_count_abbreviated}',
          'text-font': ['DIN Pro Medium', 'Arial Unicode MS Bold'],
          'text-size': 14,
          'text-allow-overlap': true,
        },
        paint: {
          'text-color': '#ffffff',
        },
      })

      // Click no cluster -> zoom
      mapa.on('click', 'clusters', (e) => {
        const features = mapa.queryRenderedFeatures(e.point, { layers: ['clusters'] })
        if (!features.length) return
        const feat = features[0] as unknown as { properties: Record<string, unknown>; geometry: { type: string; coordinates: [number, number] } }
        const clusterId = feat.properties?.cluster_id as number
        const source = mapa.getSource(SOURCE_ID) as mapboxgl.GeoJSONSource
        source.getClusterExpansionZoom(clusterId, (err, zoom) => {
          if (err) return
          mapa.easeTo({
            center: feat.geometry.coordinates,
            zoom,
          })
        })
      })

      // Cursor pointer sobre clusters
      mapa.on('mouseenter', 'clusters', () => {
        mapa.getCanvas().style.cursor = 'pointer'
      })
      mapa.on('mouseleave', 'clusters', () => {
        mapa.getCanvas().style.cursor = ''
      })

      setMapaPronto(true)
    })

    mapa.on('moveend', () => {
      setPesquisarNaArea(true)
      onMapaMoveu?.(mapa.getBounds()!)
    })

    mapaRef.current = mapa
    return () => { mapa.remove(); mapaRef.current = null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Atualizar dados do source + marcadores individuais
  useEffect(() => {
    if (!mapaPronto || !mapaRef.current) return
    const mapa = mapaRef.current
    const source = mapa.getSource(SOURCE_ID) as mapboxgl.GeoJSONSource
    if (!source) return

    // Montar GeoJSON
    const features = imoveis
      .filter(i => i.lat && i.lng)
      .map(i => ({
        type: 'Feature' as const,
        properties: {
          id: i.id,
          preco: i.preco || 0,
          precoLabel: precoLabel(i.preco || 0),
          titulo: i.titulo || '',
          bairro: i.bairro || '',
          cidade: i.cidade || '',
        },
        geometry: {
          type: 'Point' as const,
          coordinates: [i.lng, i.lat] as [number, number],
        },
      }))

    source.setData({ type: 'FeatureCollection', features })

    // Funcao para atualizar marcadores HTML nos pontos nao-clusterizados
    function atualizarMarcadores() {
      marcadoresRef.current.forEach(m => m.remove())
      marcadoresRef.current = []

      if (!mapa.isStyleLoaded()) return

      // Pegar pontos individuais (nao clusterizados)
      const pontos = mapa.querySourceFeatures(SOURCE_ID, {
        filter: ['!', ['has', 'point_count']],
      })

      // Deduplicar
      const vistos = new Set<string>()
      pontos.forEach(f => {
        const props = (f as unknown as { properties: Record<string, string> }).properties
        const geom = (f as unknown as { geometry: { coordinates: [number, number] } }).geometry
        const id = props?.id
        if (!id || vistos.has(id)) return
        vistos.add(id)

        const el = document.createElement('div')
        el.className = styles.marcador
        el.textContent = props?.precoLabel || ''
        el.dataset.id = id

        const popup = new mapboxgl.Popup({ offset: 25, closeButton: false, maxWidth: '240px' })
          .setHTML(
            '<a href="/imoveis/' + id + '" style="text-decoration:none;color:inherit;display:block;padding:4px 0">'
            + '<strong style="font-size:15px;color:#1565c0;display:block;margin-bottom:2px">' + (props?.precoLabel || '') + '</strong>'
            + '<span style="font-size:12px;color:#0f172a;display:block">' + (props?.titulo || '') + '</span>'
            + '<span style="font-size:11px;color:#64748b">' + (props?.bairro || props?.cidade || '') + '</span></a>'
          )

        const marcador = new mapboxgl.Marker({ element: el })
          .setLngLat(geom.coordinates)
          .setPopup(popup)
          .addTo(mapa)

        marcadoresRef.current.push(marcador)
      })
    }

    // Atualizar marcadores quando o mapa muda
    const onMove = () => atualizarMarcadores()
    const onSource = (e: mapboxgl.MapSourceDataEvent) => {
      if (e.sourceId === SOURCE_ID && e.isSourceLoaded) atualizarMarcadores()
    }
    mapa.on('moveend', onMove)
    mapa.on('sourcedata', onSource)
    setTimeout(atualizarMarcadores, 300)

    return () => {
      mapa.off('moveend', onMove)
      mapa.off('sourcedata', onSource)
      marcadoresRef.current.forEach(m => m.remove())
      marcadoresRef.current = []
    }
  }, [imoveis, mapaPronto])

  // Hover destaque
  useEffect(() => {
    marcadoresRef.current.forEach(m => {
      const el = m.getElement()
      const id = el.dataset.id
      if (id === imovelHover) {
        el.style.borderColor = '#ff6b35'
        el.style.color = '#ff6b35'
        el.style.zIndex = '10'
      } else {
        el.style.borderColor = ''
        el.style.color = ''
        el.style.zIndex = ''
      }
    })
  }, [imovelHover])

  const handlePesquisarNaArea = useCallback(() => {
    if (!mapaRef.current) return
    onMapaMoveu?.(mapaRef.current.getBounds()!)
    setPesquisarNaArea(false)
  }, [onMapaMoveu])

  return (
    <div className={styles.wrapper}>
      <div ref={containerRef} className={styles.mapa} />
      {pesquisarNaArea && (
        <button className={styles.btnPesquisarArea} onClick={handlePesquisarNaArea}>
          Pesquisar nesta area
        </button>
      )}
      {!mapaPronto && (
        <div className={styles.loading}>
          <div className={styles.loadingSpinner} />
          <span>Carregando mapa...</span>
        </div>
      )}
    </div>
  )
}