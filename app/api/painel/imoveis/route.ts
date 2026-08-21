import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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

    // 1. Obter metadados do usuário
    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(usuarioId)
    if (userError || !userData?.user) {
      return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 })
    }

    const meta = userData.user.user_metadata || {}
    const isImobiliaria = meta.tipo === 'imobiliaria' || meta.tipo_anunciante === 'imobiliaria'
    const imobiliariaId = meta.imobiliaria_id || null

    let idsAnunciantes: string[] = [usuarioId]
    const mapaNomes: Record<string, string> = { [usuarioId]: meta.nome || meta.full_name || 'Imobiliária (Direto)' }
    const listaCorretores: { id: string; nome: string }[] = []

    if (isImobiliaria) {
      // Buscar todos os corretores vinculados a esta imobiliária
      const { data: allUsers } = await supabase.auth.admin.listUsers()
      const corretores = (allUsers?.users || []).filter(
        (u) => u.user_metadata?.imobiliaria_id === usuarioId
      )

      corretores.forEach((c) => {
        idsAnunciantes.push(c.id)
        const nomeCorretor = c.user_metadata?.nome || c.user_metadata?.full_name || c.email?.split('@')[0] || 'Corretor'
        mapaNomes[c.id] = nomeCorretor
        listaCorretores.push({ id: c.id, nome: nomeCorretor })
      })
    }

    // 2. Buscar imóveis
    const { data: imoveisData, error: imoveisError } = await supabase
      .from('imoveis')
      .select('*, fotos_imovel(id, url, principal, ordem)')
      .in('anunciante_id', idsAnunciantes)
      .order('created_at', { ascending: false })

    if (imoveisError) {
      return NextResponse.json({ error: imoveisError.message }, { status: 500 })
    }

    // Buscar histórico de revisão e notificações recentes para mapear os motivos de ajuste
    let mapaMotivos: Record<string, string> = {}
    try {
      const { data: notifs } = await supabase
        .from('notificacoes')
        .select('*')
        .eq('tipo', 'imovel_recusado')
        .order('created_at', { ascending: false })

      if (notifs) {
        notifs.forEach((n) => {
          if (n.imovel_id && !mapaMotivos[n.imovel_id]) {
            mapaMotivos[n.imovel_id] = n.mensagem || ''
          }
        })
      }
    } catch {}

    try {
      const { data: historicos } = await supabase
        .from('historico_revisao_imoveis')
        .select('*')
        .eq('tipo_evento', 'solicitacao_ajuste')
        .order('created_at', { ascending: false })

      if (historicos) {
        historicos.forEach((h) => {
          if (h.imovel_id && !mapaMotivos[h.imovel_id]) {
            mapaMotivos[h.imovel_id] = h.mensagem || ''
          }
        })
      }
    } catch {}

    const imoveis = (imoveisData || []).map((i: any) => {
      const motivoFallback = mapaMotivos[i.id] || i.descricao_motivo_rejeicao || null
      return {
        ...i,
        descricao_motivo_rejeicao: motivoFallback,
        fotos: i.fotos_imovel || [],
        nome_anunciante: mapaNomes[i.anunciante_id] || 'Anunciante',
      }
    })

    // 3. Buscar leads
    const imoveisIds = imoveis.map((i: any) => i.id)
    let leads: any[] = []
    if (imoveisIds.length > 0) {
      const { data: leadsData } = await supabase
        .from('leads')
        .select('*, imoveis(titulo)')
        .in('imovel_id', imoveisIds)
        .order('created_at', { ascending: false })
      leads = leadsData || []
    }

    const papel = meta.papel || (isImobiliaria ? 'gestor_principal' : 'corretor')
    const isCorretorVinculado = !isImobiliaria && !!imobiliariaId
    const isGestor = isImobiliaria || papel === 'gestor' || papel === 'gestor_principal'
    const podeExcluir = !isCorretorVinculado || isGestor

    return NextResponse.json({
      imoveis,
      leads,
      mapaNomes,
      listaCorretores,
      isImobiliaria,
      isGestor,
      podeExcluir,
      papel,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Erro ao carregar dados do painel.' }, { status: 500 })
  }
}
