'use client'

import Link from 'next/link'
import { useState } from 'react'
import { type Imovel } from '@/lib/types'
import { formatarPreco, formatarArea, labelTipoImovel, fotoPrincipal } from '@/lib/utils'
import styles from './CardImovel.module.css'

interface Props {
  imovel: Imovel
  destacado?: boolean
  selecionado?: boolean
  onHover?: (id: string | null) => void
  onSelecionar?: (id: string) => void
}

export default function CardImovel({ imovel, destacado, selecionado, onHover, onSelecionar }: Props) {
  const [favoritado, setFavoritado] = useState(false)
  const foto = fotoPrincipal(imovel)

  return (
    <div
      id={`card-imovel-${imovel.id}`}
      className={`${styles.card} ${destacado ? styles.destacado : ''} ${selecionado ? styles.selecionado : ''}`}
      onMouseEnter={() => onHover?.(imovel.id)}
      onMouseLeave={() => onHover?.(null)}
      onClick={() => onSelecionar?.(imovel.id)}
    >
      {/* Foto */}
      <div className={styles.fotoWrapper}>
        <div
          className={styles.foto}
          style={{ backgroundImage: `url(${foto})` }}
        >
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
            onClick={(e) => {
              e.stopPropagation()
              setFavoritado(!favoritado)
            }}
            aria-label={favoritado ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
          >
            {favoritado ? '❤️' : '🤍'}
          </button>
        </div>
      </div>

      {/* Informações */}
      <div className={styles.info}>
        {/* Preço */}
        <div className={styles.preco}>
          {formatarPreco(imovel.preco, imovel.negociacao)}
          {imovel.condominio && imovel.negociacao === 'aluguel' && (
            <span className={styles.condominio}>
              + R$ {imovel.condominio.toLocaleString('pt-BR')} cond.
            </span>
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
            <span className={styles.car}>
              🚿 {imovel.banheiros}
            </span>
          )}
          {imovel.vagas !== undefined && imovel.vagas > 0 && (
            <span className={styles.car}>
              🚗 {imovel.vagas}
            </span>
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

        {/* Rodapé com Botão Visualizar */}
        <div className={styles.rodapeCard}>
          <Link
            href={`/imovel/${imovel.id}`}
            className={styles.btnVisualizar}
            onClick={(e) => e.stopPropagation()}
          >
            Visualizar Imóvel →
          </Link>
        </div>
      </div>
    </div>
  )
}