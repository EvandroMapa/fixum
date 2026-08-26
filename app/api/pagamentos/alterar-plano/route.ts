import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { obterPlanoPorId } from '@/lib/planos'
import { obterCredenciaisAsaas } from '@/lib/asaas'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://yxiaubwwzcnpmwfbvvrt.supabase.co'
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl4aWF1Ynd3emNucG13ZmJ2dnJ0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjY1OTM0NSwiZXhwIjoyMTAyMjM1MzQ1fQ.uHbg0JE9v929ErRqhuEeUxYXPvpIjAVK9Rs4YwSka3s'

export async function POST(req: Request) {
  try {
    const { usuarioId, novoPlanoId, tipo } = await req.json()

    if (!usuarioId || !novoPlanoId) {
      return NextResponse.json({ error: 'Dados incompletos para alteração de plano.' }, { status: 400 })
    }

    const novoPlano = obterPlanoPorId(novoPlanoId)
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // 1. Buscar assinatura atual do usuário
    const { data: assinaturaAtual } = await supabase
      .from('assinaturas')
      .select('*')
      .eq('usuario_id', usuarioId)
      .maybeSingle()

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
