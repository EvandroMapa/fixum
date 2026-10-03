'use client'

import { useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import { type Imovel } from '@/lib/types'
import { formatarPreco, formatarArea, labelTipoImovel, resolverExibicaoPreco } from '@/lib/utils'
import { useFavorito } from '@/hooks/useFavorito'
import MarcaDaguaTeste from '@/components/ui/MarcaDaguaTeste'
import Icone from '@/components/ui/Icone'
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

  const sobConsulta =
    resolverExibicaoPreco(imovel.anunciante?.modo_exibicao_preco, imovel.modo_exibicao_preco, (imovel as any).exibir_preco, imovel.preco) === 'sob_consulta'
  const area = imovel.area || imovel.area_construida
  const local = [imovel.bairro, imovel.cidade].filter(Boolean).join(', ')

  return (
    <article
      id={`card-imovel-${imovel.id}`}
      className={`${styles.card} ${destacado ? styles.destacado : ''} ${selecionado ? styles.selecionado : ''}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={() => onSelecionar?.(imovel.id)}
    >
      {/* Link que cobre o card inteiro; botões internos ficam por cima */}
      <Link
        href={`/imovel/${imovel.id}`}
        className={styles.linkCobertura}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`${imovel.titulo} — ver detalhes`}
      />

      {/* ── FOTOS ── */}
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
              alt=""
              className={styles.fotoImg}
              loading="lazy"
              onError={(e) => {
                // Foto quebrada: some e mostra o fundo neutro (nunca uma foto que não é do imóvel)
                e.currentTarget.style.display = 'none'
              }}
            />
          ) : null}
          <div className={styles.fotoPlaceholder} aria-hidden="true" />

          <MarcaDaguaTeste variante="padrao" />

          <div className={styles.selos}>
            {imovel.destaque && <span className={styles.seloDestaque}>Destaque</span>}
            <span className={styles.selo}>{imovel.negociacao === 'venda' ? 'Venda' : 'Aluguel'}</span>
          </div>

          <button
            type="button"
            className={`${styles.btnFavoritar} ${favoritado ? styles.favoritado : ''}`}
            onClick={(e) => { e.stopPropagation(); e.preventDefault(); toggleFavorito() }}
            disabled={carregando}
            aria-pressed={favoritado}
            aria-label={favoritado ? 'Desafixar imóvel' : 'Fixar imóvel'}
            title={favoritado ? 'Desafixar' : 'Fixar para comparar depois'}
          >
            <Icone nome="fixar" tamanho={20} preenchido={favoritado} />
          </button>

          {fotos.length > 1 && hovering && (
            <>
              <button
                type="button"
                className={`${styles.setaCarrossel} ${styles.setaEsq}`}
                onClick={irAnterior}
                aria-label="Foto anterior"
              >
                <Icone nome="chevronEsquerda" tamanho={18} />
              </button>
              <button
                type="button"
                className={`${styles.setaCarrossel} ${styles.setaDir}`}
                onClick={irProxima}
                aria-label="Próxima foto"
              >
                <Icone nome="chevronDireita" tamanho={18} />
              </button>
            </>
          )}

          {fotos.length > 1 && (
            <div className={styles.pontos}>
              {fotos.slice(0, 6).map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  className={`${styles.ponto} ${idx === fotoAtiva ? styles.pontoAtivo : ''}`}
                  onClick={(e) => irPara(e, idx)}
                  aria-label={`Foto ${idx + 1} de ${fotos.length}`}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── INFORMAÇÕES ── */}
      <div className={styles.info}>
        <div className={styles.preco}>
          {sobConsulta ? (
            <span className={styles.sobConsulta}>Preço sob consulta</span>
          ) : (
            <>
              {formatarPreco(imovel.preco, imovel.negociacao)}
              {imovel.condominio && imovel.negociacao === 'aluguel' ? (
                <span className={styles.condominio}>
                  + R$ {imovel.condominio.toLocaleString('pt-BR')} cond.
                </span>
              ) : null}
            </>
          )}
        </div>

        <h3 className={styles.titulo}>{imovel.titulo}</h3>
        <div className={styles.localizacao}>
          {labelTipoImovel(imovel.tipo)}
          {local && <> · {local}</>}
        </div>

        {(imovel.quartos || imovel.banheiros || imovel.vagas || area) ? (
          <ul className={styles.caracteristicas}>
            {imovel.quartos ? (
              <li className={styles.car} title={`${imovel.quartos} ${imovel.quartos === 1 ? 'quarto' : 'quartos'}`}>
                <Icone nome="quarto" tamanho={17} /> {imovel.quartos}
              </li>
            ) : null}
            {imovel.banheiros ? (
              <li className={styles.car} title={`${imovel.banheiros} ${imovel.banheiros === 1 ? 'banheiro' : 'banheiros'}`}>
                <Icone nome="banho" tamanho={17} /> {imovel.banheiros}
              </li>
            ) : null}
            {imovel.vagas ? (
              <li className={styles.car} title={`${imovel.vagas} ${imovel.vagas === 1 ? 'vaga' : 'vagas'}`}>
                <Icone nome="vaga" tamanho={17} /> {imovel.vagas}
              </li>
            ) : null}
            {area ? (
              <li className={styles.car} title="Área">
                <Icone nome="area" tamanho={17} /> {formatarArea(area)}
              </li>
            ) : null}
          </ul>
        ) : null}

        <div className={styles.blocoAnuncianteCard}>
          <div className={styles.anuncianteInfo}>
            {imovel.anunciante?.foto_url ? (
              <img src={imovel.anunciante.foto_url} alt="" className={styles.anuncianteLogoImg} />
            ) : (
              <span className={styles.anuncianteIniciais} aria-hidden="true">
                {imovel.anunciante?.nome?.slice(0, 2).toUpperCase() || 'FX'}
              </span>
            )}
            <span className={styles.anuncianteNome}>{imovel.anunciante?.nome || 'Anunciante'}</span>
          </div>
          {imovel.codigo && (
            <span className={styles.badgeCodigoCard} title="Código do anúncio">
              {imovel.codigo}
            </span>
          )}
        </div>
      </div>
    </article>
  )
}
