import { NextResponse } from 'next/server'
import { criarClienteAdmin } from '@/lib/supabase/admin'
import { exigirUsuario } from '@/lib/auth/servidor'
import { obterContextoConta, podeAcessarImoveis, idsGerenciaveis } from '@/lib/auth/contexto-conta'
import { criarNotificacao } from '@/lib/notificacoes'

export async function POST(req: Request) {
  try {
    const auth = await exigirUsuario(req)
    if (!auth.ok) return auth.resposta

    const body = await req.json()
    const { acao, imoveisIds, novoAnuncianteId, novoStatus, motivoRecusa, gestorNome } = body
    const usuarioId = auth.usuario.id

    if (!imoveisIds || !Array.isArray(imoveisIds) || imoveisIds.length === 0) {
      return NextResponse.json({ error: 'Nenhum imóvel informado.' }, { status: 400 })
    }

    const supabase = criarClienteAdmin()

    // 1. Verificar permissão do usuário sobre TODOS os imóveis informados
    const ctx = await obterContextoConta(supabase, auth.usuario)
    if (!(await podeAcessarImoveis(supabase, ctx, imoveisIds))) {
      return NextResponse.json({ error: 'Permissão negada para um ou mais imóveis.' }, { status: 403 })
    }

    const acoesDeGestor = ['aprovar_imovel', 'recusar_imovel', 'reatribuir_corretor']
    if (acoesDeGestor.includes(acao) && !ctx.isGestor) {
      return NextResponse.json({ error: 'Permissão negada: ação exclusiva de gestores.' }, { status: 403 })
    }

    // Ação: APROVAR E PUBLICAR IMÓVEL (Gestor)
    if (acao === 'aprovar_imovel') {
      const imovelId = imoveisIds[0]

      // Buscar imóvel para obter o anunciante_id e título
      const { data: imovel } = await supabase
        .from('imoveis')
        .select('id, titulo, anunciante_id')
        .eq('id', imovelId)
        .single()

      const { error: updateError } = await supabase
        .from('imoveis')
        .update({ status: 'ativo' })
        .eq('id', imovelId)

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 })
      }

      // Notificar o corretor se o anunciante for diferente do gestor
      if (imovel && imovel.anunciante_id !== usuarioId) {
        try {
          await criarNotificacao(supabase, {
            usuario_id: imovel.anunciante_id,
            titulo: '🎉 Anúncio Aprovado e Publicado!',
            mensagem: `O gestor ${gestorNome || 'da imobiliária'} avaliou e publicou seu imóvel "${imovel.titulo}" no mapa.`,
            tipo: 'imovel_aprovado',
            imovel_id: imovelId,
          })
        } catch {}
      }

      return NextResponse.json({ sucesso: true, mensagem: 'Imóvel aprovado e publicado com sucesso!' })
    }

    // Ação: RECUSAR / SOLICITAR AJUSTES (Gestor)
    if (acao === 'recusar_imovel') {
      const imovelId = imoveisIds[0]

      const { data: imovel } = await supabase
        .from('imoveis')
        .select('id, titulo, anunciante_id')
        .eq('id', imovelId)
        .single()

      const { error: updateError } = await supabase
        .from('imoveis')
        .update({
          status: 'rascunho',
          descricao_motivo_rejeicao: motivoRecusa || 'Ajustes solicitados pela gestão.',
        })
        .eq('id', imovelId)

      if (updateError) {
        // Fallback caso a coluna descricao_motivo_rejeicao não exista
        await supabase.from('imoveis').update({ status: 'rascunho' }).eq('id', imovelId)
      }

      // Notificar o corretor
      if (imovel && imovel.anunciante_id !== usuarioId) {
        try {
          await criarNotificacao(supabase, {
            usuario_id: imovel.anunciante_id,
            titulo: '⚠️ Ajustes Solicitados no Anúncio',
            mensagem: `O gestor ${gestorNome || 'da imobiliária'} solicitou correções em "${imovel.titulo}": ${motivoRecusa || 'Favor revisar os dados do anúncio.'}`,
            tipo: 'imovel_recusado',
            imovel_id: imovelId,
          })
        } catch {}
      }

      return NextResponse.json({ sucesso: true, mensagem: 'Ajustes solicitados com sucesso ao corretor.' })
    }

    // Ação: REATRIBUIR CORRETOR
    if (acao === 'reatribuir_corretor') {
      if (!novoAnuncianteId) {
        return NextResponse.json({ error: 'novoAnuncianteId é obrigatório.' }, { status: 400 })
      }

      const equipe = await idsGerenciaveis(supabase, ctx)
      if (!equipe.includes(novoAnuncianteId)) {
        return NextResponse.json({ error: 'O novo responsável não pertence à sua equipe.' }, { status: 403 })
      }

      const { error: updateError } = await supabase
        .from('imoveis')
        .update({ anunciante_id: novoAnuncianteId })
        .in('id', imoveisIds)

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 })
      }

      return NextResponse.json({ sucesso: true, mensagem: 'Responsável reatribuído com sucesso!' })
    }

    // Ação: ALTERAR STATUS EM LOTE
    if (acao === 'alterar_status') {
      if (!novoStatus) {
        return NextResponse.json({ error: 'novoStatus é obrigatório.' }, { status: 400 })
      }

      const { error: updateError } = await supabase
        .from('imoveis')
        .update({ status: novoStatus })
        .in('id', imoveisIds)

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 })
      }

      return NextResponse.json({ sucesso: true, mensagem: `Status alterado para ${novoStatus}!` })
    }

    // Ação: EXCLUIR EM LOTE / EXCLUIR IMÓVEL
    if (acao === 'excluir_lote' || acao === 'excluir_imovel') {
      if (ctx.isCorretorVinculado && !ctx.isGestor) {
        return NextResponse.json(
          { error: 'Permissão negada: Apenas gestores da imobiliária podem remover anúncios.' },
          { status: 403 }
        )
      }

      await supabase.from('fotos_imovel').delete().in('imovel_id', imoveisIds)
      await supabase.from('leads').delete().in('imovel_id', imoveisIds)

      const { error: delError } = await supabase
        .from('imoveis')
        .delete()
        .in('id', imoveisIds)

      if (delError) {
        return NextResponse.json({ error: delError.message }, { status: 500 })
      }

      return NextResponse.json({ sucesso: true, mensagem: 'Imóveis excluídos com sucesso!' })
    }

    return NextResponse.json({ error: 'Ação não reconhecida.' }, { status: 400 })
  } catch (err: any) {
    console.error('Erro na rota de ações de imóveis:', err)
    return NextResponse.json({ error: err?.message || 'Erro ao processar ação.' }, { status: 500 })
  }
}
