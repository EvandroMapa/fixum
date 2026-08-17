'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import styles from './BuscaHero.module.css'

const SUGESTOES_RAPIDAS = [
  { label: 'Casas à venda', href: '/explorar?negociacao=venda&tipo=casa' },
  { label: 'Apartamentos', href: '/explorar?tipo=apartamento' },
  { label: 'Para alugar', href: '/explorar?negociacao=aluguel' },
  { label: 'Terrenos', href: '/explorar?tipo=terreno' },
]

export default function BuscaHero() {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [negociacao, setNegociacao] = useState<'todos' | 'venda' | 'aluguel'>('todos')
  const inputRef = useRef<HTMLInputElement>(null)

  function handleBuscar(e: React.FormEvent) {
    e.preventDefault()
    const params = new URLSearchParams()
    if (query.trim()) params.set('q', query.trim())
    if (negociacao !== 'todos') params.set('negociacao', negociacao)
    router.push(`/explorar?${params.toString()}`)
  }

  return (
    <div className={styles.wrapper}>
      {/* Tabs Comprar / Alugar */}
      <div className={styles.tabs}>
        {(['todos', 'venda', 'aluguel'] as const).map((t) => (
          <button
            key={t}
            type="button"
            className={`${styles.tab} ${negociacao === t ? styles.tabAtiva : ''}`}
            onClick={() => setNegociacao(t)}
          >
            {t === 'todos' ? 'Todos' : t === 'venda' ? 'Comprar' : 'Alugar'}
          </button>
        ))}
      </div>

      {/* Campo de busca */}
      <form className={styles.form} onSubmit={handleBuscar}>
        <div className={styles.inputWrap}>
          <svg className={styles.iconBusca} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            ref={inputRef}
            type="text"
            className={styles.input}
            placeholder="Bairro, cidade ou tipo de imóvel..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            autoComplete="off"
          />
          {query && (
            <button type="button" className={styles.btnLimpar} onClick={() => { setQuery(''); inputRef.current?.focus() }}>
              ✕
            </button>
          )}
        </div>
        <button type="submit" className={styles.btnBuscar}>
          Buscar
        </button>
      </form>

      {/* Sugestões rápidas */}
      <div className={styles.rapidas}>
        <span className={styles.rapidasLabel}>Popular:</span>
        {SUGESTOES_RAPIDAS.map(s => (
          <a key={s.label} href={s.href} className={styles.chip}>
            {s.label}
          </a>
        ))}
      </div>
    </div>
  )
}
