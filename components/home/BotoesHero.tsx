'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import styles from './BotoesHero.module.css'

export default function BotoesHero() {
  const [mapaAberto, setMapaAberto] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Fecha dropdown ao clicar fora
  useEffect(() => {
    function fechar(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setMapaAberto(false)
      }
    }
    document.addEventListener('mousedown', fechar)
    return () => document.removeEventListener('mousedown', fechar)
  }, [])

  return (
    <div className={styles.wrapper}>
      {/* Comprar */}
      <Link
        href="/explorar?negociacao=venda"
        className={`btn btn-acento btn-lg ${styles.btnPrimario}`}
      >
        <span>🏠</span> Quero Comprar
      </Link>

      {/* Alugar */}
      <Link
        href="/explorar?negociacao=aluguel"
        className={`btn btn-lg ${styles.btnSecundario}`}
      >
        <span>🔑</span> Quero Alugar
      </Link>

      {/* Explorar no mapa — abre dropdown */}
      <div className={styles.mapaContainer} ref={ref}>
        <button
          className={`btn btn-lg ${styles.btnMapa} ${mapaAberto ? styles.mapaAtivo : ''}`}
          onClick={() => setMapaAberto((v) => !v)}
          aria-expanded={mapaAberto}
        >
          <span>🗺️</span> Explorar no mapa
        </button>

        {mapaAberto && (
          <div className={styles.dropdown}>
            <p className={styles.dropdownLabel}>Você busca imóvel para…</p>
            <Link
              href="/explorar?negociacao=venda"
              className={styles.dropdownOpcao}
              onClick={() => setMapaAberto(false)}
            >
              <span className={styles.dropdownIcone}>🏠</span>
              <div>
                <strong>Comprar</strong>
                <small>Imóveis à venda no mapa</small>
              </div>
            </Link>
            <Link
              href="/explorar?negociacao=aluguel"
              className={styles.dropdownOpcao}
              onClick={() => setMapaAberto(false)}
            >
              <span className={styles.dropdownIcone}>🔑</span>
              <div>
                <strong>Alugar</strong>
                <small>Imóveis para locação no mapa</small>
              </div>
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
