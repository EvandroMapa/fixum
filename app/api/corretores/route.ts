import { NextResponse } from 'next/server'
import { criarClienteAdmin } from '@/lib/supabase/admin'
import { exigirUsuario } from '@/lib/auth/servidor'
import { obterContextoConta, listarMembrosEquipe, lerVinculo } from '@/lib/auth/contexto-conta'

const PAPEIS_VALIDOS = ['gestor', 'corretor']

// GET: Listar membros da equipe da imobiliária (com papéis: gestor ou corretor)
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const imobiliariaId = searchParams.get('imobiliaria_id')

    if (!imobiliariaId) {
      return NextResponse.json({ error: 'imobiliaria_id é obrigatório.' }, { status: 400 })
    }

    const supabase = criarClienteAdmin()

    // 1. Buscar dados do Gestor Titular / Dono da Imobiliária
    const { data: donoData } = await supabase.auth.admin.getUserById(imobiliariaId)
    const donoMeta = donoData?.user?.user_metadata || {}
    const gestorTitular = donoData?.user ? {
      id: donoData.user.id,
      nome: donoMeta.nome || donoMeta.full_name || donoData.user.email?.split('@')[0] || 'Gestor Titular',
      email: donoData.user.email || '',
      telefone: donoMeta.telefone || '',
      creci: donoMeta.creci || 'Não informado',
      papel: 'gestor_principal' as const,
      avatar_url: donoMeta.avatar_url || donoMeta.foto_url || null,
      created_at: donoData.user.created_at,
    } : null

    // 2. Buscar todos os usuários vinculados a esta imobiliária
    const membros = (await listarMembrosEquipe(supabase, imobiliariaId))
      .map((u) => ({
        id: u.id,
        nome: u.user_metadata?.nome || u.user_metadata?.full_name || u.email?.split('@')[0] || 'Membro da Equipe',
        email: u.email || '',
        telefone: u.user_metadata?.telefone || '',
        creci: u.user_metadata?.creci || 'Não informado',
        papel: (lerVinculo(u).papel as 'gestor' | 'corretor') || 'corretor',
        avatar_url: u.user_metadata?.avatar_url || u.user_metadata?.foto_url || null,
        created_at: u.created_at,
      }))

    const todosMembros = gestorTitular ? [gestorTitular, ...membros] : membros

    // 4. Buscar preferências de distribuição de leads da imobiliária
    const { data: perfilImob } = await supabase
      .from('perfis')
      .select('regra_distribuicao_leads, whatsapp_destino')
      .eq('id', imobiliariaId)
      .maybeSingle()

    const modoExibicaoPrecoImob = donoMeta.modo_exibicao_preco || (perfilImob as any)?.modo_exibicao_preco || 'visivel'

    const configDistribuicao = {
      regra: (perfilImob as any)?.regra_distribuicao_leads || 'captador',
      whatsapp_destino: (perfilImob as any)?.whatsapp_destino || 'corretor',
      modo_exibicao_preco: modoExibicaoPrecoImob,
    }

    const infoImobiliaria = {
      id: imobiliariaId,
      nome: gestorTitular?.nome || (perfilImob as any)?.nome || 'Imobiliária',
      foto_url: gestorTitular?.avatar_url || (perfilImob as any)?.foto_url || null,
      modo_exibicao_preco: modoExibicaoPrecoImob,
    }

    if (todosMembros.length > 0) {
      const ids = todosMembros.map((c) => c.id)
      const { data: imoveis } = await supabase
        .from('imoveis')
        .select('anunciante_id')
        .in('anunciante_id', ids)

      const contagem: Record<string, number> = {}
      ;(imoveis || []).forEach((im: any) => {
        contagem[im.anunciante_id] = (contagem[im.anunciante_id] || 0) + 1
      })

      const formatados = todosMembros.map((c) => ({
        ...c,
        modo_exibicao_preco: modoExibicaoPrecoImob,
        total_imoveis: contagem[c.id] || 0,
      }))

      const listaGestores = formatados.filter((m) => m.papel === 'gestor' || m.papel === 'gestor_principal')

      return NextResponse.json({
        imobiliaria: infoImobiliaria,
        corretores: formatados,
        gestores: listaGestores,
        gestorTitular,
        config_distribuicao: configDistribuicao,
      })
    }

    return NextResponse.json({ imobiliaria: infoImobiliaria, corretores: [], gestores: [], gestorTitular, config_distribuicao: configDistribuicao })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Erro ao buscar equipe.' }, { status: 500 })
  }
}

