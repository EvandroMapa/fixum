'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import styles from './BotoesHero.module.css'

export default function BotoesHero() {
  const [mapaAberto, setMapaAberto] = useState(false)
  const [dropPos, setDropPos] = useState({ top: 0, left: 0 })
  const btnRef = useRef<HTMLButtonElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)

  // Fecha ao clicar fora
  useEffect(() => {
    function fechar(e: MouseEvent) {
      if (
        dropRef.current && !dropRef.current.contains(e.target as Node) &&
        btnRef.current && !btnRef.current.contains(e.target as Node)
      ) {
        setMapaAberto(false)
      }
    }
    document.addEventListener('mousedown', fechar)
    return () => document.removeEventListener('mousedown', fechar)
  }, [])

  function abrirDropdown() {
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect()
      setDropPos({
        top: rect.bottom + 10 + window.scrollY,
        left: rect.left + rect.width / 2,
      })
    }
    setMapaAberto((v) => !v)
  }

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

      {/* Explorar no mapa */}
      <button
        ref={btnRef}
        className={`btn btn-lg ${styles.btnMapa} ${mapaAberto ? styles.mapaAtivo : ''}`}
        onClick={abrirDropdown}
        aria-expanded={mapaAberto}
      >
        <span>🗺️</span> Explorar no mapa
      </button>

      {/* Dropdown fixed — nunca cortado pelo overflow do hero */}
      {mapaAberto && (
        <div
          ref={dropRef}
          className={styles.dropdown}
          style={{
            position: 'fixed',
            top: dropPos.top,
            left: dropPos.left,
            transform: 'translateX(-50%)',
            zIndex: 9999,
          }}
        >
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
  )
}
