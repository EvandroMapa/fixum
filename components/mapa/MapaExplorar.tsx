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
  imovelSelecionado?: string | null
  onSelecionarImovel?: (id: string) => void
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

export default function MapaExplorar({
  imoveis,
  imovelHover,
  imovelSelecionado,
  onSelecionarImovel,
  onMapaMoveu,
  centroInicial,
}: Props) {
  const mapaRef = useRef<mapboxgl.Map | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const marcadoresMapRef = useRef<Map<string, { marcador: mapboxgl.Marker; popup: mapboxgl.Popup }>>(new Map())
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
        clusterRadius: 55,
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
          if (err || zoom == null) return
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
      .filter((i) => i.latitude && i.longitude)
      .map((i) => ({
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
          coordinates: [i.longitude, i.latitude] as [number, number],
        },
      }))

    source.setData({ type: 'FeatureCollection', features })

    function atualizarMarcadores() {
      marcadoresMapRef.current.forEach(({ marcador }) => marcador.remove())
      marcadoresMapRef.current.clear()

      if (!mapa.isStyleLoaded()) return

      const pontos = mapa.querySourceFeatures(SOURCE_ID, {
        filter: ['!', ['has', 'point_count']],
      })

      const vistos = new Set<string>()
      pontos.forEach((f) => {
        const props = (f as unknown as { properties: Record<string, string> }).properties
        const geom = (f as unknown as { geometry: { coordinates: [number, number] } }).geometry
        const id = props?.id
        if (!id || vistos.has(id)) return
        vistos.add(id)

        const el = document.createElement('div')
        el.className = styles.marcador
        el.textContent = props?.precoLabel || ''
        el.dataset.id = id

        // Clique no marcador seleciona o imóvel e notifica a lista
        el.addEventListener('click', (e) => {
          e.stopPropagation()
          onSelecionarImovel?.(id)
        })

        const popup = new mapboxgl.Popup({ offset: 25, closeButton: true, maxWidth: '260px' })
          .setHTML(
            '<div style="padding: 6px 4px;">'
            + '<strong style="font-size:16px;font-weight:800;color:#1565c0;display:block;margin-bottom:4px">' + (props?.precoLabel || '') + '</strong>'
            + '<div style="font-size:13px;font-weight:600;color:#0f172a;margin-bottom:4px;line-height:1.3">' + (props?.titulo || '') + '</div>'
            + '<div style="font-size:12px;color:#64748b;margin-bottom:10px">📍 ' + (props?.bairro ? props.bairro + ', ' : '') + (props?.cidade || '') + '</div>'
            + '<a href="/imovel/' + id + '" style="display:inline-block;width:100%;text-align:center;padding:8px 12px;background:#1565c0;color:white;text-decoration:none;border-radius:8px;font-size:12px;font-weight:700;box-sizing:border-box;">Visualizar Imóvel →</a>'
            + '</div>'
          )

        const marcador = new mapboxgl.Marker({ element: el })
          .setLngLat(geom.coordinates)
          .setPopup(popup)
          .addTo(mapa)

        marcadoresMapRef.current.set(id, { marcador, popup })
      })
    }

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
      marcadoresMapRef.current.forEach(({ marcador }) => marcador.remove())
      marcadoresMapRef.current.clear()
    }
  }, [imoveis, mapaPronto, onSelecionarImovel])

  // Centralizar no mapa e destacar quando o imóvel for selecionado
  useEffect(() => {
    if (!mapaPronto || !mapaRef.current || !imovelSelecionado) return
    const mapa = mapaRef.current

    const imovel = imoveis.find((i) => i.id === imovelSelecionado)
    if (imovel?.latitude && imovel?.longitude) {
      mapa.flyTo({
        center: [imovel.longitude, imovel.latitude],
        zoom: Math.max(mapa.getZoom(), 15),
        duration: 1200,
        essential: true,
      })

      // Abrir o popup correspondente
      const item = marcadoresMapRef.current.get(imovelSelecionado)
      if (item) {
        item.marcador.togglePopup()
      }
    }
  }, [imovelSelecionado, imoveis, mapaPronto])

  // Hover e Seleção destaque nos marcadores
  useEffect(() => {
    marcadoresMapRef.current.forEach(({ marcador }, id) => {
      const el = marcador.getElement()
      if (id === imovelSelecionado) {
        el.style.borderColor = '#1565c0'
        el.style.backgroundColor = '#1565c0'
        el.style.color = '#ffffff'
        el.style.transform = 'scale(1.2)'
        el.style.zIndex = '20'
        el.style.boxShadow = '0 0 0 4px rgba(21, 101, 192, 0.35)'
      } else if (id === imovelHover) {
        el.style.borderColor = '#ff6b35'
        el.style.color = '#ff6b35'
        el.style.backgroundColor = '#ffffff'
        el.style.transform = 'scale(1.1)'
        el.style.zIndex = '15'
        el.style.boxShadow = '0 2px 10px rgba(255, 107, 53, 0.3)'
      } else {
        el.style.borderColor = ''
        el.style.backgroundColor = ''
        el.style.color = ''
        el.style.transform = ''
        el.style.zIndex = ''
        el.style.boxShadow = ''
      }
    })
  }, [imovelHover, imovelSelecionado])

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
          Pesquisar nesta área
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