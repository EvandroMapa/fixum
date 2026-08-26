import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { CHAVE_SECRETA_ADMIN_PADRAO } from '@/lib/admin-auth'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://yxiaubwwzcnpmwfbvvrt.supabase.co'
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl4aWF1Ynd3emNucG13ZmJ2dnJ0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjY1OTM0NSwiZXhwIjoyMTAyMjM1MzQ1fQ.uHbg0JE9v929ErRqhuEeUxYXPvpIjAVK9Rs4YwSka3s'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const {
      tipoAcao,
      entidade,
      entidadeId,
      dadosAnteriores,
      dadosNovos,
      justificativa,
      adminPin,
      adminEmail,
    } = body

    // 1. Validação da Chave Secreta Master
    if (!adminPin || adminPin.trim() !== CHAVE_SECRETA_ADMIN_PADRAO) {
      return NextResponse.json({ error: 'Chave Secreta Master inválida. Ação bloqueada.' }, { status: 403 })
    }

    if (!tipoAcao || !justificativa) {
      return NextResponse.json({ error: 'Ação e justificativa obrigatória são necessárias.' }, { status: 400 })
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // 2. Executar ação correspondente
    if (tipoAcao === 'ALTERAR_PLANO_MANUAL' && entidadeId && dadosNovos?.plano_id) {
      // Atualiza na tabela assinaturas
      await supabase
        .from('assinaturas')
        .upsert(
          {
            usuario_id: entidadeId,
            plano_id: dadosNovos.plano_id,
            status: 'ativo',
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'usuario_id' }
        )

      // Atualiza no perfil do usuário
      await supabase
        .from('perfis')
        .update({ plano_id: dadosNovos.plano_id })
        .eq('id', entidadeId)
    }

    if (tipoAcao === 'SUSPENDER_CONTA' && entidadeId) {
      await supabase
        .from('perfis')
        .update({
          status_conta: 'suspenso',
          motivo_suspensao: justificativa,
        })
        .eq('id', entidadeId)

      // Pausa os imóveis do anunciante suspenso
      await supabase
        .from('imoveis')
        .update({ status: 'pausado' })
        .eq('anunciante_id', entidadeId)
    }

    if (tipoAcao === 'REATIVAR_CONTA' && entidadeId) {
      await supabase
        .from('perfis')
        .update({
          status_conta: 'ativo',
          motivo_suspensao: null,
        })
        .eq('id', entidadeId)
    }

    if (tipoAcao === 'SALVAR_NOTAS_CLIENTE' && entidadeId) {
      await supabase
        .from('perfis')
        .update({
          notas_admin: dadosNovos?.notas_admin || '',
        })
        .eq('id', entidadeId)
    }

    if (tipoAcao === 'CANCELAR_ASSINATURA_ADMIN' && entidadeId) {
      await supabase
        .from('assinaturas')
        .update({
          status: 'cancelado',
          motivo_cancelamento: justificativa,
          cancelado_em: new Date().toISOString(),
          plano_id: 'gratis',
        })
        .eq('usuario_id', entidadeId)
    }

    if (tipoAcao === 'RESOLVER_DISPUTA' && entidadeId) {
      await supabase
        .from('contestacoes_disputas')
        .update({
          status_disputa: dadosNovos?.status_disputa || 'em_analise',
          notas_admin: justificativa,
          updated_at: new Date().toISOString(),
        })
        .eq('id', entidadeId)
    }

    // 3. Gravar log imutável de auditoria
    await supabase.from('logs_auditoria_admin').insert({
      admin_email: adminEmail || 'admin@fixum.com.br',
      tipo_acao: tipoAcao,
      entidade: entidade || 'sistema',
      entidade_id: entidadeId || null,
      dados_anteriores: dadosAnteriores || null,
      dados_novos: dadosNovos || null,
      justificativa,
      ip: req.headers.get('x-forwarded-for') || '127.0.0.1',
      user_agent: req.headers.get('user-agent') || 'fixum-admin',
    })

    return NextResponse.json({ sucesso: true, mensagem: 'Operação executada e registrada com sucesso na auditoria!' })
  } catch (err: any) {
    console.error('[ACAO-AUDITADA-ERROR]:', err)
    return NextResponse.json({ error: err?.message || 'Falha ao executar ação administrativa' }, { status: 500 })
  }
}
