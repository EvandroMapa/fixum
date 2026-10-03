import { NextResponse } from 'next/server'
import { obterPlanoPorId, calcularPrecoPeriodicidade } from '@/lib/planos'
import {
  criarOuBuscarClienteAsaas,
  criarCobrancaPixAsaas,
  criarAssinaturaCartaoAsaas,
  type DadosCartaoCredito,
} from '@/lib/asaas'
import { criarClienteAdmin } from '@/lib/supabase/admin'
import { exigirUsuario } from '@/lib/auth/servidor'

export async function POST(req: Request) {
  try {
    const auth = await exigirUsuario(req)
    if (!auth.ok) return auth.resposta

    const body = await req.json()
    const usuarioId = auth.usuario.id
    const {
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

    const supabase = criarClienteAdmin()

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
