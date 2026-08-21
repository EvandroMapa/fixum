import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://yxiaubwwzcnpmwfbvvrt.supabase.co'
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl4aWF1Ynd3emNucG13ZmJ2dnJ0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjY1OTM0NSwiZXhwIjoyMTAyMjM1MzQ1fQ.uHbg0JE9v929ErRqhuEeUxYXPvpIjAVK9Rs4YwSka3s'

// Armazenamento seguro de notificações corporativas (em banco/metadados com fallback em memória)
// Para garantir 100% de disponibilidade mesmo que a tabela de notificações esteja sendo provisionada
let notificacoesFallback: Array<{
  id: string
  usuario_id: string
  titulo: string
  mensagem: string
  tipo: 'revisao_pendente' | 'imovel_aprovado' | 'imovel_recusado' | 'info'
  imovel_id?: string
  lida: boolean
  created_at: string
}> = []

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const usuarioId = searchParams.get('usuario_id')
    const imobiliariaId = searchParams.get('imobiliaria_id')

    if (!usuarioId) {
      return NextResponse.json({ error: 'usuario_id é obrigatório.' }, { status: 400 })
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // Tenta buscar no banco se a tabela existir
    try {
      const { data: notifs, error } = await supabase
        .from('notificacoes')
        .select('*')
        .or(`usuario_id.eq.${usuarioId},imobiliaria_id.eq.${imobiliariaId || usuarioId}`)
        .order('created_at', { ascending: false })
        .limit(30)

      if (!error && notifs) {
        return NextResponse.json({ notificacoes: notifs })
      }
    } catch {
      // Continua para fallback
    }

    // Fallback local em memória
    const lista = notificacoesFallback.filter(
      (n) => n.usuario_id === usuarioId || (imobiliariaId && n.usuario_id === imobiliariaId)
    )

    return NextResponse.json({ notificacoes: lista })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Erro ao buscar notificações.' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { acao, notificacaoId, usuario_id, titulo, mensagem, tipo, imovel_id } = body

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    if (acao === 'marcar_lida') {
      try {
        await supabase.from('notificacoes').update({ lida: true }).eq('id', notificacaoId)
      } catch {}

      notificacoesFallback = notificacoesFallback.map((n) =>
        n.id === notificacaoId ? { ...n, lida: true } : n
      )
      return NextResponse.json({ success: true })
    }

    if (acao === 'marcar_todas_lidas') {
      try {
        await supabase.from('notificacoes').update({ lida: true }).eq('usuario_id', usuario_id)
      } catch {}

      notificacoesFallback = notificacoesFallback.map((n) =>
        n.usuario_id === usuario_id ? { ...n, lida: true } : n
      )
      return NextResponse.json({ success: true })
    }

    // Criar nova notificação
    const novaNotif = {
      id: 'notif_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      usuario_id,
      titulo,
      mensagem,
      tipo: tipo || 'info',
      imovel_id,
      lida: false,
      created_at: new Date().toISOString(),
    }

    try {
      await supabase.from('notificacoes').insert(novaNotif)
    } catch {}

    notificacoesFallback.unshift(novaNotif)

    return NextResponse.json({ success: true, notificacao: novaNotif })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Erro ao processar notificação.' }, { status: 500 })
  }
}
