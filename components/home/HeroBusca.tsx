'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createPortal } from 'react-dom'
import Icone from '@/components/ui/Icone'
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
    const width = isMobile ? screenW - 24 : Math.max(rect.width, 380)
    const left = isMobile
      ? 12
      : rect.left

    // Altura estimada do dropdown (5 itens × ~56px + padding)
    const alturaDropdown = 300
    const espacoAbaixo = screenH - rect.bottom
    const abrirAcima = espacoAbaixo < alturaDropdown && rect.top > alturaDropdown

    setDropdownPos({
      top: rect.bottom + 8,
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
      const itens: Sugestao[] = (data.features ?? []).map((f: { id: string; place_name: string; text: string; center: [number, number] }) => {
        const partes = (f.place_name || '').split(', ')
        const nomePrincipal = f.text || partes[0] || ''
        const detalhe = partes.length > 1 ? partes.slice(1).join(', ') : f.place_name
        return {
          id: f.id,
          nome: nomePrincipal,
          nomeCompleto: detalhe,
          coords: f.center,
        }
      })
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
    if (typeof window !== 'undefined') sessionStorage.removeItem('fixum_mapa_pos')
    if (!navigator.geolocation) {
      setGeoErro('Seu navegador não informa a localização. Digite a cidade ou o bairro.')
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
          setGeoErro('A localização não foi liberada. Digite a cidade ou o bairro.')
        } else {
          setGeoErro('Não conseguimos sua localização agora. Tente digitar o bairro.')
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
    if (typeof window !== 'undefined') sessionStorage.removeItem('fixum_mapa_pos')
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
            <Icone nome="local" tamanho={18} />
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
      {/* Comprar / Alugar */}
      <div className={styles.abasWrapper} role="tablist" aria-label="Tipo de negociação">
        <button
          type="button"
          role="tab"
          aria-selected={negociacao === 'venda'}
          className={`${styles.aba} ${negociacao === 'venda' ? styles.abaAtiva : ''}`}
          onClick={() => setNegociacao('venda')}
        >
          Comprar
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={negociacao === 'aluguel'}
          className={`${styles.aba} ${negociacao === 'aluguel' ? styles.abaAtiva : ''}`}
          onClick={() => setNegociacao('aluguel')}
        >
          Alugar
        </button>
      </div>

      <div className={styles.barraBusca}>
        <label className={styles.inputContainer}>
          <span className={styles.iconeLupa}>
            <Icone nome="local" tamanho={22} />
          </span>
          <span className={styles.inputTextos}>
            <span className={styles.inputRotulo}>Onde</span>
            <input
              ref={inputRef}
              type="text"
              className={styles.input}
              placeholder="Cidade, bairro ou rua"
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
              aria-label="Cidade, bairro ou rua"
            />
          </span>
          {carregandoSugestoes && <span className={styles.spinner} />}
          {texto && !carregandoSugestoes && (
            <button
              className={styles.btnLimpar}
              onClick={handleLimparInput}
              type="button"
              aria-label="Limpar"
            >
              <Icone nome="fechar" tamanho={16} />
            </button>
          )}
        </label>

        <button
          type="button"
          className={`${styles.btnGps} ${geoCarregando ? styles.btnGpsLoading : ''}`}
          onClick={handleUsarGps}
          disabled={geoCarregando}
          title="Ver imóveis perto de onde você está"
        >
          {geoCarregando ? <span className={styles.spinnerGps} /> : <Icone nome="mira" tamanho={18} />}
          <span className={styles.textoGps}>{geoCarregando ? 'Localizando…' : 'Perto de mim'}</span>
        </button>

        <button type="button" className={styles.btnBuscar} onClick={executarBusca}>
          <Icone nome="mapa" tamanho={18} />
          <span>Explorar no mapa</span>
        </button>
      </div>

      {geoErro && (
        <span className={styles.avisoErro} role="alert">
          <Icone nome="alerta" tamanho={16} /> {geoErro}
        </span>
      )}

      {montado && dropdownMenu && createPortal(dropdownMenu, document.body)}
    </div>
  )
}
