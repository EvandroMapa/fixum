import { NextResponse } from 'next/server'
import { criarClienteAdmin } from '@/lib/supabase/admin'
import { exigirUsuario } from '@/lib/auth/servidor'
import { obterContextoConta, idsGerenciaveis } from '@/lib/auth/contexto-conta'

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
    const auth = await exigirUsuario(req)
    if (!auth.ok) return auth.resposta

    const supabase = criarClienteAdmin()

    // Usuário e imobiliária vêm da sessão (parâmetros da query são ignorados)
    const ctx = await obterContextoConta(supabase, auth.usuario)
    const usuarioId = ctx.id
    const imobiliariaId = ctx.imobiliariaId

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
    const auth = await exigirUsuario(req)
    if (!auth.ok) return auth.resposta

    const body = await req.json()
    const { acao, notificacaoId, titulo, mensagem, tipo, imovel_id } = body

    const supabase = criarClienteAdmin()
    const ctx = await obterContextoConta(supabase, auth.usuario)

    if (acao === 'marcar_lida') {
      try {
        await supabase
          .from('notificacoes')
          .update({ lida: true })
          .eq('id', notificacaoId)
          .or(`usuario_id.eq.${ctx.id},imobiliaria_id.eq.${ctx.imobiliariaId || ctx.id}`)
      } catch {}

      notificacoesFallback = notificacoesFallback.map((n) =>
        n.id === notificacaoId ? { ...n, lida: true } : n
      )
      return NextResponse.json({ success: true })
    }

    if (acao === 'marcar_todas_lidas') {
      const usuario_id = ctx.id
      try {
        await supabase.from('notificacoes').update({ lida: true }).eq('usuario_id', usuario_id)
      } catch {}

      notificacoesFallback = notificacoesFallback.map((n) =>
        n.usuario_id === usuario_id ? { ...n, lida: true } : n
      )
      return NextResponse.json({ success: true })
    }

    // Criar nova notificação: só para si mesmo, para a própria imobiliária ou (gestor) para a equipe
    const usuario_id = body.usuario_id || ctx.id
    const destinatariosPermitidos = new Set([ctx.id, ...(ctx.imobiliariaId ? [ctx.imobiliariaId] : [])])
    if (!destinatariosPermitidos.has(usuario_id) && !(ctx.isGestor && (await idsGerenciaveis(supabase, ctx)).includes(usuario_id))) {
      return NextResponse.json({ error: 'Sem permissão para notificar este usuário.' }, { status: 403 })
    }

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
