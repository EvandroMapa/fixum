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
  onPesquisarNaArea?: (bounds: mapboxgl.LngLatBounds, isInteracaoUsuario?: boolean) => void
  centroInicial?: [number, number]
  voarPara?: [number, number] | null // [lng, lat] — recebido do autocomplete
  cidadeFiltro?: string
  isOrigemGps?: boolean
  isFavoritos?: boolean
  carregando?: boolean
}

function precoLabel(preco: number): string {
  if (!preco) return ''
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(preco)
}

function calcularDistanciaKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

// Dispersão sutil para imóveis com mesma coordenada (ex: mesmo prédio/condomínio)
function aplicarDispersaoCoordenadas(imoveis: Imovel[]): { imovel: Imovel; lng: number; lat: number }[] {
  const coordCount = new Map<string, number>()
  return imoveis
    .filter((i) => typeof i.latitude === 'number' && typeof i.longitude === 'number')
    .map((i) => {
      const chave = `${i.latitude!.toFixed(4)}_${i.longitude!.toFixed(4)}`
      const index = coordCount.get(chave) || 0
      coordCount.set(chave, index + 1)

      if (index === 0) {
        return { imovel: i, lng: i.longitude!, lat: i.latitude! }
      }

      // Pequeno deslocamento circular para que nenhum marcador fique 100% oculto atrás de outro
      const angulo = (index * (2 * Math.PI)) / 6
      const raio = 0.00018 * Math.ceil(index / 6)
      const deltaLat = raio * Math.sin(angulo)
      const deltaLng = raio * Math.cos(angulo)

      return {
        imovel: i,
        lng: i.longitude! + deltaLng,
        lat: i.latitude! + deltaLat,
      }
    })
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
  cidadeFiltro,
  isOrigemGps,
  isFavoritos,
  carregando,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapaRef = useRef<mapboxgl.Map | null>(null)
  const marcadorUsuarioRef = useRef<mapboxgl.Marker | null>(null)
  const marcadoresMapRef = useRef<Map<string, { marcador: mapboxgl.Marker; popup: mapboxgl.Popup; inner: HTMLElement; btnHeart: HTMLButtonElement }>>(new Map())
  const [mapaPronto, setMapaPronto] = useState(false)
  const [mostrarBannerDistante, setMostrarBannerDistante] = useState(false)
  const fitInicialExecutadoRef = useRef(false)
  const isAnimandoProgramaticoRef = useRef(false)
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Ref para evitar stale closure no listener do moveend
  const onPesquisarRef = useRef(onPesquisarNaArea)
  useEffect(() => { onPesquisarRef.current = onPesquisarNaArea }, [onPesquisarNaArea])

  // Inicializar mapa
  useEffect(() => {
    if (!containerRef.current || mapaRef.current) return

    const mapa = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: centroInicial ?? [-43.7867, -20.6603], // Região de atuação (Lafaiete/Hub)
      zoom: centroInicial ? 14 : 13,                 // Zoom 14 para GPS/localidade | Zoom 13 para visão urbana
      attributionControl: false,
    })

    mapa.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right')
    
    // Controle oficial de Geolocalização com alta precisão e sem cache
    const geolocateControl = new mapboxgl.GeolocateControl({
      positionOptions: {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 7000,
      },
      trackUserLocation: false,
      showUserHeading: true,
    })
    mapa.addControl(geolocateControl, 'top-right')

    mapa.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-right')

    mapa.on('load', () => {
      setMapaPronto(true)
      // Só dispara busca por bounds no load se NÃO houver filtro de cidade
      // (quando há cidade, o useEffect de enquadramento cuida de buscar por texto e fazer fitBounds)
      if (!cidadeFiltro) {
        onPesquisarRef.current?.(mapa.getBounds()!, false)
      }
    })

    mapa.on('moveend', (e) => {
      // Ignora se for uma animação programática inicial (fitBounds / flyTo do sistema)
      if (isAnimandoProgramaticoRef.current) return

      const isInteracaoUsuario = Boolean((e as unknown as { originalEvent?: unknown }).originalEvent)
      if (isInteracaoUsuario) {
        // Debounce de 300ms — evita disparar dezenas de queries durante arrasto contínuo
        if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
        debounceTimerRef.current = setTimeout(() => {
          onPesquisarRef.current?.(mapa.getBounds()!, true)
        }, 300)
      }
    })

    mapaRef.current = mapa
    return () => { mapa.remove(); mapaRef.current = null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Gerenciar marcador da localização do usuário
  useEffect(() => {
    if (!mapaPronto || !mapaRef.current) return

    if (marcadorUsuarioRef.current) {
      marcadorUsuarioRef.current.remove()
      marcadorUsuarioRef.current = null
    }

    if (centroInicial) {
      const el = document.createElement('div')
      el.className = styles.marcadorUsuario
      el.title = 'Sua localização atual'

      const popup = new mapboxgl.Popup({ offset: 12, closeButton: false }).setText('📍 Você está aqui')

      marcadorUsuarioRef.current = new mapboxgl.Marker({ element: el })
        .setLngLat(centroInicial)
        .setPopup(popup)
        .addTo(mapaRef.current)
    }
  }, [centroInicial, mapaPronto])

  // Enquadramento suave na montagem: distingue GPS puro de busca por cidade
  useEffect(() => {
    if (!mapaPronto || fitInicialExecutadoRef.current) {
      return
    }

    // Caso 1: Busca por cidade (com ou sem coordenadas do geocoding)
    // → Enquadra nos imóveis reais encontrados, não no centro da cidade
    if (cidadeFiltro) {
      const imoveisValidos = imoveis.filter((i) => i.latitude && i.longitude)
      if (carregando) return // Espera a busca terminar
      fitInicialExecutadoRef.current = true

      if (imoveisValidos.length > 0 && mapaRef.current) {
        isAnimandoProgramaticoRef.current = true
        const bounds = new mapboxgl.LngLatBounds()
        imoveisValidos.forEach((i) => bounds.extend([i.longitude!, i.latitude!]))
        mapaRef.current.fitBounds(bounds, { padding: 60, duration: 900, maxZoom: 15 })
        mapaRef.current.once('idle', () => {
          isAnimandoProgramaticoRef.current = false
          // Após enquadrar, dispara busca com os bounds reais para sincronizar a lista
          if (mapaRef.current) {
            onPesquisarRef.current?.(mapaRef.current.getBounds()!, false)
          }
        })
        setMostrarBannerDistante(false)
      } else {
        setMostrarBannerDistante(true)
      }
      return
    }

    // Caso 2: GPS puro (origem=gps, sem filtro de cidade)
    // → Mantém câmera no centro do usuário com zoom 14
    if (centroInicial) {
      fitInicialExecutadoRef.current = true
      if (!carregando) {
        setMostrarBannerDistante(imoveis.length === 0)
      }
      return
    }
  }, [centroInicial, imoveis, mapaPronto, cidadeFiltro, carregando])

  // Atualiza exibição do banner distante quando a lista de imóveis da área for atualizada
  useEffect(() => {
    // Só avalia o banner APÓS o carregamento terminar
    if (carregando) return
    if (centroInicial && mapaPronto) {
      setMostrarBannerDistante(imoveis.length === 0)
    } else {
      setMostrarBannerDistante(false)
    }
  }, [centroInicial, imoveis, mapaPronto, carregando])

  // Quando o modo de favoritos estiver ativo ou a lista de favoritos mudar: enquadrar todos os favoritos no mapa
  useEffect(() => {
    if (!mapaPronto || !mapaRef.current || !isFavoritos) return
    const imoveisValidos = imoveis.filter((i) => i.latitude && i.longitude)
    if (imoveisValidos.length === 0) return

    const bounds = new mapboxgl.LngLatBounds()
    imoveisValidos.forEach((i) => bounds.extend([i.longitude!, i.latitude!]))
    mapaRef.current.fitBounds(bounds, { padding: 80, duration: 900, maxZoom: 14 })
  }, [isFavoritos, imoveis, mapaPronto])

  function handleEnquadrarTodosImoveis() {
    if (!mapaRef.current) return
    isAnimandoProgramaticoRef.current = true
    mapaRef.current.flyTo({
      center: [-43.7867, -20.6603],
      zoom: 13,
      duration: 1600,
      essential: true,
    })
    mapaRef.current.once('idle', () => {
      isAnimandoProgramaticoRef.current = false
      if (mapaRef.current) {
        onPesquisarRef.current?.(mapaRef.current.getBounds()!, true)
      }
    })
    setMostrarBannerDistante(false)
  }

  // Voar para coordenadas quando o usuário seleciona uma sugestão do autocomplete
  useEffect(() => {
    if (!mapaPronto || !mapaRef.current || !voarPara) return
    isAnimandoProgramaticoRef.current = true
    mapaRef.current.flyTo({
      center: voarPara,
      zoom: 13,
      duration: 1400,
      essential: true,
    })
    mapaRef.current.once('idle', () => {
      isAnimandoProgramaticoRef.current = false
      // Dispara busca com os bounds reais da nova posição para atualizar lista e marcadores
      if (mapaRef.current) {
        onPesquisarRef.current?.(mapaRef.current.getBounds()!, false)
      }
    })
  }, [voarPara, mapaPronto])

  // Cache local em memória de IDs favoritados para renderização síncrona instantânea (sem piscar)
  const favoritosSetRef = useRef<Set<string>>(new Set())

  // Carregar todos os favoritos do usuário logado de uma só vez
  useEffect(() => {
    async function carregarIdsFavoritos() {
      try {
        const { createClient } = await import('@/lib/supabase/client')
        const sb = createClient()
        const { data: { session } } = await sb.auth.getSession()
        if (session?.user) {
          const { data } = await sb
            .from('favoritos')
            .select('imovel_id')
            .eq('usuario_id', session.user.id)

          const ids = (data ?? []).map((f: any) => f.imovel_id).filter(Boolean)
          favoritosSetRef.current = new Set(ids)

          // Atualiza marcadores existentes no mapa caso já estejam renderizados
          ids.forEach((id: string) => {
            const item = marcadoresMapRef.current.get(id)
            if (item) {
              item.btnHeart.innerHTML = ''
              item.btnHeart.appendChild(criarSvgHeart(true))
              item.btnHeart.dataset.favoritado = 'true'
              item.btnHeart.style.opacity = '1'
            }
          })
        } else {
          favoritosSetRef.current.clear()
        }
      } catch { /* silencioso */ }
    }

    carregarIdsFavoritos()
  }, [])

  // Sincroniza favoritos: lista → mapa
  useEffect(() => {
    function handleFavoritoAtualizado(e: Event) {
      const { imovelId, favoritado } = (e as CustomEvent).detail
      if (favoritado) {
        favoritosSetRef.current.add(imovelId)
      } else {
        favoritosSetRef.current.delete(imovelId)
      }

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

  // Helper síncrono para criar SVG do coração
  function criarSvgHeart(cheio: boolean): SVGSVGElement {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.setAttribute('width', '14')
    svg.setAttribute('height', '14')
    svg.setAttribute('viewBox', '0 0 24 24')
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    path.setAttribute(
      'd',
      'M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z'
    )
    path.setAttribute('fill', cheio ? '#e53e3e' : 'none')
    path.setAttribute('stroke', cheio ? '#e53e3e' : '#94a3b8')
    path.setAttribute('stroke-width', '2.5')
    path.setAttribute('stroke-linecap', 'round')
    path.setAttribute('stroke-linejoin', 'round')
    svg.appendChild(path)
    return svg
  }

  // Recriar marcadores quando lista de imoveis mudar
  useEffect(() => {
    if (!mapaPronto || !mapaRef.current) return
    const mapa = mapaRef.current

    marcadoresMapRef.current.forEach(({ marcador }) => marcador.remove())
    marcadoresMapRef.current.clear()

    aplicarDispersaoCoordenadas(imoveis).forEach(({ imovel: i, lng, lat }) => {
        const label = precoLabel(i.preco || 0)
        const isFavoritado = favoritosSetRef.current.has(i.id)

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

        // Coração no marcador — já nasce perfeitamente preenchido e visível se for favorito (sem piscar!)
        const btnHeart = document.createElement('button')
        btnHeart.type = 'button'
        btnHeart.title = isFavoritado ? 'Remover dos favoritos' : 'Favoritar'
        btnHeart.dataset.favoritado = String(isFavoritado)
        btnHeart.style.cssText = `background:none;border:none;cursor:pointer;padding:0;display:flex;align-items:center;line-height:1;transition:transform 0.15s,opacity 0.15s;opacity:${isFavoritado ? '1' : '0'}`
        btnHeart.appendChild(criarSvgHeart(isFavoritado))
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
              favoritosSetRef.current.delete(i.id)
              await sb.from('favoritos').delete().eq('usuario_id', session.user.id).eq('imovel_id', i.id)
              btnHeart.innerHTML = ''; btnHeart.appendChild(criarSvgHeart(false))
              btnHeart.dataset.favoritado = 'false'
              btnHeart.style.opacity = '0'
              window.dispatchEvent(new CustomEvent('fixum:favoritoAtualizado', { detail: { imovelId: i.id, favoritado: false } }))
            } else {
              favoritosSetRef.current.add(i.id)
              await sb.from('favoritos').insert({ usuario_id: session.user.id, imovel_id: i.id })
              btnHeart.innerHTML = ''; btnHeart.appendChild(criarSvgHeart(true))
              btnHeart.dataset.favoritado = 'true'
              btnHeart.style.opacity = '1'
              window.dispatchEvent(new CustomEvent('fixum:favoritoAtualizado', { detail: { imovelId: i.id, favoritado: true } }))
            }
          } catch { /* silencioso */ }
        })

        wrapper.appendChild(inner)

        wrapper.addEventListener('click', (e) => {
          e.stopPropagation()
          // Fechar todos os outros popups antes de abrir este
          marcadoresMapRef.current.forEach(({ popup, marcador }, otherId) => {
            if (otherId !== i.id && popup.isOpen()) marcador.togglePopup()
          })

          // Auto-ajuste de câmera (Auto-Pan inteligente): garante que o popup nunca fique cortado em nenhuma borda
          if (mapa && lng && lat) {
            const point = mapa.project([lng, lat])
            const containerH = mapa.getContainer().clientHeight
            const containerW = mapa.getContainer().clientWidth

            let deltaY = 0
            let deltaX = 0

            // Se estiver próximo à parte inferior (popup tem ~320px de altura)
            if (point.y > containerH - 340) {
              deltaY = point.y - (containerH - 340) + 40
            } else if (point.y < 130) {
              deltaY = point.y - 130
            }

            // Se estiver próximo às laterais
            if (point.x < 160) {
              deltaX = point.x - 160
            } else if (point.x > containerW - 160) {
              deltaX = point.x - (containerW - 160)
            }

            if (deltaX !== 0 || deltaY !== 0) {
              mapa.panBy([deltaX, deltaY], { duration: 320 })
            }
          }

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

        const isMobile = window.innerWidth < 768
        const popupW = isMobile ? 200 : 270
        const fotoH = isMobile ? 90 : 160

        const popupEl = document.createElement('div')
        popupEl.style.cssText = `font-family:system-ui,-apple-system,sans-serif;width:${popupW}px;overflow:hidden;border-radius:${isMobile ? '12px' : '16px'};cursor:pointer;`
        popupEl.innerHTML = `
          <a href="/imovel/${i.id}" style="text-decoration:none;color:inherit;display:block;">
            ${fotoUrl ? `
              <div style="position:relative;height:${fotoH}px;overflow:hidden;border-radius:${isMobile ? '10px 10px 0 0' : '12px 12px 0 0'};">
                <img src="${fotoUrl}" alt="${i.titulo || ''}"
                  style="width:100%;height:100%;object-fit:cover;display:block;"
                />
                <div style="position:absolute;inset:0;background:linear-gradient(to top,rgba(0,0,0,0.35) 0%,transparent 50%);pointer-events:none;"></div>
                <div style="position:absolute;bottom:${isMobile ? '6px' : '10px'};left:${isMobile ? '8px' : '12px'};background:white;color:#1a56db;font-size:${isMobile ? '12px' : '14px'};font-weight:800;padding:${isMobile ? '2px 7px' : '3px 9px'};border-radius:20px;letter-spacing:-0.02em;">
                  ${label}${negociacaoLabel}
                </div>
              </div>
            ` : `
              <div style="height:${isMobile ? '48px' : '80px'};background:linear-gradient(135deg,#e0eaff,#c7d7f7);border-radius:12px 12px 0 0;display:flex;align-items:center;justify-content:center;">
                <span style="font-size:${isMobile ? '12px' : '14px'};font-weight:800;color:#1a56db;">${label}${negociacaoLabel}</span>
              </div>
            `}
            <div style="padding:${isMobile ? '8px 10px 10px' : '12px 14px 14px'};">
              <div style="font-size:${isMobile ? '11px' : '13px'};font-weight:700;color:#0f172a;line-height:1.3;margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                ${i.titulo || ''}
              </div>
              ${localidade ? `<div style="font-size:${isMobile ? '10px' : '12px'};color:#64748b;margin-bottom:${detalhes ? '4px' : '0'};">${localidade}</div>` : ''}
              ${detalhes ? `<div style="font-size:${isMobile ? '10px' : '11.5px'};color:#94a3b8;">${detalhes}</div>` : ''}
              ${!isMobile ? `
                <div style="margin-top:8px;padding-top:8px;border-top:1px solid #f1f5f9;display:flex;align-items:center;justify-content:space-between;gap:6px;">
                  <div style="display:flex;align-items:center;gap:5px;min-width:0;overflow:hidden;">
                    ${i.anunciante?.foto_url ? `
                      <img src="${i.anunciante.foto_url}" alt="Logo" style="width:18px;height:18px;border-radius:50%;object-fit:cover;flex-shrink:0;border:1px solid #cbd5e1;" />
                    ` : `
                      <div style="width:18px;height:18px;border-radius:50%;background:#eff6ff;color:#2563eb;font-size:9px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                        ${(i.anunciante?.nome || 'FX').slice(0, 2).toUpperCase()}
                      </div>
                    `}
                    <span style="font-size:11px;font-weight:700;color:#475569;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                      ${i.anunciante?.nome || 'Imobiliária'}
                    </span>
                  </div>
                  ${i.codigo ? `<span style="font-size:10px;font-weight:800;color:#1e40af;background:#dbeafe;border:1px solid #bfdbfe;padding:1px 5px;border-radius:4px;white-space:nowrap;flex-shrink:0;">Ref: ${i.codigo}</span>` : '<span style="font-size:11px;font-weight:700;color:#1a56db;flex-shrink:0;">Ver →</span>'}
                </div>
              ` : ''}
            </div>
          </a>
        `

        const popup = new mapboxgl.Popup({
          offset: isMobile ? 14 : 20,
          closeButton: true,
          closeOnClick: true,
          maxWidth: isMobile ? '220px' : '290px',
          className: 'fixum-popup',
        }).setDOMContent(popupEl)

        const marcador = new mapboxgl.Marker({ element: wrapper })
          .setLngLat([lng, lat])
          .setPopup(popup)
          .addTo(mapa)

        marcadoresMapRef.current.set(i.id, { marcador, popup, inner, btnHeart })
      })

    return () => {
      marcadoresMapRef.current.forEach(({ marcador }) => marcador.remove())
      marcadoresMapRef.current.clear()
    }
  }, [imoveis, mapaPronto, onSelecionarImovel])

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

      {mostrarBannerDistante && (
        <div className={styles.bannerDistante}>
          <span>📍 Imóveis disponíveis em outras cidades</span>
          <button
            type="button"
            className={styles.btnVerTodosMapa}
            onClick={handleEnquadrarTodosImoveis}
          >
            Ver {imoveis.length} {imoveis.length === 1 ? 'imóvel' : 'imóveis'} no mapa
          </button>
        </div>
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