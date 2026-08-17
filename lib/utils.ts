import { type Imovel } from './types'

export function formatarPreco(preco: number, negociacao?: string): string {
  const formatado = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(preco)

  if (negociacao === 'aluguel') return `${formatado}/m\u00EAs`
  return formatado
}

export function formatarArea(area?: number): string {
  if (!area) return ''
  return `${area} m²`
}

export function labelTipoImovel(tipo: string): string {
  const labels: Record<string, string> = {
    // Residencial
    apartamento:    'Apartamento',
    casa:           'Casa',
    sobrado:        'Sobrado',
    cobertura:      'Cobertura',
    kitnet:         'Kitnet / Studio',
    flat:           'Flat',
    casa_condominio:'Casa em Condomínio',
    lote:           'Lote',
    // Comercial
    sala_comercial: 'Sala Comercial',
    loja:           'Loja / Ponto Comercial',
    galpao:         'Galpão',
    predio:         'Prédio Comercial',
    garagem:        'Garagem',
    terreno_comercial: 'Terreno / Lote',
    // Terreno
    terreno:        'Terreno',
    // Rural
    sitio:          'Sítio',
    chacara:        'Chácara',
    fazenda:        'Fazenda',
    rancho:         'Rancho',
    // Geral
    outro:          'Outro',
  }
  return labels[tipo] || tipo
}

export function fotoPrincipal(imovel: Imovel): string {
  const principal = imovel.fotos?.find((f) => f.principal)
  const primeira = imovel.fotos?.[0]
  return principal?.url || primeira?.url || '/placeholder-imovel.jpg'
}

export function coordenadasValidas(lat?: number, lng?: number): boolean {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    lat >= -90 && lat <= 90 &&
    lng >= -180 && lng <= 180
  )
}
