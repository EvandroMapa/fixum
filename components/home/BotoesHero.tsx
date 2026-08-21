'use client'

import Link from 'next/link'
import styles from './BotoesHero.module.css'

export default function BotoesHero() {
  return (
    <div className={styles.wrapper}>
      {/* Comprar — vai direto para o mapa com filtro de venda */}
      <Link
        href="/explorar?negociacao=venda"
        className={`btn btn-acento btn-lg ${styles.btnPrimario}`}
      >
        <span>🏠</span> Quero Comprar
      </Link>

      {/* Alugar — vai direto para o mapa com filtro de aluguel */}
      <Link
        href="/explorar?negociacao=aluguel"
        className={`btn btn-lg ${styles.btnSecundario}`}
      >
        <span>🔑</span> Quero Alugar
      </Link>

      {/* Explorar no mapa — visão geral */}
      <Link
        href="/explorar"
        className={`btn btn-lg ${styles.btnMapa}`}
      >
        <span>🗺️</span> Explorar no mapa
      </Link>
    </div>
  )
}
