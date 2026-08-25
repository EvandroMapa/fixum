import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://yxiaubwwzcnpmwfbvvrt.supabase.co'
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl4aWF1Ynd3emNucG13ZmJ2dnJ0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjY1OTM0NSwiZXhwIjoyMTAyMjM1MzQ1fQ.uHbg0JE9v929ErRqhuEeUxYXPvpIjAVK9Rs4YwSka3s'
const ASAAS_WEBHOOK_TOKEN = process.env.ASAAS_WEBHOOK_TOKEN || ''

export async function POST(req: Request) {
  try {
    // 1. Validar token de autenticação do webhook se configurado
    if (ASAAS_WEBHOOK_TOKEN) {
      const headerToken = req.headers.get('asaas-access-token')
      if (headerToken !== ASAAS_WEBHOOK_TOKEN) {
        console.warn('[ASAAS-WEBHOOK] Token inválido recebido.')
        return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
      }
    }

    const payload = await req.json()
    const { event, payment, subscription } = payload

    console.log('[ASAAS-WEBHOOK] Evento recebido:', event, payment?.id || subscription?.id)

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // 2. Tratar confirmação de pagamento (PIX ou Cartão)
    if (event === 'PAYMENT_RECEIVED' || event === 'PAYMENT_CONFIRMED') {
      let usuarioId = ''
      let planoId = ''

      try {
        const refObj = JSON.parse(payment.externalReference || '{}')
        usuarioId = refObj.usuarioId
        planoId = refObj.planoId
      } catch {}

      if (usuarioId && planoId) {
        // Ativar assinatura
        await supabase.from('assinaturas').upsert(
          {
            usuario_id: usuarioId,
            plano_id: planoId,
            status: 'ativo',
            data_inicio: new Date().toISOString(),
            metodo_pagamento: payment.billingType === 'PIX' ? 'pix' : 'cartao',
          },
          { onConflict: 'usuario_id' }
        )

        // Gravar fatura paga
        await supabase.from('faturas').insert({
          usuario_id: usuarioId,
          valor: payment.value,
          status: 'pago',
          metodo_pagamento: payment.billingType === 'PIX' ? 'pix' : 'cartao',
          data_vencimento: payment.dueDate || new Date().toISOString(),
          data_pagamento: payment.paymentDate || new Date().toISOString(),
        })

        console.log(`[ASAAS-WEBHOOK] Plano ${planoId} ativado com sucesso para o usuário ${usuarioId}`)
      }
    }

    // 3. Tratar fatura vencida / não paga
    if (event === 'PAYMENT_OVERDUE') {
      try {
        const refObj = JSON.parse(payment.externalReference || '{}')
        if (refObj.usuarioId) {
          await supabase
            .from('assinaturas')
            .update({ status: 'atrasada' })
            .eq('usuario_id', refObj.usuarioId)
        }
      } catch {}
    }

    // 4. Tratar cancelamento de assinatura
    if (event === 'SUBSCRIPTION_DELETED') {
      try {
        const refObj = JSON.parse(subscription.externalReference || '{}')
        if (refObj.usuarioId) {
          // Rebaixa para o plano grátis
          await supabase.from('assinaturas').upsert(
            {
              usuario_id: refObj.usuarioId,
              plano_id: 'gratis',
              status: 'ativo',
              metodo_pagamento: 'gratis',
            },
            { onConflict: 'usuario_id' }
          )
        }
      } catch {}
    }

    return NextResponse.json({ recebido: true })
  } catch (err: any) {
    console.error('[ASAAS-WEBHOOK-ERROR]:', err)
    return NextResponse.json({ error: err.message || 'Erro ao processar webhook' }, { status: 500 })
  }
}
