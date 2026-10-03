import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { criarClienteAdmin } from '@/lib/supabase/admin'
import { exigirUsuario } from '@/lib/auth/servidor'
import { obterContextoConta, podeAcessarLead } from '@/lib/auth/contexto-conta'
import type { SupabaseClient } from '@supabase/supabase-js'

function obterClienteSupabase() {
  return criarClienteAdmin()
}

// ── AUXILIAR: ARMAZENAMENTO PERSISTENTE LOCAL DE COMPROMISSOS ──
const BACKUP_FILE = path.resolve(process.cwd(), 'data_compromissos_leads.json')

function lerCompromissosLocais(leadId: string): any[] {
  try {
    if (!fs.existsSync(BACKUP_FILE)) return []
    const conteudo = fs.readFileSync(BACKUP_FILE, 'utf8')
    const todos: any[] = JSON.parse(conteudo || '[]')
    return todos.filter((c) => c.lead_id === leadId)
  } catch {
    return []
  }
}

function salvarCompromissoLocal(novo: any) {
  try {
    let todos: any[] = []
    if (fs.existsSync(BACKUP_FILE)) {
      todos = JSON.parse(fs.readFileSync(BACKUP_FILE, 'utf8') || '[]')
    }
    const idx = todos.findIndex((c) => c.id === novo.id)
    if (idx >= 0) {
      todos[idx] = novo
    } else {
      todos.unshift(novo)
    }
    fs.writeFileSync(BACKUP_FILE, JSON.stringify(todos, null, 2), 'utf8')
  } catch (e) {
    console.error('Erro ao salvar compromisso local:', e)
  }
}

function removerCompromissoLocal(compromissoId: string) {
  try {
    if (!fs.existsSync(BACKUP_FILE)) return
    const todos: any[] = JSON.parse(fs.readFileSync(BACKUP_FILE, 'utf8') || '[]')
    const filtrados = todos.filter((c) => c.id !== compromissoId)
    fs.writeFileSync(BACKUP_FILE, JSON.stringify(filtrados, null, 2), 'utf8')
  } catch (e) {
    console.error('Erro ao remover compromisso local:', e)
  }
}

// ── AUXILIAR: AUTORIZAÇÃO ──
// Cabeçalhos para chamar a rota interna de atividades com a mesma sessão do usuário
function repassarSessao(req: Request): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const cookie = req.headers.get('cookie')
  const authorization = req.headers.get('authorization')
  if (cookie) headers.cookie = cookie
  if (authorization) headers.authorization = authorization
  return headers
}

async function autorizarLead(req: Request, supabase: SupabaseClient, leadId: string | null) {
  const auth = await exigirUsuario(req)
  if (!auth.ok) return { erro: auth.resposta }

  const ctx = await obterContextoConta(supabase, auth.usuario)
  if (!leadId || !(await podeAcessarLead(supabase, ctx, leadId))) {
    return { erro: NextResponse.json({ error: 'Sem permissão para acessar este lead.' }, { status: 403 }) }
  }
  return { ctx }
}

async function leadDoCompromisso(supabase: SupabaseClient, id: string): Promise<string | null> {
  try {
    const { data } = await supabase.from('compromissos_leads').select('lead_id').eq('id', id).maybeSingle()
    if (data?.lead_id) return data.lead_id
  } catch {}
  try {
    if (fs.existsSync(BACKUP_FILE)) {
      const todos: { id: string; lead_id: string }[] = JSON.parse(fs.readFileSync(BACKUP_FILE, 'utf8') || '[]')
      return todos.find((item) => item.id === id)?.lead_id || null
    }
  } catch {}
  return null
}

// ── GET: Buscar compromissos do lead ──
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const leadId = searchParams.get('lead_id')

    if (!leadId) {
      return NextResponse.json({ error: 'lead_id é obrigatório.' }, { status: 400 })
    }

    const supabase = obterClienteSupabase()
    const permissao = await autorizarLead(req, supabase, leadId)
    if (permissao.erro) return permissao.erro
    let compromissos: any[] = []

    try {
      const { data, error } = await supabase
        .from('compromissos_leads')
        .select('*')
        .eq('lead_id', leadId)
        .order('data_hora', { ascending: true })

      if (!error && data && data.length > 0) {
        compromissos = data
      }
    } catch {}

    const locais = lerCompromissosLocais(leadId)
    if (locais.length > 0) {
      const idsJaPresentes = new Set(compromissos.map((c) => c.id))
      const complementares = locais.filter((l) => !idsJaPresentes.has(l.id))
      compromissos = [...compromissos, ...complementares].sort(
        (a, b) => new Date(a.data_hora).getTime() - new Date(b.data_hora).getTime()
      )
    }

    return NextResponse.json({ compromissos })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Erro ao buscar compromissos.' }, { status: 500 })
  }
}

