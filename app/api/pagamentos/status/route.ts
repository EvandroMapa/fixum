import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { consultarCobrancaAsaas } from '@/lib/asaas'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://yxiaubwwzcnpmwfbvvrt.supabase.co'
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl4aWF1Ynd3emNucG13ZmJ2dnJ0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjY1OTM0NSwiZXhwIjoyMTAyMjM1MzQ1fQ.uHbg0JE9v929ErRqhuEeUxYXPvpIjAVK9Rs4YwSka3s'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const cobrancaId = searchParams.get('cobrancaId')
    const usuarioId = searchParams.get('usuarioId')
    const planoId = searchParams.get('planoId')

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

    // Se foi pago e temos os dados do usuário, ativamos no Supabase
    if (isPago && usuarioId && planoId) {
      const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
      })

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
