interface Props {
  size?: number
  className?: string
}

/**
 * Ícone da "gota" do Fixum — pin de localização com casinha.
 * Usar em lugares onde a logo completa não cabe:
 *   - Sidebar do painel
 *   - Favicon
 *   - Marcadores do mapa
 *   - Avatar/ícone compacto
 */
export default function LogoGota({ size = 40, className }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Gota / Pin de localização */}
      <path
        d="M50 4C30.1 4 14 20.1 14 40C14 62.5 50 96 50 96C50 96 86 62.5 86 40C86 20.1 69.9 4 50 4Z"
        fill="white"
        stroke="#1a56db"
        strokeWidth="7"
      />

      {/* Telhado / Chevron da casa — laranja */}
      <path
        d="M27 45L50 26L73 45"
        stroke="#f97316"
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Janela / grade da casa */}
      <rect x="41" y="52" width="18" height="14" rx="1.5" fill="none" stroke="#1a56db" strokeWidth="4.5" />
      <line x1="50" y1="52" x2="50" y2="66" stroke="#1a56db" strokeWidth="2.5" />
      <line x1="41" y1="59" x2="59" y2="59" stroke="#1a56db" strokeWidth="2.5" />

      {/* Mapa / grid abaixo do pin */}
      <g stroke="#1a56db" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
        <line x1="50" y1="96" x2="50" y2="112" />
        <path d="M28 106 L50 112 L72 106" />
        <path d="M22 100 L50 108 L78 100" />
      </g>
    </svg>
  )
}
