import { Plano, SlugPlano, UsoPlano, Assinatura } from './types'

/**
 * Tabela Oficial de Planos da Fixum
 * Baseada no documento oficial de monetização.
 */
export const PLANOS_OFICIAIS: Plano[] = [
  {
    id: 'gratis',
    nome: 'Grátis',
    descricao: 'Porta de entrada para experimentar a Fixum sem custos.',
    limite_imoveis_min: 1,
    limite_imoveis_max: 1,
    preco_mensal: 0.0,
    custo_unitario_max: 0.0,
    destaque_incluso: false,
    ordem: 1,
    ativo: true,
  },
  {
    id: 'inicial',
    nome: 'Inicial',
    descricao: 'Ideal para proprietários e pequenos corretores.',
    limite_imoveis_min: 2,
    limite_imoveis_max: 2,
    preco_mensal: 14.9,
    custo_unitario_max: 7.45,
    destaque_incluso: false,
    ordem: 2,
    ativo: true,
  },
  {
    id: 'basico',
    nome: 'Básico',
    descricao: 'Flexibilidade para até 3 imóveis simultâneos.',
    limite_imoveis_min: 3,
    limite_imoveis_max: 3,
    preco_mensal: 19.9,
    custo_unitario_max: 6.63,
    destaque_incluso: false,
    ordem: 3,
    ativo: true,
  },
  {
    id: 'profissional',
    nome: 'Profissional',
    descricao: 'Excelente custo-benefício para corretores ativos.',
    limite_imoveis_min: 4,
    limite_imoveis_max: 10,
    preco_mensal: 29.9,
    custo_unitario_max: 2.99,
    destaque_incluso: false,
    ordem: 4,
    ativo: true,
  },
  {
    id: 'profissional_plus',
    nome: 'Profissional Plus',
    descricao: 'Mais capacidade e economia por imóvel para corretores.',
    limite_imoveis_min: 11,
    limite_imoveis_max: 20,
    preco_mensal: 39.9,
    custo_unitario_max: 1.99,
    destaque_incluso: false,
    ordem: 5,
    ativo: true,
  },
  {
    id: 'avancado',
    nome: 'Avançado',
    descricao: 'Para corretores de alta performance e equipes pequenas.',
    limite_imoveis_min: 21,
    limite_imoveis_max: 50,
    preco_mensal: 89.9,
    custo_unitario_max: 1.8,
    destaque_incluso: false,
    ordem: 6,
    ativo: true,
  },
  {
    id: 'imobiliaria',
    nome: 'Imobiliária',
    descricao: 'Para imobiliárias e carteiras médias.',
    limite_imoveis_min: 51,
    limite_imoveis_max: 100,
    preco_mensal: 169.9,
    custo_unitario_max: 1.7,
    destaque_incluso: false,
    ordem: 7,
    ativo: true,
  },
  {
    id: 'imobiliaria_plus',
    nome: 'Imobiliária Plus',
    descricao: 'Grande capacidade com baixíssimo custo por anúncio.',
    limite_imoveis_min: 101,
    limite_imoveis_max: 200,
    preco_mensal: 299.9,
    custo_unitario_max: 1.5,
    destaque_incluso: false,
    ordem: 8,
    ativo: true,
  },
  {
    id: 'enterprise',
    nome: 'Enterprise',
    descricao: 'Para grandes imobiliárias e redes consolidadas.',
    limite_imoveis_min: 201,
    limite_imoveis_max: 500,
    preco_mensal: 599.9,
    custo_unitario_max: 1.2,
    destaque_incluso: false,
    ordem: 9,
    ativo: true,
  },
  {
    id: 'enterprise_plus',
    nome: 'Enterprise Plus',
    descricao: 'Para carteiras acima de 500 imóveis com suporte dedicado.',
    limite_imoveis_min: 501,
    limite_imoveis_max: 99999,
    preco_mensal: 0.0, // Sob consulta
    custo_unitario_max: 0.0,
    destaque_incluso: true,
    ordem: 10,
    ativo: true,
  },
]

/**
 * Retorna o plano correspondente pelo ID/Slug
 */
