import Image from 'next/image'
import Icone from '@/components/ui/Icone'
import styles from './MapaVitrine.module.css'

/*
 * Mapa ilustrativo do hero da home. É uma imagem estática (public/mapa-hero.webp),
 * capturada do mapa vetorial no estilo da marca, centro em -43.7867, -20.6603 e zoom 14.2,
 * para a home carregar sem baixar o Mapbox.
 *
 * A imagem fica num "palco" com a mesma proporção dela (9:7) que cobre a moldura
 * como um object-fit: cover. Os pins são posicionados em % desse palco, então
 * continuam sobre a mesma rua em qualquer tamanho de tela.
 * Para recapturar: mesmo centro/zoom, 720x560 a 2x, e recalcular x/y com map.project().
 */

// Foto ilustrativa (Unsplash)
const FOTO = 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=200&auto=format&fit=crop&q=80'

type Pin = { x: number; y: number; texto: string; tipo?: 'ativo' | 'destaque' | 'cluster' }

const PINS: Pin[] = [
  { x: 26.95, y: 28.55, texto: 'R$ 420 mil' },
  { x: 67.1, y: 30.6, texto: 'R$ 285 mil', tipo: 'ativo' },
  { x: 25.84, y: 56.13, texto: 'R$ 610 mil' },
  { x: 51.49, y: 79.63, texto: 'R$ 1.800/mês', tipo: 'destaque' },
  { x: 77.88, y: 72.48, texto: '12', tipo: 'cluster' },
]

export default function MapaVitrine() {
  const ativo = PINS.find((p) => p.tipo === 'ativo')!

  return (
    <div className={styles.mapa}>
      <div className={styles.palco}>
        <Image
          src="/mapa-hero.webp"
          alt=""
          fill
          priority
          sizes="(max-width: 640px) 100vw, 640px"
          className={styles.imagem}
        />

        {PINS.map((p) => (
          <span
            key={p.texto}
            className={
              p.tipo === 'cluster'
                ? styles.cluster
                : `${styles.pin} ${p.tipo === 'ativo' ? styles.pinAtivo : ''} ${p.tipo === 'destaque' ? styles.pinDestaque : ''}`
            }
            style={{ left: `${p.x}%`, top: `${p.y}%` }}
          >
            {p.texto}
          </span>
        ))}

        {/* Prévia do imóvel presa ao pin selecionado */}
        <div className={styles.card} style={{ left: `${ativo.x}%`, top: `${ativo.y}%` }}>
          <div className={styles.cardFoto}>
            <Image src={FOTO} alt="" fill sizes="64px" className={styles.cardImagem} />
          </div>
          <div>
            <strong>R$ 285.000</strong>
            <span>Casa · 3 quartos · 142 m²</span>
            <span className={styles.cardLugar}>
              <Icone nome="caminhada" tamanho={14} /> 5 min da praça
            </span>
          </div>
        </div>
      </div>

      <span className={styles.atribuicao}>
        <img src="/mapbox-logo.svg" alt="Mapbox" width={66} height={17} />
        <span>© Mapbox © OpenStreetMap</span>
      </span>
    </div>
  )
}
