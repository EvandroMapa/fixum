/**
 * Módulo de Integração com o Asaas (Gateway Oficial de Pagamentos do Fixum)
 * Suporta Sandbox (ambiente de testes) e Produção.
 * As credenciais podem ser carregadas das variáveis de ambiente (.env) ou da tabela configuracoes_sistema no Supabase.
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://yxiaubwwzcnpmwfbvvrt.supabase.co'
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl4aWF1Ynd3emNucG13ZmJ2dnJ0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjY1OTM0NSwiZXhwIjoyMTAyMjM1MzQ1fQ.uHbg0JE9v929ErRqhuEeUxYXPvpIjAVK9Rs4YwSka3s'

export interface DadosClienteAsaas {
  usuarioId: string
  nome: string
  email: string
  cpfCnpj: string
  telefone?: string
  cep?: string
  endereco?: string
  numero?: string
  complemento?: string
  bairro?: string
}

export interface DadosCartaoCredito {
  nomeTitular: string
  numeroCartao: string
  mesExpiracao: string
  anoExpiracao: string
  cvv: string
  cpfCnpjTitular: string
  telefoneTitular?: string
  cepTitular?: string
  numeroEnderecoTitular?: string
}

/**
 * Obtém dinamicamente as credenciais ativas do Asaas (banco ou variáveis de ambiente)
 */
export async function obterCredenciaisAsaas(): Promise<{ apiKey: string; apiUrl: string; isSandbox: boolean }> {
  let apiKey = process.env.ASAAS_API_KEY || ''
  let modo = process.env.ASAAS_MODO || (process.env.NODE_ENV === 'production' && !process.env.ASAAS_SANDBOX ? 'producao' : 'sandbox')

  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: configs } = await supabase.from('configuracoes_sistema').select('*')
    if (configs) {
      const configKey = configs.find((c) => c.chave === 'asaas_api_key')
      const configModo = configs.find((c) => c.chave === 'asaas_modo')

      if (configKey?.valor && configKey.valor.trim()) {
        apiKey = configKey.valor.trim()
      }
      if (configModo?.valor) {
        modo = configModo.valor
      }
    }
  } catch (err) {
    console.warn('[ASAAS] Aviso ao buscar credenciais do banco:', err)
  }

  const isSandbox = modo === 'sandbox'
  const apiUrl = isSandbox ? 'https://sandbox.asaas.com/api/v3' : 'https://api.asaas.com/v3'

  return {
    apiKey,
    apiUrl,
    isSandbox,
  }
}

/**
 * Cria ou busca um cliente existente no Asaas pelo CPF/CNPJ ou Email
 */
export async function criarOuBuscarClienteAsaas(dados: DadosClienteAsaas): Promise<{ id: string; nome: string; email: string }> {
  const { apiKey, apiUrl } = await obterCredenciaisAsaas()

  if (!apiKey || apiKey === 'mock_asaas_key') {
    throw new Error('Chave de API do Asaas não configurada. Acesse o Painel Admin > Configurações Globais para configurar a chave.')
  }

  const headers = {
    'Content-Type': 'application/json',
    'access_token': apiKey,
    'User-Agent': 'Fixum-Plataforma-Imobiliaria/1.0',
  }

  const cpfCnpjLimpo = dados.cpfCnpj.replace(/\D/g, '')

  // 1. Tentar buscar cliente existente pelo CPF/CNPJ ou email
  try {
    const resBusca = await fetch(`${apiUrl}/customers?cpfCnpj=${cpfCnpjLimpo}`, {
      method: 'GET',
      headers,
    })

    if (resBusca.status === 401) {
      throw new Error('Chave de API do Asaas não autorizada (HTTP 401). Verifique suas credenciais em Configurações Globais.')
    }

    if (resBusca.ok) {
      const dataBusca = await resBusca.json()
      if (dataBusca.data && dataBusca.data.length > 0) {
        return {
          id: dataBusca.data[0].id,
          nome: dataBusca.data[0].name,
          email: dataBusca.data[0].email,
        }
      }
    }
  } catch (err: any) {
    if (err.message && err.message.includes('401')) {
      throw err
    }
    console.warn('[ASAAS] Erro ao buscar cliente existente, tentando criar novo:', err)
  }

  // 2. Criar novo cliente no Asaas
  const payload = {
    name: dados.nome,
    email: dados.email,
    cpfCnpj: cpfCnpjLimpo,
    phone: dados.telefone ? dados.telefone.replace(/\D/g, '') : undefined,
    mobilePhone: dados.telefone ? dados.telefone.replace(/\D/g, '') : undefined,
    externalReference: dados.usuarioId,
    notificationDisabled: false,
  }

  const resCriar = await fetch(`${apiUrl}/customers`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  })

  if (resCriar.status === 401) {
    throw new Error('Chave de API do Asaas não autorizada (HTTP 401). Verifique suas credenciais no Painel Admin > Configurações Globais.')
  }

  const rawText = await resCriar.text()
  let dataCriar: any = {}
  try {
    dataCriar = JSON.parse(rawText)
  } catch {}

  if (!resCriar.ok) {
    const msgErro = dataCriar.errors?.[0]?.description || 'Erro ao cadastrar cliente no Asaas.'
    throw new Error(`Asaas: ${msgErro}`)
  }

  return {
    id: dataCriar.id,
    nome: dataCriar.name,
    email: dataCriar.email,
  }
}

