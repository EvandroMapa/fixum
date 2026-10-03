import { NextResponse } from 'next/server'
import { obterPlanoPorId } from '@/lib/planos'
import { obterCredenciaisAsaas } from '@/lib/asaas'
import { criarClienteAdmin } from '@/lib/supabase/admin'
import { exigirUsuario } from '@/lib/auth/servidor'

export async function POST(req: Request) {
  try {
    const auth = await exigirUsuario(req)
    if (!auth.ok) return auth.resposta

    const { novoPlanoId, tipo } = await req.json()
    const usuarioId = auth.usuario.id

    if (!novoPlanoId) {
      return NextResponse.json({ error: 'Dados incompletos para alteração de plano.' }, { status: 400 })
    }

    const novoPlano = obterPlanoPorId(novoPlanoId)
    const supabase = criarClienteAdmin()

    // 1. Buscar assinatura atual do usuário
    const { data: assinaturaAtual } = await supabase
      .from('assinaturas')
      .select('*')
      .eq('usuario_id', usuarioId)
      .maybeSingle()

    // Esta rota só reduz o plano (sem cobrança). Upgrade precisa passar pelo checkout com pagamento.
    const planoAtual = obterPlanoPorId(assinaturaAtual?.plano_id || 'gratis')
    const ehReducao = novoPlano.preco_mensal === 0 || novoPlano.preco_mensal < planoAtual.preco_mensal
    if (!ehReducao) {
      return NextResponse.json(
        { error: 'Para mudar para um plano superior, conclua o pagamento pelo checkout.' },
        { status: 400 }
      )
    }

    // 2. Se for downgrade (redução de plano)
    if (tipo === 'downgrade' || novoPlano.preco_mensal === 0) {
      // Se tiver assinatura ativa no Asaas, atualizar o valor da próxima cobrança
      if (assinaturaAtual?.asaas_subscription_id) {
        try {
          const { apiKey, apiUrl } = await obterCredenciaisAsaas()
          if (apiKey && apiKey !== 'mock_asaas_key') {
            if (novoPlano.preco_mensal === 0) {
              // Cancelar assinatura no Asaas se for para o plano grátis
              await fetch(`${apiUrl}/subscriptions/${assinaturaAtual.asaas_subscription_id}`, {
                method: 'DELETE',
                headers: {
                  'Content-Type': 'application/json',
                  'access_token': apiKey,
                  'User-Agent': 'Fixum-Plataforma-Imobiliaria/1.0',
                },
              })
            } else {
              // Atualizar valor da assinatura para a próxima cobrança
              await fetch(`${apiUrl}/subscriptions/${assinaturaAtual.asaas_subscription_id}`, {
                method: 'POST', // ou PUT no Asaas v3
                headers: {
                  'Content-Type': 'application/json',
                  'access_token': apiKey,
                  'User-Agent': 'Fixum-Plataforma-Imobiliaria/1.0',
                },
                body: JSON.stringify({
                  value: novoPlano.preco_mensal,
                  description: `Fixum Imóveis - Assinatura Plano ${novoPlano.nome}`,
                  externalReference: `${usuarioId}:${novoPlano.id}:cartao`,
                }),
              })
            }
          }
        } catch (errAsaas) {
          console.warn('[ASAAS] Aviso ao atualizar assinatura no gateway:', errAsaas)
        }
      }

      // Atualizar assinatura e perfil no Supabase
      if (novoPlano.preco_mensal === 0) {
        await supabase.from('assinaturas').update({
          plano_id: 'gratis',
          status: 'ativo',
          metodo_pagamento: 'gratis',
        }).eq('usuario_id', usuarioId)

        await supabase.from('perfis').update({
          plano_id: 'gratis',
        }).eq('id', usuarioId)
      } else {
        await supabase.from('assinaturas').update({
          plano_id: novoPlano.id,
          status: 'ativo',
        }).eq('usuario_id', usuarioId)

        await supabase.from('perfis').update({
          plano_id: novoPlano.id,
        }).eq('id', usuarioId)
      }

      return NextResponse.json({
        sucesso: true,
        mensagem: `Plano ajustado com sucesso para ${novoPlano.nome}! A nova mensalidade passa a valer a partir do próximo ciclo.`,
        plano: novoPlano,
      })
    }

    return NextResponse.json({ error: 'Tipo de alteração não suportado.' }, { status: 400 })
  } catch (err: any) {
    console.error('[ALTERAR-PLANO-ERROR]:', err)
    return NextResponse.json({ error: err.message || 'Erro ao alterar plano.' }, { status: 500 })
  }
}
