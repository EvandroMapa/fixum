import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { CHAVE_SECRETA_ADMIN_PADRAO } from '@/lib/admin-auth'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://yxiaubwwzcnpmwfbvvrt.supabase.co'
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl4aWF1Ynd3emNucG13ZmJ2dnJ0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjY1OTM0NSwiZXhwIjoyMTAyMjM1MzQ1fQ.uHbg0JE9v929ErRqhuEeUxYXPvpIjAVK9Rs4YwSka3s'
const ASAAS_API_URL = process.env.ASAAS_API_URL || (
  process.env.NODE_ENV === 'production' && !process.env.ASAAS_SANDBOX
    ? 'https://api.asaas.com/v3'
    : 'https://sandbox.asaas.com/api/v3'
)
const ASAAS_API_KEY = process.env.ASAAS_API_KEY || ''

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const {
      faturaId,
      usuarioId,
      valor,
      motivo,
      tipoReembolso,
      justificativa,
      adminPin,
      adminEmail,
    } = body

    // 1. Validação do PIN Master do Administrador
    if (!adminPin || adminPin.trim() !== CHAVE_SECRETA_ADMIN_PADRAO) {
      return NextResponse.json({ error: 'PIN Master inválido. Operação de estorno rejeitada.' }, { status: 403 })
    }

    if (!faturaId || !usuarioId || !justificativa) {
      return NextResponse.json({ error: 'Parâmetros obrigatórios ausentes (faturaId, usuarioId, justificativa).' }, { status: 400 })
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // 2. Obter dados da fatura original
    const { data: fatura, error: erroFatura } = await supabase
      .from('faturas')
      .select('*')
      .eq('id', faturaId)
      .single()

    if (erroFatura || !fatura) {
      return NextResponse.json({ error: 'Fatura não localizada.' }, { status: 404 })
    }

    const valorEstorno = valor ? Number(valor) : Number(fatura.valor)

    // 3. Se houver gateway Asaas e paymentId, tentar estornar via API do Asaas
    let estornoAsaasSucesso = false
    let erroAsaasMsg = ''

    if (fatura.asaas_payment_id && ASAAS_API_KEY && ASAAS_API_KEY !== 'mock_asaas_key') {
      try {
        const resEstorno = await fetch(`${ASAAS_API_URL}/payments/${fatura.asaas_payment_id}/refund`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'access_token': ASAAS_API_KEY,
            'User-Agent': 'Fixum-Admin/1.0',
          },
          body: JSON.stringify({
            value: valorEstorno,
            description: `Estorno Fixum: ${motivo} - ${justificativa.slice(0, 100)}`,
          }),
        })

        if (resEstorno.ok) {
          estornoAsaasSucesso = true
        } else {
          const errData = await resEstorno.json()
          erroAsaasMsg = errData.errors?.[0]?.description || 'Erro na API do Asaas'
          console.warn('[ASAAS-REFUND-WARN]:', erroAsaasMsg)
        }
      } catch (e: any) {
        erroAsaasMsg = e?.message || 'Falha de comunicação com Asaas'
        console.warn('[ASAAS-REFUND-ERROR]:', erroAsaasMsg)
      }
    }

    // 4. Atualizar a fatura no banco para 'reembolsado'
    await supabase
      .from('faturas')
      .update({
        status: 'reembolsado',
        estornado_em: new Date().toISOString(),
        motivo_estorno: `${motivo} — ${justificativa}`,
      })
      .eq('id', faturaId)

    // 5. Inserir registro na tabela de devoluções/reembolsos
    await supabase.from('devolucoes_reembolsos').insert({
      fatura_id: faturaId,
      usuario_id: usuarioId,
      asaas_payment_id: fatura.asaas_payment_id || null,
      valor: valorEstorno,
      motivo,
      tipo_reembolso: tipoReembolso || (fatura.metodo_pagamento === 'pix' ? 'pix' : 'cartao'),
      status: 'concluido',
      justificativa,
    })

    // 6. Rebaixar assinatura do cliente para o plano 'gratis'
    await supabase
      .from('assinaturas')
      .update({
        plano_id: 'gratis',
        status: 'ativo',
        metodo_pagamento: 'gratis',
        updated_at: new Date().toISOString(),
      })
      .eq('usuario_id', usuarioId)

    // 7. Gravar Log Imutável de Auditoria
    await supabase.from('logs_auditoria_admin').insert({
      admin_email: adminEmail || 'admin@fixum.com.br',
      tipo_acao: 'ESTORNO_FATURA',
      entidade: 'faturas',
      entidade_id: faturaId,
      dados_anteriores: { status: fatura.status, valor: fatura.valor },
      dados_novos: { status: 'reembolsado', valorEstorno, motivo, justificativa },
      justificativa: `Estorno efetuado: ${motivo} | Justificativa: ${justificativa} ${erroAsaasMsg ? `(Aviso Gateway: ${erroAsaasMsg})` : ''}`,
      ip: req.headers.get('x-forwarded-for') || '127.0.0.1',
      user_agent: req.headers.get('user-agent') || 'fixum-admin',
    })

    return NextResponse.json({
      sucesso: true,
      mensagem: 'Estorno processado e auditado com sucesso!',
      estornoAsaas: estornoAsaasSucesso,
    })
  } catch (err: any) {
    console.error('[ADMIN-ESTORNO-ERROR]:', err)
    return NextResponse.json({ error: err?.message || 'Falha interna ao processar estorno' }, { status: 500 })
  }
}
