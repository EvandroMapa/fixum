import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { PLANOS_OFICIAIS, obterPlanoPorId } from '@/lib/planos'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://yxiaubwwzcnpmwfbvvrt.supabase.co'
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl4aWF1Ynd3emNucG13ZmJ2dnJ0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjY1OTM0NSwiZXhwIjoyMTAyMjM1MzQ1fQ.uHbg0JE9v929ErRqhuEeUxYXPvpIjAVK9Rs4YwSka3s'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const usuarioId = searchParams.get('usuario_id')

    if (!usuarioId) {
      return NextResponse.json({ error: 'usuario_id é obrigatório.' }, { status: 400 })
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // 1. Identificar usuário e metadados
    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(usuarioId)
    if (userError || !userData?.user) {
      return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 })
    }

    const user = userData.user
    const meta = user.user_metadata || {}
    const { data: perfil } = await supabase.from('perfis').select('*').eq('id', usuarioId).maybeSingle()

    const tipo = perfil?.tipo || meta.tipo || meta.tipo_anunciante || 'proprietario'
    const imobId = meta.imobiliaria_id || perfil?.imobiliaria_id || null
    const isCorretor = tipo === 'corretor' || !!imobId
    const isImobiliaria = tipo === 'imobiliaria'

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
    const { data: allUsers } = await supabase.auth.admin.listUsers()
    const todosUsuarios = allUsers?.users || []
    
    let idsEquipe: string[] = [idDonoConta]
    const mapaNomes: Record<string, string> = { [idDonoConta]: 'Imobiliária (Direto)' }
    const listaCorretores: { id: string; nome: string; email: string }[] = []

    const corretoresEquipe = todosUsuarios.filter(
      (u) => u.user_metadata?.imobiliaria_id === idDonoConta
    )

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
