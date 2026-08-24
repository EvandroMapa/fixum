import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { lerTodosMetadadosLeads } from '@/lib/leadsMetadata'

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
    const isImobDirect = meta.tipo === 'imobiliaria' || meta.tipo_anunciante === 'imobiliaria'
    const imobiliariaId = meta.imobiliaria_id || (isImobDirect ? usuarioId : null)
    const papel = meta.papel || (isImobDirect ? 'gestor_principal' : 'corretor')
    const isGestor = isImobDirect || papel === 'gestor' || papel === 'gestor_principal'
    const isCorretorVinculado = !isImobDirect && !!imobiliariaId
    const podeExcluir = !isCorretorVinculado || isGestor

    let idsAnunciantes: string[] = [usuarioId]
    const mapaNomes: Record<string, string> = { [usuarioId]: meta.nome || meta.full_name || 'Usuário' }
    const listaCorretores: { id: string; nome: string }[] = []

    if (isGestor && imobiliariaId) {
      // Buscar todos os membros e corretores vinculados a esta imobiliária
      const { data: allUsers } = await supabase.auth.admin.listUsers()
      const membros = (allUsers?.users || []).filter(
        (u) => u.user_metadata?.imobiliaria_id === imobiliariaId || u.id === imobiliariaId
      )

      idsAnunciantes = Array.from(new Set([imobiliariaId, ...membros.map((m) => m.id)]))
      membros.forEach((c) => {
        const nomeCorretor = c.user_metadata?.nome || c.user_metadata?.full_name || c.email?.split('@')[0] || 'Corretor'
        mapaNomes[c.id] = nomeCorretor
        if (c.id !== imobiliariaId) {
          listaCorretores.push({ id: c.id, nome: nomeCorretor })
        }
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
    const mapaImoveisObj: Record<string, any> = {}
    imoveis.forEach((im: any) => {
      mapaImoveisObj[im.id] = im
    })

    let leads: any[] = []
    if (imoveisIds.length > 0) {
      const { data: leadsData } = await supabase
        .from('leads')
        .select('*')
        .in('imovel_id', imoveisIds)
        .order('created_at', { ascending: false })

      const todosMetadados = lerTodosMetadadosLeads()

      const leadsTratados = (leadsData || []).map((l: any) => {
        const metaLocal = todosMetadados[l.id] || {}
        const imovelRel = mapaImoveisObj[l.imovel_id] || null
        const corretorIdFinal = l.corretor_id || metaLocal.corretor_id || imovelRel?.anunciante_id || usuarioId
        const corretorNomeFinal = metaLocal.corretor_nome || mapaNomes[corretorIdFinal] || 'Equipe Fixum'

        return {
          ...l,
          valor_proposta: l.valor_proposta ?? metaLocal.valor_proposta ?? null,
          data_visita: l.data_visita ?? metaLocal.data_visita ?? null,
          data_primeiro_contato: l.data_primeiro_contato ?? metaLocal.data_primeiro_contato ?? null,
          data_ultimo_contato: l.data_ultimo_contato ?? metaLocal.data_ultimo_contato ?? null,
          motivo_perda: l.motivo_perda ?? metaLocal.motivo_perda ?? null,
          temperatura: l.temperatura ?? metaLocal.temperatura ?? 'morno',
          corretor_id: corretorIdFinal,
          corretor_nome: corretorNomeFinal,
          imovel: imovelRel ? {
            id: imovelRel.id,
            titulo: imovelRel.titulo,
            preco: imovelRel.preco,
            negociacao: imovelRel.negociacao,
            codigo: imovelRel.codigo,
            bairro: imovelRel.bairro,
            cidade: imovelRel.cidade,
            fotos: imovelRel.fotos || [],
          } : null,
        }
      })

      // REGRA: Se for Gestor ou Imobiliária, vê todos os leads.
      // Se for Corretor regular (não gestor), vê APENAS os seus leads!
      if (isGestor) {
        leads = leadsTratados
      } else {
        leads = leadsTratados.filter(
          (l: any) => l.corretor_id === usuarioId || l.imovel?.anunciante_id === usuarioId
        )
      }
    }

    return NextResponse.json({
      imoveis,
      leads,
      mapaNomes,
      listaCorretores,
      isImobiliaria: isImobDirect,
      isGestor,
      podeExcluir,
      papel,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Erro ao carregar dados do painel.' }, { status: 500 })
  }
}
