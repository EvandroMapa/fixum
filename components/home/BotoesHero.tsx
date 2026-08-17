'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import styles from './BotoesHero.module.css'
import ModalBuscaCidade from './ModalBuscaCidade'

type Negociacao = 'venda' | 'aluguel'

export default function BotoesHero() {
  const router = useRouter()
  const [modalNeg, setModalNeg] = useState<Negociacao | null>(null)

  return (
    <>
      <div className={styles.wrapper}>
        {/* Comprar — abre modal de cidade */}
        <button
          className={`btn btn-acento btn-lg ${styles.btnPrimario}`}
          onClick={() => setModalNeg('venda')}
        >
          <span>🏠</span> Quero Comprar
        </button>

        {/* Alugar — abre modal de cidade */}
        <button
          className={`btn btn-lg ${styles.btnSecundario}`}
          onClick={() => setModalNeg('aluguel')}
        >
          <span>🔑</span> Quero Alugar
        </button>

        {/* Explorar no mapa — vai direto, sem modal */}
        <button
          className={`btn btn-lg ${styles.btnMapa}`}
          onClick={() => router.push('/explorar')}
        >
          <span>🗺️</span> Explorar no mapa
        </button>
      </div>

      {/* Modal de cidade */}
      {modalNeg && (
        <ModalBuscaCidade
          negociacao={modalNeg}
          onFechar={() => setModalNeg(null)}
        />
      )}
    </>
  )
}
