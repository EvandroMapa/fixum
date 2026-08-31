'use client'

import { useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import { type Imovel } from '@/lib/types'
import { formatarPreco, formatarArea, labelTipoImovel, resolverExibicaoPreco } from '@/lib/utils'
import { useFavorito } from '@/hooks/useFavorito'
import MarcaDaguaTeste from '@/components/ui/MarcaDaguaTeste'
import styles from './CardImovel.module.css'

interface Props {
  imovel: Imovel
  destacado?: boolean
  selecionado?: boolean
  onHover?: (id: string | null) => void
  onSelecionar?: (id: string) => void
}

export default function CardImovel({ imovel, destacado, selecionado, onHover, onSelecionar }: Props) {
  const { favoritado, toggleFavorito, carregando } = useFavorito(imovel.id)
  const fotos = imovel.fotos ?? []
  const [fotoAtiva, setFotoAtiva] = useState(0)
  const [hovering, setHovering] = useState(false)
  const touchStartX = useRef<number | null>(null)
  const touchEndX = useRef<number | null>(null)

  const fotoAtual = fotos[fotoAtiva]?.url ?? null

  const irAnterior = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation()
    e?.preventDefault()
    setFotoAtiva(i => (i - 1 + fotos.length) % fotos.length)
  }, [fotos.length])

  const irProxima = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation()
    e?.preventDefault()
    setFotoAtiva(i => (i + 1) % fotos.length)
  }, [fotos.length])

  const irPara = useCallback((e: React.MouseEvent, idx: number) => {
    e.stopPropagation()
    e.preventDefault()
    setFotoAtiva(idx)
  }, [])

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.targetTouches[0].clientX
    touchEndX.current = null
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.targetTouches[0].clientX
  }

  const handleTouchEnd = () => {
    if (touchStartX.current === null || touchEndX.current === null) return
    const diff = touchStartX.current - touchEndX.current
    const minSwipeDistance = 35
    if (diff > minSwipeDistance) {
      irProxima()
    } else if (diff < -minSwipeDistance) {
      irAnterior()
    }
    touchStartX.current = null
    touchEndX.current = null
  }

  const handleMouseEnter = () => {
    setHovering(true)
    onHover?.(imovel.id)
  }
  const handleMouseLeave = () => {
    setHovering(false)
    onHover?.(null)
  }

  return (
    <div
      id={`card-imovel-${imovel.id}`}
      className={`${styles.card} ${destacado ? styles.destacado : ''} ${selecionado ? styles.selecionado : ''}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={() => onSelecionar?.(imovel.id)}
    >
      {/* ── CARROSSEL DE FOTOS ── */}
      <div
        className={styles.fotoWrapper}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className={styles.foto}>
          {fotoAtual ? (
            <img
              src={fotoAtual}
              alt={imovel.titulo}
              className={styles.fotoImg}
              loading="lazy"
              onError={(e) => {
                const target = e.currentTarget
                target.onerror = null
                target.src = 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1200&q=80'
              }}
            />
          ) : (
            <div className={styles.fotoPlaceholder} />
          )}

          {/* Marca d'água sutil de teste */}
          <MarcaDaguaTeste variante="padrao" />

          {/* Selos */}
          <div className={styles.selos}>
            {imovel.destaque && (
              <span className="badge badge-destaque">⭐ Destaque</span>
            )}
            <span className={`badge ${imovel.negociacao === 'venda' ? 'badge-primario' : 'badge-acento'}`}>
              {imovel.negociacao === 'venda' ? 'Venda' : 'Aluguel'}
            </span>
          </div>

          {/* Botão Favoritar */}
          <button
            type="button"
            className={`${styles.btnFavoritar} ${favoritado ? styles.favoritado : ''}`}
            onClick={(e) => { e.stopPropagation(); toggleFavorito() }}
            disabled={carregando}
            aria-label={favoritado ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
          >
            <svg
              width="17"
              height="17"
              viewBox="0 0 24 24"
              fill={favoritado ? '#e53e3e' : 'rgba(0, 0, 0, 0.05)'}
              stroke={favoritado ? '#e53e3e' : '#334155'}
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
          </button>

          {/* Setas de navegação — aparecem no hover */}
          {fotos.length > 1 && hovering && (
            <>
              <button
                type="button"
                className={`${styles.setaCarrossel} ${styles.setaEsq}`}
                onClick={irAnterior}
                aria-label="Foto anterior"
              >
                ‹
              </button>
              <button
                type="button"
                className={`${styles.setaCarrossel} ${styles.setaDir}`}
                onClick={irProxima}
                aria-label="Próxima foto"
              >
                ›
              </button>
            </>
          )}

          {/* Pontos indicadores */}
          {fotos.length > 1 && (
            <div className={styles.pontos}>
              {fotos.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  className={`${styles.ponto} ${idx === fotoAtiva ? styles.pontoAtivo : ''}`}
                  onClick={(e) => irPara(e, idx)}
                  aria-label={`Foto ${idx + 1}`}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── INFORMAÇÕES ── */}
      <div className={styles.info}>
        {/* Preço */}
        <div className={styles.preco}>
          {resolverExibicaoPreco(imovel.anunciante?.modo_exibicao_preco, imovel.modo_exibicao_preco, (imovel as any).exibir_preco, imovel.preco) === 'sob_consulta' ? (
            <span className={styles.sobConsulta}>Preço sob consulta</span>
          ) : (
            <>
              {formatarPreco(imovel.preco, imovel.negociacao)}
              {imovel.condominio && imovel.negociacao === 'aluguel' && (
                <span className={styles.condominio}>
                  + R$ {imovel.condominio.toLocaleString('pt-BR')} cond.
                </span>
              )}
            </>
          )}
        </div>

        {/* Tipo e título */}
        <div className={styles.tipo}>{labelTipoImovel(imovel.tipo)}</div>
        <h3 className={styles.titulo}>{imovel.titulo}</h3>

        {/* Características */}
        <div className={styles.caracteristicas}>
          {imovel.quartos !== undefined && imovel.quartos > 0 && (
            <span className={styles.car}>
              🛏️ {imovel.quartos} {imovel.quartos === 1 ? 'quarto' : 'quartos'}
            </span>
          )}
          {imovel.banheiros !== undefined && imovel.banheiros > 0 && (
            <span className={styles.car}>🚿 {imovel.banheiros}</span>
          )}
          {imovel.vagas !== undefined && imovel.vagas > 0 && (
            <span className={styles.car}>🚗 {imovel.vagas}</span>
          )}
          {(imovel.area || imovel.area_construida) && (
            <span className={styles.car}>
              📐 {formatarArea((imovel.area || imovel.area_construida)!)}
            </span>
          )}
        </div>

        {/* Localização */}
        <div className={styles.localizacao}>
          📍 {imovel.bairro ? `${imovel.bairro}, ` : ''}{imovel.cidade}
        </div>

        {/* Anunciante / Imobiliária & Código Ref */}
        <div className={styles.blocoAnuncianteCard}>
          <div className={styles.anuncianteInfo}>
            {imovel.anunciante?.foto_url ? (
              <img
                src={imovel.anunciante.foto_url}
                alt={imovel.anunciante.nome}
                className={styles.anuncianteLogoImg}
              />
            ) : (
              <div className={styles.anuncianteIniciais}>
                {imovel.anunciante?.nome?.slice(0, 2).toUpperCase() || '🏢'}
              </div>
            )}
            <span className={styles.anuncianteNome}>
              {imovel.anunciante?.nome || 'Imobiliária Parceira'}
            </span>
          </div>

          {imovel.codigo && (
            <span className={styles.badgeCodigoCard} title="Código de Referência">
              Ref: {imovel.codigo}
            </span>
          )}
        </div>

        {/* Rodapé */}
        <div className={styles.rodapeCard}>
          <Link
            href={`/imovel/${imovel.id}`}
            className={styles.btnVisualizar}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
          >
            Visualizar Imóvel →
          </Link>
        </div>
      </div>
    </div>
  )
}