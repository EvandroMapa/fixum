'use client'

import { useState, useEffect } from 'react'
import { type PontoInteresse } from '@/lib/types'
import styles from './SecaoEntorno.module.css'
import Icone, { ehNomeIcone } from '@/components/ui/Icone'

interface Props {
  lat: number | string | null | undefined
  lng: number | string | null | undefined
  onPoisCarregados?: (pois: PontoInteresse[]) => void
  poiSelecionadoId?: string | null
  onSelecionarPoi?: (poi: PontoInteresse) => void
}

const CATEGORIAS = [
  { id: 'supermercados', label: 'Supermercados', icone: 'carrinho' },
  { id: 'farmacias', label: 'Farmácias', icone: 'farmacia' },
  { id: 'escolas', label: 'Escolas e creches', icone: 'escola' },
  { id: 'restaurantes', label: 'Restaurantes e cafés', icone: 'talheres' },
  { id: 'academias', label: 'Academias', icone: 'haltere' },
  { id: 'hospitais', label: 'Hospitais e saúde', icone: 'hospital' },
  { id: 'bancos', label: 'Bancos e caixas', icone: 'banco' },
  { id: 'transporte', label: 'Transporte público', icone: 'onibus' },
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
  // 'todas': uma requisição traz as 8 categorias. 'categoria': reserva, uma por vez.
  const [modo, setModo] = useState<'todas' | 'categoria'>('todas')

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

  // Uma requisição traz todas as categorias; trocar de categoria fica instantâneo
  useEffect(() => {
    if (!coordenadasValidas) return
    let cancelado = false
    fetch(`/api/imoveis/entorno?lat=${numLat}&lng=${numLng}&categoria=todas`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (cancelado) return
        if (json?.categorias) {
          setPoisPorCategoria(json.categorias)
        } else {
          setModo('categoria')
        }
      })
      .catch(() => {
        if (!cancelado) setModo('categoria')
      })
    return () => {
      cancelado = true
    }
  }, [coordenadasValidas, numLat, numLng])

  // Reserva: se a consulta única falhar, busca só a categoria aberta
  useEffect(() => {
    if (modo !== 'categoria' || poisPorCategoria[categoriaAtiva]) return
    let cancelado = false
    fetch(`/api/imoveis/entorno?lat=${numLat}&lng=${numLng}&categoria=${categoriaAtiva}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (!cancelado) setPoisPorCategoria((prev) => ({ ...prev, [categoriaAtiva]: json?.pois ?? [] }))
      })
      .catch((err) => {
        console.error('Erro ao buscar POIs da categoria:', categoriaAtiva, err)
        if (!cancelado) setPoisPorCategoria((prev) => ({ ...prev, [categoriaAtiva]: [] }))
      })
    return () => {
      cancelado = true
    }
  }, [modo, categoriaAtiva, poisPorCategoria, numLat, numLng])

  // Mantém os pontos do mapa em sincronia com a categoria aberta
  const listaAtiva = poisPorCategoria[categoriaAtiva]
  useEffect(() => {
    if (listaAtiva) onPoisCarregados?.(listaAtiva)
  }, [listaAtiva, onPoisCarregados])

  function handleTrocarCategoria(catId: string) {
    setCategoriaAtiva(catId)
  }

  if (!coordenadasValidas) {
    return null
  }

  const poisAtuais = listaAtiva || []
  const catConfig = CATEGORIAS.find((c) => c.id === categoriaAtiva) || CATEGORIAS[0]

  return (
    <div className={styles.containerEntorno}>
      <div className={styles.cabecalhoSecao}>
        <div>
          <h2 className={styles.tituloSecao}>O que tem no entorno?</h2>
          <p className={styles.subtituloSecao}>
            Lugares reais por perto deste endereço, com a distância e o tempo a pé
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
              <span className={styles.iconeCat}>{ehNomeIcone(cat.icone) && <Icone nome={cat.icone} tamanho={18} />}</span>
              <span>{cat.label}</span>
              {qtd !== null && qtd > 0 && <span className={styles.badgeQtd}>{qtd}</span>}
            </button>
          )
        })}
      </div>

      {/* ── LISTA DE POIs DA CATEGORIA ATIVA ── */}
      {/* Sem a lista desta categoria ainda = carregando */}
      {!listaAtiva ? (
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
                  <div className={styles.poiIconeWrapper}>{ehNomeIcone(poi.icone) && <Icone nome={poi.icone} tamanho={18} />}</div>
                  <div className={styles.poiTextos}>
                    <strong className={styles.poiNome}>{poi.nome}</strong>
                    <div className={styles.poiDistancias}>
                      <span className={styles.poiDistanciaBadge}>{poi.distanciaFormatada}</span>
                      <span className={styles.poiTempoPe}><Icone nome="caminhada" tamanho={16} /> {poi.tempoPe}</span>
                    </div>
                  </div>
                </div>
                <span className={styles.poiSetaVer}><Icone nome="local" tamanho={16} /></span>
              </div>
            )
          })}
        </div>
      ) : (
        <div className={styles.vazioPois}>
          <span>Nada de {catConfig.label.toLowerCase()} encontrado por perto deste endereço.</span>
        </div>
      )}
    </div>
  )
}
