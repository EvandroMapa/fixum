import { useId } from 'react'
import { LOGOTIPO_VIEWBOX, LOGOTIPO_PROPORCAO, LOGOTIPO_CORPO, MONOGRAMA_VIEWBOX, MONOGRAMA_CORPO } from './logo-dados'

/*
 * Marca Fixum — ver brand/brandbook-fixum.html
 *
 * <Logotipo />  "fixum" com o i desenhado como alfinete de mapa (cabeça Vermelho Marco).
 * <Simbolo />   monograma "fi" recortado do logotipo, para espaços pequenos.
 *
 * Nunca use os dois lado a lado. O traço segue `currentColor`; a cabeça usa `corMarco`.
 */

const VERMELHO_MARCO = '#D4401F'

function corpo(svg: string, uid: string, corMarco: string) {
  return svg.replaceAll('UID', uid).replaceAll('MARCO', corMarco)
}

interface LogotipoProps {
  /** Largura em px (a altura é proporcional). */
  largura?: number
  corMarco?: string
  className?: string
  titulo?: string
}

export function Logotipo({ largura = 96, corMarco = VERMELHO_MARCO, className, titulo = 'Fixum' }: LogotipoProps) {
  const uid = 'fx' + useId().replace(/[^a-zA-Z0-9]/g, '')
  return (
    <svg
      viewBox={LOGOTIPO_VIEWBOX}
      width={largura}
      height={Math.round(largura / LOGOTIPO_PROPORCAO)}
      className={className}
      role="img"
      aria-label={titulo}
      xmlns="http://www.w3.org/2000/svg"
      dangerouslySetInnerHTML={{ __html: corpo(LOGOTIPO_CORPO, uid, corMarco) }}
    />
  )
}

interface SimboloProps {
  tamanho?: number
  corMarco?: string
  className?: string
  titulo?: string
}

export function Simbolo({ tamanho = 32, corMarco = VERMELHO_MARCO, className, titulo = 'Fixum' }: SimboloProps) {
  const uid = 'fm' + useId().replace(/[^a-zA-Z0-9]/g, '')
  return (
    <svg
      viewBox={MONOGRAMA_VIEWBOX}
      width={tamanho}
      height={tamanho}
      className={className}
      role="img"
      aria-label={titulo}
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMid meet"
      dangerouslySetInnerHTML={{ __html: corpo(MONOGRAMA_CORPO, uid, corMarco) }}
    />
  )
}