// POST: Ações de equipe (Desvincular, Alterar Papel, Sincronizar Logo ou Salvar Regra de Distribuição)
export async function POST(req: Request) {
  try {
    const auth = await exigirUsuario(req)
    if (!auth.ok) return auth.resposta

    const body = await req.json()
    const { acao, corretor_id, novo_papel, foto_url, regra, whatsapp_destino } = body

    const supabase = criarClienteAdmin()
    const ctx = await obterContextoConta(supabase, auth.usuario)

    // A imobiliária afetada é sempre a do usuário autenticado, e só gestores podem mexer na equipe
    const imobiliaria_id = ctx.imobiliariaId
    const editandoProprioPerfil = acao === 'editar_corretor' && corretor_id === ctx.id
    if (!editandoProprioPerfil && (!ctx.isGestor || !imobiliaria_id)) {
      return NextResponse.json({ error: 'Permissão negada: ação exclusiva de gestores da imobiliária.' }, { status: 403 })
    }

    // Ação: Salvar Regra de Distribuição de Leads da Imobiliária
    if (acao === 'salvar_regra_distribuicao') {
      if (!imobiliaria_id) {
        return NextResponse.json({ error: 'imobiliaria_id é obrigatório.' }, { status: 400 })
      }

      try {
        await supabase
          .from('perfis')
          .update({
            regra_distribuicao_leads: regra || 'captador',
            whatsapp_destino: whatsapp_destino || 'corretor',
          })
          .eq('id', imobiliaria_id)
      } catch (errDb) {
        console.error('Erro ao atualizar regra no Supabase:', errDb)
      }

      return NextResponse.json({ success: true, regra, whatsapp_destino })
    }

    // Ação: Sincronizar Logo da Imobiliária para todos os membros da equipe
    if (acao === 'sincronizar_logo') {
      if (!imobiliaria_id) {
        return NextResponse.json({ error: 'imobiliaria_id é obrigatório.' }, { status: 400 })
      }

      const membrosVinculados = await listarMembrosEquipe(supabase, imobiliaria_id!)
      const membros = [{ id: imobiliaria_id! }, ...membrosVinculados]

      for (const m of membros) {
        await supabase
          .from('perfis')
          .update({ foto_url: foto_url || null })
          .eq('id', m.id)
      }

      return NextResponse.json({ success: true, total: membros.length })
    }

    if (!corretor_id) {
      return NextResponse.json({ error: 'corretor_id é obrigatório.' }, { status: 400 })
    }

    const { data: userData, error: getError } = await supabase.auth.admin.getUserById(corretor_id)
    if (getError || !userData.user) {
      return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 })
    }

    // O alvo precisa ser membro da equipe do gestor (o dono da imobiliária não pode ser rebaixado/desvinculado)
    const alvoEhMembro = lerVinculo(userData.user).imobiliariaId === imobiliaria_id && corretor_id !== imobiliaria_id
    if (!editandoProprioPerfil && !alvoEhMembro) {
      return NextResponse.json({ error: 'Este usuário não pertence à sua equipe.' }, { status: 403 })
    }
    const appMetaAtual = userData.user.app_metadata || {}

    // Ação: Editar Corretor (Nome, E-mail, Telefone, CRECI, Papel, Avatar/Foto)
    if (acao === 'editar_corretor') {
      const { nome, email, telefone, creci, avatar_url } = body
      // Papel só pode ser alterado por gestor (impede que um corretor se autopromova editando o próprio perfil)
      const papel = ctx.isGestor && alvoEhMembro && corretor_id !== ctx.id && PAPEIS_VALIDOS.includes(body.papel) ? body.papel : undefined

      const authUpdatePayload: any = {}
      const metaAtual = userData.user.user_metadata || {}
      const metaNova = {
        ...metaAtual,
        ...(nome !== undefined ? { nome, full_name: nome } : {}),
        ...(telefone !== undefined ? { telefone, whatsapp: telefone } : {}),
        ...(creci !== undefined ? { creci } : {}),
        ...(papel !== undefined ? { papel } : {}),
        ...(avatar_url !== undefined ? { avatar_url, foto_url: avatar_url } : {}),
      }

      authUpdatePayload.user_metadata = metaNova
      if (papel !== undefined) {
        authUpdatePayload.app_metadata = { ...appMetaAtual, papel }
      }
      // Troca de e-mail pela própria pessoa deve passar pelo fluxo de confirmação do Supabase, não por aqui
      if (email && email !== userData.user.email && !editandoProprioPerfil) {
        authUpdatePayload.email = email
      }

      await supabase.auth.admin.updateUserById(corretor_id, authUpdatePayload)

      // Atualizar também na tabela perfis
      const perfilUpdatePayload: Record<string, any> = {}
      if (nome !== undefined) perfilUpdatePayload.nome = nome
      if (email !== undefined && !editandoProprioPerfil) perfilUpdatePayload.email = email
      if (telefone !== undefined) {
        perfilUpdatePayload.telefone = telefone
        perfilUpdatePayload.whatsapp = telefone
      }
      if (creci !== undefined) perfilUpdatePayload.creci = creci
      if (avatar_url !== undefined) {
        perfilUpdatePayload.avatar_url = avatar_url
        perfilUpdatePayload.foto_url = avatar_url
      }

      if (Object.keys(perfilUpdatePayload).length > 0) {
        try {
          await supabase.from('perfis').update(perfilUpdatePayload).eq('id', corretor_id)
        } catch {}
      }

      return NextResponse.json({
        success: true,
        membro: {
          id: corretor_id,
          nome: metaNova.nome,
          email: email || userData.user.email,
          telefone: metaNova.telefone,
          creci: metaNova.creci,
          papel: metaNova.papel || 'corretor',
          avatar_url: metaNova.avatar_url || null,
        },
      })
    }

    // Ação: Alterar Papel (Gestor / Corretor)
    if (acao === 'alterar_papel') {
      if (corretor_id === ctx.id) {
        return NextResponse.json({ error: 'Você não pode alterar o próprio papel.' }, { status: 403 })
      }
      if (!novo_papel || !['gestor', 'corretor'].includes(novo_papel)) {
        return NextResponse.json({ error: 'Papel inválido. Deve ser gestor ou corretor.' }, { status: 400 })
      }

      const updatedMeta = { ...userData.user.user_metadata, papel: novo_papel }
      await supabase.auth.admin.updateUserById(corretor_id, {
        user_metadata: updatedMeta,
        app_metadata: { ...appMetaAtual, papel: novo_papel },
      })

      return NextResponse.json({ success: true, papel: novo_papel })
    }

    // Ação padrão: Desvincular da imobiliária
    const updatedMeta = { ...userData.user.user_metadata, imobiliaria_id: null, papel: null }
    await supabase.auth.admin.updateUserById(corretor_id, {
      user_metadata: updatedMeta,
      app_metadata: { ...appMetaAtual, imobiliaria_id: null, papel: null },
    })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Erro ao processar ação de equipe.' }, { status: 500 })
  }
}
