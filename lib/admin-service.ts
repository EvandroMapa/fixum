/**
 * Fixum Admin Service — Camada de Inteligência de Negócios, Financeiro e Operações
 */

import { PLANOS_OFICIAIS } from './planos'

export type PeriodoAnalytics = '7d' | '30d' | 'mes' | 'ano' | 'tudo'
export type TipoAnunciante = 'proprietario' | 'corretor' | 'imobiliaria' | 'admin'
export type StatusConta = 'ativo' | 'suspenso' | 'em_analise' | 'bloqueado'
export type StatusFatura = 'pago' | 'pendente' | 'atrasado' | 'falhou' | 'reembolsado' | 'em_disputa' | 'cancelado'

export interface CorretorEquipeItem {
  id: string
  nome: string
  email: string
  telefone?: string
  creci?: string
  total_imoveis: number
  imoveis_ativos: number
}

export interface ClienteAdmin360 {
  id: string
  nome: string
  email: string
  telefone?: string
  whatsapp?: string
  cpf_cnpj?: string
  creci?: string
  tipo_anunciante: TipoAnunciante
  status_conta: StatusConta
  plano_id: string
  plano_nome: string
  plano_preco: number
  cidade?: string
  uf?: string
  notas_admin?: string
  motivo_suspensao?: string
  
  // Carteira de Imóveis Consolidada (Empresa + Equipe)
  total_imoveis: number
  imoveis_ativos: number
  imoveis_destaque: number
  imoveis_diretos: number
  imoveis_equipe: number

  total_faturas_pagas: number
  valor_total_gasto: number
  tem_inadimplencia: boolean
  created_at: string
  ultimo_acesso?: string
  
  // Hierarquia Imobiliária & Equipe
  imobiliaria_id?: string
  imobiliaria_nome?: string
  is_corretor_vinculado: boolean
  corretores_equipe?: CorretorEquipeItem[]

  faturas?: FaturaAdmin[]
  imoveis?: any[]
}

export interface FaturaAdmin {
  id: string
  assinatura_id?: string
  usuario_id: string
  usuario_nome: string
  usuario_email: string
  usuario_telefone?: string
  plano_id?: string
  plano_nome?: string
  valor: number
  status: StatusFatura
  metodo_pagamento: 'pix' | 'cartao' | 'gratis'
  data_vencimento?: string
  data_pagamento?: string
  asaas_payment_id?: string
  asaas_invoice_url?: string
  comprovante_url?: string
  cidade_origem?: string
  uf_origem?: string
  motivo_estorno?: string
  estornado_em?: string
  created_at: string
}

export interface CancelamentoAdmin {
  id: string
  usuario_id: string
  usuario_nome: string
  usuario_email: string
  plano_id: string
  plano_nome: string
  valor_plano: number
  motivo_cancelamento?: string
  data_inicio?: string
  cancelado_em?: string
  cidade_origem?: string
}

export interface DevolucaoAdmin {
  id: string
  fatura_id?: string
  usuario_id: string
  usuario_nome: string
  usuario_email: string
  asaas_payment_id?: string
  valor: number
  motivo: string
  tipo_reembolso: string
  status: string
  justificativa?: string
  processado_por?: string
  created_at: string
}

export interface ContestacaoAdmin {
  id: string
  fatura_id?: string
  asaas_payment_id?: string
  usuario_id: string
  usuario_nome: string
  usuario_email: string
  valor: number
  motivo_bandeira?: string
  status_disputa: 'aberta' | 'em_analise' | 'defesa_enviada' | 'ganha' | 'perdida'
  data_limite_defesa?: string
  notas_admin?: string
  created_at: string
}

export interface LogAuditoriaAdmin {
  id: string
  admin_id?: string
  admin_email: string
  tipo_acao: string
  entidade: string
  entidade_id?: string
  dados_anteriores?: any
  dados_novos?: any
  justificativa: string
  ip?: string
  user_agent?: string
  created_at: string
}

export interface MetricasBI {
  mrr: number
  arr: number
  faturamentoPeriodo: number
  totalVendasPeriodo: number
  ticketMedio: number
  contratacoesPeriodo: number
  cancelamentosPeriodo: number
  netGrowth: number
  taxaChurn: number
  taxaRetencao: number
  totalClientesAtivos: number
  totalImoveisAtivos: number
  vendasPorPlano: { planoId: string; nome: string; quantidade: number; totalValor: number }[]
  vendasPorMetodo: { metodo: string; quantidade: number; percentual: number }[]
  motivosCancelamento: { motivo: string; quantidade: number; percentual: number }[]
  rankingCidades: { cidade: string; faturamento: number; clientes: number; churnRate: number }[]
}

