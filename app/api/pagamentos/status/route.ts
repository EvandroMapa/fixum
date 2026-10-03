import { NextResponse } from 'next/server'
import { consultarCobrancaAsaas } from '@/lib/asaas'
import { criarClienteAdmin } from '@/lib/supabase/admin'
import { exigirUsuario } from '@/lib/auth/servidor'

export async function GET(req: Request) {
  try {
    const auth = await exigirUsuario(req)
    if (!auth.ok) return auth.resposta

    const { searchParams } = new URL(req.url)
    const cobrancaId = searchParams.get('cobrancaId')
    const usuarioId = auth.usuario.id

    if (!cobrancaId) {
      return NextResponse.json({ error: 'cobrancaId é obrigatório' }, { status: 400 })
    }

    // Se for mock em desenvolvimento
    if (cobrancaId.startsWith('pay_mock_')) {
      return NextResponse.json({
        pago: false,
        status: 'PENDING',
      })
    }

    const cobranca = await consultarCobrancaAsaas(cobrancaId)
    const isPago = cobranca.status === 'RECEIVED' || cobranca.status === 'CONFIRMED'

    // A cobrança precisa ser deste usuário; o plano liberado é o que está gravado na cobrança (externalReference)
    const [donoCobranca, planoDaCobranca] = (cobranca.externalReference || '').split(':')
    if (donoCobranca !== usuarioId) {
      return NextResponse.json({ error: 'Cobrança não pertence a este usuário.' }, { status: 403 })
    }
    const planoId = planoDaCobranca || null

    // Se foi pago e temos os dados do usuário, ativamos no Supabase
    if (isPago && usuarioId && planoId) {
      const supabase = criarClienteAdmin()

      // Ativar assinatura
      await supabase.from('assinaturas').upsert(
        {
          usuario_id: usuarioId,
          plano_id: planoId,
          status: 'ativo',
          data_inicio: new Date().toISOString(),
          metodo_pagamento: 'pix',
        },
        { onConflict: 'usuario_id' }
      )

      // Atualizar fatura para pago
      await supabase.from('faturas').insert({
        usuario_id: usuarioId,
        valor: cobranca.valor,
        status: 'pago',
        metodo_pagamento: 'pix',
        data_vencimento: new Date().toISOString(),
        data_pagamento: cobranca.dataPagamento || new Date().toISOString(),
      })
    }

    return NextResponse.json({
      pago: isPago,
      status: cobranca.status,
      valor: cobranca.valor,
      dataPagamento: cobranca.dataPagamento,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro ao consultar status' }, { status: 500 })
  }
}
