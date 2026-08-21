import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://yxiaubwwzcnpmwfbvvrt.supabase.co'
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl4aWF1Ynd3emNucG13ZmJ2dnJ0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjY1OTM0NSwiZXhwIjoyMTAyMjM1MzQ1fQ.uHbg0JE9v929ErRqhuEeUxYXPvpIjAVK9Rs4YwSka3s'

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// Armazenamento em memória com resiliência para fallback
let historicoFallback: Array<{
  id: string
  imovel_id: string
  autor_id: string
  autor_nome: string
  autor_papel: 'gestor' | 'gestor_principal' | 'corretor'
  tipo_evento: 'submissao_inicial' | 'solicitacao_ajuste' | 'resposta_corretor' | 'aprovacao' | 'edicao_dados'
  mensagem?: string
  created_at: string
}> = []

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const imovelId = searchParams.get('imovelId')
    const imoveisIdsParam = searchParams.get('imoveisIds')

    // 1. Busca em lote para contagens de mensagens não lidas nos cards
    if (imoveisIdsParam) {
      const ids = imoveisIdsParam.split(',').filter(Boolean)
      if (ids.length === 0) return NextResponse.json({ mapa: {} })

      try {
        const { data, error } = await supabase
          .from('historico_revisao_imoveis')
          .select('id, imovel_id, autor_id, autor_nome, autor_papel, tipo_evento, created_at')
          .in('imovel_id', ids)
          .order('created_at', { ascending: false })

        const mapa: Record<string, Array<{ id: string; autor_id: string; created_at: string }>> = {}
        if (!error && data) {
          for (const item of data) {
            if (!mapa[item.imovel_id]) mapa[item.imovel_id] = []
            mapa[item.imovel_id].push({
              id: item.id,
              autor_id: item.autor_id,
              created_at: item.created_at,
            })
          }
        }

        // Se algum imóvel tem descricao_motivo_rejeicao no banco e ainda não tem mensagens no mapa
        const { data: imoveisComRejeicao } = await supabase
          .from('imoveis')
          .select('id, descricao_motivo_rejeicao, anunciante_id, updated_at')
          .in('id', ids)
          .not('descricao_motivo_rejeicao', 'is', null)

        if (imoveisComRejeicao) {
          for (const im of imoveisComRejeicao) {
            if (im.descricao_motivo_rejeicao && (!mapa[im.id] || mapa[im.id].length === 0)) {
              mapa[im.id] = [
                {
                  id: 'legado_' + im.id,
                  autor_id: 'gestor_sistema',
                  created_at: im.updated_at || new Date().toISOString(),
                },
              ]
            }
          }
        }

        return NextResponse.json({ mapa })
      } catch {}

      return NextResponse.json({ mapa: {} })
    }

    if (!imovelId) {
      return NextResponse.json({ error: 'imovelId ou imoveisIds é obrigatório.' }, { status: 400 })
    }

    // 2. Busca individual de histórico completo de um imóvel
    try {
      const { data, error } = await supabase
        .from('historico_revisao_imoveis')
        .select('*')
        .eq('imovel_id', imovelId)
        .order('created_at', { ascending: true })

      if (!error && data && data.length > 0) {
        return NextResponse.json({ historico: data })
      }

      // Fallback: se não tiver histórico na tabela, verifica se o imóvel possui descricao_motivo_rejeicao
      const { data: imovelData } = await supabase
        .from('imoveis')
        .select('id, descricao_motivo_rejeicao, updated_at, anunciante_id')
        .eq('id', imovelId)
        .single()

      if (imovelData?.descricao_motivo_rejeicao) {
        return NextResponse.json({
          historico: [
            {
              id: 'legado_' + imovelData.id,
              imovel_id: imovelData.id,
              autor_id: 'gestor_sistema',
              autor_nome: 'Gestão da Imobiliária',
              autor_papel: 'gestor',
              tipo_evento: 'solicitacao_ajuste',
              mensagem: imovelData.descricao_motivo_rejeicao,
              created_at: imovelData.updated_at || new Date().toISOString(),
            },
          ],
        })
      }
    } catch {}

    // 2. Fallback de dados locais em memória
    const lista = historicoFallback
      .filter((h) => h.imovel_id === imovelId)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

    return NextResponse.json({ historico: lista })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro ao buscar histórico.' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const {
      imovelId,
      autorId,
      autorNome,
      autorPapel,
      tipoEvento,
      mensagem,
      imobiliariaId,
      corretorId,
      imovelTitulo,
    } = body

    if (!imovelId || !autorId || !tipoEvento) {
      return NextResponse.json(
        { error: 'imovelId, autorId e tipoEvento são obrigatórios.' },
        { status: 400 }
      )
    }

    const objetoParaInserir = {
      imovel_id: imovelId,
      autor_id: autorId,
      autor_nome: autorNome || 'Usuário',
      autor_papel: (autorPapel || 'corretor') as any,
      tipo_evento: tipoEvento,
      mensagem: mensagem || '',
      created_at: new Date().toISOString(),
    }

    let registroSalvo = { ...objetoParaInserir, id: 'temp_' + Date.now() }

    // Gravar no Supabase
    try {
      const { data, error } = await supabase
        .from('historico_revisao_imoveis')
        .insert(objetoParaInserir)
        .select()
        .single()

      if (!error && data) {
        registroSalvo = data
      }
    } catch {}

    historicoFallback.push(registroSalvo)

    // Atualizar status e descrições no imóvel dependendo do evento
    if (tipoEvento === 'solicitacao_ajuste') {
      try {
        await supabase
          .from('imoveis')
          .update({
            status: 'rascunho',
            descricao_motivo_rejeicao: mensagem || 'Ajustes solicitados pela gestão.',
          })
          .eq('id', imovelId)
      } catch {}

      // Notificar Corretor
      if (corretorId && corretorId !== autorId) {
        try {
          await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/painel/notificacoes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              usuario_id: corretorId,
              titulo: '⚠️ Ajustes Solicitados no Anúncio',
              mensagem: `O gestor ${autorNome} solicitou correções no imóvel "${imovelTitulo || 'Anúncio'}": ${mensagem || 'Favor revisar os dados do imóvel.'}`,
              tipo: 'imovel_recusado',
              imovel_id: imovelId,
            }),
          })
        } catch {}
      }
    } else if (tipoEvento === 'resposta_corretor') {
      try {
        await supabase
          .from('imoveis')
          .update({
            status: 'rascunho',
            descricao_motivo_rejeicao: null, // Limpa o motivo pois o corretor já corrigiu e reenviou
          })
          .eq('id', imovelId)
      } catch {}

      // Notificar Gestor da Imobiliária
      if (imobiliariaId) {
        try {
          await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/painel/notificacoes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              usuario_id: imobiliariaId,
              titulo: '📤 Anúncio Reenviado para Revisão',
              mensagem: `O corretor ${autorNome} aplicou os ajustes e reenviou o imóvel "${imovelTitulo || 'Anúncio'}": ${mensagem ? `"${mensagem}"` : 'Pronto para aprovação.'}`,
              tipo: 'revisao_pendente',
              imovel_id: imovelId,
            }),
          })
        } catch {}
      }
    } else if (tipoEvento === 'aprovacao') {
      try {
        await supabase
          .from('imoveis')
          .update({
            status: 'ativo',
            descricao_motivo_rejeicao: null,
          })
          .eq('id', imovelId)
      } catch {}

      // Notificar Corretor
      if (corretorId && corretorId !== autorId) {
        try {
          await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/painel/notificacoes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              usuario_id: corretorId,
              titulo: '🎉 Imóvel Aprovado e Publicado!',
              mensagem: `Parabéns! O gestor ${autorNome} aprovou seu anúncio "${imovelTitulo || 'Imóvel'}". Ele já está visível no mapa público do Fixum.`,
              tipo: 'imovel_aprovado',
              imovel_id: imovelId,
            }),
          })
        } catch {}
      }
    } else if (tipoEvento === 'mensagem_chat') {
      // Notificar a outra parte na conversa
      const destinatarioId = autorPapel === 'corretor' ? imobiliariaId : corretorId
      if (destinatarioId && destinatarioId !== autorId) {
        try {
          await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/painel/notificacoes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              usuario_id: destinatarioId,
              titulo: `💬 Nova Mensagem no Chat de Moderação`,
              mensagem: `${autorNome}: "${mensagem}" (Imóvel: ${imovelTitulo || 'Anúncio'})`,
              tipo: 'revisao_pendente',
              imovel_id: imovelId,
            }),
          })
        } catch {}
      }
    }

    return NextResponse.json({ success: true, evento: registroSalvo })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro ao processar evento de revisão.' }, { status: 500 })
  }
}
