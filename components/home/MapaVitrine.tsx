'use client'

import { useEffect, useRef, useState } from 'react'
import 'mapbox-gl/dist/mapbox-gl.css'
import { aplicarEstiloFixum, ESTILO_BASE } from '@/lib/estilo-mapa'
import { iconeSvg } from '@/components/ui/Icone'
import styles from './MapaVitrine.module.css'

/*
 * Mapa ilustrativo do hero da home: vetorial, no estilo da marca e sem interação.
 * Os pins ficam presos a coordenadas reais (e não a porcentagens da tela),
 * então continuam sobre as ruas em qualquer tamanho de tela.
 */

const CENTRO: [number, number] = [-43.7867, -20.6603]

type Pin = { dLng: number; dLat: number; texto: string; tipo?: 'ativo' | 'destaque' | 'cluster' }

const PINS: Pin[] = [
  { dLng: -0.0072, dLat: 0.0042, texto: 'R$ 420 mil' },
  { dLng: 0.0046, dLat: 0.0052, texto: 'R$ 285 mil', tipo: 'ativo' },
  { dLng: -0.0081, dLat: -0.0012, texto: 'R$ 610 mil' },
  { dLng: 0.0004, dLat: -0.0058, texto: 'R$ 1.800/mês', tipo: 'destaque' },
  { dLng: 0.0098, dLat: -0.0044, texto: '12', tipo: 'cluster' },
]

export default function MapaVitrine() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [pronto, setPronto] = useState(false)

  useEffect(() => {
    let cancelado = false
    let mapa: import('mapbox-gl').Map | null = null
    let observador: ResizeObserver | null = null

    ;(async () => {
      const mapboxgl = (await import('mapbox-gl')).default
      if (cancelado || !containerRef.current) return
      mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || ''

      mapa = new mapboxgl.Map({
        container: containerRef.current,
        style: ESTILO_BASE,
        center: CENTRO,
        zoom: 14.2,
        interactive: false,
        attributionControl: false,
        fadeDuration: 0,
      })
      mapa.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-right')
      const m = mapa
      m.on('style.load', () => aplicarEstiloFixum(m))
      m.once('load', () => !cancelado && setPronto(true))

      PINS.forEach((p) => {
        const el = document.createElement('div')
        const balao = document.createElement('span')
        balao.className =
          p.tipo === 'cluster'
            ? styles.cluster
            : `${styles.pin} ${p.tipo === 'ativo' ? styles.pinAtivo : ''} ${p.tipo === 'destaque' ? styles.pinDestaque : ''}`
        balao.textContent = p.texto
        el.appendChild(balao)
        new mapboxgl.Marker({ element: el, anchor: p.tipo === 'cluster' ? 'center' : 'bottom' })
          .setLngLat([CENTRO[0] + p.dLng, CENTRO[1] + p.dLat])
          .addTo(m)

        // Prévia do imóvel presa ao pin selecionado
        if (p.tipo === 'ativo') {
          const card = document.createElement('div')
          card.className = styles.card
          card.innerHTML = `
            <div class="${styles.cardFoto}"></div>
            <div>
              <strong>R$ 285.000</strong>
              <span>Casa · 3 quartos · 142 m²</span>
              <span class="${styles.cardLugar}">${iconeSvg('caminhada', 14)} 5 min da praça</span>
            </div>`
          new mapboxgl.Marker({ element: card, anchor: 'top', offset: [0, 10] })
            .setLngLat([CENTRO[0] + p.dLng, CENTRO[1] + p.dLat])
            .addTo(m)
        }
      })

      observador = new ResizeObserver(() => m.resize())
      observador.observe(containerRef.current)
    })()

    return () => {
      cancelado = true
      observador?.disconnect()
      mapa?.remove()
    }
  }, [])

  return (
    <div className={`${styles.mapa} ${pronto ? styles.pronto : ''}`}>
      <div ref={containerRef} className={styles.canvas} />
    </div>
  )
}
