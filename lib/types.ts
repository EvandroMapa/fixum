export type TipoImovel =
  | 'casa'
  | 'apartamento'
  | 'terreno'
  | 'sala_comercial'
  | 'loja'
  | 'galpao'
  | 'sitio'
  | 'chacara'
  | 'fazenda'
  | 'outro'

export type TipoNegociacao = 'venda' | 'aluguel'

export type StatusImovel =
  | 'rascunho'
  | 'em_analise'
  | 'publicado'
  | 'ativo'
  | 'pausado'
  | 'reservado'
  | 'vendido'
  | 'alugado'
  | 'expirado'
  | 'removido'

export type TipoPerfil = 'comprador' | 'proprietario' | 'corretor' | 'imobiliaria' | 'admin'

export type StatusLead =
  | 'novo'
  | 'em_contato'
  | 'visita_agendada'
  | 'proposta'
  | 'negociacao'
  | 'fechado'
  | 'perdido'

export interface Perfil {
  id: string
  nome: string
  email: string
  tipo: TipoPerfil
  foto_url?: string
  telefone?: string
  whatsapp?: string
  creci?: string
  imobiliaria_id?: string
  created_at: string
}

export interface Imobiliaria {
  id: string
  nome: string
  logo_url?: string
  descricao?: string
  endereco?: string
  cidade?: string
  telefone?: string
  whatsapp?: string
  site?: string
  created_at: string
}

export interface FotoImovel {
  id: string
  imovel_id: string
  url: string
  principal: boolean
  ordem: number
}

export interface Imovel {
  id: string
  titulo: string
  descricao?: string
  tipo: TipoImovel
  negociacao: TipoNegociacao
  preco: number
  area_construida?: number
  area_terreno?: number
  quartos?: number
  suites?: number
  banheiros?: number
  vagas?: number
  condominio?: number
  iptu?: number
  endereco: string
  cidade: string
  bairro?: string
  latitude: number
  longitude: number
  endereco_publico: boolean
  status: StatusImovel
  anunciante_id: string
  destaque: boolean
  created_at: string
  // Joins
  fotos?: FotoImovel[]
  caracteristicas?: string[]
  anunciante?: Perfil
  imobiliaria?: Imobiliaria
}

export interface Lead {
  id: string
  imovel_id: string
  nome: string
  email?: string
  telefone?: string
  mensagem?: string
  status: StatusLead
  created_at: string
  imovel?: Imovel
}

export interface Favorito {
  id: string
  usuario_id: string
  imovel_id: string
  created_at: string
  imovel?: Imovel
}

export interface FiltrosBusca {
  negociacao?: TipoNegociacao
  tipo?: TipoImovel[]
  preco_min?: number
  preco_max?: number
  quartos_min?: number
  banheiros_min?: number
  vagas_min?: number
  area_min?: number
  area_max?: number
  cidade?: string
  bairro?: string
  caracteristicas?: string[]
}
