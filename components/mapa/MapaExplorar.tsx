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
  onPesquisarNaArea?: (bounds: mapboxgl.LngLatBounds) => void
  centroInicial?: [number, number]
}

function precoLabel(preco: number): string {
  if (!preco) return ''
  if (preco >= 1_000_000) return 'R$' + (preco / 1_000_000).toFixed(1) + 'M'
  if (preco >= 1_000) return 'R$' + Math.round(preco / 1_000) + 'k'
  return 'R$' + preco
}

export default function MapaExplorar({
  imoveis,
  imovelHover,
  imovelSelecionado,
  onSelecionarImovel,
  onMapaMoveu,
  onPesquisarNaArea,
  centroInicial,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapaRef = useRef<mapboxgl.Map | null>(null)
  const marcadoresMapRef = useRef<Map<string, { marcador: mapboxgl.Marker; popup: mapboxgl.Popup }>>(new Map())
  const [mapaPronto, setMapaPronto] = useState(false)
  const [pesquisarNaArea, setPesquisarNaArea] = useState(false)

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

    mapa.on('load', () => setMapaPronto(true))

    mapa.on('moveend', () => {
      setPesquisarNaArea(true)
      onMapaMoveu?.(mapa.getBounds()!)
    })

    mapaRef.current = mapa
    return () => { mapa.remove(); mapaRef.current = null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Recriar marcadores quando lista de imoveis mudar
  useEffect(() => {
    if (!mapaPronto || !mapaRef.current) return
    const mapa = mapaRef.current

    marcadoresMapRef.current.forEach(({ marcador }) => marcador.remove())
    marcadoresMapRef.current.clear()

    imoveis
      .filter((i) => i.latitude && i.longitude)
      .forEach((i) => {
        const label = precoLabel(i.preco || 0)

        const el = document.createElement('div')
        el.className = styles.marcador
        el.textContent = label
        el.dataset.id = i.id

        el.addEventListener('click', (e) => {
          e.stopPropagation()
          onSelecionarImovel?.(i.id)
        })

        const localidade = (i.bairro ? i.bairro + ', ' : '') + (i.cidade || '')
        const popup = new mapboxgl.Popup({ offset: 25, closeButton: true, maxWidth: '260px' })
          .setHTML(
            '<div style="padding:6px 4px">'
            + '<strong style="font-size:16px;font-weight:800;color:#1565c0;display:block;margin-bottom:4px">' + label + '</strong>'
            + '<div style="font-size:13px;font-weight:600;color:#0f172a;margin-bottom:4px;line-height:1.3">' + (i.titulo || '') + '</div>'
            + '<div style="font-size:12px;color:#64748b;margin-bottom:10px">' + localidade + '</div>'
            + '<a href="/imovel/' + i.id + '" style="display:inline-block;width:100%;text-align:center;padding:8px 12px;background:#1565c0;color:white;text-decoration:none;border-radius:8px;font-size:12px;font-weight:700;box-sizing:border-box;">Visualizar Im\u00F3vel \u2192</a>'
            + '</div>'
          )

        const marcador = new mapboxgl.Marker({ element: el })
          .setLngLat([i.longitude!, i.latitude!])
          .setPopup(popup)
          .addTo(mapa)

        marcadoresMapRef.current.set(i.id, { marcador, popup })
      })

    return () => {
      marcadoresMapRef.current.forEach(({ marcador }) => marcador.remove())
      marcadoresMapRef.current.clear()
    }
  }, [imoveis, mapaPronto, onSelecionarImovel])

  // Centralizar e abrir popup quando imovel selecionado pela lista
  useEffect(() => {
    if (!mapaPronto || !mapaRef.current || !imovelSelecionado) return
    const mapa = mapaRef.current
    const imovel = imoveis.find((i) => i.id === imovelSelecionado)
    if (imovel?.latitude && imovel?.longitude) {
      mapa.flyTo({ center: [imovel.longitude, imovel.latitude], zoom: Math.max(mapa.getZoom(), 15), duration: 1200, essential: true })
      const item = marcadoresMapRef.current.get(imovelSelecionado)
      if (item) setTimeout(() => item.marcador.togglePopup(), 1300)
    }
  }, [imovelSelecionado, imoveis, mapaPronto])

  // Hover/selecao - destacar marcadores (so propriedades individuais, nunca cssText)
  useEffect(() => {
    marcadoresMapRef.current.forEach(({ marcador }, id) => {
      const el = marcador.getElement()
      if (id === imovelSelecionado) {
        el.style.borderColor = '#1565c0'
        el.style.backgroundColor = '#1565c0'
        el.style.color = '#fff'
        el.style.transform = 'scale(1.2)'
        el.style.zIndex = '20'
        el.style.boxShadow = '0 0 0 4px rgba(21,101,192,0.35)'
      } else if (id === imovelHover) {
        el.style.borderColor = '#ff6b35'
        el.style.backgroundColor = '#fff7ed'
        el.style.color = '#ea580c'
        el.style.transform = 'scale(1.1)'
        el.style.zIndex = '10'
        el.style.boxShadow = '0 0 0 3px rgba(255,107,53,0.3)'
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

  // Botao "Pesquisar nesta area" - dispara busca com bounds atuais
  const handlePesquisarNaArea = useCallback(() => {
    if (!mapaRef.current) return
    const bounds = mapaRef.current.getBounds()!
    onPesquisarNaArea?.(bounds)
    onMapaMoveu?.(bounds)
    setPesquisarNaArea(false)
  }, [onPesquisarNaArea, onMapaMoveu])

  return (
    <div className={styles.wrapper}>
      <div ref={containerRef} className={styles.mapa} />
      {pesquisarNaArea && (
        <button className={styles.btnPesquisarArea} onClick={handlePesquisarNaArea}>
          {"\uD83D\uDD0D"} Pesquisar nesta area
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