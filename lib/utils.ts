import { type Imovel } from './types'

export function formatarPreco(preco: number, negociacao?: string): string {
  const formatado = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(preco)

  if (negociacao === 'aluguel') return `${formatado}/mês`
  return formatado
}

export function formatarArea(area?: number): string {
  if (!area) return ''
  return `${area} m²`
}

export function labelTipoImovel(tipo: string): string {
  const labels: Record<string, string> = {
    casa: 'Casa',
    apartamento: 'Apartamento',
    terreno: 'Terreno',
    sala_comercial: 'Sala Comercial',
    loja: 'Loja',
    galpao: 'Galpão',
    sitio: 'Sítio',
    chacara: 'Chácara',
    fazenda: 'Fazenda',
    outro: 'Outro',
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
