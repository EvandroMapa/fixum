import { type Imovel } from './types'

export function resolverExibicaoPreco(
  modoConta?: 'visivel' | 'sob_consulta' | 'por_anuncio' | string | null,
  modoImovel?: 'visivel' | 'sob_consulta' | string | null,
  exibirPrecoImovel?: boolean | null,
  preco?: number | null
): 'visivel' | 'sob_consulta' {
  // 0. Se o preço for 0, menor ou igual a 0 ou não informado (quando número) -> SEMPRE Sob Consulta
  if (preco !== undefined && preco !== null && preco <= 0) {
    return 'sob_consulta'
  }

  // 1. Se a conta/imobiliária força "Sim" (Sempre Visível)
  if (modoConta === 'visivel') return 'visivel'

  // 2. Se a conta/imobiliária força "Não" (Sempre Sob Consulta)
  if (modoConta === 'sob_consulta') return 'sob_consulta'

  // 3. Se for "Opcional por Anúncio" (ou conta individual/padrão) -> respeita o imóvel
  if (modoImovel === 'sob_consulta' || exibirPrecoImovel === false) {
    return 'sob_consulta'
  }

  return 'visivel'
}

export function formatarPreco(preco?: number | null, negociacao?: string, modoExibicao?: string): string {
  if (modoExibicao === 'sob_consulta' || preco === undefined || preco === null || preco <= 0) {
    return 'Preço sob consulta'
  }

  const formatado = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(preco)

  if (negociacao === 'aluguel') return `${formatado}/mês`
  return formatado
}

/**
 * Preço abreviado para pins do mapa e chips (brandbook, seção 05):
 * venda → "R$ 450 mil", "R$ 1,2 mi"; aluguel → "R$ 1.800/mês"; sem preço → "Consulte".
 */
export function formatarPrecoCurto(preco?: number | null, negociacao?: string, modoExibicao?: string): string {
  if (modoExibicao === 'sob_consulta' || !preco || preco <= 0) return 'Consulte'

  if (negociacao === 'aluguel') {
    return `R$ ${Math.round(preco).toLocaleString('pt-BR')}/mês`
  }
  if (preco >= 1_000_000) {
    const mi = preco / 1_000_000
    const texto = mi >= 10 ? Math.round(mi).toString() : mi.toLocaleString('pt-BR', { maximumFractionDigits: 1 })
    return `R$ ${texto} mi`
  }
  if (preco >= 1_000) {
    const mil = preco / 1_000
    const texto = mil >= 100 ? Math.round(mil).toString() : mil.toLocaleString('pt-BR', { maximumFractionDigits: 1 })
    return `R$ ${texto} mil`
  }
  return `R$ ${Math.round(preco).toLocaleString('pt-BR')}`
}

export function formatarMoeda(valor?: number | null): string {
  if (valor === undefined || valor === null) return 'R$ 0'
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(valor)
}

export function formatarArea(area?: number): string {
  if (!area) return ''
  return `${area} m²`
}

export function formatarTelefone(tel?: string): string {
  if (!tel) return ''
  const limpo = tel.replace(/\D/g, '')
  if (limpo.length === 11) {
    return `(${limpo.slice(0, 2)}) ${limpo.slice(2, 7)}-${limpo.slice(7)}`
  }
  if (limpo.length === 10) {
    return `(${limpo.slice(0, 2)}) ${limpo.slice(2, 6)}-${limpo.slice(6)}`
  }
  return tel
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

/**
 * Retorna as iniciais inteligentes do usuário (2 letras).
 * - Se tiver 2 ou mais nomes: 1ª letra do 1º nome + 1ª letra do último nome (ex: "Evandro Mapa" -> "EM", "Carlos Silva Santos" -> "CS")
 * - Se tiver 1 nome: as 2 primeiras letras (ex: "Evandro" -> "EV", "Fixum" -> "FI")
 * - Se for e-mail: 2 primeiras letras do prefixo (ex: "corretor02" -> "CO")
 */
export function obterIniciaisUsuario(nome?: string | null, email?: string | null): string {
  const texto = (nome || '').trim()
  if (texto) {
    const palavras = texto.split(/\s+/).filter(Boolean)
    if (palavras.length >= 2) {
      const p1 = palavras[0][0] || ''
      const p2 = palavras[palavras.length - 1][0] || ''
      return (p1 + p2).toUpperCase()
    }
    if (palavras.length === 1) {
      if (palavras[0].length >= 2) {
        return palavras[0].substring(0, 2).toUpperCase()
      }
      return palavras[0][0].toUpperCase()
    }
  }

  const emailUsuario = (email || '').trim().split('@')[0] || ''
  if (emailUsuario.length >= 2) {
    return emailUsuario.substring(0, 2).toUpperCase()
  }
  if (emailUsuario.length === 1) {
    return emailUsuario[0].toUpperCase()
  }

  return 'FX'
}

/**
 * Paleta harmônica de gradientes vibrantes e elegantes para identificação de usuários.
 * Cada usuário/corretor recebe determinísticamente uma cor única baseada no seu identificador (id, email ou nome).
 */
// Cores sólidas da paleta Fixum (sem gradientes): tons terrosos e cartográficos
const PALETA_AVATARES = [
  '#16201C', // Tinta
  '#2E6B4E', // Cerrado
  '#2C5F8A', // Hidro
  '#8A5F12', // Ouro escuro
  '#B23318', // Marco escuro
  '#5A5449', // Pedra
  '#3E5A50', // Musgo
  '#6B4A3A', // Terra
  '#45566B', // Ardósia
  '#7A5A2E', // Barro
]

export function obterGradienteUsuario(identificador?: string | null): string {
  if (!identificador || !identificador.trim()) {
    return PALETA_AVATARES[0]
  }

  const str = identificador.trim().toLowerCase()
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }

  const index = Math.abs(hash) % PALETA_AVATARES.length
  return PALETA_AVATARES[index]
}
