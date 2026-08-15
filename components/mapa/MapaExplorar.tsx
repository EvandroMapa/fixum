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
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(preco)
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
  // Armazena { marcador, popup, inner } - inner e o filho visual (nao o elemento root do Mapbox)
  const marcadoresMapRef = useRef<Map<string, { marcador: mapboxgl.Marker; popup: mapboxgl.Popup; inner: HTMLElement }>>(new Map())
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

        // wrapper transparente — o Mapbox aplica o transform nele para posicionar
        const wrapper = document.createElement('div')
        wrapper.style.cssText = 'cursor:pointer;'

        // inner e o elemento visual — estilos de hover vao aqui, nunca no wrapper
        const inner = document.createElement('div')
        inner.className = styles.marcador
        inner.textContent = label
        inner.dataset.id = i.id
        wrapper.appendChild(inner)

        wrapper.addEventListener('click', (e) => {
          e.stopPropagation()
          // Fechar todos os outros popups antes de abrir este
          marcadoresMapRef.current.forEach(({ popup, marcador }, otherId) => {
            if (otherId !== i.id && popup.isOpen()) {
              marcador.togglePopup()
            }
          })
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

        const marcador = new mapboxgl.Marker({ element: wrapper })
          .setLngLat([i.longitude!, i.latitude!])
          .setPopup(popup)
          .addTo(mapa)

        marcadoresMapRef.current.set(i.id, { marcador, popup, inner })
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
      setTimeout(() => {
        // Fechar outros popups abertos
        marcadoresMapRef.current.forEach(({ popup, marcador }, otherId) => {
          if (otherId !== imovelSelecionado && popup.isOpen()) marcador.togglePopup()
        })
        const item = marcadoresMapRef.current.get(imovelSelecionado)
        if (item && !item.popup.isOpen()) item.marcador.togglePopup()
      }, 1300)
    }
  }, [imovelSelecionado, imoveis, mapaPronto])

  // Hover/selecao — estilizar apenas o .inner, nunca o wrapper (que o Mapbox controla)
  useEffect(() => {
    marcadoresMapRef.current.forEach(({ inner }, id) => {
      if (id === imovelSelecionado) {
        inner.style.borderColor = '#1565c0'
        inner.style.backgroundColor = '#1565c0'
        inner.style.color = '#fff'
        inner.style.boxShadow = '0 0 0 4px rgba(21,101,192,0.35)'
        inner.style.zIndex = '20'
      } else if (id === imovelHover) {
        inner.style.borderColor = '#ff6b35'
        inner.style.backgroundColor = '#fff7ed'
        inner.style.color = '#ea580c'
        inner.style.boxShadow = '0 0 0 3px rgba(255,107,53,0.3)'
        inner.style.zIndex = '10'
      } else {
        inner.style.borderColor = ''
        inner.style.backgroundColor = ''
        inner.style.color = ''
        inner.style.boxShadow = ''
        inner.style.zIndex = ''
      }
    })
  }, [imovelHover, imovelSelecionado])

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