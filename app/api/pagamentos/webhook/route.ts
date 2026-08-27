import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://yxiaubwwzcnpmwfbvvrt.supabase.co'
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl4aWF1Ynd3emNucG13ZmJ2dnJ0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjY1OTM0NSwiZXhwIjoyMTAyMjM1MzQ1fQ.uHbg0JE9v929ErRqhuEeUxYXPvpIjAVK9Rs4YwSka3s'
const ASAAS_WEBHOOK_TOKEN = process.env.ASAAS_WEBHOOK_TOKEN || ''

export async function POST(req: Request) {
  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // 1. Obter o token esperado (do .env ou do banco)
    let tokenEsperado = ASAAS_WEBHOOK_TOKEN

    if (!tokenEsperado) {
      try {
        const { data: configToken } = await supabase
          .from('configuracoes_sistema')
          .select('valor')
          .eq('chave', 'asaas_webhook_token')
          .single()
        if (configToken?.valor) {
          tokenEsperado = configToken.valor
        }
      } catch {}
    }

    // Validar token de autenticação do webhook se configurado
    if (tokenEsperado) {
      const headerToken = req.headers.get('asaas-access-token')
      if (headerToken !== tokenEsperado) {
        console.warn('[ASAAS-WEBHOOK] Token inválido recebido.')
        return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
      }
    }

    const payload = await req.json()
    const { event, payment, subscription, chargeback } = payload

    console.log('[ASAAS-WEBHOOK] Evento recebido:', event, payment?.id || subscription?.id || chargeback?.id)

    function extrairDadosReferencia(extRef?: string): {
      usuarioId: string
      planoId: string
      periodicidade: 'mensal' | 'trimestral' | 'semestral' | 'anual'
      metodo: string
    } {
      if (!extRef) return { usuarioId: '', planoId: '', periodicidade: 'mensal', metodo: 'cartao' }
      if (extRef.includes(':')) {
        const partes = extRef.split(':')
        const usuarioId = partes[0] || ''
        const planoId = partes[1] || ''
        let periodicidade: any = 'mensal'
        let metodo = 'cartao'
        if (partes.length >= 4) {
          periodicidade = ['mensal', 'trimestral', 'semestral', 'anual'].includes(partes[2]) ? partes[2] : 'mensal'
          metodo = partes[3] || 'cartao'
        } else if (partes.length === 3) {
          metodo = partes[2] || 'cartao'
        }
        return { usuarioId, planoId, periodicidade, metodo }
      }
      try {
        const obj = JSON.parse(extRef)
        return {
          usuarioId: obj.usuarioId || obj.u || '',
          planoId: obj.planoId || obj.p || '',
          periodicidade: obj.periodicidade || 'mensal',
          metodo: obj.metodo || 'cartao',
        }
      } catch {
        return { usuarioId: '', planoId: '', periodicidade: 'mensal', metodo: 'cartao' }
      }
    }

    const { usuarioId, planoId, periodicidade } = extrairDadosReferencia(
      payment?.externalReference || subscription?.externalReference || chargeback?.externalReference
    )

    // 2. Tratar confirmação de pagamento (PIX ou Cartão)
    if (event === 'PAYMENT_RECEIVED' || event === 'PAYMENT_CONFIRMED') {
      if (usuarioId && planoId) {
        // Calcular data de término do ciclo de acordo com a periodicidade contratada
        const dataFim = new Date()
        if (periodicidade === 'anual') {
          dataFim.setFullYear(dataFim.getFullYear() + 1)
        } else if (periodicidade === 'semestral') {
          dataFim.setMonth(dataFim.getMonth() + 6)
        } else if (periodicidade === 'trimestral') {
          dataFim.setMonth(dataFim.getMonth() + 3)
        } else {
          dataFim.setDate(dataFim.getDate() + 30)
        }

        // Ativar assinatura e blindar ciclo contratual
        await supabase.from('assinaturas').upsert(
          {
            usuario_id: usuarioId,
            plano_id: planoId,
            status: 'ativo',
            data_inicio: new Date().toISOString(),
            data_fim_ciclo: dataFim.toISOString(),
            metodo_pagamento: payment.billingType === 'PIX' ? 'pix' : 'cartao',
            asaas_subscription_id: subscription?.id || null,
            asaas_customer_id: payment.customer || null,
          },
          { onConflict: 'usuario_id' }
        )

        // Atualizar perfil
        await supabase.from('perfis').update({ plano_id: planoId }).eq('id', usuarioId)

        // Gravar fatura paga
        await supabase.from('faturas').insert({
          usuario_id: usuarioId,
          valor: payment.value,
          status: 'pago',
          metodo_pagamento: payment.billingType === 'PIX' ? 'pix' : 'cartao',
          data_vencimento: payment.dueDate || new Date().toISOString(),
          data_pagamento: payment.paymentDate || new Date().toISOString(),
          asaas_payment_id: payment.id,
          asaas_customer_id: payment.customer,
          asaas_invoice_url: payment.invoiceUrl,
        })

        console.log(`[ASAAS-WEBHOOK] Plano ${planoId} ativado com sucesso para o usuário ${usuarioId}`)
      }
    }

    // 3. Tratar fatura vencida / não paga
    if (event === 'PAYMENT_OVERDUE') {
      if (usuarioId) {
        await supabase
          .from('assinaturas')
          .update({ status: 'atrasado' })
          .eq('usuario_id', usuarioId)
      }
    }

    // 4. Tratar estorno / devolução (Refund)
    if (event === 'PAYMENT_REFUNDED') {

      if (payment.id) {
        await supabase
          .from('faturas')
          .update({
            status: 'reembolsado',
            estornado_em: new Date().toISOString(),
            motivo_estorno: 'Reembolso confirmado no gateway Asaas',
          })
          .eq('asaas_payment_id', payment.id)

        if (usuarioId) {
          await supabase
            .from('assinaturas')
            .update({ plano_id: 'gratis', status: 'ativo', metodo_pagamento: 'gratis' })
            .eq('usuario_id', usuarioId)
          await supabase.from('perfis').update({ plano_id: 'gratis' }).eq('id', usuarioId)
        }
      }
    }

    // 5. Tratar contestação / Chargeback
    if (event === 'PAYMENT_CHARGEBACK_REQUESTED' || event === 'PAYMENT_CHARGEBACK_DISPUTE') {
      let usuarioId = ''
      try {
        const refObj = JSON.parse(payment.externalReference || '{}')
        usuarioId = refObj.usuarioId
      } catch {}

      // Atualiza status da fatura para 'em_disputa'
      if (payment?.id) {
        await supabase
          .from('faturas')
          .update({ status: 'em_disputa' })
          .eq('asaas_payment_id', payment.id)

        // Cria ou atualiza disputa
        if (usuarioId) {
          await supabase.from('contestacoes_disputas').insert({
            asaas_payment_id: payment.id,
            usuario_id: usuarioId,
            valor: payment.value || 0,
            motivo_bandeira: chargeback?.reason || 'Contestação solicitada pelo titular do cartão',
            status_disputa: 'aberta',
            data_limite_defesa: chargeback?.disputeDueDate || null,
          })
        }
      }
    }

    // 6. Tratar cancelamento de assinatura
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
              motivo_cancelamento: 'Assinatura cancelada no gateway de pagamento',
              cancelado_em: new Date().toISOString(),
            },
            { onConflict: 'usuario_id' }
          )
          await supabase.from('perfis').update({ plano_id: 'gratis' }).eq('id', refObj.usuarioId)
        }
      } catch {}
    }

    return NextResponse.json({ recebido: true })
  } catch (err: any) {
    console.error('[ASAAS-WEBHOOK-ERROR]:', err)
    return NextResponse.json({ error: err.message || 'Erro ao processar webhook' }, { status: 500 })
  }
}
