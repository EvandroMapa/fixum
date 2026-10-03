import { NextResponse } from 'next/server'
import { criarClienteAdmin } from '@/lib/supabase/admin'
import { exigirAdmin } from '@/lib/auth/servidor'

export async function POST(req: Request) {
  try {
    const auth = await exigirAdmin(req)
    if (!auth.ok) return auth.resposta
    const adminEmail = auth.usuario.email || 'admin'

    const body = await req.json()
    const {
      tipoAcao,
      entidade,
      entidadeId,
      dadosAnteriores,
      dadosNovos,
      justificativa,
    } = body

    if (!tipoAcao || !justificativa) {
      return NextResponse.json({ error: 'Ação e justificativa obrigatória são necessárias.' }, { status: 400 })
    }

    const supabase = criarClienteAdmin()

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
