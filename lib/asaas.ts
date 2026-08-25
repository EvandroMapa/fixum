/**
 * Módulo de Integração com o Asaas (Gateway Oficial de Pagamentos do Fixum)
 * Suporta Sandbox (ambiente de testes) e Produção.
 */

const ASAAS_API_URL = process.env.ASAAS_API_URL || (
  process.env.NODE_ENV === 'production' && !process.env.ASAAS_SANDBOX
    ? 'https://api.asaas.com/v3'
    : 'https://sandbox.asaas.com/api/v3'
)

const ASAAS_API_KEY = process.env.ASAAS_API_KEY || ''

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

function obterHeaders(): HeadersInit {
  return {
    'Content-Type': 'application/json',
    'access_token': ASAAS_API_KEY,
    'User-Agent': 'Fixum-Plataforma-Imobiliaria/1.0',
  }
}

/**
 * Cria ou busca um cliente existente no Asaas pelo CPF/CNPJ ou Email
 */
export async function criarOuBuscarClienteAsaas(dados: DadosClienteAsaas): Promise<{ id: string; nome: string; email: string }> {
  // Se não houver chave do Asaas configurada ainda (ambiente de dev inicial), simula cliente
  if (!ASAAS_API_KEY || ASAAS_API_KEY === 'mock_asaas_key') {
    return {
      id: `cus_mock_${dados.usuarioId.slice(0, 8)}`,
      nome: dados.nome,
      email: dados.email,
    }
  }

  const cpfCnpjLimpo = dados.cpfCnpj.replace(/\D/g, '')

  // 1. Tentar buscar cliente existente pelo CPF/CNPJ ou email
  try {
    const resBusca = await fetch(`${ASAAS_API_URL}/customers?cpfCnpj=${cpfCnpjLimpo}`, {
      method: 'GET',
      headers: obterHeaders(),
    })

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
  } catch (err) {
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

  const resCriar = await fetch(`${ASAAS_API_URL}/customers`, {
    method: 'POST',
    headers: obterHeaders(),
    body: JSON.stringify(payload),
  })

  const dataCriar = await resCriar.json()

  if (!resCriar.ok) {
    const msgErro = dataCriar.errors?.[0]?.description || 'Erro ao cadastrar cliente no gateway de pagamento.'
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
  // Mock para desenvolvimento sem chave
  if (!ASAAS_API_KEY || ASAAS_API_KEY === 'mock_asaas_key') {
    const mockId = `pay_mock_${Date.now()}`
    return {
      cobrancaId: mockId,
      status: 'PENDING',
      valor,
      vencimento: new Date(Date.now() + 86400000).toISOString().split('T')[0],
      pixQrCode: 'https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=00020126580014br.gov.bcb.pix0136fixum-mock-key5204000053039865405' + valor + '5802BR5915FIXUM_IMOVEIS6009LAFAIETE62070503***6304',
      pixCopiaCola: `00020126580014br.gov.bcb.pix0136fixum-mock-key5204000053039865405${valor.toFixed(2)}5802BR5915FIXUM_IMOVEIS6009LAFAIETE62070503***6304`,
    }
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

  const res = await fetch(`${ASAAS_API_URL}/payments`, {
    method: 'POST',
    headers: obterHeaders(),
    body: JSON.stringify(payload),
  })

  const data = await res.json()

  if (!res.ok) {
    const msg = data.errors?.[0]?.description || 'Erro ao gerar cobrança PIX no Asaas.'
    throw new Error(`Asaas: ${msg}`)
  }

  // Buscar o QR Code e código copia e cola do PIX
  let pixQrCode = ''
  let pixCopiaCola = ''

  try {
    const resPix = await fetch(`${ASAAS_API_URL}/payments/${data.id}/pixQrCode`, {
      method: 'GET',
      headers: obterHeaders(),
    })
    if (resPix.ok) {
      const dataPix = await resPix.json()
      pixQrCode = dataPix.encodedImage ? `data:image/png;base64,${dataPix.encodedImage}` : ''
      pixCopiaCola = dataPix.payload || ''
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
  // Mock para desenvolvimento sem chave
  if (!ASAAS_API_KEY || ASAAS_API_KEY === 'mock_asaas_key') {
    return {
      assinaturaId: `sub_mock_${Date.now()}`,
      status: 'ACTIVE',
      valor,
      proximaCobranca: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
    }
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

  const res = await fetch(`${ASAAS_API_URL}/subscriptions`, {
    method: 'POST',
    headers: obterHeaders(),
    body: JSON.stringify(payload),
  })

  const data = await res.json()

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
  if (!ASAAS_API_KEY || ASAAS_API_KEY === 'mock_asaas_key' || cobrancaId.startsWith('pay_mock_')) {
    return {
      id: cobrancaId,
      status: 'PENDING',
      valor: 0,
    }
  }

  const res = await fetch(`${ASAAS_API_URL}/payments/${cobrancaId}`, {
    method: 'GET',
    headers: obterHeaders(),
  })

  const data = await res.json()

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
