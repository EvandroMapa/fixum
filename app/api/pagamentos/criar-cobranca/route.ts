import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { obterPlanoPorId, calcularPrecoPeriodicidade } from '@/lib/planos'
import {
  criarOuBuscarClienteAsaas,
  criarCobrancaPixAsaas,
  criarAssinaturaCartaoAsaas,
  type DadosCartaoCredito,
} from '@/lib/asaas'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://yxiaubwwzcnpmwfbvvrt.supabase.co'
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl4aWF1Ynd3emNucG13ZmJ2dnJ0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjY1OTM0NSwiZXhwIjoyMTAyMjM1MzQ1fQ.uHbg0JE9v929ErRqhuEeUxYXPvpIjAVK9Rs4YwSka3s'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const {
      usuarioId,
      planoId,
      metodoPagamento, // 'pix' | 'cartao'
      periodicidade = 'mensal', // 'mensal' | 'trimestral' | 'semestral' | 'anual'
      dadosPessoais, // { nome, email, cpfCnpj, telefone }
      dadosCartao,   // DadosCartaoCredito (se cartao)
    } = body

    if (!usuarioId || !planoId || !metodoPagamento || !dadosPessoais?.cpfCnpj) {
      return NextResponse.json(
        { error: 'Dados incompletos para processar a cobrança.' },
        { status: 400 }
      )
    }

    const plano = obterPlanoPorId(planoId)
    if (!plano) {
      return NextResponse.json({ error: 'Plano não encontrado.' }, { status: 404 })
    }

    // Calcular o valor com base na periodicidade e desconto promocional
    const detalhesPreco = calcularPrecoPeriodicidade(plano.preco_mensal, periodicidade)
    const valorCobrar = detalhesPreco.valorTotalComDesconto

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // 1. Criar ou sincronizar cliente no Asaas
    const clienteAsaas = await criarOuBuscarClienteAsaas({
      usuarioId,
      nome: dadosPessoais.nome,
      email: dadosPessoais.email,
      cpfCnpj: dadosPessoais.cpfCnpj,
      telefone: dadosPessoais.telefone,
    })

    const nomePeriodicidadeMap: Record<string, string> = {
      mensal: 'Mensal',
      trimestral: 'Trimestral (3 meses)',
      semestral: 'Semestral (6 meses)',
      anual: 'Anual (12 meses)',
    }
    const labelCiclo = nomePeriodicidadeMap[periodicidade] || 'Mensal'

    // 2. Se for PIX
    if (metodoPagamento === 'pix') {
      const cobrancaPix = await criarCobrancaPixAsaas({
        clienteId: clienteAsaas.id,
        valor: valorCobrar,
        descricao: `Fixum Imóveis - Plano ${plano.nome} (${labelCiclo})`,
        usuarioId,
        planoId: plano.id,
        periodicidade,
      })

      // Registrar fatura pendente no Supabase
      try {
        await supabase.from('faturas').insert({
          usuario_id: usuarioId,
          valor: valorCobrar,
          status: 'pendente',
          metodo_pagamento: 'pix',
          data_vencimento: cobrancaPix.vencimento,
        })
      } catch (err) {
        console.warn('[SUPABASE] Erro ao registrar fatura pendente:', err)
      }

      return NextResponse.json({
        sucesso: true,
        tipo: 'pix',
        cobrancaId: cobrancaPix.cobrancaId,
        pixQrCode: cobrancaPix.pixQrCode,
        pixCopiaCola: cobrancaPix.pixCopiaCola,
        valor: cobrancaPix.valor,
        vencimento: cobrancaPix.vencimento,
        periodicidade,
        economia: detalhesPreco.economiaTotal,
      })
    }

    // 3. Se for Cartão de Crédito
    if (metodoPagamento === 'cartao') {
      if (!dadosCartao?.numeroCartao || !dadosCartao?.cvv) {
        return NextResponse.json({ error: 'Dados do cartão de crédito incompletos.' }, { status: 400 })
      }

      const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0] || '127.0.0.1'

      const assinaturaCartao = await criarAssinaturaCartaoAsaas({
        clienteId: clienteAsaas.id,
        valor: valorCobrar,
        descricao: `Fixum Imóveis - Assinatura Plano ${plano.nome} (${labelCiclo})`,
        usuarioId,
        planoId: plano.id,
        cartao: dadosCartao as DadosCartaoCredito,
        periodicidade,
        remoteIp: clientIp,
      })

      // Ativar assinatura imediatamente no Supabase
      await supabase.from('assinaturas').upsert(
        {
          usuario_id: usuarioId,
          plano_id: plano.id,
          status: 'ativo',
          data_inicio: new Date().toISOString(),
          metodo_pagamento: 'cartao',
        },
        { onConflict: 'usuario_id' }
      )

      // Registrar fatura paga no Supabase
      await supabase.from('faturas').insert({
        usuario_id: usuarioId,
        valor: plano.preco_mensal,
        status: 'pago',
        metodo_pagamento: 'cartao',
        data_vencimento: new Date().toISOString(),
        data_pagamento: new Date().toISOString(),
      })

      return NextResponse.json({
        sucesso: true,
        tipo: 'cartao',
        assinaturaId: assinaturaCartao.assinaturaId,
        status: assinaturaCartao.status,
        valor: assinaturaCartao.valor,
      })
    }

    return NextResponse.json({ error: 'Método de pagamento inválido.' }, { status: 400 })
  } catch (err: any) {
    console.error('[CRIAR-COBRANCA-ERROR]:', err)
    return NextResponse.json({ error: err.message || 'Erro ao processar pagamento.' }, { status: 500 })
  }
}
