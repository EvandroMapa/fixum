'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'
import styles from './BuscaAutoComplete.module.css'

export interface Sugestao {
  id: string
  nome: string
  nomeCompleto: string
  coords: [number, number]
}

interface Props {
  placeholder?: string
  onSelecionada: (sugestao: Sugestao) => void
  onLimpar?: () => void
  valorInicial?: string
  autoFocus?: boolean
}

export default function BuscaAutoComplete({
  placeholder = 'Cidade, bairro ou regiao...',
  onSelecionada,
  onLimpar,
  valorInicial,
  autoFocus,
}: Props) {
  const [texto, setTexto] = useState(valorInicial ?? '')
  const [sugestoes, setSugestoes] = useState<Sugestao[]>([])
  const [carregando, setCarregando] = useState(false)
  const [aberto, setAberto] = useState(false)
  const [indiceAtivo, setIndiceAtivo] = useState(-1)
  const [dropdownPos, setDropdownPos] = useState({ top: 0, bottom: 0, left: 0, width: 0, abrirAcima: false })
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [montado, setMontado] = useState(false)

  useEffect(() => { setMontado(true) }, [])

  // Sincroniza o texto do input caso valorInicial mude externamente (ou seja limpo)
  useEffect(() => {
    setTexto(valorInicial ?? '')
  }, [valorInicial])

  const atualizarPosicao = useCallback(() => {
    if (!wrapperRef.current) return
    const rect = wrapperRef.current.getBoundingClientRect()
    const screenW = window.innerWidth
    const screenH = window.innerHeight
    const isMobile = screenW < 768
    const width = isMobile ? Math.min(rect.width, screenW - 24) : Math.max(rect.width, 320)
    const left = isMobile
      ? Math.max(12, Math.min(rect.left, screenW - width - 12))
      : Math.min(rect.left, screenW - width - 16)

    const alturaDropdown = 280
    const espacoAbaixo = screenH - rect.bottom
    const abrirAcima = espacoAbaixo < alturaDropdown && rect.top > alturaDropdown

    setDropdownPos({
      top: rect.bottom + 6,
      bottom: (screenH - rect.top) + 6,
      left,
      width,
      abrirAcima,
    })
  }, [])

  const buscarSugestoes = useCallback(async (query: string) => {
    if (query.length < 2) { setSugestoes([]); setAberto(false); return }
    setCarregando(true)
    try {
      const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
      if (!token) return
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${token}&language=pt&country=BR&limit=6`
      const res = await fetch(url)
      const data = await res.json()
      const itens: Sugestao[] = (data.features ?? []).map((f: { id: string; place_name: string; text: string; center: [number, number] }) => ({
        id: f.id, nome: f.text, nomeCompleto: f.place_name, coords: f.center,
      }))
      setSugestoes(itens)
      if (itens.length > 0) { atualizarPosicao(); setAberto(true) } else { setAberto(false) }
      setIndiceAtivo(-1)
    } catch { setSugestoes([]); setAberto(false) }
    finally { setCarregando(false) }
  }, [atualizarPosicao])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    setTexto(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => buscarSugestoes(val), 300)
  }

  function handleSelecionar(s: Sugestao) {
    setTexto(s.nome); setSugestoes([]); setAberto(false)
    onSelecionada(s); inputRef.current?.blur()
  }

  function handleLimpar() {
    setTexto(''); setSugestoes([]); setAberto(false)
    onLimpar?.(); inputRef.current?.focus()
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!aberto) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setIndiceAtivo(i => Math.min(i + 1, sugestoes.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setIndiceAtivo(i => Math.max(i - 1, -1)) }
    else if (e.key === 'Enter' && indiceAtivo >= 0) { e.preventDefault(); handleSelecionar(sugestoes[indiceAtivo]) }
    else if (e.key === 'Escape') setAberto(false)
  }

  useEffect(() => {
    function onClickFora(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setAberto(false)
    }
    document.addEventListener('mousedown', onClickFora)
    return () => document.removeEventListener('mousedown', onClickFora)
  }, [])

  useEffect(() => {
    if (!aberto) return
    const onResize = () => atualizarPosicao()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [aberto, atualizarPosicao])

  const dropdown = aberto && sugestoes.length > 0 && (
    <ul
      className={`${styles.dropdown} ${dropdownPos.abrirAcima ? styles.dropdownAcima : ''}`}
      role="listbox"
      style={{
        position: 'fixed',
        ...(dropdownPos.abrirAcima ? { bottom: dropdownPos.bottom } : { top: dropdownPos.top }),
        left: dropdownPos.left,
        width: dropdownPos.width,
        zIndex: 10001,
      }}
    >
      {sugestoes.map((s, idx) => (
        <li
          key={s.id}
          className={`${styles.item} ${idx === indiceAtivo ? styles.itemAtivo : ''}`}
          onMouseDown={() => handleSelecionar(s)}
          onMouseEnter={() => setIndiceAtivo(idx)}
          role="option"
          aria-selected={idx === indiceAtivo}
        >
          <span className={styles.itemIcone}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
          </span>
          <div className={styles.itemTexto}>
            <span className={styles.itemNome}>{s.nome}</span>
            <span className={styles.itemDetalhe}>{s.nomeCompleto}</span>
          </div>
        </li>
      ))}
    </ul>
  )

  return (
    <div className={styles.wrapper} ref={wrapperRef}>
      <div className={styles.inputWrapper}>
        <span className={styles.icone}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
        </span>
        <input ref={inputRef} type="text" className={styles.input} placeholder={placeholder}
          value={texto} onChange={handleChange} onKeyDown={handleKeyDown}
          onFocus={() => { if (sugestoes.length > 0) { atualizarPosicao(); setAberto(true) } }}
          autoComplete="off" spellCheck={false} autoFocus={autoFocus} />
        {carregando && <span className={styles.spinner} />}
        {texto && !carregando && (
          <button className={styles.btnLimpar} onClick={handleLimpar} type="button" aria-label="Limpar busca">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
      {montado && dropdown && createPortal(dropdown, document.body)}
    </div>
  )
}
