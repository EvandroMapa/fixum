import type mapboxgl from 'mapbox-gl'

/*
 * Estilo cartográfico da Fixum (brandbook, seção 09) aplicado em tempo de execução
 * sobre o "light-v11" do Mapbox: chão em Papel, água em Hidro dessaturado,
 * parques em Cerrado claro, rótulos em Pedra. Quando houver um estilo publicado
 * no Mapbox Studio, basta trocar ESTILO_BASE pela URL dele e remover a chamada.
 */
export const ESTILO_BASE = 'mapbox://styles/mapbox/light-v11'

const COR = {
  chao: '#EFE9DD',
  quadra: '#F5F1E9',
  agua: '#BFD0DD',
  parque: '#D5E2CF',
  predio: '#E4DCCD',
  rua: '#FFFFFF',
  ruaBorda: '#DDD4C4',
  texto: '#5A5449',
  textoForte: '#3F3B34',
  halo: '#F7F3EC',
}

function definir(mapa: mapboxgl.Map, camada: string, prop: string, valor: unknown) {
  try {
    mapa.setPaintProperty(camada, prop as never, valor as never)
  } catch {
    /* camada sem essa propriedade neste estilo */
  }
}

export function aplicarEstiloFixum(mapa: mapboxgl.Map) {
  const camadas = mapa.getStyle()?.layers ?? []
  for (const c of camadas) {
    const id = c.id
    if (c.type === 'background') {
      definir(mapa, id, 'background-color', COR.chao)
    } else if (c.type === 'fill') {
      if (id.includes('water')) definir(mapa, id, 'fill-color', COR.agua)
      else if (id === 'landuse') {
        // Só áreas verdes ficam em Cerrado; hospital, escola etc. viram quadra neutra
        definir(mapa, id, 'fill-color', [
          'match', ['get', 'class'],
          ['park', 'grass', 'cemetery', 'wood', 'scrub', 'pitch', 'agriculture'], COR.parque,
          COR.quadra,
        ])
      }
      else if (id.includes('park') || id.includes('national') || id.includes('landcover')) definir(mapa, id, 'fill-color', COR.parque)
      else if (id.includes('building')) definir(mapa, id, 'fill-color', COR.predio)
      else if (id.includes('land')) definir(mapa, id, 'fill-color', COR.quadra)
    } else if (c.type === 'line') {
      if (id.includes('water') || id.includes('waterway')) definir(mapa, id, 'line-color', COR.agua)
      else if (id.includes('case')) definir(mapa, id, 'line-color', COR.ruaBorda)
      else if (id.startsWith('road') || id.startsWith('bridge') || id.startsWith('tunnel')) definir(mapa, id, 'line-color', COR.rua)
    } else if (c.type === 'symbol') {
      const forte = id.includes('settlement') || id.includes('place')
      definir(mapa, id, 'text-color', forte ? COR.textoForte : COR.texto)
      definir(mapa, id, 'text-halo-color', COR.halo)
      if (id.includes('poi')) definir(mapa, id, 'icon-opacity', 0.55)
    }
  }
}
