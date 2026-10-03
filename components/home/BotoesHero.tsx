'use client'

import Link from 'next/link'
import styles from './BotoesHero.module.css'
import Icone from '@/components/ui/Icone'

export default function BotoesHero() {
  return (
    <div className={styles.wrapper}>
      {/* Comprar — vai direto para o mapa com filtro de venda */}
      <Link
        href="/explorar?negociacao=venda"
        className={`btn btn-acento btn-lg ${styles.btnPrimario}`}
      >
        <span><Icone nome="casa" tamanho={16} /></span> Quero comprar
      </Link>

      {/* Alugar — vai direto para o mapa com filtro de aluguel */}
      <Link
        href="/explorar?negociacao=aluguel"
        className={`btn btn-lg ${styles.btnSecundario}`}
      >
        <span><Icone nome="chave" tamanho={16} /></span> Quero alugar
      </Link>

      {/* Explorar no mapa — visão geral */}
      <Link
        href="/explorar"
        className={`btn btn-lg ${styles.btnMapa}`}
      >
        <span><Icone nome="mapa" tamanho={16} /></span> Explorar no mapa
      </Link>
    </div>
  )
}
