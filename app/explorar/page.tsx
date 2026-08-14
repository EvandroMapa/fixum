'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import Header from '@/components/layout/Header'
import CardImovel from '@/components/imovel/CardImovel'
import FiltrosBusca from '@/components/imovel/FiltrosBusca'
import { type Imovel, type FiltrosBusca as TFiltros } from '@/lib/types'
import { createClient } from '@/lib/supabase/client'
import styles from './page.module.css'

// Importação dinâmica do mapa (evita SSR)
const MapaExplorar = dynamic(() => import('@/components/mapa/MapaExplorar'), {
  ssr: false,
  loading: () => <div className={styles.mapaLoading}><span>Carregando mapa...</span></div>,
})

function ExplorarConteudo() {
  const searchParams = useSearchParams()
  const [imoveis, setImoveis] = useState<Imovel[]>([])
  const [carregando, setCarregando] = useState(true)
  const [imovelHover, setImovelHover] = useState<string | null>(null)
  const [totalResultados, setTotalResultados] = useState(0)
  const [vistaAtiva, setVistaAtiva] = useState<'lista' | 'mapa'>('lista')
  const [filtros, setFiltros] = useState<TFiltros>({
    negociacao: (searchParams.get('negociacao') as TFiltros['negociacao']) ?? undefined,
    cidade: searchParams.get('q') ?? undefined,
  })

  const supabase = createClient()

  const buscarImoveis = useCallback(async (filtrosAtivos: TFiltros) => {
    setCarregando(true)
    try {
      let query = supabase
        .from('imoveis')
        .select(`
          *,
          fotos_imovel (id, url, principal, ordem)
        `)
        .in('status', ['publicado', 'ativo'])
        .order('destaque', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(50)

      if (filtrosAtivos.negociacao) {
        query = query.eq('negociacao', filtrosAtivos.negociacao)
      }
      if (filtrosAtivos.tipo && filtrosAtivos.tipo.length > 0) {
        query = query.in('tipo', filtrosAtivos.tipo)
      }
      if (filtrosAtivos.preco_min) {
        query = query.gte('preco', filtrosAtivos.preco_min)
      }
      if (filtrosAtivos.preco_max) {
        query = query.lte('preco', filtrosAtivos.preco_max)
      }
      if (filtrosAtivos.quartos_min) {
        query = query.gte('quartos', filtrosAtivos.quartos_min)
      }
      if (filtrosAtivos.cidade) {
        query = query.ilike('cidade', `%${filtrosAtivos.cidade}%`)
      }

      const { data, error, count } = await query

      if (error) throw error

      // Mapear fotos
      const imoveisComFotos = (data ?? []).map((i: Record<string, unknown>) => ({
        ...i,
        fotos: (i.fotos_imovel as Record<string, unknown>[]) ?? [],
      })) as unknown as Imovel[]

      setImoveis(imoveisComFotos)
      setTotalResultados(count ?? imoveisComFotos.length)
    } catch (err) {
      console.error('Erro ao buscar imóveis:', err)
    } finally {
      setCarregando(false)
    }
  }, [supabase])

  useEffect(() => {
    buscarImoveis(filtros)
  }, [filtros, buscarImoveis])

  function handleFiltrosChange(novosFiltros: TFiltros) {
    setFiltros(novosFiltros)
  }

  return (
    <div className={styles.layout}>
      <Header />

      {/* Barra de filtros */}
      <div className={styles.barraTopo}>
        <div className={styles.barraTopoInner}>
          <FiltrosBusca filtros={filtros} onChange={handleFiltrosChange} />

          {/* Toggle Vista Mobile */}
          <div className={styles.toggleVista}>
            <button
              className={`${styles.btnVista} ${vistaAtiva === 'lista' ? styles.vistaAtiva : ''}`}
              onClick={() => setVistaAtiva('lista')}
            >
              ☰ Lista
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

      {/* Conteúdo principal */}
      <div className={styles.conteudo}>
        {/* Lista */}
        <div className={`${styles.lista} ${vistaAtiva === 'mapa' ? styles.listaOculta : ''}`}>
          <div className={styles.listaHeader}>
            {carregando ? (
              <span className={styles.carregando}>Buscando imóveis...</span>
            ) : (
              <span className={styles.resultados}>
                <strong>{totalResultados}</strong> imóvel{totalResultados !== 1 ? 'is' : ''} encontrado{totalResultados !== 1 ? 's' : ''}
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
              <span>🔍</span>
              <h3>Nenhum imóvel encontrado</h3>
              <p>Tente ajustar os filtros ou explorar outra região</p>
            </div>
          ) : (
            <div className={styles.grid}>
              {imoveis.map((imovel) => (
                <CardImovel
                  key={imovel.id}
                  imovel={imovel}
                  destacado={imovelHover === imovel.id}
                  onHover={setImovelHover}
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
