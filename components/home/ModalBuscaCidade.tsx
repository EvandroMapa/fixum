'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createPortal } from 'react-dom'
import BuscaAutoComplete, { type Sugestao } from '@/components/imovel/BuscaAutoComplete'
import styles from './ModalBuscaCidade.module.css'

interface Props {
  negociacao: 'venda' | 'aluguel'
  onFechar: () => void
}

export default function ModalBuscaCidade({ negociacao, onFechar }: Props) {
  const router = useRouter()
  const [montado, setMontado] = useState(false)
  const [geoCarregando, setGeoCarregando] = useState(false)
  const [geoErro, setGeoErro] = useState<string | null>(null)
  const overlayRef = useRef<HTMLDivElement>(null)

  // Garante que estamos no cliente antes de usar o portal
  useEffect(() => { setMontado(true) }, [])

  const icone = negociacao === 'venda' ? '🏠' : '🔑'
  const titulo = negociacao === 'venda' ? 'Onde você quer comprar?' : 'Onde você quer alugar?'

  // Fecha ao clicar no overlay
  function handleOverlayClick(e: React.MouseEvent) {
    if (e.target === overlayRef.current) onFechar()
  }

  // Fecha com Esc
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onFechar()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onFechar])

  function handleCidadeSelecionada(sugestao: Sugestao) {
    const [lng, lat] = sugestao.coords
    const params = new URLSearchParams({
      negociacao,
      cidade: sugestao.nome,
      lat: lat.toFixed(6),
      lng: lng.toFixed(6),
    })
    router.push(`/explorar?${params.toString()}`)
    onFechar()
  }

  function usarLocalizacao() {
    if (!navigator.geolocation) {
      setGeoErro('Seu navegador não suporta geolocalização')
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
        onFechar()
      },
      (err) => {
        setGeoCarregando(false)
        if (err.code === err.PERMISSION_DENIED) {
          setGeoErro('Permissão de localização negada')
        } else {
          setGeoErro('Não foi possível obter sua localização')
        }
      },
      { timeout: 8000 }
    )
  }

  const conteudo = (
    <div className={styles.overlay} ref={overlayRef} onClick={handleOverlayClick}>
      <div className={styles.modal}>
        {/* Header */}
        <div className={styles.header}>
          <span className={styles.icone}>{icone}</span>
          <h2 className={styles.titulo}>{titulo}</h2>
          <button className={styles.btnFechar} onClick={onFechar} aria-label="Fechar">×</button>
        </div>

        {/* Autocomplete */}
        <div className={styles.campo}>
          <BuscaAutoComplete
            placeholder="Digite a cidade ou bairro..."
            onSelecionada={handleCidadeSelecionada}
            autoFocus
          />
        </div>

        {/* Divisor */}
        <div className={styles.divisor}>
          <span>ou</span>
        </div>

        {/* Geolocalização */}
        <button
          className={styles.btnGeo}
          onClick={usarLocalizacao}
          disabled={geoCarregando}
        >
          {geoCarregando ? (
            <span className={styles.spinner} />
          ) : (
            <span>📍</span>
          )}
          {geoCarregando ? 'Obtendo localização...' : 'Usar minha localização atual'}
        </button>

        {geoErro && <p className={styles.erro}>{geoErro}</p>}

        {/* Dica */}
        <p className={styles.dica}>
          Você também pode explorar diretamente no mapa sem escolher cidade.{' '}
          <button
            className={styles.linkExplorar}
            onClick={() => {
              router.push(`/explorar?negociacao=${negociacao}`)
              onFechar()
            }}
          >
            Ir para o mapa →
          </button>
        </p>
      </div>
    </div>
  )

  if (!montado) return null
  return createPortal(conteudo, document.body)
}