/**
 * Cria uma cobrança avulsa ou mensal via PIX
 */
export async function criarCobrancaPixAsaas({
  clienteId,
  valor,
  descricao,
  usuarioId,
  planoId,
}: {
  clienteId: string
  valor: number
  descricao: string
  usuarioId: string
  planoId: string
}): Promise<{
  cobrancaId: string
  status: string
  valor: number
  vencimento: string
  invoiceUrl?: string
  pixQrCode?: string
  pixCopiaCola?: string
}> {
  const { apiKey, apiUrl } = await obterCredenciaisAsaas()

  if (!apiKey || apiKey === 'mock_asaas_key') {
    throw new Error('Chave de API do Asaas não configurada. Acesse o Painel Admin > Configurações Globais para configurar a chave.')
  }

  const headers = {
    'Content-Type': 'application/json',
    'access_token': apiKey,
    'User-Agent': 'Fixum-Plataforma-Imobiliaria/1.0',
  }

  // Vencimento em 1 dia
  const amanha = new Date()
  amanha.setDate(amanha.getDate() + 1)
  const dueDate = amanha.toISOString().split('T')[0]

  const payload = {
    customer: clienteId,
    billingType: 'PIX',
    value: valor,
    dueDate,
    description: descricao,
    externalReference: JSON.stringify({ usuarioId, planoId, tipo: 'pix' }),
    postalService: false,
  }

  const res = await fetch(`${apiUrl}/payments`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  })

  if (res.status === 401) {
    throw new Error('Chave de API do Asaas não autorizada (HTTP 401). Verifique suas credenciais em Configurações Globais.')
  }

  const rawText = await res.text()
  let data: any = {}
  try {
    data = JSON.parse(rawText)
  } catch {}

  if (!res.ok) {
    const msg = data.errors?.[0]?.description || 'Erro ao gerar cobrança PIX no Asaas.'
    throw new Error(`Asaas: ${msg}`)
  }

  // Buscar o QR Code e código copia e cola do PIX
  let pixQrCode = ''
  let pixCopiaCola = ''

  try {
    const resPix = await fetch(`${apiUrl}/payments/${data.id}/pixQrCode`, {
      method: 'GET',
      headers,
    })
    if (resPix.ok) {
      const dataPix = await resPix.json()
      pixCopiaCola = dataPix.payload || ''
      if (dataPix.encodedImage) {
        pixQrCode = `data:image/png;base64,${dataPix.encodedImage}`
      } else if (pixCopiaCola) {
        pixQrCode = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(pixCopiaCola)}`
      }
    }
  } catch (err) {
    console.error('[ASAAS] Erro ao obter QR Code do PIX:', err)
  }

  return {
    cobrancaId: data.id,
    status: data.status,
    valor: data.value,
    vencimento: data.dueDate,
    invoiceUrl: data.invoiceUrl,
    pixQrCode,
    pixCopiaCola,
  }
}

/**
 * Cria uma assinatura recorrente mensal via Cartão de Crédito
 */
export async function criarAssinaturaCartaoAsaas({
  clienteId,
  valor,
  descricao,
  usuarioId,
  planoId,
  cartao,
  remoteIp,
}: {
  clienteId: string
  valor: number
  descricao: string
  usuarioId: string
  planoId: string
  cartao: DadosCartaoCredito
  remoteIp?: string
}): Promise<{
  assinaturaId: string
  status: string
  valor: number
  proximaCobranca: string
}> {
  const { apiKey, apiUrl } = await obterCredenciaisAsaas()

  if (!apiKey || apiKey === 'mock_asaas_key') {
    throw new Error('Chave de API do Asaas não configurada. Acesse o Painel Admin > Configurações Globais.')
  }

  const headers = {
    'Content-Type': 'application/json',
    'access_token': apiKey,
    'User-Agent': 'Fixum-Plataforma-Imobiliaria/1.0',
  }

  const amanha = new Date()
  amanha.setDate(amanha.getDate() + 1)

  const payload = {
    customer: clienteId,
    billingType: 'CREDIT_CARD',
    value: valor,
    nextDueDate: amanha.toISOString().split('T')[0],
    cycle: 'MONTHLY',
    description: descricao,
    externalReference: JSON.stringify({ usuarioId, planoId, tipo: 'assinatura_cartao' }),
    creditCard: {
      holderName: cartao.nomeTitular,
      number: cartao.numeroCartao.replace(/\D/g, ''),
      expiryMonth: cartao.mesExpiracao.padStart(2, '0'),
      expiryYear: cartao.anoExpiracao.length === 2 ? `20${cartao.anoExpiracao}` : cartao.anoExpiracao,
      ccv: cartao.cvv,
    },
    creditCardHolderInfo: {
      name: cartao.nomeTitular,
      email: cartao.nomeTitular.toLowerCase().replace(/\s+/g, '') + '@cliente.com',
      cpfCnpj: cartao.cpfCnpjTitular.replace(/\D/g, ''),
      postalCode: cartao.cepTitular ? cartao.cepTitular.replace(/\D/g, '') : undefined,
      addressNumber: cartao.numeroEnderecoTitular || 'S/N',
      phone: cartao.telefoneTitular ? cartao.telefoneTitular.replace(/\D/g, '') : undefined,
    },
    remoteIp: remoteIp || '127.0.0.1',
  }

  const res = await fetch(`${apiUrl}/subscriptions`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  })

  if (res.status === 401) {
    throw new Error('Chave de API do Asaas não autorizada (HTTP 401). Verifique suas credenciais em Configurações Globais.')
  }

  const rawText = await res.text()
  let data: any = {}
  try {
    data = JSON.parse(rawText)
  } catch {}

  if (!res.ok) {
    const msg = data.errors?.[0]?.description || 'Erro ao processar assinatura no cartão de crédito.'
    throw new Error(`Asaas: ${msg}`)
  }

  return {
    assinaturaId: data.id,
    status: data.status,
    valor: data.value,
    proximaCobranca: data.nextDueDate,
  }
}

/**
 * Consulta o status atual de uma cobrança no Asaas
 */
export async function consultarCobrancaAsaas(cobrancaId: string): Promise<{
  id: string
  status: 'PENDING' | 'RECEIVED' | 'CONFIRMED' | 'OVERDUE' | 'REFUNDED' | string
  valor: number
  dataPagamento?: string
}> {
  const { apiKey, apiUrl } = await obterCredenciaisAsaas()

  if (!apiKey || apiKey === 'mock_asaas_key') {
    return {
      id: cobrancaId,
      status: 'PENDING',
      valor: 0,
    }
  }

  const headers = {
    'Content-Type': 'application/json',
    'access_token': apiKey,
    'User-Agent': 'Fixum-Plataforma-Imobiliaria/1.0',
  }

  const res = await fetch(`${apiUrl}/payments/${cobrancaId}`, {
    method: 'GET',
    headers,
  })

  const rawText = await res.text()
  let data: any = {}
  try {
    data = JSON.parse(rawText)
  } catch {}

  if (!res.ok) {
    throw new Error(data.errors?.[0]?.description || 'Erro ao consultar status da cobrança no Asaas.')
  }

  return {
    id: data.id,
    status: data.status,
    valor: data.value,
    dataPagamento: data.paymentDate,
  }
}
