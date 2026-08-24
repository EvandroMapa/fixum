'use client'

import { useState, useEffect, useCallback } from 'react'
import { type PontoInteresse } from '@/lib/types'
import styles from './SecaoEntorno.module.css'

interface Props {
  lat: number | string | null | undefined
  lng: number | string | null | undefined
  onPoisCarregados?: (pois: PontoInteresse[]) => void
  poiSelecionadoId?: string | null
  onSelecionarPoi?: (poi: PontoInteresse) => void
}

const CATEGORIAS = [
  { id: 'supermercados', label: 'Supermercados', icone: '🛒' },
  { id: 'farmacias', label: 'Farmácias', icone: '💊' },
  { id: 'escolas', label: 'Escolas e Creches', icone: '🏫' },
  { id: 'restaurantes', label: 'Restaurantes e Cafés', icone: '🍽️' },
  { id: 'academias', label: 'Academias', icone: '🏋️' },
  { id: 'hospitais', label: 'Hospitais e Saúde', icone: '🏥' },
  { id: 'bancos', label: 'Bancos e Caixas', icone: '🏦' },
  { id: 'transporte', label: 'Transporte Público', icone: '🚌' },
]

export default function SecaoEntorno({
  lat,
  lng,
  onPoisCarregados,
  poiSelecionadoId = null,
  onSelecionarPoi,
}: Props) {
  const [categoriaAtiva, setCategoriaAtiva] = useState('supermercados')
  const [poisPorCategoria, setPoisPorCategoria] = useState<Record<string, PontoInteresse[]>>({})
  const [carregando, setCarregando] = useState(false)

  const numLat = typeof lat === 'string' ? parseFloat(lat) : Number(lat)
  const numLng = typeof lng === 'string' ? parseFloat(lng) : Number(lng)

  const coordenadasValidas =
    !isNaN(numLat) &&
    !isNaN(numLng) &&
    (numLat !== 0 || numLng !== 0) &&
    numLat >= -90 &&
    numLat <= 90 &&
    numLng >= -180 &&
    numLng <= 180

  const carregarPoisCategoria = useCallback(
    async (cat: string) => {
      if (!coordenadasValidas) return

      // Se já temos em cache local no estado, apenas atualizamos o mapa
      if (poisPorCategoria[cat]) {
        onPoisCarregados?.(poisPorCategoria[cat])
        return
      }

      try {
        setCarregando(true)
        const res = await fetch(
          `/api/imoveis/entorno?lat=${numLat}&lng=${numLng}&categoria=${cat}`
        )
        if (res.ok) {
          const json = await res.json()
          const lista = json.pois || []
          setPoisPorCategoria((prev) => ({ ...prev, [cat]: lista }))
          onPoisCarregados?.(lista)
        }
      } catch (err) {
        console.error('Erro ao buscar POIs da categoria:', cat, err)
      } finally {
        setCarregando(false)
      }
    },
    [numLat, numLng, coordenadasValidas, poisPorCategoria, onPoisCarregados]
  )

  // Carregar categoria inicial na montagem
  useEffect(() => {
    if (coordenadasValidas) {
      carregarPoisCategoria(categoriaAtiva)
    }
  }, [coordenadasValidas, categoriaAtiva])

  function handleTrocarCategoria(catId: string) {
    setCategoriaAtiva(catId)
    carregarPoisCategoria(catId)
  }

  if (!coordenadasValidas) {
    return null
  }

  const poisAtuais = poisPorCategoria[categoriaAtiva] || []
  const catConfig = CATEGORIAS.find((c) => c.id === categoriaAtiva) || CATEGORIAS[0]

  return (
    <div className={styles.containerEntorno}>
      <div className={styles.cabecalhoSecao}>
        <div>
          <h2 className={styles.tituloSecao}>🏘️ O que tem no entorno?</h2>
          <p className={styles.subtituloSecao}>
            Conveniências reais calculadas a partir deste endereço (distância e tempo a pé)
          </p>
        </div>
      </div>

      {/* ── BARRA DE CATEGORIAS INTERATIVAS ── */}
      <div className={styles.scrollCategorias}>
        {CATEGORIAS.map((cat) => {
          const ativa = cat.id === categoriaAtiva
          const listaCache = poisPorCategoria[cat.id]
          const qtd = listaCache ? listaCache.length : null

          return (
            <button
              key={cat.id}
              type="button"
              className={`${styles.btnCategoria} ${ativa ? styles.btnCategoriaAtiva : ''}`}
              onClick={() => handleTrocarCategoria(cat.id)}
            >
              <span className={styles.iconeCat}>{cat.icone}</span>
              <span>{cat.label}</span>
              {qtd !== null && qtd > 0 && <span className={styles.badgeQtd}>{qtd}</span>}
            </button>
          )
        })}
      </div>

      {/* ── LISTA DE POIs DA CATEGORIA ATIVA ── */}
      {carregando ? (
        <div className={styles.skeletonGrid}>
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className={styles.skeletonCard} />
          ))}
        </div>
      ) : poisAtuais.length > 0 ? (
        <div className={styles.gridPois}>
          {poisAtuais.map((poi) => {
            const selecionado = poiSelecionadoId === poi.id

            return (
              <div
                key={poi.id}
                className={`${styles.cardPoi} ${selecionado ? styles.cardPoiSelecionado : ''}`}
                onClick={() => onSelecionarPoi?.(poi)}
                title="Clique para ver no mapa acima"
              >
                <div className={styles.poiInfoPrincipal}>
                  <div className={styles.poiIconeWrapper}>{poi.icone}</div>
                  <div className={styles.poiTextos}>
                    <strong className={styles.poiNome}>{poi.nome}</strong>
                    <div className={styles.poiDistancias}>
                      <span className={styles.poiDistanciaBadge}>{poi.distanciaFormatada}</span>
                      <span className={styles.poiTempoPe}>🚶 {poi.tempoPe}</span>
                    </div>
                  </div>
                </div>
                <span className={styles.poiSetaVer}>📍</span>
              </div>
            )
          })}
        </div>
      ) : (
        <div className={styles.vazioPois}>
          <span>🔍 Nenhum ponto de {catConfig.label.toLowerCase()} encontrado num raio de 2.5 km.</span>
        </div>
      )}
    </div>
  )
}
