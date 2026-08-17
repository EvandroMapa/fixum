'use client'

import { useState, useEffect, useCallback, useRef, Suspense } from 'react'
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
    cidade: searchParams.get('q') ?? undefined,
  })
  // Guarda os bounds atuais do mapa — ao mudar filtros, mantém a área visível
  const boundsAtualRef = useRef<mapboxgl.LngLatBounds | null>(null)

  const supabase = createClient()

  const buscarImoveis = useCallback(async (filtrosAtivos: TFiltros, bounds?: mapboxgl.LngLatBounds | null) => {
    setCarregando(true)
    try {
      let query = supabase
        .from('imoveis')
        .select(`*, fotos_imovel (id, url, principal, ordem)`)
        .in('status', ['publicado', 'ativo'])
        .order('destaque', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(50)

      if (filtrosAtivos.negociacao) query = query.eq('negociacao', filtrosAtivos.negociacao)
      if (filtrosAtivos.tipo && filtrosAtivos.tipo.length > 0) query = query.in('tipo', filtrosAtivos.tipo)
      if (filtrosAtivos.preco_min) query = query.gte('preco', filtrosAtivos.preco_min)
      if (filtrosAtivos.preco_max) query = query.lte('preco', filtrosAtivos.preco_max)
      if (filtrosAtivos.quartos_min) query = query.gte('quartos', filtrosAtivos.quartos_min)
      if (filtrosAtivos.cidade) query = query.ilike('cidade', `%${filtrosAtivos.cidade}%`)

      // Filtro por bounds do mapa (pesquisar nesta area)
      if (bounds) {
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
  }, [supabase])

  // Ao mudar filtros: reutiliza os bounds atuais do mapa (mantém área visível)
  useEffect(() => {
    buscarImoveis(filtros, boundsAtualRef.current)
  }, [filtros, buscarImoveis])

  // Chamado pelo mapa automaticamente ao mover/zoom
  const handlePesquisarNaArea = useCallback((bounds: mapboxgl.LngLatBounds) => {
    boundsAtualRef.current = bounds // salva para reusar ao trocar filtros
    buscarImoveis(filtros, bounds)
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
              {"\uD83D\uDCCB"} Lista
            </button>
            <button
              className={`${styles.btnVista} ${vistaAtiva === 'mapa' ? styles.vistaAtiva : ''}`}
              onClick={() => setVistaAtiva('mapa')}
            >
              {"\uD83D\uDDFA\uFE0F"} Mapa
            </button>
          </div>
        </div>
      </div>

      <div className={styles.conteudo}>
        {/* Lista */}
        <div className={`${styles.lista} ${vistaAtiva === 'mapa' ? styles.listaOculta : ''}`}>
          <div className={styles.listaHeader}>
            {carregando ? (
              <span className={styles.carregando}>Buscando imoveis...</span>
            ) : (
              <span className={styles.resultados}>
                <strong>{totalResultados}</strong> imovel{totalResultados !== 1 ? 'is' : ''} encontrado{totalResultados !== 1 ? 's' : ''}
                {filtros.cidade && ` em ${filtros.cidade}`}
              </span>
            )}
          </div>

          {carregando ? (
            <div className={styles.gridSkeleton}>
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className={`${styles.skeletonCard} skeleton`} />
              ))}
            </div>
          ) : imoveis.length === 0 ? (
            <div className={styles.semResultados}>
              <span>{"\uD83D\uDDFA\uFE0F"}</span>
              <h3>Nenhum imovel encontrado</h3>
              <p>Tente ajustar os filtros ou clique em "Pesquisar nesta area" no mapa</p>
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
          />
        </div>
      </div>
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