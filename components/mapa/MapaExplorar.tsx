'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import Link from 'next/link'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { type Imovel } from '@/lib/types'
import { resolverExibicaoPreco, formatarPrecoCurto } from '@/lib/utils'
import { aplicarEstiloFixum, ESTILO_BASE } from '@/lib/estilo-mapa'
import Icone from '@/components/ui/Icone'
import MarcaDaguaTeste from '@/components/ui/MarcaDaguaTeste'
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

function escaparHtml(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
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
  const [imovelCardMobile, setImovelCardMobile] = useState<Imovel | null>(null)
  const fitInicialExecutadoRef = useRef(false)

  // Agrupamento: pins que se sobrepõem na tela viram um círculo com a contagem
  const clustersRef = useRef<mapboxgl.Marker[]>([])
  const selecionadoRef = useRef<string | null | undefined>(imovelSelecionado)
  const reagruparRef = useRef<() => void>(() => {})
  reagruparRef.current = () => {
    const mapa = mapaRef.current
    if (!mapa) return
    clustersRef.current.forEach((m) => m.remove())
    clustersRef.current = []

    const itens = [...marcadoresMapRef.current.entries()].map(([id, it]) => ({
      id,
      it,
      p: mapa.project(it.marcador.getLngLat()),
    }))
    itens.forEach(({ it }) => { it.marcador.getElement().style.visibility = '' })
    if (mapa.getZoom() >= 16.5 || itens.length < 2) return

    const usados = new Set<string>()
    for (const a of itens) {
      if (usados.has(a.id) || a.id === selecionadoRef.current) continue
      const grupo = itens.filter(
        (b) =>
          !usados.has(b.id) &&
          b.id !== selecionadoRef.current &&
          Math.abs(b.p.x - a.p.x) < 72 &&
          Math.abs(b.p.y - a.p.y) < 30
      )
      if (grupo.length < 2) continue

      const limites = new mapboxgl.LngLatBounds()
      grupo.forEach((g) => {
        usados.add(g.id)
        limites.extend(g.it.marcador.getLngLat())
        g.it.marcador.getElement().style.visibility = 'hidden'
        if (g.it.popup.isOpen()) g.it.popup.remove()
      })

      const el = document.createElement('button')
      el.type = 'button'
      el.className = styles.cluster
      el.textContent = String(grupo.length)
      el.setAttribute('aria-label', `${grupo.length} imóveis aqui. Aproximar.`)
      el.title = `${grupo.length} imóveis — clique para aproximar`
      el.addEventListener('click', (e) => {
        e.stopPropagation()
        mapa.fitBounds(limites, { padding: 90, maxZoom: 17, duration: 600 })
        // aproximar pelo grupo é ação do usuário: atualiza a lista para a nova área
        mapa.once('moveend', () => onPesquisarRef.current?.(mapa.getBounds()!, true))
      })
      clustersRef.current.push(
        new mapboxgl.Marker({ element: el }).setLngLat(limites.getCenter()).addTo(mapa)
      )
    }
  }
  const isAnimandoProgramaticoRef = useRef(false)
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Ref para evitar stale closure no listener do moveend
  const onPesquisarRef = useRef(onPesquisarNaArea)
  useEffect(() => { onPesquisarRef.current = onPesquisarNaArea }, [onPesquisarNaArea])

  // Inicializar mapa
  useEffect(() => {
    if (!containerRef.current || mapaRef.current) return

    let centroCalculado: [number, number] = centroInicial ?? [-43.7867, -20.6603]
    let zoomCalculado: number = centroInicial ? 14 : 13
    let veioDePosicaoSalva = false

    if (typeof window !== 'undefined') {
      try {
        const salvoStr = sessionStorage.getItem('fixum_mapa_pos')
        if (salvoStr) {
          const salvo = JSON.parse(salvoStr)
          if (Array.isArray(salvo.center) && typeof salvo.zoom === 'number') {
            centroCalculado = salvo.center
            zoomCalculado = salvo.zoom
            veioDePosicaoSalva = true
            fitInicialExecutadoRef.current = true // Não roda fitBounds agressivo, preserva onde o usuário estava
          }
        }
      } catch {}
    }

    const mapa = new mapboxgl.Map({
      container: containerRef.current,
      style: ESTILO_BASE,
      center: centroCalculado,
      zoom: zoomCalculado,
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

    mapa.on('style.load', () => aplicarEstiloFixum(mapa))

    mapa.on('load', () => {
      setMapaPronto(true)
      // Dispara a busca com os bounds da área restaurada ou visível
      if (veioDePosicaoSalva || !cidadeFiltro) {
        onPesquisarRef.current?.(mapa.getBounds()!, false)
      }
    })

      mapa.on('click', (e) => {
        const target = (e.originalEvent as MouseEvent)?.target as HTMLElement | undefined
        if (!target?.closest(`.${styles.marcador}`)) {
          setImovelCardMobile(null)
        }
      })

      mapa.on('zoomend', () => reagruparRef.current())

      mapa.on('moveend', (e) => {
        // Grava a posição contínua da câmera para que, ao abrir um imóvel e voltar, a posição seja 100% idêntica
        if (typeof window !== 'undefined') {
          try {
            const center = mapa.getCenter()
            sessionStorage.setItem('fixum_mapa_pos', JSON.stringify({
              center: [center.lng, center.lat],
              zoom: mapa.getZoom(),
            }))
          } catch {}
        }

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

      const popup = new mapboxgl.Popup({ offset: 12, closeButton: false }).setText('Você está aqui')

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

  // Ícone "fixar": o alfinete do logotipo, desenhado de forma síncrona para não piscar
  function criarSvgHeart(cheio: boolean): SVGSVGElement {
    const ns = 'http://www.w3.org/2000/svg'
    const svg = document.createElementNS(ns, 'svg')
    svg.setAttribute('width', '16')
    svg.setAttribute('height', '16')
    svg.setAttribute('viewBox', '0 0 24 24')
    svg.setAttribute('fill', 'none')
    svg.setAttribute('stroke', 'currentColor')
    svg.setAttribute('stroke-linecap', 'round')
    const cabeca = document.createElementNS(ns, 'circle')
    cabeca.setAttribute('cx', '12'); cabeca.setAttribute('cy', '7.6'); cabeca.setAttribute('r', '4.8')
    cabeca.setAttribute('stroke-width', '2')
    cabeca.setAttribute('fill', cheio ? '#D4401F' : '#ffffff')
    if (cheio) cabeca.setAttribute('stroke', '#D4401F')
    const haste = document.createElementNS(ns, 'path')
    haste.setAttribute('d', 'M12 12.4v6.2'); haste.setAttribute('stroke-width', '2.2'); haste.setAttribute('stroke-linecap', 'butt')
    const agulha = document.createElementNS(ns, 'path')
    agulha.setAttribute('d', 'M12 18.6v3.6'); agulha.setAttribute('stroke-width', '1.2')
    svg.append(agulha, haste, cabeca)
    if (cheio) svg.classList.add(styles.pinoCravando)
    return svg
  }

  // Recriar marcadores quando lista de imoveis mudar
  useEffect(() => {
    if (!mapaPronto || !mapaRef.current) return
    const mapa = mapaRef.current

    marcadoresMapRef.current.forEach(({ marcador }) => marcador.remove())
    marcadoresMapRef.current.clear()

    aplicarDispersaoCoordenadas(imoveis).forEach(({ imovel: i, lng, lat }) => {
        const modoFinal = resolverExibicaoPreco(i.anunciante?.modo_exibicao_preco, i.modo_exibicao_preco, (i as any).exibir_preco, i.preco)
        const isSobConsulta = modoFinal === 'sob_consulta'
        const label = isSobConsulta ? 'Sob consulta' : precoLabel(i.preco || 0)
        const labelPin = formatarPrecoCurto(i.preco, i.negociacao, modoFinal)
        const isFavoritado = favoritosSetRef.current.has(i.id)

        // wrapper transparente — o Mapbox aplica o transform nele para posicionar
        const wrapper = document.createElement('div')
        wrapper.style.cssText = 'cursor:pointer;'

        // inner é o elemento visual (bolha de preço)
        const inner = document.createElement('div')
        inner.className = styles.marcador
        inner.dataset.id = i.id
        if (i.destaque) inner.classList.add(styles.marcadorDestaque)

        // Texto do preço
        const precoSpan = document.createElement('span')
        precoSpan.textContent = labelPin
        inner.appendChild(precoSpan)

        // Coração no marcador — já nasce perfeitamente preenchido e visível se for favorito (sem piscar!)
        const btnHeart = document.createElement('button')
        btnHeart.type = 'button'
        btnHeart.title = isFavoritado ? 'Desafixar' : 'Fixar'
        btnHeart.setAttribute('aria-label', isFavoritado ? 'Desafixar imóvel' : 'Fixar imóvel')
        btnHeart.dataset.favoritado = String(isFavoritado)
        btnHeart.className = styles.marcadorFixar
        btnHeart.style.opacity = isFavoritado ? '1' : '0'
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
                detail: { mensagem: 'Entre para fixar imóveis e comparar depois.' }
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
          const isMobile = window.innerWidth < 768

          if (isMobile) {
            // No Mobile: abre o card flutuante no rodapé estilo Airbnb (sem balão cobrindo o mapa)
            marcadoresMapRef.current.forEach(({ popup }) => {
              if (popup.isOpen()) popup.remove()
            })
            setImovelCardMobile(i)
            onSelecionarImovel?.(i.id)
            return
          }

          // No Desktop: abre popup ancorado Mapbox normalmente
          marcadoresMapRef.current.forEach(({ popup, marcador }, otherId) => {
            if (otherId !== i.id && popup.isOpen()) marcador.togglePopup()
          })

          // Auto-ajuste de câmera (Auto-Pan inteligente) no desktop
          if (mapa && lng && lat) {
            const point = mapa.project([lng, lat])
            const containerH = mapa.getContainer().clientHeight
            const containerW = mapa.getContainer().clientWidth

            let deltaY = 0
            let deltaX = 0

            if (point.y > containerH - 340) {
              deltaY = point.y - (containerH - 340) + 40
            } else if (point.y < 130) {
              deltaY = point.y - 130
            }

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

        const negociacaoLabel = (!isSobConsulta && i.negociacao === 'aluguel') ? '/mês' : ''
        const popupPrecoTexto = isSobConsulta ? 'Preço sob consulta' : `${label}${negociacaoLabel}`

        const isMobile = window.innerWidth < 768

        // Todo texto vindo do anúncio é escapado antes de entrar no HTML do popup
        const titulo = escaparHtml(i.titulo || '')
        const anuncianteNome = escaparHtml(i.anunciante?.nome || 'Anunciante')
        const iniciais = escaparHtml((i.anunciante?.nome || 'FX').slice(0, 2).toUpperCase())

        const popupEl = document.createElement('div')
        popupEl.className = `fx-popup${isMobile ? ' fx-popup--compacto' : ''}`
        popupEl.innerHTML = `
          <a href="/imovel/${encodeURIComponent(i.id)}?origem=mapa" target="_blank" rel="noopener noreferrer" class="fx-popup-link">
            <div class="fx-popup-foto">
              ${fotoUrl
                ? `<img src="${escaparHtml(fotoUrl)}" alt="${titulo}" loading="lazy" />`
                : `<div class="fx-popup-semfoto"></div>`}
              <span class="fx-popup-teste">Anúncio fictício · teste</span>
            </div>
            <div class="fx-popup-corpo">
              <div class="fx-popup-preco${isSobConsulta ? ' fx-popup-preco--consulta' : ''}">${escaparHtml(popupPrecoTexto)}</div>
              <div class="fx-popup-titulo">${titulo}</div>
              ${localidade ? `<div class="fx-popup-local">${escaparHtml(localidade)}</div>` : ''}
              ${detalhes ? `<div class="fx-popup-detalhes">${escaparHtml(detalhes)}</div>` : ''}
              ${!isMobile ? `
                <div class="fx-popup-rodape">
                  <span class="fx-popup-anunciante">
                    ${i.anunciante?.foto_url
                      ? `<img src="${escaparHtml(i.anunciante.foto_url)}" alt="" />`
                      : `<span class="fx-popup-iniciais">${iniciais}</span>`}
                    <span>${anuncianteNome}</span>
                  </span>
                  ${i.codigo ? `<span class="fx-popup-ref">${escaparHtml(i.codigo)}</span>` : ''}
                </div>
              ` : ''}
            </div>
          </a>
        `

        const popup = new mapboxgl.Popup({
          offset: isMobile ? 14 : 20,
          closeButton: true,
          closeOnClick: false,
          maxWidth: isMobile ? '220px' : '290px',
          className: 'fixum-popup',
        }).setDOMContent(popupEl)

        const marcador = new mapboxgl.Marker({ element: wrapper })
          .setLngLat([lng, lat])
          .setPopup(popup)
          .addTo(mapa)

        marcadoresMapRef.current.set(i.id, { marcador, popup, inner, btnHeart })
      })

    reagruparRef.current()

    return () => {
      marcadoresMapRef.current.forEach(({ marcador }) => marcador.remove())
      marcadoresMapRef.current.clear()
      clustersRef.current.forEach((m) => m.remove())
      clustersRef.current = []
    }
  }, [imoveis, mapaPronto, onSelecionarImovel])

  // Hover/seleção — só classes no .inner, nunca no wrapper (que o Mapbox posiciona)
  useEffect(() => {
    marcadoresMapRef.current.forEach(({ inner, marcador }, id) => {
      const selecionado = id === imovelSelecionado
      const emFoco = id === imovelHover
      inner.classList.toggle(styles.marcadorSelecionado, selecionado)
      inner.classList.toggle(styles.marcadorHover, emFoco && !selecionado)
      // traz o pin ativo para frente dos vizinhos
      marcador.getElement().style.zIndex = selecionado ? '3' : emFoco ? '2' : ''
    })
    if (selecionadoRef.current !== imovelSelecionado) {
      selecionadoRef.current = imovelSelecionado
      reagruparRef.current()
    }
  }, [imovelHover, imovelSelecionado])

  // Sincronizar seleção externa no mobile
  useEffect(() => {
    if (!imovelSelecionado) {
      setImovelCardMobile(null)
      return
    }
    const enc = imoveis.find((im) => im.id === imovelSelecionado)
    if (enc && typeof window !== 'undefined' && window.innerWidth < 768) {
      setImovelCardMobile(enc)
    }
  }, [imovelSelecionado, imoveis])

  return (
    <div className={styles.wrapper}>
      <div ref={containerRef} className={styles.mapa} />

      {mostrarBannerDistante && (
        <div className={styles.bannerDistante}>
          <span>Nenhum imóvel por aqui ainda. Há anúncios em outras regiões.</span>
          <button
            type="button"
            className={styles.btnVerTodosMapa}
            onClick={handleEnquadrarTodosImoveis}
          >
            Ver {imoveis.length} {imoveis.length === 1 ? 'imóvel' : 'imóveis'} no mapa
          </button>
        </div>
      )}

      {/* Card Flutuante no Rodapé para Mobile (Estilo Airbnb) */}
      {imovelCardMobile && (
        <div className={styles.cardFlutuanteMobile}>
          <button
            type="button"
            className={styles.btnFecharCardMobile}
            onClick={() => setImovelCardMobile(null)}
            aria-label="Fechar prévia"
          >
            <Icone nome="fechar" tamanho={16} />
          </button>
          <Link
            href={`/imovel/${imovelCardMobile.id}?origem=mapa`}
            className={styles.linkCardMobile}
            onClick={() => {
              if (typeof window !== 'undefined') {
                sessionStorage.setItem('fixum_vista_ativa', 'mapa')
              }
            }}
          >
            <div className={styles.fotoCardMobile}>
              <MarcaDaguaTeste variante="compacto" />
              {imovelCardMobile.fotos?.find((f) => f.principal)?.url || imovelCardMobile.fotos?.[0]?.url ? (
                <img
                  src={imovelCardMobile.fotos?.find((f) => f.principal)?.url || imovelCardMobile.fotos?.[0]?.url}
                  alt={imovelCardMobile.titulo || ''}
                />
              ) : (
                <div className={styles.semFotoCardMobile}>Fixum</div>
              )}
              <span className={styles.precoBadgeMobile}>
                {resolverExibicaoPreco(imovelCardMobile.anunciante?.modo_exibicao_preco, imovelCardMobile.modo_exibicao_preco, (imovelCardMobile as any).exibir_preco, imovelCardMobile.preco) === 'sob_consulta'
                  ? 'Preço sob consulta'
                  : formatarPrecoCurto(imovelCardMobile.preco, imovelCardMobile.negociacao)}
              </span>
            </div>
            <div className={styles.infoCardMobile}>
              <h4 className={styles.tituloCardMobile}>{imovelCardMobile.titulo || 'Imóvel sem título'}</h4>
              <p className={styles.localCardMobile}>
                {(imovelCardMobile.bairro ? `${imovelCardMobile.bairro}, ` : '') + (imovelCardMobile.cidade || '')}
              </p>
              <p className={styles.detalhesCardMobile}>
                {[
                  imovelCardMobile.quartos ? `${imovelCardMobile.quartos} ${imovelCardMobile.quartos === 1 ? 'quarto' : 'quartos'}` : null,
                  imovelCardMobile.area ? `${imovelCardMobile.area} m²` : null,
                  imovelCardMobile.vagas ? `${imovelCardMobile.vagas} ${imovelCardMobile.vagas === 1 ? 'vaga' : 'vagas'}` : null,
                ]
                  .filter(Boolean)
                  .join(' · ') || 'Veja os detalhes'}
              </p>
              <div className={styles.rodapeCardMobile}>
                <span className={styles.anuncianteCardMobile}>
                  {imovelCardMobile.anunciante?.nome || 'Imobiliária parceira'}
                </span>
                <span className={styles.btnVerCardMobile}>Ver imóvel <Icone nome="chevronDireita" tamanho={14} /></span>
              </div>
            </div>
          </Link>
        </div>
      )}

      {!mapaPronto && (
        <div className={styles.loading}>
          <div className={styles.loadingSpinner} />
          <span>Carregando o mapa…</span>
        </div>
      )}
    </div>
  )
}