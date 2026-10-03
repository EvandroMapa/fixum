import { NextResponse } from 'next/server'
import { PLANOS_OFICIAIS, obterPlanoPorId } from '@/lib/planos'
import { criarClienteAdmin } from '@/lib/supabase/admin'
import { exigirUsuario } from '@/lib/auth/servidor'
import { obterContextoConta, listarMembrosEquipe } from '@/lib/auth/contexto-conta'

export async function GET(req: Request) {
  try {
    const auth = await exigirUsuario(req)
    if (!auth.ok) return auth.resposta

    const supabase = criarClienteAdmin()

    // 1. Identificar usuário autenticado e metadados (o usuario_id da query é ignorado)
    const usuarioId = auth.usuario.id
    const meta = auth.usuario.user_metadata || {}
    const { data: perfil } = await supabase.from('perfis').select('*').eq('id', usuarioId).maybeSingle()
    const ctx = await obterContextoConta(supabase, auth.usuario)

    const tipo = ctx.tipo
    const imobId = ctx.isCorretorVinculado ? ctx.imobiliariaId : null
    const isCorretor = tipo === 'corretor' || !!imobId
    const isImobiliaria = ctx.isImobiliaria

    const idDonoConta = (isCorretor && imobId) ? imobId : usuarioId

    // 2. Buscar dados da imobiliária dona (se for corretor)
    let imobiliariaNome = ''
    if (isCorretor && imobId) {
      const { data: imobUser } = await supabase.auth.admin.getUserById(imobId)
      const { data: imobPerfil } = await supabase.from('perfis').select('nome').eq('id', imobId).maybeSingle()
      imobiliariaNome = imobPerfil?.nome || imobUser?.user?.user_metadata?.nome || 'Imobiliária Vinculada'
    } else if (isImobiliaria) {
      imobiliariaNome = perfil?.nome || meta.nome || 'Minha Imobiliária'
    }

    // 3. Buscar equipe de corretores
    let idsEquipe: string[] = [idDonoConta]
    const mapaNomes: Record<string, string> = { [idDonoConta]: 'Imobiliária (Direto)' }
    const listaCorretores: { id: string; nome: string; email: string }[] = []

    const corretoresEquipe = await listarMembrosEquipe(supabase, idDonoConta)

    corretoresEquipe.forEach((c) => {
      idsEquipe.push(c.id)
      const nomeCorretor = c.user_metadata?.nome || c.user_metadata?.full_name || c.email?.split('@')[0] || 'Corretor'
      mapaNomes[c.id] = nomeCorretor
      listaCorretores.push({ id: c.id, nome: nomeCorretor, email: c.email || '' })
    })

    // 4. Buscar assinatura da conta gestora
    const { data: assinaturaData } = await supabase
      .from('assinaturas')
      .select('*')
      .eq('usuario_id', idDonoConta)
      .maybeSingle()

    const planoId = assinaturaData?.plano_id || (isImobiliaria || isCorretor ? 'profissional_plus' : 'gratis')
    const planoInfo = obterPlanoPorId(planoId)

    // 5. Contar imóveis ativos da equipe
    const { data: imoveisEquipe } = await supabase
      .from('imoveis')
      .select('id, status, anunciante_id')
      .in('anunciante_id', idsEquipe)

    const totalAtivos = (imoveisEquipe || []).filter(
      (i) => i.status === 'ativo' || i.status === 'publicado'
    ).length

    const totalPausados = (imoveisEquipe || []).filter(
      (i) => i.status === 'pausado'
    ).length

    const limiteMaximo = planoInfo.limite_imoveis_max
    const atingiuLimite = totalAtivos >= limiteMaximo

    return NextResponse.json({
      isCorretor,
      isImobiliaria,
      imobiliariaNome,
      plano: {
        id: planoId,
        nome: planoInfo.nome,
        limiteImoveis: limiteMaximo,
      },
      assinatura: assinaturaData,
      totalAtivos,
      totalPausados,
      limiteMaximo,
      atingiuLimite,
      listaCorretores,
      mapaNomes,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Erro ao calcular cota' }, { status: 500 })
  }
}
