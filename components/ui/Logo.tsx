import { useId } from 'react'

/*
 * Marca Fixum — ver brand/brandbook-fixum.html
 *
 * <Logotipo />  "fixum" desenhado em traço único; o x carrega o Marco (ponto vermelho).
 * <Simbolo />   o x isolado, para espaços pequenos (favicon, avatar, pin do mapa).
 *
 * Nunca use os dois lado a lado: o x já está no nome.
 * A cor do traço segue `currentColor`; o ponto usa `corMarco` (padrão: Vermelho Marco).
 */

const VERMELHO_MARCO = '#D4401F'

interface LogotipoProps {
  /** Largura em px (a altura é proporcional, 266:92). */
  largura?: number
  corMarco?: string
  className?: string
  titulo?: string
}

export function Logotipo({ largura = 96, corMarco = VERMELHO_MARCO, className, titulo = 'Fixum' }: LogotipoProps) {
  const id = useId().replace(/:/g, '')
  return (
    <svg
      viewBox="2 12 266 92"
      width={largura}
      height={Math.round((largura * 92) / 266)}
      className={className}
      role="img"
      aria-label={titulo}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <clipPath id={`c${id}`}>
          <rect x="60" y="50" width="80" height="50" />
        </clipPath>
        <mask id={`m${id}`} maskUnits="userSpaceOnUse" x="0" y="0" width="300" height="120">
          <rect width="300" height="120" fill="#fff" />
          <circle cx="101" cy="75" r="11.5" fill="#000" />
        </mask>
      </defs>
      <g fill="none" stroke="currentColor" strokeWidth="13">
        <path d="M16 100V44A22 22 0 0 1 38 22H40M4 56.5H40" />
        <path d="M60 100V50" />
        <g clipPath={`url(#c${id})`} mask={`url(#m${id})`}>
          <path d="M78.6 40L123.4 110M123.4 40L78.6 110" />
        </g>
        <path d="M142 50V78A16 16 0 0 0 174 78V50M174 50V100" />
        <path d="M198 100V50M198 72A15.5 15.5 0 0 1 229 72V100M229 72A15.5 15.5 0 0 1 260 72V100" />
      </g>
      <circle cx="60" cy="30" r="8" fill="currentColor" />
      <circle cx="101" cy="75" r="6.5" fill={corMarco} />
    </svg>
  )
}

interface SimboloProps {
  tamanho?: number
  corMarco?: string
  className?: string
  titulo?: string
}

export function Simbolo({ tamanho = 32, corMarco = VERMELHO_MARCO, className, titulo = 'Fixum' }: SimboloProps) {
  const id = useId().replace(/:/g, '')
  return (
    <svg
      viewBox="0 0 100 100"
      width={tamanho}
      height={tamanho}
      className={className}
      role="img"
      aria-label={titulo}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <clipPath id={`c${id}`}>
          <rect x="0" y="14" width="100" height="72" />
        </clipPath>
        <mask id={`m${id}`} maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100">
          <rect width="100" height="100" fill="#fff" />
          <circle cx="50" cy="50" r="16" fill="#000" />
        </mask>
      </defs>
      <g clipPath={`url(#c${id})`} mask={`url(#m${id})`} fill="none" stroke="currentColor" strokeWidth="19">
        <path d="M18 0L82 100M82 0L18 100" />
      </g>
      <circle cx="50" cy="50" r="9" fill={corMarco} />
    </svg>
  )
}
