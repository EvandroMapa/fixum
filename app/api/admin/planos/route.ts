import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://yxiaubwwzcnpmwfbvvrt.supabase.co'
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl4aWF1Ynd3emNucG13ZmJ2dnJ0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjY1OTM0NSwiZXhwIjoyMTAyMjM1MzQ1fQ.uHbg0JE9v929ErRqhuEeUxYXPvpIjAVK9Rs4YwSka3s'

export async function GET() {
  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: planos, error } = await supabase
      .from('planos')
      .select('*')
      .order('ordem', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ planos: planos || [] })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro ao carregar planos.' }, { status: 500 })
  }
}

export async function PUT(req: Request) {
  try {
    const { planos, descontos, adminEmail, pinMaster } = await req.json()

    if (!Array.isArray(planos) || planos.length === 0) {
      return NextResponse.json({ error: 'Nenhum plano fornecido para atualização.' }, { status: 400 })
    }

    // Validação de segurança básica para ações administrativas
    if (pinMaster && pinMaster !== 'FIXUM-MASTER-2026') {
      return NextResponse.json({ error: 'PIN Master inválido para alteração de precificação.' }, { status: 403 })
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // 1. Buscar os planos atuais para log de auditoria
    const { data: planosAntigos } = await supabase
      .from('planos')
      .select('id, nome, preco_mensal, limite_imoveis_max, ativo')

    const mapaAntigo = new Map(planosAntigos?.map((p) => [p.id, p]) || [])
    const alteracoesLog: string[] = []

    // 2. Atualizar cada plano na tabela
    for (const p of planos) {
      const antigo = mapaAntigo.get(p.id)
      const precoMensal = Number(p.preco_mensal) || 0
      const limiteMax = Number(p.limite_imoveis_max) || 1
      const limiteMin = Number(p.limite_imoveis_min) || 1
      const custoUnitario = limiteMax > 0 && precoMensal > 0 ? Number((precoMensal / limiteMax).toFixed(2)) : 0

      // Registrar se houve mudança de preço ou limites
      if (antigo) {
        if (antigo.preco_mensal !== precoMensal) {
          alteracoesLog.push(`${p.nome}: R$ ${antigo.preco_mensal} ➔ R$ ${precoMensal}`)
        }
        if (antigo.limite_imoveis_max !== limiteMax) {
          alteracoesLog.push(`${p.nome}: Limite ${antigo.limite_imoveis_max} ➔ ${limiteMax} imóveis`)
        }
        if (antigo.ativo !== p.ativo) {
          alteracoesLog.push(`${p.nome}: ${p.ativo ? 'Ativado' : 'Pausado'}`)
        }
      }

      await supabase
        .from('planos')
        .update({
          nome: p.nome,
          descricao: p.descricao,
          limite_imoveis_min: limiteMin,
          limite_imoveis_max: limiteMax,
          preco_mensal: precoMensal,
          preco_anual: p.preco_anual ? Number(p.preco_anual) : null,
          custo_unitario_max: custoUnitario,
          destaque_incluso: !!p.destaque_incluso,
          ativo: p.ativo !== undefined ? !!p.ativo : true,
          ordem: p.ordem ? Number(p.ordem) : 1,
        })
        .eq('id', p.id)
    }

    // 3. Salvar descontos promocionais por ciclo em configuracoes_sistema
    if (descontos) {
      if (descontos.trimestral !== undefined) {
        await supabase.from('configuracoes_sistema').upsert({
          chave: 'desconto_trimestral_pct',
          valor: String(descontos.trimestral),
          descricao: 'Percentual de desconto promocional para ciclo trimestral (3 meses)',
        }, { onConflict: 'chave' })
      }
      if (descontos.semestral !== undefined) {
        await supabase.from('configuracoes_sistema').upsert({
          chave: 'desconto_semestral_pct',
          valor: String(descontos.semestral),
          descricao: 'Percentual de desconto promocional para ciclo semestral (6 meses)',
        }, { onConflict: 'chave' })
      }
      if (descontos.anual !== undefined) {
        await supabase.from('configuracoes_sistema').upsert({
          chave: 'desconto_anual_pct',
          valor: String(descontos.anual),
          descricao: 'Percentual de desconto promocional para ciclo anual (12 meses)',
        }, { onConflict: 'chave' })
      }
    }

    // 4. Gravar na trilha de auditoria se houve modificações
    if (alteracoesLog.length > 0) {
      await supabase.from('logs_auditoria_admin').insert({
        admin_email: adminEmail || 'admin@fixum.com.br',
        acao: 'atualizacao_precificacao_planos',
        entidade_tipo: 'planos',
        entidade_id: 'tabela_planos',
        detalhes: {
          total_alterados: alteracoesLog.length,
          resumo: alteracoesLog.join(' | '),
          descontos,
        },
        motivo: 'Reajuste e calibração de precificação da plataforma Fixum',
      })
    }

    return NextResponse.json({
      sucesso: true,
      mensagem: `${planos.length} planos e descontos promocionais atualizados com sucesso!`,
      alteracoes: alteracoesLog,
    })
  } catch (err: any) {
    console.error('[ADMIN-PLANOS-UPDATE-ERROR]:', err)
    return NextResponse.json({ error: err.message || 'Erro ao atualizar planos.' }, { status: 500 })
  }
}
