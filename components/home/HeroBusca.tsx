'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createPortal } from 'react-dom'
import styles from './HeroBusca.module.css'

interface Sugestao {
  id: string
  nome: string
  nomeCompleto: string
  coords: [number, number]
}

export default function HeroBusca() {
  const router = useRouter()
  const [negociacao, setNegociacao] = useState<'venda' | 'aluguel'>('venda')
  const [texto, setTexto] = useState('')
  const [sugestoes, setSugestoes] = useState<Sugestao[]>([])
  const [sugestaoSelecionada, setSugestaoSelecionada] = useState<Sugestao | null>(null)
  const [carregandoSugestoes, setCarregandoSugestoes] = useState(false)
  const [dropdownAberto, setDropdownAberto] = useState(false)
  const [indiceAtivo, setIndiceAtivo] = useState(-1)
  const [geoCarregando, setGeoCarregando] = useState(false)
  const [geoErro, setGeoErro] = useState<string | null>(null)
  const [dropdownPos, setDropdownPos] = useState({ top: 0, bottom: 0, left: 0, width: 0, abrirAcima: false })
  const [montado, setMontado] = useState(false)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setMontado(true)
  }, [])

  // Posicionamento do dropdown de sugestões (Portal)
  const atualizarPosicaoDropdown = useCallback(() => {
    if (!inputRef.current) return
    const rect = inputRef.current.getBoundingClientRect()
    const screenW = window.innerWidth
    const screenH = window.innerHeight
    const isMobile = screenW < 768
    const width = isMobile ? Math.min(rect.width, screenW - 32) : Math.max(rect.width, 360)
    const left = isMobile
      ? Math.max(16, Math.min(rect.left, screenW - width - 16))
      : rect.left + window.scrollX

    // Altura estimada do dropdown (5 itens × ~56px + padding)
    const alturaDropdown = 300
    const espacoAbaixo = screenH - rect.bottom
    const abrirAcima = espacoAbaixo < alturaDropdown && rect.top > alturaDropdown

    setDropdownPos({
      top: rect.bottom + window.scrollY + 8,
      bottom: (screenH - rect.top) + 8,
      left,
      width,
      abrirAcima,
    })
  }, [])

  // Buscar sugestões no Mapbox Geocoding
  const buscarSugestoes = useCallback(async (query: string) => {
    if (query.trim().length < 2) {
      setSugestoes([])
      setDropdownAberto(false)
      return
    }
    setCarregandoSugestoes(true)
    try {
      const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
      if (!token) return
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${token}&language=pt&country=BR&limit=5`
      const res = await fetch(url)
      const data = await res.json()
      const itens: Sugestao[] = (data.features ?? []).map((f: { id: string; place_name: string; text: string; center: [number, number] }) => ({
        id: f.id,
        nome: f.text,
        nomeCompleto: f.place_name,
        coords: f.center,
      }))
      setSugestoes(itens)
      if (itens.length > 0) {
        atualizarPosicaoDropdown()
        setDropdownAberto(true)
      } else {
        setDropdownAberto(false)
      }
      setIndiceAtivo(-1)
    } catch {
      setSugestoes([])
      setDropdownAberto(false)
    } finally {
      setCarregandoSugestoes(false)
    }
  }, [atualizarPosicaoDropdown])

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    setTexto(val)
    setSugestaoSelecionada(null)
    setGeoErro(null)

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => buscarSugestoes(val), 280)
  }

  function handleSelecionarSugestao(sugestao: Sugestao) {
    setTexto(sugestao.nome)
    setSugestaoSelecionada(sugestao)
    setSugestoes([])
    setDropdownAberto(false)
  }

  function handleLimparInput() {
    setTexto('')
    setSugestaoSelecionada(null)
    setSugestoes([])
    setDropdownAberto(false)
    inputRef.current?.focus()
  }

  // Teclado para navegar nas sugestões
  function handleKeyDown(e: React.KeyboardEvent) {
    if (!dropdownAberto) {
      if (e.key === 'Enter') {
        e.preventDefault()
        executarBusca()
      }
      return
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setIndiceAtivo((i) => Math.min(i + 1, sugestoes.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setIndiceAtivo((i) => Math.max(i - 1, -1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (indiceAtivo >= 0 && sugestoes[indiceAtivo]) {
        handleSelecionarSugestao(sugestoes[indiceAtivo])
      } else {
        executarBusca()
      }
    } else if (e.key === 'Escape') {
      setDropdownAberto(false)
    }
  }

  // Fecha dropdown ao clicar fora
  useEffect(() => {
    function onClickFora(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setDropdownAberto(false)
      }
    }
    document.addEventListener('mousedown', onClickFora)
    return () => document.removeEventListener('mousedown', onClickFora)
  }, [])

  useEffect(() => {
    if (!dropdownAberto) return
    const onResize = () => atualizarPosicaoDropdown()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [dropdownAberto, atualizarPosicaoDropdown])

  // Geolocalização GPS do usuário
  function handleUsarGps() {
    if (!navigator.geolocation) {
      setGeoErro('Navegador sem suporte a GPS')
      return
    }
    setGeoCarregando(true)
    setGeoErro(null)

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords
        const params = new URLSearchParams({
          negociacao,
          origem: 'gps',
          lat: lat.toFixed(6),
          lng: lng.toFixed(6),
        })
        router.push(`/explorar?${params.toString()}`)
      },
      (err) => {
        setGeoCarregando(false)
        if (err.code === err.PERMISSION_DENIED) {
          setGeoErro('Permissão de GPS negada')
        } else {
          setGeoErro('Não foi possível obter localização')
        }
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 8000,
      }
    )
  }

  // Executar busca principal
  function executarBusca() {
    if (sugestaoSelecionada) {
      const [lng, lat] = sugestaoSelecionada.coords
      const params = new URLSearchParams({
        negociacao,
        cidade: sugestaoSelecionada.nome,
        lat: lat.toFixed(6),
        lng: lng.toFixed(6),
      })
      router.push(`/explorar?${params.toString()}`)
      return
    }

    if (texto.trim()) {
      // Se digitou algo livre
      const params = new URLSearchParams({
        negociacao,
        cidade: texto.trim(),
      })
      router.push(`/explorar?${params.toString()}`)
      return
    }

    // Se clicou em buscar sem digitar nada: vai para o mapa no modo da negociação
    router.push(`/explorar?negociacao=${negociacao}`)
  }

  const dropdownMenu = dropdownAberto && sugestoes.length > 0 && (
    <ul
      className={`${styles.dropdown} ${dropdownPos.abrirAcima ? styles.dropdownAcima : ''}`}
      role="listbox"
      style={{
        position: 'fixed',
        ...(dropdownPos.abrirAcima
          ? { bottom: dropdownPos.bottom }
          : { top: dropdownPos.top }),
        left: dropdownPos.left,
        width: dropdownPos.width,
        zIndex: 10002,
      }}
    >
      {sugestoes.map((s, idx) => (
        <li
          key={s.id}
          className={`${styles.itemDropdown} ${idx === indiceAtivo ? styles.itemDropdownAtivo : ''}`}
          onMouseDown={() => handleSelecionarSugestao(s)}
          onMouseEnter={() => setIndiceAtivo(idx)}
          role="option"
          aria-selected={idx === indiceAtivo}
        >
          <span className={styles.itemIcone}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
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
    <div className={styles.container} ref={wrapperRef}>
      {/* Abas: Comprar / Alugar */}
      <div className={styles.abasWrapper}>
        <button
          type="button"
          className={`${styles.aba} ${negociacao === 'venda' ? styles.abaAtiva : ''}`}
          onClick={() => setNegociacao('venda')}
        >
          <span>🏠</span> Quero Comprar
        </button>
        <button
          type="button"
          className={`${styles.aba} ${negociacao === 'aluguel' ? styles.abaAtiva : ''}`}
          onClick={() => setNegociacao('aluguel')}
        >
          <span>🔑</span> Quero Alugar
        </button>
      </div>

      {/* Caixa de Busca Unificada */}
      <div className={styles.barraBusca}>
        <div className={styles.inputContainer}>
          <span className={styles.iconeLupa}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
          </span>
          <input
            ref={inputRef}
            type="text"
            className={styles.input}
            placeholder="Qual cidade, bairro ou região você procura?"
            value={texto}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              if (sugestoes.length > 0) {
                atualizarPosicaoDropdown()
                setDropdownAberto(true)
              }
            }}
            autoComplete="off"
            spellCheck={false}
          />
          {carregandoSugestoes && <span className={styles.spinner} />}
          {texto && !carregandoSugestoes && (
            <button
              className={styles.btnLimpar}
              onClick={handleLimparInput}
              type="button"
              aria-label="Limpar texto"
            >
              ✕
            </button>
          )}
        </div>

        {/* Botão GPS */}
        <button
          type="button"
          className={`${styles.btnGps} ${geoCarregando ? styles.btnGpsLoading : ''}`}
          onClick={handleUsarGps}
          disabled={geoCarregando}
          title="Buscar imóveis perto da minha localização atual"
        >
          {geoCarregando ? (
            <span className={styles.spinnerGps} />
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
            </svg>
          )}
          <span className={styles.textoGps}>
            {geoCarregando ? 'Localizando...' : 'Perto de mim'}
          </span>
        </button>

        {/* Botão Principal de Busca */}
        <button
          type="button"
          className={styles.btnBuscar}
          onClick={executarBusca}
          title="Ver imóveis no mapa"
        >
          <span className={styles.btnBuscarIcone}>🗺️</span>
          <span>Buscar no Mapa</span>
        </button>
      </div>

      {geoErro && <span className={styles.avisoErro}>⚠️ {geoErro}</span>}

      {/* Link Secundário de Exploração Livre */}
      <div className={styles.rodapeAtalhos}>
        <button
          type="button"
          className={styles.linkExplorarLivre}
          onClick={() => router.push(`/explorar?negociacao=${negociacao}`)}
        >
          Ou navegue livremente pelo mapa interativo →
        </button>
      </div>

      {montado && dropdownMenu && createPortal(dropdownMenu, document.body)}
    </div>
  )
}
