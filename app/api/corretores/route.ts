import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://yxiaubwwzcnpmwfbvvrt.supabase.co'
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl4aWF1Ynd3emNucG13ZmJ2dnJ0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjY1OTM0NSwiZXhwIjoyMTAyMjM1MzQ1fQ.uHbg0JE9v929ErRqhuEeUxYXPvpIjAVK9Rs4YwSka3s'

// GET: Listar membros da equipe da imobiliária (com papéis: gestor ou corretor)
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const imobiliariaId = searchParams.get('imobiliaria_id')

    if (!imobiliariaId) {
      return NextResponse.json({ error: 'imobiliaria_id é obrigatório.' }, { status: 400 })
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

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
    const { data: usersData, error: usersError } = await supabase.auth.admin.listUsers()
    if (usersError) {
      return NextResponse.json({ error: usersError.message }, { status: 500 })
    }

    const membros = (usersData.users || [])
      .filter((u) => u.user_metadata?.imobiliaria_id === imobiliariaId && u.id !== imobiliariaId)
      .map((u) => ({
        id: u.id,
        nome: u.user_metadata?.nome || u.user_metadata?.full_name || u.email?.split('@')[0] || 'Membro da Equipe',
        email: u.email || '',
        telefone: u.user_metadata?.telefone || '',
        creci: u.user_metadata?.creci || 'Não informado',
        papel: (u.user_metadata?.papel as 'gestor' | 'corretor') || 'corretor',
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
    const body = await req.json()
    const { acao, corretor_id, novo_papel, imobiliaria_id, foto_url, regra, whatsapp_destino } = body

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

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

      const { data: usersData } = await supabase.auth.admin.listUsers()
      const membros = (usersData?.users || []).filter(
        (u) => u.user_metadata?.imobiliaria_id === imobiliaria_id || u.id === imobiliaria_id
      )

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

    // Ação: Editar Corretor (Nome, E-mail, Telefone, CRECI, Papel, Avatar/Foto)
    if (acao === 'editar_corretor') {
      const { nome, email, telefone, creci, papel, avatar_url } = body

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
      if (email && email !== userData.user.email) {
        authUpdatePayload.email = email
      }

      await supabase.auth.admin.updateUserById(corretor_id, authUpdatePayload)

      // Atualizar também na tabela perfis
      const perfilUpdatePayload: Record<string, any> = {}
      if (nome !== undefined) perfilUpdatePayload.nome = nome
      if (email !== undefined) perfilUpdatePayload.email = email
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
      if (!novo_papel || !['gestor', 'corretor'].includes(novo_papel)) {
        return NextResponse.json({ error: 'Papel inválido. Deve ser gestor ou corretor.' }, { status: 400 })
      }

      const updatedMeta = { ...userData.user.user_metadata, papel: novo_papel }
      await supabase.auth.admin.updateUserById(corretor_id, {
        user_metadata: updatedMeta,
      })

      return NextResponse.json({ success: true, papel: novo_papel })
    }

    // Ação padrão: Desvincular da imobiliária
    const updatedMeta = { ...userData.user.user_metadata, imobiliaria_id: null, papel: null }
    await supabase.auth.admin.updateUserById(corretor_id, {
      user_metadata: updatedMeta,
    })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Erro ao processar ação de equipe.' }, { status: 500 })
  }
}
