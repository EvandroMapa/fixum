/*
 * Curvas de nível — elemento gráfico da marca (brandbook, seção 06).
 * Geradas de forma determinística a partir de uma semente: o mesmo `semente`
 * sempre produz o mesmo desenho, então o HTML do servidor e do cliente batem.
 * Cor via currentColor; controle a opacidade pelo CSS de quem usa.
 */

interface Pico {
  /** Posição do centro, 0–1 relativo à largura/altura. */
  x: number
  y: number
  aneis: number
  passo: number
  semente: number
}

interface Props {
  picos?: Pico[]
  /** Proporção altura/largura da área desenhada (só afeta o enquadramento). */
  proporcao?: number
  className?: string
}

function aleatorio(semente: number) {
  let s = semente | 0
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function gerarCaminhos(picos: Pico[], L: number, A: number) {
  const caminhos: { d: string; mestra: boolean }[] = []
  for (const p of picos) {
    const r = aleatorio(p.semente)
    const fase = [r() * 6.28, r() * 6.28, r() * 6.28, r() * 6.28]
    const amp = [0.14 + r() * 0.08, 0.08 + r() * 0.06, 0.05 + r() * 0.04, 0.03]
    const dx = (r() - 0.5) * 1.6
    const dy = (r() - 0.5) * 1.6
    const cx = p.x * L
    const cy = p.y * A
    for (let k = 1; k <= p.aneis; k++) {
      const raio = k * p.passo
      const ox = cx + dx * k * k * 0.6
      const oy = cy + dy * k * k * 0.6
      let d = ''
      for (let i = 0; i <= 96; i++) {
        const t = (i / 96) * Math.PI * 2
        const m =
          1 +
          amp[0] * Math.sin(2 * t + fase[0] + k * 0.07) +
          amp[1] * Math.sin(3 * t + fase[1] - k * 0.05) +
          amp[2] * Math.sin(5 * t + fase[2] + k * 0.11) +
          amp[3] * Math.sin(7 * t + fase[3])
        const x = ox + Math.cos(t) * raio * m * 1.15
        const y = oy + Math.sin(t) * raio * m
        d += `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`
      }
      caminhos.push({ d: d + 'Z', mestra: k % 5 === 0 })
    }
  }
  return caminhos
}

const PADRAO: Pico[] = [
  { x: 0.78, y: 0.4, aneis: 20, passo: 30, semente: 7 },
  { x: 0.1, y: 0.95, aneis: 10, passo: 28, semente: 3 },
]

export default function CurvasDeNivel({ picos = PADRAO, proporcao = 0.6, className }: Props) {
  const L = 1000
  const A = Math.round(L * proporcao)
  const caminhos = gerarCaminhos(picos, L, A)
  return (
    <svg
      viewBox={`0 0 ${L} ${A}`}
      preserveAspectRatio="xMidYMid slice"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <g fill="none" stroke="currentColor" vectorEffect="non-scaling-stroke">
        {caminhos.map((c, i) => (
          <path key={i} d={c.d} strokeWidth={c.mestra ? 1.6 : 1} vectorEffect="non-scaling-stroke" />
        ))}
      </g>
    </svg>
  )
}
