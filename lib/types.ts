export type TipoImovel =
  // Residencial
  | 'apartamento'
  | 'casa'
  | 'sobrado'
  | 'cobertura'
  | 'kitnet'
  | 'flat'
  | 'casa_condominio'
  | 'lote'
  // Comercial
  | 'sala_comercial'
  | 'loja'
  | 'galpao'
  | 'predio'
  | 'garagem'
  // Terreno
  | 'terreno'
  | 'terreno_comercial'
  // Rural
  | 'sitio'
  | 'chacara'
  | 'fazenda'
  | 'rancho'
  // Geral
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
  codigo?: string
  descricao?: string
  tipo: TipoImovel
  negociacao: TipoNegociacao
  preco: number
  area?: number
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
  estado?: string
  bairro?: string
  cep?: string
  latitude: number
  longitude: number
  endereco_publico: boolean
  aceita_pets?: boolean
  mobiliado?: boolean
  descricao_motivo_rejeicao?: string | null
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

export interface AtividadeLead {
  id: string
  lead_id: string
  autor_id: string
  autor_nome: string
  tipo: 'criacao' | 'contato_whatsapp' | 'mudanca_status' | 'anotacao' | 'visita_agendada' | 'proposta' | 'reatribuicao'
  descricao: string
  created_at: string
}

export interface CompromissoLead {
  id: string
  lead_id: string
  titulo: string
  tipo: 'visita' | 'ligacao' | 'proposta' | 'reuniao' | 'outro'
  data_hora: string
  concluido: boolean
  responsavel_id?: string
  responsavel_nome?: string
  responsavel_telefone?: string
  created_at: string
}

export interface AnexoLead {
  id: string
  lead_id: string
  nome_arquivo: string
  tipo_arquivo: string
  url: string
  tamanho?: number
  autor_id: string
  autor_nome: string
  created_at: string
}

export interface Lead {
  id: string
  imovel_id: string
  corretor_id?: string
  imobiliaria_id?: string
  nome: string
  email?: string
  telefone?: string
  mensagem?: string
  status: StatusLead
  data_primeiro_contato?: string
  data_ultimo_contato?: string
  data_visita?: string
  valor_proposta?: number
  motivo_perda?: string
  origem?: string
  temperatura?: 'frio' | 'morno' | 'quente'
  created_at: string
  imovel?: Imovel
  corretor_nome?: string
  atividades?: AtividadeLead[]
  compromissos?: CompromissoLead[]
  anexos?: AnexoLead[]
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

// ── MONETIZAÇÃO E PLANOS ──────────────────────────────────────────
export type SlugPlano =
  | 'gratis'
  | 'inicial'
  | 'basico'
  | 'profissional'
  | 'profissional_plus'
  | 'avancado'
  | 'imobiliaria'
  | 'imobiliaria_plus'
  | 'enterprise'
  | 'enterprise_plus'

export type StatusAssinatura = 'ativo' | 'pendente' | 'cancelado' | 'atrasado'
export type MetodoPagamento = 'pix' | 'cartao' | 'gratis'
export type StatusFatura = 'pago' | 'pendente' | 'falhou' | 'reembolsado' | 'atrasado' | 'atrasada'

export interface Plano {
  id: SlugPlano
  nome: string
  descricao: string
  limite_imoveis_min: number
  limite_imoveis_max: number // ex: 1, 2, 3, 10, 20, 50, 100, 200, 500, 99999
  preco_mensal: number
  preco_anual?: number
  custo_unitario_max: number
  destaque_incluso: boolean
  ordem: number
  ativo: boolean
}

export interface Assinatura {
  id: string
  usuario_id: string
  plano_id: SlugPlano
  status: StatusAssinatura
  data_inicio: string
  data_fim_ciclo?: string
  cancelado_em?: string
  metodo_pagamento: MetodoPagamento
  created_at: string
  updated_at?: string
  plano?: Plano
}

export interface Fatura {
  id: string
  assinatura_id?: string
  usuario_id: string
  valor: number
  status: StatusFatura
  metodo_pagamento: MetodoPagamento
  data_vencimento?: string
  data_pagamento?: string
  comprovante_url?: string
  created_at: string
}

export interface UsoPlano {
  plano: Plano
  assinatura?: Assinatura
  imoveisAtivos: number
  imoveisPausados: number
  totalImoveis: number
  limiteMaximo: number
  porcentagemUso: number
  atingiuLimite: boolean
  podePublicarMais: boolean
  vagasRestantes: number
}

// ── PONTOS DE INTERESSE / ENTORNO ─────────────────────────────────
export interface PontoInteresse {
  id: string
  nome: string
  categoria: string
  icone: string
  distanciaMetros: number
  distanciaFormatada: string
  tempoPe: string
  lat: number
  lng: number
}