export function obterPlanoPorId(id: SlugPlano | string): Plano {
  const encontrado = PLANOS_OFICIAIS.find((p) => p.id === id)
  return encontrado || PLANOS_OFICIAIS[0]
}

/**
 * Identifica automaticamente qual plano é necessário para acomodar
 * uma dada quantidade de imóveis ativos.
 */
export function obterPlanoNecessario(quantidadeImoveisAtivos: number): Plano {
  if (quantidadeImoveisAtivos <= 1) return PLANOS_OFICIAIS[0] // Grátis
  if (quantidadeImoveisAtivos === 2) return PLANOS_OFICIAIS[1] // Inicial
  if (quantidadeImoveisAtivos === 3) return PLANOS_OFICIAIS[2] // Básico
  if (quantidadeImoveisAtivos <= 10) return PLANOS_OFICIAIS[3] // Profissional
  if (quantidadeImoveisAtivos <= 20) return PLANOS_OFICIAIS[4] // Profissional Plus
  if (quantidadeImoveisAtivos <= 50) return PLANOS_OFICIAIS[5] // Avançado
  if (quantidadeImoveisAtivos <= 100) return PLANOS_OFICIAIS[6] // Imobiliária
  if (quantidadeImoveisAtivos <= 200) return PLANOS_OFICIAIS[7] // Imobiliária Plus
  if (quantidadeImoveisAtivos <= 500) return PLANOS_OFICIAIS[8] // Enterprise
  return PLANOS_OFICIAIS[9] // Enterprise Plus
}

/**
 * Retorna o próximo plano sugerido para upgrade em relação ao plano atual
 */
export function obterProximoPlano(planoAtualId: SlugPlano | string): Plano | null {
  const index = PLANOS_OFICIAIS.findIndex((p) => p.id === planoAtualId)
  if (index >= 0 && index < PLANOS_OFICIAIS.length - 1) {
    return PLANOS_OFICIAIS[index + 1]
  }
  return null
}

/**
 * Calcula o resumo de uso de cota do plano de um anunciante
 */
export function calcularUsoPlano(
  planoId: SlugPlano | string = 'gratis',
  imoveisAtivos: number = 0,
  imoveisPausados: number = 0,
  assinatura?: Assinatura
): UsoPlano {
  const plano = obterPlanoPorId(planoId)
  const limiteMaximo = plano.limite_imoveis_max
  const totalImoveis = imoveisAtivos + imoveisPausados
  const porcentagemUso = limiteMaximo > 0 ? Math.min(100, Math.round((imoveisAtivos / limiteMaximo) * 100)) : 0
  const atingiuLimite = imoveisAtivos >= limiteMaximo
  const podePublicarMais = imoveisAtivos < limiteMaximo
  const vagasRestantes = Math.max(0, limiteMaximo - imoveisAtivos)

  return {
    plano,
    assinatura,
    imoveisAtivos,
    imoveisPausados,
    totalImoveis,
    limiteMaximo,
    porcentagemUso,
    atingiuLimite,
    podePublicarMais,
    vagasRestantes,
  }
}

/**
 * Valida se o downgrade é permitido com base na quantidade atual de imóveis ativos
 */
export function validarDowngrade(
  planoDestinoId: SlugPlano | string,
  imoveisAtivosAtuais: number
): { permitido: boolean; mensagem?: string; excedente: number } {
  const planoDestino = obterPlanoPorId(planoDestinoId)
  if (imoveisAtivosAtuais > planoDestino.limite_imoveis_max) {
    const excedente = imoveisAtivosAtuais - planoDestino.limite_imoveis_max
    return {
      permitido: false,
      mensagem: `Para mudar para o plano ${planoDestino.nome} (até ${planoDestino.limite_imoveis_max} imóveis), você precisa ter no máximo ${planoDestino.limite_imoveis_max} imóveis ativos. Pause ou remova ${excedente} imóvel(is) antes de continuar.`,
      excedente,
    }
  }
  return { permitido: true, excedente: 0 }
}

/**
 * Formata valores monetários em Real brasileiro (R$ 0,00)
 */
export function formatarMoeda(valor: number): string {
  if (valor === 0) return 'Grátis'
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(valor)
}
