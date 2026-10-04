'use client'

import { useEffect, useRef, useState } from 'react'
import { useFavorito } from '@/hooks/useFavorito'
import styles from './BotaoFixar.module.css'

/*
 * "Fixar" — o gesto assinado da Fixum (como o "yeah!" do Enjoei).
 * O alfinete é o mesmo do "i" do logotipo. Ao fixar: ele desce e se crava,
 * curvas de nível se espalham a partir da ponta e um carimbo "fixado" aparece.
 * Ao desafixar, o alfinete só sai. Respeita prefers-reduced-motion (via CSS).
 */

interface Props {
  imovelId: string
  /** flutuante: círculo sobre a foto (cards). rotulo: botão com texto (página do imóvel). */
  variante?: 'flutuante' | 'rotulo'
  className?: string
}

// Curvas irregulares (anéis de "curva de nível") ao redor da ponta da agulha
const ANEIS = [
  'M12 7.2c2.9-.3 5.4 1.4 5.1 4.6-.3 3-2.7 5.1-5.6 4.9-2.8-.2-4.9-2.4-4.6-5.2.3-2.6 2.3-4 5.1-4.3z',
  'M11.6 3.4c5-.4 9.3 2.6 8.8 8-.5 5.1-4.6 8.7-9.6 8.3-4.8-.4-8.3-4.1-7.8-8.8.5-4.4 3.9-7.1 8.6-7.5z',
  'M12.3-.2c6.8-.5 12.4 3.6 11.7 10.8-.7 6.9-6.2 11.6-12.9 11.1C4.6 21.2-.1 16.3.6 10 1.2 4.1 5.9.3 12.3-.2z',
]

export default function BotaoFixar({ imovelId, variante = 'flutuante', className }: Props) {
  const { favoritado, toggleFavorito, carregando } = useFavorito(imovelId)
  return (
    <AlfineteFixar
      favoritado={favoritado}
      carregando={carregando}
      onAlternar={toggleFavorito}
      variante={variante}
      className={className}
    />
  )
}

/** Versão de demonstração (home): mesmo gesto, estado só local, sem login. */
export function BotaoFixarDemo({ variante = 'flutuante', className }: Omit<Props, 'imovelId'>) {
  const [favoritado, setFavoritado] = useState(false)
  return (
    <AlfineteFixar
      favoritado={favoritado}
      onAlternar={() => setFavoritado((f) => !f)}
      variante={variante}
      className={className}
    />
  )
}

interface PropsAlfinete extends Omit<Props, 'imovelId'> {
  favoritado: boolean
  carregando?: boolean
  onAlternar: () => void
}

function AlfineteFixar({ favoritado, carregando = false, onAlternar, variante = 'flutuante', className }: PropsAlfinete) {
  const acionadoRef = useRef(false)
  const anteriorRef = useRef(favoritado)
  const [animacao, setAnimacao] = useState<'cravar' | 'soltar' | null>(null)
  const [rodada, setRodada] = useState(0)

  // Anima só quando a mudança veio de um clique neste botão
  useEffect(() => {
    if (anteriorRef.current === favoritado) return
    anteriorRef.current = favoritado
    if (!acionadoRef.current) return
    acionadoRef.current = false
    setAnimacao(favoritado ? 'cravar' : 'soltar')
    setRodada((r) => r + 1)
    if (favoritado && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try { navigator.vibrate?.(12) } catch { /* sem suporte */ }
    }
  }, [favoritado])

  function aoClicar(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    acionadoRef.current = true
    onAlternar()
  }

  const rotulo = favoritado ? 'Fixado' : 'Fixar'

  return (
    <button
      type="button"
      className={`${styles.botao} ${styles[variante]} ${favoritado ? styles.fixado : ''} ${className ?? ''}`}
      onClick={aoClicar}
      disabled={carregando}
      aria-pressed={favoritado}
      aria-label={favoritado ? 'Desafixar imóvel' : 'Fixar imóvel para comparar depois'}
      title={favoritado ? 'Desafixar' : 'Fixar para comparar depois'}
    >
      <span className={styles.alvo} aria-hidden="true">
        {animacao === 'cravar' && (
          <svg key={`aneis-${rodada}`} className={styles.aneis} viewBox="-2 -2 28 28">
            {ANEIS.map((d, i) => (
              <path key={i} d={d} style={{ animationDelay: `${i * 110}ms` }} />
            ))}
          </svg>
        )}
        <svg
          key={`pino-${rodada}`}
          className={`${styles.pino} ${animacao === 'cravar' ? styles.cravar : ''} ${animacao === 'soltar' ? styles.soltar : ''}`}
          viewBox="0 0 24 24"
          onAnimationEnd={() => setAnimacao((a) => (a === 'soltar' ? null : a))}
        >
          {/* agulha */}
          <path className={styles.agulha} d="M12 17.5L12 22.6" />
          {/* haste */}
          <path className={styles.haste} d="M12 12.4V17.8" />
          {/* cabeça — a mesma do "i" do logotipo */}
          <circle className={styles.cabeca} cx="12" cy="7.6" r="4.9" />
        </svg>
      </span>

      {variante === 'rotulo' && <span className={styles.texto}>{rotulo}</span>}

      {animacao === 'cravar' && variante === 'flutuante' && (
        <span key={`carimbo-${rodada}`} className={styles.carimbo} aria-hidden="true">
          fixado
        </span>
      )}
    </button>
  )
}
