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
  voarPara?: [number, number] | null // [lng, lat] — recebido do autocomplete
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
  voarPara,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapaRef = useRef<mapboxgl.Map | null>(null)
  const marcadoresMapRef = useRef<Map<string, { marcador: mapboxgl.Marker; popup: mapboxgl.Popup; inner: HTMLElement; btnHeart: HTMLButtonElement }>>(new Map())
  const [mapaPronto, setMapaPronto] = useState(false)
  // Ignora o primeiro moveend (disparo do carregamento inicial do mapa)
  const primeiroMovimentoRef = useRef(false)
  // Ref para evitar stale closure no listener do moveend
  const onPesquisarRef = useRef(onPesquisarNaArea)
  useEffect(() => { onPesquisarRef.current = onPesquisarNaArea }, [onPesquisarNaArea])

  // Inicializar mapa
  useEffect(() => {
    if (!containerRef.current || mapaRef.current) return

    const mapa = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: centroInicial ?? [-47.9292, -15.7801], // Brasil (Brasília) como fallback
      zoom: centroInicial ? 13 : 4,                  // Cidade → zoom 13 | Brasil → zoom 4
      attributionControl: false,
    })

    mapa.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right')
    mapa.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-right')

    mapa.on('load', () => setMapaPronto(true))

    mapa.on('moveend', () => {
      if (!primeiroMovimentoRef.current) {
        primeiroMovimentoRef.current = true
        return // pula o primeiro moveend (posicionamento inicial)
      }
      // Usa ref para garantir sempre o callback mais recente (evita stale closure)
      onPesquisarRef.current?.(mapa.getBounds()!)
    })

    mapaRef.current = mapa
    return () => { mapa.remove(); mapaRef.current = null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Voar para coordenadas quando o usuário seleciona uma sugestão do autocomplete
  useEffect(() => {
    if (!mapaPronto || !mapaRef.current || !voarPara) return
    mapaRef.current.flyTo({
      center: voarPara,
      zoom: 13,
      duration: 1400,
      essential: true,
    })
  }, [voarPara, mapaPronto])

  // Sincroniza favoritos: lista → mapa
  // Quando o card (useFavorito) favorita/desfavorita, atualiza o coração no marcador do mapa
  useEffect(() => {
    function criarSvgHeart(cheio: boolean): SVGSVGElement {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
      svg.setAttribute('width', '14'); svg.setAttribute('height', '14')
      svg.setAttribute('viewBox', '0 0 24 24')
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
      path.setAttribute('d', 'M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z')
      path.setAttribute('fill', cheio ? '#e53e3e' : 'none')
      path.setAttribute('stroke', cheio ? '#e53e3e' : '#94a3b8')
      path.setAttribute('stroke-width', '2.5')
      path.setAttribute('stroke-linecap', 'round')
      path.setAttribute('stroke-linejoin', 'round')
      svg.appendChild(path)
      return svg
    }

    function handleFavoritoAtualizado(e: Event) {
      const { imovelId, favoritado } = (e as CustomEvent).detail
      const item = marcadoresMapRef.current.get(imovelId)
      if (!item) return
      const { btnHeart } = item
      btnHeart.innerHTML = ''
      btnHeart.appendChild(criarSvgHeart(favoritado))
      btnHeart.dataset.favoritado = String(favoritado)
      btnHeart.style.opacity = favoritado ? '1' : '0'
    }

    window.addEventListener('fixum:favoritoAtualizado', handleFavoritoAtualizado)
    return () => window.removeEventListener('fixum:favoritoAtualizado', handleFavoritoAtualizado)
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

        // inner é o elemento visual (bolha de preço)
        const inner = document.createElement('div')
        inner.className = styles.marcador
        inner.dataset.id = i.id

        // Texto do preço
        const precoSpan = document.createElement('span')
        precoSpan.textContent = label
        inner.appendChild(precoSpan)

        // Helper: cria SVG heart via createElementNS (não sofre sanitização)
        function criarSvgHeart(cheio: boolean): SVGSVGElement {
          const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
          svg.setAttribute('width', '14'); svg.setAttribute('height', '14')
          svg.setAttribute('viewBox', '0 0 24 24')
          const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
          path.setAttribute('d', 'M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z')
          path.setAttribute('fill', cheio ? '#e53e3e' : 'none')
          path.setAttribute('stroke', cheio ? '#e53e3e' : '#94a3b8')
          path.setAttribute('stroke-width', '2.5')
          path.setAttribute('stroke-linecap', 'round')
          path.setAttribute('stroke-linejoin', 'round')
          svg.appendChild(path)
          return svg
        }

        // Coração no marcador — oculto por padrão, visível no hover ou se favoritado
        const btnHeart = document.createElement('button')
        btnHeart.type = 'button'
        btnHeart.title = 'Favoritar'
        btnHeart.dataset.favoritado = 'false'
        btnHeart.style.cssText = 'background:none;border:none;cursor:pointer;padding:0;display:flex;align-items:center;line-height:1;transition:transform 0.15s,opacity 0.15s;opacity:0'
        btnHeart.appendChild(criarSvgHeart(false))
        inner.appendChild(btnHeart)

        // Mostrar coração no hover (só se não favoritado)
        inner.addEventListener('mouseenter', () => { btnHeart.style.opacity = '1' })
        inner.addEventListener('mouseleave', () => {
          if (btnHeart.dataset.favoritado !== 'true') btnHeart.style.opacity = '0'
        })

        // Listener do coração — stopPropagation para não abrir popup
        btnHeart.addEventListener('click', async (e) => {
          e.stopPropagation()
          btnHeart.style.transform = 'scale(1.4)'
          setTimeout(() => { btnHeart.style.transform = 'scale(1)' }, 150)
          try {
            const { createClient } = await import('@/lib/supabase/client')
            const sb = createClient()
            const { data: { session } } = await sb.auth.getSession()
            if (!session?.user) {
              window.dispatchEvent(new CustomEvent('fixum:abrirModalLogin', {
                detail: { mensagem: 'Entre para salvar imóveis favoritos' }
              }))
              return
            }
            if (btnHeart.dataset.favoritado === 'true') {
              await sb.from('favoritos').delete().eq('usuario_id', session.user.id).eq('imovel_id', i.id)
              btnHeart.innerHTML = ''; btnHeart.appendChild(criarSvgHeart(false))
              btnHeart.dataset.favoritado = 'false'
              btnHeart.style.opacity = '0'
              window.dispatchEvent(new CustomEvent('fixum:favoritoAtualizado', { detail: { imovelId: i.id, favoritado: false } }))
            } else {
              await sb.from('favoritos').insert({ usuario_id: session.user.id, imovel_id: i.id })
              btnHeart.innerHTML = ''; btnHeart.appendChild(criarSvgHeart(true))
              btnHeart.dataset.favoritado = 'true'
              btnHeart.style.opacity = '1'
              window.dispatchEvent(new CustomEvent('fixum:favoritoAtualizado', { detail: { imovelId: i.id, favoritado: true } }))
            }
          } catch { /* silencioso */ }
        })

        // Verificar estado inicial do favorito (usuário logado)
        ;(async () => {
          try {
            const { createClient } = await import('@/lib/supabase/client')
            const sb = createClient()
            const { data: { session } } = await sb.auth.getSession()
            if (session?.user) {
              const { data } = await sb.from('favoritos').select('id')
                .eq('usuario_id', session.user.id).eq('imovel_id', i.id).maybeSingle()
              if (data) {
                btnHeart.innerHTML = ''; btnHeart.appendChild(criarSvgHeart(true))
                btnHeart.dataset.favoritado = 'true'
                btnHeart.style.opacity = '1' // sempre visível quando favoritado
              }
            }
          } catch { /* silencioso */ }
        })()

        wrapper.appendChild(inner)

        wrapper.addEventListener('click', (e) => {
          e.stopPropagation()
          // Fechar todos os outros popups antes de abrir este
          marcadoresMapRef.current.forEach(({ popup, marcador }, otherId) => {
            if (otherId !== i.id && popup.isOpen()) marcador.togglePopup()
          })
          // Abrir popup deste marcador
          const item = marcadoresMapRef.current.get(i.id)
          if (item && !item.popup.isOpen()) item.marcador.togglePopup()
          onSelecionarImovel?.(i.id)
        })

        const localidade = (i.bairro ? i.bairro + ', ' : '') + (i.cidade || '')

        // Popup estilo Airbnb com foto, preço e detalhes
        const fotoUrl = i.fotos?.find(f => f.principal)?.url
          ?? i.fotos?.[0]?.url
          ?? null

        const detalhes = [
          i.quartos ? `${i.quartos} ${i.quartos === 1 ? 'quarto' : 'quartos'}` : null,
          i.area ? `${i.area} m²` : null,
          i.vagas ? `${i.vagas} ${i.vagas === 1 ? 'vaga' : 'vagas'}` : null,
        ].filter(Boolean).join(' · ')

        const negociacaoLabel = i.negociacao === 'aluguel' ? '/mês' : ''

        const popupEl = document.createElement('div')
        popupEl.style.cssText = 'font-family:system-ui,-apple-system,sans-serif;width:270px;overflow:hidden;border-radius:16px;cursor:pointer;'
        popupEl.innerHTML = `
          <a href="/imovel/${i.id}" target="_blank" rel="noopener noreferrer" style="text-decoration:none;color:inherit;display:block;">
            ${fotoUrl ? `
              <div style="position:relative;height:160px;overflow:hidden;border-radius:12px 12px 0 0;">
                <img src="${fotoUrl}" alt="${i.titulo || ''}"
                  style="width:100%;height:100%;object-fit:cover;display:block;transition:transform 0.3s;"
                  onmouseover="this.style.transform='scale(1.04)'"
                  onmouseout="this.style.transform='scale(1)'"
                />
                <div style="position:absolute;inset:0;background:linear-gradient(to top,rgba(0,0,0,0.35) 0%,transparent 50%);pointer-events:none;"></div>
                <div style="position:absolute;bottom:10px;left:12px;background:white;color:#1a56db;font-size:14px;font-weight:800;padding:3px 9px;border-radius:20px;letter-spacing:-0.02em;">
                  ${label}${negociacaoLabel}
                </div>
              </div>
            ` : `
              <div style="height:80px;background:linear-gradient(135deg,#e0eaff,#c7d7f7);border-radius:12px 12px 0 0;display:flex;align-items:center;justify-content:center;">
                <span style="font-size:14px;font-weight:800;color:#1a56db;">${label}${negociacaoLabel}</span>
              </div>
            `}
            <div style="padding:12px 14px 14px;">
              ${!fotoUrl ? '' : ''}
              <div style="font-size:13px;font-weight:700;color:#0f172a;line-height:1.35;margin-bottom:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                ${i.titulo || ''}
              </div>
              ${localidade ? `<div style="font-size:12px;color:#64748b;margin-bottom:${detalhes ? '6px' : '0'};">${localidade}</div>` : ''}
              ${detalhes ? `<div style="font-size:11.5px;color:#94a3b8;">${detalhes}</div>` : ''}
              <div style="margin-top:12px;padding-top:10px;border-top:1px solid #f1f5f9;display:flex;align-items:center;justify-content:space-between;">
                <span style="font-size:11px;color:#64748b;">Toque para ver detalhes</span>
                <span style="font-size:11px;font-weight:700;color:#1a56db;">Ver imóvel →</span>
              </div>
            </div>
          </a>
        `

        const popup = new mapboxgl.Popup({
          offset: 20,
          closeButton: true,
          closeOnClick: false,
          maxWidth: '290px',
          className: 'fixum-popup',
        }).setDOMContent(popupEl)

        const marcador = new mapboxgl.Marker({ element: wrapper })
          .setLngLat([i.longitude!, i.latitude!])
          .setPopup(popup)
          .addTo(mapa)

        marcadoresMapRef.current.set(i.id, { marcador, popup, inner, btnHeart })
      })

    return () => {
      marcadoresMapRef.current.forEach(({ marcador }) => marcador.remove())
      marcadoresMapRef.current.clear()
    }
  }, [imoveis, mapaPronto, onSelecionarImovel])

  // Ao selecionar imóvel (lista ou mapa): abre popup no marcador, sem mover o mapa
  useEffect(() => {
    if (!mapaPronto || !imovelSelecionado) return
    // Fechar outros popups abertos
    marcadoresMapRef.current.forEach(({ popup, marcador }, otherId) => {
      if (otherId !== imovelSelecionado && popup.isOpen()) marcador.togglePopup()
    })
    // Abrir popup do imóvel selecionado
    const item = marcadoresMapRef.current.get(imovelSelecionado)
    if (item && !item.popup.isOpen()) item.marcador.togglePopup()
  }, [imovelSelecionado, mapaPronto])

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

  return (
    <div className={styles.wrapper}>
      <div ref={containerRef} className={styles.mapa} />
      {!mapaPronto && (
        <div className={styles.loading}>
          <div className={styles.loadingSpinner} />
          <span>Carregando mapa...</span>
        </div>
      )}
    </div>
  )
}