/**
 * Calcula a data de corte inicial com base no filtro de período selecionado
 */
export function calcularDataCorte(periodo: PeriodoAnalytics): Date | null {
  const agora = new Date()
  switch (periodo) {
    case '7d': {
      const d = new Date(agora)
      d.setDate(d.getDate() - 7)
      return d
    }
    case '30d': {
      const d = new Date(agora)
      d.setDate(d.getDate() - 30)
      return d
    }
    case 'mes': {
      return new Date(agora.getFullYear(), agora.getMonth(), 1)
    }
    case 'ano': {
      return new Date(agora.getFullYear(), 0, 1)
    }
    case 'tudo':
    default:
      return null
  }
}

/**
 * Processa e calcula todas as métricas de BI e Analytics agregadas (com suporte a filtro regional e período)
 */
export function calcularMetricasBI({
  clientes,
  faturas,
  cancelamentos,
  imoveis,
  regiaoSelecionada,
  periodoSelecionado,
}: {
  clientes: ClienteAdmin360[]
  faturas: FaturaAdmin[]
  cancelamentos: CancelamentoAdmin[]
  imoveis: any[]
  regiaoSelecionada: string
  periodoSelecionado: PeriodoAnalytics
}): MetricasBI {
  const dataCorte = calcularDataCorte(periodoSelecionado)

  // 1. Filtrar por Região (Considerando apenas Clientes Comerciais: Imobiliárias, Autônomos e Proprietários)
  const clientesFiltrados = clientes.filter((c) => {
    if (regiaoSelecionada === 'todas') return true
    return (c.cidade || '').toLowerCase() === regiaoSelecionada.toLowerCase()
  })

  // Apenas Clientes Comerciais reais (excluindo corretores vinculados que são equipe)
  const clientesComerciais = clientesFiltrados.filter((c) => !c.is_corretor_vinculado)
  const idsClientesComerciais = new Set(clientesComerciais.map((c) => c.id))

  const faturasFiltradas = faturas.filter((f) => {
    const pertenceRegiao = regiaoSelecionada === 'todas' || 
      (f.cidade_origem && f.cidade_origem.toLowerCase() === regiaoSelecionada.toLowerCase()) ||
      idsClientesComerciais.has(f.usuario_id)

    if (!pertenceRegiao) return false

    if (dataCorte) {
      const dataFatura = new Date(f.data_pagamento || f.created_at)
      if (dataFatura < dataCorte) return false
    }
    return true
  })

  const cancelamentosFiltrados = cancelamentos.filter((c) => {
    const pertenceRegiao = regiaoSelecionada === 'todas' || 
      (c.cidade_origem && c.cidade_origem.toLowerCase() === regiaoSelecionada.toLowerCase()) ||
      idsClientesComerciais.has(c.usuario_id)

    if (!pertenceRegiao) return false

    if (dataCorte && c.cancelado_em) {
      const dataCanc = new Date(c.cancelado_em)
      if (dataCanc < dataCorte) return false
    }
    return true
  })

  const imoveisFiltrados = imoveis.filter((im) => {
    if (regiaoSelecionada === 'todas') return true
    return (im.cidade || '').toLowerCase() === regiaoSelecionada.toLowerCase()
  })

  // 2. Faturamento e Vendas do Período
  const faturasPagas = faturasFiltradas.filter((f) => f.status === 'pago')
  const faturamentoPeriodo = faturasPagas.reduce((acc, f) => acc + (f.valor || 0), 0)
  const totalVendasPeriodo = faturasPagas.length
  const ticketMedio = totalVendasPeriodo > 0 ? faturamentoPeriodo / totalVendasPeriodo : 0

  // 3. MRR e ARR (Apenas de contas pagadoras: Imobiliárias, Corretores Autônomos e Proprietários pagantes)
  let mrrTotal = 0
  clientesComerciais.forEach((c) => {
    if (c.status_conta === 'ativo') {
      const plano = PLANOS_OFICIAIS.find((p) => p.id === c.plano_id)
      if (plano) mrrTotal += plano.preco_mensal
    }
  })
  const arrTotal = mrrTotal * 12

  // 4. Contratações vs Cancelamentos & Net Growth
  const contratacoesPeriodo = faturasPagas.length
  const totalCancelamentos = cancelamentosFiltrados.length
  const netGrowth = contratacoesPeriodo - totalCancelamentos

  // Churn rate: cancelamentos / base pagadora
  const baseClientesPagantes = clientesComerciais.length || 1
  const taxaChurn = Math.min(100, Math.round((totalCancelamentos / baseClientesPagantes) * 100 * 10) / 10)
  const taxaRetencao = Math.max(0, Math.round((100 - taxaChurn) * 10) / 10)

  // 5. Vendas por Plano
  const contagemPlanos: Record<string, { quantidade: number; totalValor: number }> = {}
  PLANOS_OFICIAIS.forEach((p) => {
    contagemPlanos[p.id] = { quantidade: 0, totalValor: 0 }
  })

  faturasPagas.forEach((f) => {
    const planoId = f.plano_id || 'gratis'
    if (!contagemPlanos[planoId]) {
      contagemPlanos[planoId] = { quantidade: 0, totalValor: 0 }
    }
    contagemPlanos[planoId].quantidade += 1
    contagemPlanos[planoId].totalValor += f.valor || 0
  })

  const vendasPorPlano = PLANOS_OFICIAIS.map((p) => ({
    planoId: p.id,
    nome: p.nome,
    quantidade: contagemPlanos[p.id]?.quantidade || 0,
    totalValor: contagemPlanos[p.id]?.totalValor || 0,
  })).filter((p) => p.quantidade > 0 || p.totalValor > 0 || p.planoId === 'profissional' || p.planoId === 'imobiliaria')

  // 6. Vendas por Método
  let qtdPix = 0
  let qtdCartao = 0
  faturasPagas.forEach((f) => {
    if (f.metodo_pagamento === 'pix') qtdPix++
    else if (f.metodo_pagamento === 'cartao') qtdCartao++
  })
  const totalMetodos = qtdPix + qtdCartao || 1
  const vendasPorMetodo = [
    { metodo: 'PIX Instantâneo', quantidade: qtdPix, percentual: Math.round((qtdPix / totalMetodos) * 100) },
    { metodo: 'Cartão de Crédito', quantidade: qtdCartao, percentual: Math.round((qtdCartao / totalMetodos) * 100) },
  ]

  // 7. Motivos de Cancelamento
  const motivosCount: Record<string, number> = {}
  cancelamentosFiltrados.forEach((c) => {
    const motivo = c.motivo_cancelamento || 'Não informado / Outros'
    motivosCount[motivo] = (motivosCount[motivo] || 0) + 1
  })

  const totalMotivos = cancelamentosFiltrados.length || 1
  const motivosCancelamento = Object.entries(motivosCount).map(([motivo, qtd]) => ({
    motivo,
    quantidade: qtd,
    percentual: Math.round((qtd / totalMotivos) * 100),
  }))

  // 8. Ranking de Cidades
  const cidadesMap: Record<string, { faturamento: number; clientes: Set<string>; cancelamentos: number }> = {}

  clientesComerciais.forEach((c) => {
    const cid = c.cidade || 'Não informada'
    if (!cidadesMap[cid]) cidadesMap[cid] = { faturamento: 0, clientes: new Set(), cancelamentos: 0 }
    cidadesMap[cid].clientes.add(c.id)
  })

  faturas.filter((f) => f.status === 'pago').forEach((f) => {
    const cid = f.cidade_origem || clientes.find((c) => c.id === f.usuario_id)?.cidade || 'Não informada'
    if (!cidadesMap[cid]) cidadesMap[cid] = { faturamento: 0, clientes: new Set(), cancelamentos: 0 }
    cidadesMap[cid].faturamento += f.valor || 0
  })

  cancelamentos.forEach((c) => {
    const cid = c.cidade_origem || clientes.find((cl) => cl.id === c.usuario_id)?.cidade || 'Não informada'
    if (!cidadesMap[cid]) cidadesMap[cid] = { faturamento: 0, clientes: new Set(), cancelamentos: 0 }
    cidadesMap[cid].cancelamentos += 1
  })

  const rankingCidades = Object.entries(cidadesMap)
    .map(([cidade, dados]) => {
      const totalCli = dados.clientes.size || 1
      const churnRate = Math.round((dados.cancelamentos / totalCli) * 100 * 10) / 10
      return {
        cidade,
        faturamento: dados.faturamento,
        clientes: dados.clientes.size,
        churnRate,
      }
    })
    .sort((a, b) => b.faturamento - a.faturamento)
    .slice(0, 10)

  return {
    mrr: mrrTotal,
    arr: arrTotal,
    faturamentoPeriodo,
    totalVendasPeriodo,
    ticketMedio,
    contratacoesPeriodo,
    cancelamentosPeriodo: totalCancelamentos,
    netGrowth,
    taxaChurn,
    taxaRetencao,
    totalClientesAtivos: clientesComerciais.length,
    totalImoveisAtivos: imoveisFiltrados.filter((i) => i.status === 'ativo').length,
    vendasPorPlano,
    vendasPorMetodo,
    motivosCancelamento,
    rankingCidades,
  }
}
