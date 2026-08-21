'use client'

import { useState, useEffect, useCallback, useRef, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
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
  const searchParams = useSearchParams()
  const [imoveis, setImoveis] = useState<Imovel[]>([])
  const [carregando, setCarregando] = useState(true)
  const [imovelHover, setImovelHover] = useState<string | null>(null)
  const [imovelSelecionado, setImovelSelecionado] = useState<string | null>(null)
  const [totalResultados, setTotalResultados] = useState(0)
  const [vistaAtiva, setVistaAtiva] = useState<'lista' | 'mapa'>('lista')
  const [voarPara, setVoarPara] = useState<[number, number] | null>(null)
  const [filtros, setFiltros] = useState<TFiltros>({
    negociacao: (searchParams.get('negociacao') as TFiltros['negociacao']) ?? 'venda',
    cidade: searchParams.get('cidade') ?? searchParams.get('q') ?? undefined,
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

        idsFavoritos = (favs ?? []).map((f) => f.imovel_id).filter(Boolean)

        if (idsFavoritos.length === 0) {
          setImoveis([])
          setTotalResultados(0)
          setCarregando(false)
          return
        }
      }

      let query = supabase
        .from('imoveis')
        .select(`*, fotos_imovel (id, url, principal, ordem)`)
        .in('status', ['publicado', 'ativo'])
        .order('destaque', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(50)

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

      if (filtrosAtivos.negociacao) query = query.eq('negociacao', filtrosAtivos.negociacao)
      if (filtrosAtivos.tipo && filtrosAtivos.tipo.length > 0) query = query.in('tipo', filtrosAtivos.tipo)
      if (filtrosAtivos.preco_min) query = query.gte('preco', filtrosAtivos.preco_min)
      if (filtrosAtivos.preco_max) query = query.lte('preco', filtrosAtivos.preco_max)
      if (filtrosAtivos.quartos_min) query = query.gte('quartos', filtrosAtivos.quartos_min)
      if (filtrosAtivos.cidade) {
        query = query.or(`cidade.ilike.%${filtrosAtivos.cidade}%,bairro.ilike.%${filtrosAtivos.cidade}%`)
      }

      // Filtro por bounds do mapa (pesquisar nesta area) quando não estiver filtrando favoritos
      if (bounds && !filtrosAtivos.cidade && !isFavoritos) {
        const sw = bounds.getSouthWest()
        const ne = bounds.getNorthEast()
        query = query
          .gte('latitude', sw.lat)
          .lte('latitude', ne.lat)
          .gte('longitude', sw.lng)
          .lte('longitude', ne.lng)
      }

      const { data, error } = await query
      if (error) throw error

      const imoveisComFotos = (data ?? []).map((i: Record<string, unknown>) => ({
        ...i,
        fotos: (i.fotos_imovel as Record<string, unknown>[]) ?? [],
      })) as unknown as Imovel[]

      setImoveis(imoveisComFotos)
      setTotalResultados(imoveisComFotos.length)
    } catch (err) {
      console.error('Erro ao buscar imoveis:', err)
    } finally {
      setCarregando(false)
    }
  }, [supabase, isFavoritos])

  // Sincroniza estado de filtros com os parâmetros da URL
  useEffect(() => {
    const negociacaoUrl = (searchParams.get('negociacao') as TFiltros['negociacao']) ?? 'venda'
    const cidadeUrl = searchParams.get('cidade') ?? searchParams.get('q') ?? undefined
    setFiltros((f) => ({
      ...f,
      negociacao: negociacaoUrl,
      cidade: cidadeUrl,
    }))
  }, [searchParams])

  // Ao mudar filtros: reutiliza os bounds atuais do mapa (mantém área visível)
  useEffect(() => {
    buscarImoveis(filtros, boundsAtualRef.current)
  }, [filtros, buscarImoveis])

  // Chamado pelo mapa automaticamente ao mover/zoom manual
  const handlePesquisarNaArea = useCallback((bounds: mapboxgl.LngLatBounds, isInteracaoUsuario?: boolean) => {
    boundsAtualRef.current = bounds // salva para reusar ao trocar filtros

    if (isInteracaoUsuario) {
      setFiltros((f) => {
        if (f.cidade) {
          return { ...f, cidade: undefined }
        }
        return f
      })
      buscarImoveis({ ...filtros, cidade: undefined }, bounds)
    }
  }, [filtros, buscarImoveis])

  function handleFiltrosChange(novosFiltros: TFiltros) {
    setFiltros(novosFiltros)
  }

  const handleLocalSelecionado = useCallback((sugestao: Sugestao) => {
    // Voa para as coordenadas do local selecionado no autocomplete
    setVoarPara(sugestao.coords)
  }, [])

  const handleSelecionarImovel = useCallback((id: string) => {
    setImovelSelecionado(id)
    setTimeout(() => {
      const el = document.getElementById(`card-imovel-${id}`)
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }, 50)
  }, [])

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
          <div className={styles.listaHeader}>
            {carregando ? (
              <span className={styles.carregando}>Buscando imóveis...</span>
            ) : isFavoritos ? (
              <span className={styles.resultados} style={{ color: '#b91c1c' }}>
                <strong>❤️ {totalResultados}</strong> {totalResultados === 1 ? 'imóvel favorito' : 'imóveis favoritos'}
              </span>
            ) : (
              <span className={styles.resultados}>
                <strong>{totalResultados}</strong> {totalResultados === 1 ? 'imóvel encontrado' : 'imóveis encontrados'}
                {filtros.cidade && ` em ${filtros.cidade}`}
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
              <h3>Nenhum imóvel encontrado{filtros.cidade ? ` em ${filtros.cidade}` : ''}</h3>
              <p style={{ maxWidth: '420px', margin: '0 auto 1rem', lineHeight: '1.5' }}>
                {filtros.cidade
                  ? `Ainda não temos imóveis para ${filtros.negociacao === 'aluguel' ? 'alugar' : 'comprar'} cadastrados em ${filtros.cidade}. Você pode ser o primeiro a anunciar ou explorar outras cidades no mapa!`
                  : 'Tente ajustar os filtros ou clique em "Pesquisar nesta área" no mapa.'}
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