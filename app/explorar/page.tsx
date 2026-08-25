'use client'

import { useState, useEffect, useCallback, useRef, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import Header from '@/components/layout/Header'
import CardImovel from '@/components/imovel/CardImovel'
import FiltrosBusca from '@/components/imovel/FiltrosBusca'
import { type Sugestao } from '@/components/imovel/BuscaAutoComplete'
import { type Imovel, type FiltrosBusca as TFiltros } from '@/lib/types'
import { createClient } from '@/lib/supabase/client'
import styles from './page.module.css'
import mapboxgl from 'mapbox-gl'

const MapaExplorar = dynamic(() => import('@/components/mapa/MapaExplorar'), {
  ssr: false,
  loading: () => <div className={styles.mapaLoading}><span>Carregando mapa...</span></div>,
})

function ExplorarConteudo() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [imoveis, setImoveis] = useState<Imovel[]>([])
  const [carregando, setCarregando] = useState(true)
  const [imovelHover, setImovelHover] = useState<string | null>(null)
  const [imovelSelecionado, setImovelSelecionado] = useState<string | null>(null)
  const [totalResultados, setTotalResultados] = useState(0)
  const [vistaAtiva, setVistaAtiva] = useState<'lista' | 'mapa'>('lista')
  const [voarPara, setVoarPara] = useState<[number, number] | null>(null)
  const imobiliariaId = searchParams.get('imobiliaria') || searchParams.get('imobiliaria_id') || null
  const nomeImobParam = searchParams.get('nome') || ''
  const [nomeImobiliaria, setNomeImobiliaria] = useState(nomeImobParam)

  const [filtros, setFiltros] = useState<TFiltros>(() => {
    const negParam = searchParams.get('negociacao')
    const negociacaoInicial = negParam ? (negParam as TFiltros['negociacao']) : (imobiliariaId ? undefined : 'venda')
    return {
      negociacao: negociacaoInicial,
      cidade: searchParams.get('cidade') ?? searchParams.get('q') ?? undefined,
    }
  })

  const isFavoritos = searchParams.get('favoritos') === 'true'
  const isOrigemGps = searchParams.get('origem') === 'gps'
  const [precisaLoginFavoritos, setPrecisaLoginFavoritos] = useState(false)

  // Centro inicial do mapa: vem da URL (lat/lng do modal de busca) ou fallback fixo
  const centroInicial = (() => {
    const lat = parseFloat(searchParams.get('lat') ?? '')
    const lng = parseFloat(searchParams.get('lng') ?? '')
    if (!isNaN(lat) && !isNaN(lng)) return [lng, lat] as [number, number]
    return undefined
  })()
  // Guarda os bounds atuais do mapa — ao mudar filtros, mantém a área visível
  const boundsAtualRef = useRef<mapboxgl.LngLatBounds | null>(null)
  const idsImobiliariaCacheRef = useRef<Record<string, string[]>>({})
  // Cache do mapa membro→imobiliária (carregado 1x, evita N requests a cada arrasto)
  const mapaBrandingRef = useRef<Map<string, any> | null>(null)
  const brandingCarregandoRef = useRef(false)
  // Flag para bloquear busca duplicada durante transição de flyTo (autocomplete)
  const voandoParaRef = useRef(false)

  const supabase = createClient()

  const buscarImoveis = useCallback(async (filtrosAtivos: TFiltros, bounds?: mapboxgl.LngLatBounds | null) => {
    setCarregando(true)
    setPrecisaLoginFavoritos(false)
    try {
      let idsFavoritos: string[] = []

      if (isFavoritos) {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.user) {
          setPrecisaLoginFavoritos(true)
          setImoveis([])
          setTotalResultados(0)
          setCarregando(false)
          return
        }

        const { data: favs } = await supabase
          .from('favoritos')
          .select('imovel_id')
          .eq('usuario_id', session.user.id)

        idsFavoritos = (favs ?? []).map((f: any) => f.imovel_id).filter(Boolean)

        if (idsFavoritos.length === 0) {
          setImoveis([])
          setTotalResultados(0)
          setCarregando(false)
          return
        }
      }

      // Se estiver filtrando por imobiliária, descobrir os IDs da equipe dela (com cache local)
      let idsAnunciantesImob: string[] | null = null
      if (imobiliariaId) {
        if (idsImobiliariaCacheRef.current[imobiliariaId]) {
          idsAnunciantesImob = idsImobiliariaCacheRef.current[imobiliariaId]
        } else {
          try {
            const resImob = await fetch(`/api/imobiliarias/${imobiliariaId}`)
            if (resImob.ok) {
              const dadosImob = await resImob.json()
              if (dadosImob.imobiliaria?.nome) {
                setNomeImobiliaria(dadosImob.imobiliaria.nome)
              }
              if (dadosImob.idsAnunciantes?.length > 0) {
                idsAnunciantesImob = dadosImob.idsAnunciantes
                idsImobiliariaCacheRef.current[imobiliariaId] = dadosImob.idsAnunciantes
              }
            }
          } catch {
            idsAnunciantesImob = [imobiliariaId]
            idsImobiliariaCacheRef.current[imobiliariaId] = [imobiliariaId]
          }
        }
      }

      let query = supabase
        .from('imoveis')
        .select(`*, fotos_imovel (id, url, principal, ordem), perfis:anunciante_id (id, nome, tipo, foto_url)`)
        .in('status', ['publicado', 'ativo'])
        .order('destaque', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(60)

      if (isFavoritos) {
        if (idsFavoritos.length > 0) {
          query = query.in('id', idsFavoritos)
        } else {
          setImoveis([])
          setTotalResultados(0)
          setCarregando(false)
          return
        }
      }

      if (idsAnunciantesImob && idsAnunciantesImob.length > 0) {
        query = query.in('anunciante_id', idsAnunciantesImob)
      }

      if (filtrosAtivos.negociacao) query = query.eq('negociacao', filtrosAtivos.negociacao)
      if (filtrosAtivos.tipo && filtrosAtivos.tipo.length > 0) query = query.in('tipo', filtrosAtivos.tipo)
      if (filtrosAtivos.preco_min) query = query.gte('preco', filtrosAtivos.preco_min)
      if (filtrosAtivos.preco_max) query = query.lte('preco', filtrosAtivos.preco_max)
      if (filtrosAtivos.quartos_min) query = query.gte('quartos', filtrosAtivos.quartos_min)

      // Filtro por bounds do mapa (pesquisar na área visível ao dar zoom / arrastar)
      if (bounds && !isFavoritos) {
        const sw = bounds.getSouthWest()
        const ne = bounds.getNorthEast()
        query = query
          .gte('latitude', sw.lat)
          .lte('latitude', ne.lat)
          .gte('longitude', sw.lng)
          .lte('longitude', ne.lng)
      } else if (filtrosAtivos.cidade && !imobiliariaId) {
        query = query.or(`cidade.ilike.%${filtrosAtivos.cidade}%,bairro.ilike.%${filtrosAtivos.cidade}%,codigo.ilike.%${filtrosAtivos.cidade}%`)
      }

      const { data, error } = await query
      if (error) throw error

      // Resolver branding imobiliária → membro (com cache persistente)
      let mapaMembroParaImob = mapaBrandingRef.current
      if (!mapaMembroParaImob && !brandingCarregandoRef.current) {
        brandingCarregandoRef.current = true
        mapaMembroParaImob = new Map<string, any>()
        try {
          const { data: todosPerfisList } = await supabase
            .from('perfis')
            .select('id, nome, tipo, foto_url')

          const todosPerfis = todosPerfisList ?? []
          const imobiliarias = todosPerfis.filter((p: any) => p.tipo === 'imobiliaria')

          for (const imob of imobiliarias) {
            try {
              const res = await fetch(`/api/corretores?imobiliaria_id=${imob.id}`)
              if (res.ok) {
                const json = await res.json()
                const membros = json.corretores || []
                for (const m of membros) {
                  mapaMembroParaImob.set(m.id, imob)
                }
              }
            } catch {}
            mapaMembroParaImob.set(imob.id, imob)
          }
        } catch {}
        mapaBrandingRef.current = mapaMembroParaImob
        brandingCarregandoRef.current = false
      }

      // Se ainda está carregando em paralelo, usar mapa vazio temporário
      if (!mapaMembroParaImob) mapaMembroParaImob = new Map()

      let imoveisComFotos = (data ?? []).map((i: Record<string, unknown>) => {
        const perfilOriginal = (i.perfis as any) || null
        const anuncianteId = (i.anunciante_id as string) || ''

        // Se o anunciante pertence a uma imobiliária, usar branding da imobiliária
        let anuncianteFinal = perfilOriginal
        if (mapaMembroParaImob.has(anuncianteId)) {
          const imobDona = mapaMembroParaImob.get(anuncianteId)
          anuncianteFinal = {
            id: imobDona.id,
            nome: imobDona.nome,
            tipo: 'imobiliaria',
            foto_url: imobDona.foto_url,
          }
        }

        return {
          ...i,
          fotos: (i.fotos_imovel as Record<string, unknown>[]) ?? [],
          anunciante: anuncianteFinal,
        }
      }) as unknown as Imovel[]

      // Se a busca foi por bounds, garantir que somente imóveis 100% contidos na área visível da tela sejam listados
      if (bounds && !isFavoritos) {
        const sw = bounds.getSouthWest()
        const ne = bounds.getNorthEast()
        imoveisComFotos = imoveisComFotos.filter((i) => {
          if (typeof i.latitude !== 'number' || typeof i.longitude !== 'number') return false
          return (
            i.latitude >= sw.lat &&
            i.latitude <= ne.lat &&
            i.longitude >= sw.lng &&
            i.longitude <= ne.lng
          )
        })
      }

      setImoveis(imoveisComFotos)
      setTotalResultados(imoveisComFotos.length)
    } catch (err) {
      console.error('Erro ao buscar imoveis:', err)
    } finally {
      setCarregando(false)
    }
  }, [supabase, isFavoritos, imobiliariaId])

  // Sincroniza estado de filtros com os parâmetros da URL
  useEffect(() => {
    const imobId = searchParams.get('imobiliaria') || searchParams.get('imobiliaria_id') || null
    const negParam = searchParams.get('negociacao')
    const negociacaoUrl = negParam ? (negParam as TFiltros['negociacao']) : (imobId ? undefined : 'venda')
    const cidadeUrl = searchParams.get('cidade') ?? searchParams.get('q') ?? undefined
    setFiltros((f) => ({
      ...f,
      negociacao: negociacaoUrl,
      cidade: cidadeUrl,
    }))
  }, [searchParams])

  // Ao mudar filtros ou alternar modo de favoritos: busca imóveis mantendo a área visível do mapa
  useEffect(() => {
    // Bloqueia durante transição de flyTo (a busca será feita ao pousar)
    if (voandoParaRef.current) return
    // Se há cidade ou favoritos ou já temos bounds do mapa, busca imediatamente
    if (filtros.cidade || isFavoritos || boundsAtualRef.current) {
      buscarImoveis(filtros, boundsAtualRef.current)
    }
  }, [filtros, isFavoritos, buscarImoveis])

  // Listener para sincronização instantânea ao favoritar/desfavoritar em tempo real
  useEffect(() => {
    function handleFavoritoAtualizado() {
      buscarImoveis(filtros, boundsAtualRef.current)
    }

    window.addEventListener('fixum:favoritoAtualizado', handleFavoritoAtualizado)
    return () => window.removeEventListener('fixum:favoritoAtualizado', handleFavoritoAtualizado)
  }, [filtros, buscarImoveis])

  // Chamado pelo mapa automaticamente no load e a cada arrasto/zoom (moveend)
  const handlePesquisarNaArea = useCallback((bounds: mapboxgl.LngLatBounds, isInteracaoUsuario?: boolean) => {
    boundsAtualRef.current = bounds // salva para reusar ao trocar filtros
    voandoParaRef.current = false   // flyTo pousou, desbloqueia buscas por filtros

    if (isInteracaoUsuario) {
      // 1. Limpar parâmetros de cidade/GPS da URL silenciosamente no evento
      try {
        const url = new URL(window.location.href)
        let alterouUrl = false
        if (url.searchParams.has('cidade')) { url.searchParams.delete('cidade'); alterouUrl = true }
        if (url.searchParams.has('lat')) { url.searchParams.delete('lat'); alterouUrl = true }
        if (url.searchParams.has('lng')) { url.searchParams.delete('lng'); alterouUrl = true }
        if (url.searchParams.has('origem')) { url.searchParams.delete('origem'); alterouUrl = true }
        if (url.searchParams.has('q')) { url.searchParams.delete('q'); alterouUrl = true }
        if (alterouUrl) {
          window.history.replaceState(null, '', url.pathname + (url.search ? url.search : ''))
        }
      } catch {}

      // 2. Se filtros tinha cidade, remove. O useEffect([filtros]) cuidará da busca se mudar
      if (filtros.cidade) {
        setFiltros((f) => ({ ...f, cidade: undefined }))
        return
      }
    }

    // Busca sempre garantindo os bounds reais da tela
    buscarImoveis(filtros, bounds)
  }, [filtros, buscarImoveis])

  function handleFiltrosChange(novosFiltros: TFiltros) {
    setFiltros(novosFiltros)
  }

  const handleLocalSelecionado = useCallback((sugestao: Sugestao) => {
    // Flag: bloqueia useEffect([filtros]) até o flyTo pousar
    voandoParaRef.current = true

    // Limpa o filtro de cidade para não disparar busca duplicada via useEffect([filtros])
    // A busca real acontece UMA ÚNICA VEZ quando o flyTo pousa (idle → onPesquisarNaArea)
    setFiltros((f) => {
      if (f.cidade) return { ...f, cidade: undefined }
      return f
    })

    // Voa para as coordenadas do local selecionado no autocomplete
    setVoarPara(sugestao.coords)

    // Atualiza a URL para refletir a nova localidade
    try {
      const url = new URL(window.location.href)
      url.searchParams.delete('cidade')
      url.searchParams.delete('lat')
      url.searchParams.delete('lng')
      url.searchParams.delete('origem')
      url.searchParams.delete('q')
      window.history.replaceState(null, '', url.pathname + (url.search || ''))
    } catch {}
  }, [])

  const handleSelecionarImovel = useCallback((id: string) => {
    setImovelSelecionado(id)
    setTimeout(() => {
      const el = document.getElementById(`card-imovel-${id}`)
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }, 50)
  }, [])

  function handleLimparFiltroImobiliaria() {
    router.push('/explorar')
  }

  return (
    <div className={styles.layout}>
      <Header />

      <div className={styles.barraTopo}>
        <div className={styles.barraTopoInner}>
          <FiltrosBusca
            filtros={filtros}
            onChange={handleFiltrosChange}
            onLocalSelecionado={handleLocalSelecionado}
          />
          <div className={styles.toggleVista}>
            <button
              className={`${styles.btnVista} ${vistaAtiva === 'lista' ? styles.vistaAtiva : ''}`}
              onClick={() => setVistaAtiva('lista')}
            >
              📋 Lista
            </button>
            <button
              className={`${styles.btnVista} ${vistaAtiva === 'mapa' ? styles.vistaAtiva : ''}`}
              onClick={() => setVistaAtiva('mapa')}
            >
              🗺️ Mapa
            </button>
          </div>
        </div>
      </div>

      <div className={styles.conteudo}>
        {/* Lista */}
        <div className={`${styles.lista} ${vistaAtiva === 'mapa' ? styles.listaOculta : ''}`}>
          {/* Banner de filtro exclusivo de imobiliária */}
          {imobiliariaId && (
            <div className={styles.bannerFiltroImobiliaria}>
              <div className={styles.infoFiltroImob}>
                <span className={styles.iconeFiltroImob}>🏢</span>
                <div>
                  <strong className={styles.nomeFiltroImob}>
                    {nomeImobiliaria || 'Imobiliária Parceira'}
                  </strong>
                  <span className={styles.subFiltroImob}>
                    Exibindo {totalResultados} {totalResultados === 1 ? 'imóvel desta empresa' : 'imóveis desta empresa'} no mapa
                  </span>
                </div>
              </div>
              <button
                type="button"
                className={styles.btnLimparFiltroImob}
                onClick={handleLimparFiltroImobiliaria}
                title="Ver todos os imóveis da plataforma"
              >
                ✕ Ver todos os imóveis
              </button>
            </div>
          )}

          <div className={styles.listaHeader}>
            {carregando ? (
              <span className={styles.carregando}>Buscando imóveis...</span>
            ) : isFavoritos ? (
              <span className={styles.resultados} style={{ color: '#b91c1c' }}>
                <strong>❤️ {totalResultados}</strong> {totalResultados === 1 ? 'imóvel favorito' : 'imóveis favoritos'}
              </span>
            ) : imobiliariaId ? (
              <span className={styles.resultados} style={{ color: '#1e40af' }}>
                <strong>🏢 {totalResultados}</strong> {totalResultados === 1 ? 'imóvel desta imobiliária' : 'imóveis desta imobiliária'}
              </span>
            ) : filtros.cidade ? (
              <span className={styles.resultados}>
                <strong>{totalResultados}</strong> {totalResultados === 1 ? 'imóvel encontrado' : 'imóveis encontrados'} em <strong>{filtros.cidade}</strong>
              </span>
            ) : (
              <span className={styles.resultados}>
                <strong>{totalResultados}</strong> {totalResultados === 1 ? 'imóvel nesta área do mapa' : 'imóveis nesta área do mapa'}
              </span>
            )}
          </div>

          {/* Banner de contexto de localização quando pesquisado puramente por GPS sem cidade */}
          {!carregando && isOrigemGps && !filtros.cidade && totalResultados > 0 && !isFavoritos && (
            <div style={{
              background: '#eff6ff',
              border: '1px solid #bfdbfe',
              borderRadius: '0.75rem',
              padding: '0.65rem 0.9rem',
              marginBottom: '1rem',
              fontSize: '0.82rem',
              color: '#1e40af',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <span>📍</span>
              <span>
                Sua localização foi detectada no mapa. Mostrando imóveis disponíveis cadastrados na plataforma.
              </span>
            </div>
          )}

          {carregando ? (
            <div className={styles.gridSkeleton}>
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className={`${styles.skeletonCard} skeleton`} />
              ))}
            </div>
          ) : precisaLoginFavoritos ? (
            <div className={styles.semResultados}>
              <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '0.5rem' }}>🔒</span>
              <h3>Acesse sua conta para ver seus favoritos</h3>
              <p style={{ maxWidth: '420px', margin: '0 auto 1rem', lineHeight: '1.5' }}>
                Você precisa estar conectado para salvar e visualizar sua lista personalizada de imóveis favoritos em qualquer dispositivo.
              </p>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                <Link href="/login?next=/explorar?favoritos=true" className="btn btn-primario btn-sm">
                  Entrar na Conta
                </Link>
                <Link href="/explorar" className="btn btn-outline btn-sm">
                  Ver Todos no Mapa
                </Link>
              </div>
            </div>
          ) : isFavoritos && imoveis.length === 0 ? (
            <div className={styles.semResultados}>
              <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '0.5rem' }}>🤍</span>
              <h3>Nenhum imóvel favoritado ainda</h3>
              <p style={{ maxWidth: '420px', margin: '0 auto 1rem', lineHeight: '1.5' }}>
                Quando você encontrar um imóvel que gostou pelo mapa ou lista, clique no ícone de coração <strong>❤️</strong> para salvá-lo aqui e compará-lo depois.
              </p>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                <Link href="/explorar" className="btn btn-primario btn-sm">
                  🗺️ Explorar Imóveis no Mapa
                </Link>
              </div>
            </div>
          ) : imoveis.length === 0 ? (
            <div className={styles.semResultados}>
              <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '0.5rem' }}>📍</span>
              <h3>Nenhum imóvel encontrado{filtros.cidade ? ` em ${filtros.cidade}` : ' nesta área do mapa'}</h3>
              <p style={{ maxWidth: '420px', margin: '0 auto 1rem', lineHeight: '1.5' }}>
                {filtros.cidade
                  ? `Ainda não temos imóveis para ${filtros.negociacao === 'aluguel' ? 'alugar' : 'comprar'} cadastrados em ${filtros.cidade}. Você pode ser o primeiro a anunciar ou navegar pelo mapa para outras cidades!`
                  : 'Nenhum imóvel ativo neste quadrante do mapa. Arraste o mapa, afaste o zoom ou ajuste os filtros para ver mais opções.'}
              </p>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
                <Link href="/painel/novo-imovel" className="btn btn-primario btn-sm">
                  + Anunciar Imóvel Aqui
                </Link>
                {filtros.cidade && (
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => handleFiltrosChange({ ...filtros, cidade: undefined })}
                  >
                    Ver Todos os Imóveis
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className={styles.grid}>
              {imoveis.map((imovel) => (
                <CardImovel
                  key={imovel.id}
                  imovel={imovel}
                  destacado={imovelHover === imovel.id}
                  selecionado={imovelSelecionado === imovel.id}
                  onHover={setImovelHover}
                  onSelecionar={handleSelecionarImovel}
                />
              ))}
            </div>
          )}
        </div>

        {/* Mapa */}
        <div className={`${styles.mapaWrapper} ${vistaAtiva === 'lista' ? styles.mapaOcultoMobile : ''}`}>
          <MapaExplorar
            imoveis={imoveis}
            imovelHover={imovelHover}
            imovelSelecionado={imovelSelecionado}
            onSelecionarImovel={handleSelecionarImovel}
            onPesquisarNaArea={handlePesquisarNaArea}
            voarPara={voarPara}
            centroInicial={centroInicial}
            cidadeFiltro={filtros.cidade}
            isOrigemGps={isOrigemGps}
            isFavoritos={isFavoritos}
            carregando={carregando}
          />
        </div>
      </div>

      {/* Botão Flutuante Mobile: Alternar Lista / Mapa */}
      <button
        type="button"
        className={styles.btnFlutuanteMobile}
        onClick={() => setVistaAtiva(vistaAtiva === 'lista' ? 'mapa' : 'lista')}
        aria-label={vistaAtiva === 'lista' ? 'Ver no mapa' : 'Ver lista de imóveis'}
      >
        {vistaAtiva === 'lista' ? (
          <>
            <span className={styles.iconeFlutuante}>🗺️</span>
            <span>Ver no Mapa</span>
          </>
        ) : (
          <>
            <span className={styles.iconeFlutuante}>📋</span>
            <span>Ver Lista</span>
          </>
        )}
      </button>
    </div>
  )
}

export default function ExplorarPage() {
  return (
    <Suspense fallback={<div>Carregando...</div>}>
      <ExplorarConteudo />
    </Suspense>
  )
}