// ── POST: Criar novo compromisso na agenda ──
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const {
      lead_id,
      titulo,
      tipo,
      data_hora,
      responsavel_id,
      responsavel_nome,
      responsavel_telefone,
    } = body

    if (!lead_id || !titulo || !data_hora) {
      return NextResponse.json({ error: 'lead_id, titulo e data_hora são obrigatórios.' }, { status: 400 })
    }

    const supabase = obterClienteSupabase()
    const permissao = await autorizarLead(req, supabase, lead_id)
    if (permissao.erro) return permissao.erro
    const usuario_autor_id = permissao.ctx.id
    const usuario_autor_nome = permissao.ctx.nome

    const novoCompromisso = {
      id: 'comp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      lead_id,
      titulo,
      tipo: tipo || 'visita',
      data_hora,
      concluido: false,
      responsavel_id: responsavel_id || usuario_autor_id || null,
      responsavel_nome: responsavel_nome || usuario_autor_nome || 'Responsável',
      responsavel_telefone: responsavel_telefone || '',
      created_at: new Date().toISOString(),
    }

    // 1. Salvar no backup local
    salvarCompromissoLocal(novoCompromisso)

    // 2. Salvar no Supabase se existir
    try {
      const { data, error } = await supabase
        .from('compromissos_leads')
        .insert({
          lead_id,
          titulo,
          tipo: tipo || 'visita',
          data_hora,
          concluido: false,
          responsavel_id: responsavel_id || null,
          responsavel_nome: responsavel_nome || null,
        })
        .select()
        .single()

      if (!error && data) {
        novoCompromisso.id = data.id
      }
    } catch {}

    // 3. Registrar na timeline de atividades
    const dataFormatada = new Date(data_hora).toLocaleString('pt-BR')
    const descricaoAtividade = `📅 Compromisso agendado: "${titulo}" para ${dataFormatada} (${responsavel_nome || 'Equipe'}).`

    try {
      await fetch(new URL('/api/painel/leads', req.url).toString(), {
        method: 'POST',
        headers: repassarSessao(req),
        body: JSON.stringify({
          lead_id,
          usuario_id: usuario_autor_id,
          usuario_nome: usuario_autor_nome,
          tipo: 'visita_agendada',
          descricao: descricaoAtividade,
        }),
      })
    } catch {}

    // 4. Se o tipo for visita, atualizar data_visita no lead
    if (tipo === 'visita') {
      try {
        await supabase
          .from('leads')
          .update({ data_visita: data_hora, status: 'visita_agendada' })
          .eq('id', lead_id)
      } catch {}
    }

    return NextResponse.json({ success: true, compromisso: novoCompromisso })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Erro ao agendar compromisso.' }, { status: 500 })
  }
}

// ── PATCH: Atualizar status de conclusão ou data do compromisso ──
export async function PATCH(req: Request) {
  try {
    const body = await req.json()
    const { compromisso_id, lead_id, concluido, data_hora, titulo } = body

    if (!compromisso_id) {
      return NextResponse.json({ error: 'compromisso_id é obrigatório.' }, { status: 400 })
    }

    const supabase = obterClienteSupabase()
    const permissao = await autorizarLead(req, supabase, await leadDoCompromisso(supabase, compromisso_id))
    if (permissao.erro) return permissao.erro

    // 1. Atualizar no backup local
    if (leadIdSafe(lead_id)) {
      const locais = lerCompromissosLocais(lead_id)
      const alvo = locais.find((c) => c.id === compromisso_id)
      if (alvo) {
        if (concluido !== undefined) alvo.concluido = concluido
        if (data_hora !== undefined) alvo.data_hora = data_hora
        if (titulo !== undefined) alvo.titulo = titulo
        salvarCompromissoLocal(alvo)
      }
    }

    // 2. Atualizar no Supabase
    try {
      const camposUpdate: Record<string, any> = {}
      if (concluido !== undefined) camposUpdate.concluido = concluido
      if (data_hora !== undefined) camposUpdate.data_hora = data_hora
      if (titulo !== undefined) camposUpdate.titulo = titulo

      await supabase.from('compromissos_leads').update(camposUpdate).eq('id', compromisso_id)
    } catch {}

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Erro ao atualizar compromisso.' }, { status: 500 })
  }
}

// ── DELETE: Remover compromisso ──
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const compromissoId = searchParams.get('compromisso_id')

    if (!compromissoId) {
      return NextResponse.json({ error: 'compromisso_id é obrigatório.' }, { status: 400 })
    }

    const supabase = obterClienteSupabase()
    const permissao = await autorizarLead(req, supabase, await leadDoCompromisso(supabase, compromissoId))
    if (permissao.erro) return permissao.erro

    removerCompromissoLocal(compromissoId)

    try {
      await supabase.from('compromissos_leads').delete().eq('id', compromissoId)
    } catch {}

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Erro ao excluir compromisso.' }, { status: 500 })
  }
}

function leadIdSafe(val: any): boolean {
  return typeof val === 'string' && val.length > 0
}
