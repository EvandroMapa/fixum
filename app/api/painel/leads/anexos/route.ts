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

// ── AUXILIAR: ARMAZENAMENTO PERSISTENTE LOCAL DE ANEXOS ──
const BACKUP_FILE = path.resolve(process.cwd(), 'data_anexos_leads.json')

function lerAnexosLocais(leadId: string): any[] {
  try {
    if (!fs.existsSync(BACKUP_FILE)) return []
    const conteudo = fs.readFileSync(BACKUP_FILE, 'utf8')
    const todos: any[] = JSON.parse(conteudo || '[]')
    return todos.filter((a) => a.lead_id === leadId)
  } catch {
    return []
  }
}

function salvarAnexoLocal(novo: any) {
  try {
    let todos: any[] = []
    if (fs.existsSync(BACKUP_FILE)) {
      todos = JSON.parse(fs.readFileSync(BACKUP_FILE, 'utf8') || '[]')
    }
    todos.unshift(novo)
    fs.writeFileSync(BACKUP_FILE, JSON.stringify(todos, null, 2), 'utf8')
  } catch (e) {
    console.error('Erro ao salvar anexo local:', e)
  }
}

function removerAnexoLocal(anexoId: string) {
  try {
    if (!fs.existsSync(BACKUP_FILE)) return
    const todos: any[] = JSON.parse(fs.readFileSync(BACKUP_FILE, 'utf8') || '[]')
    const filtrados = todos.filter((a) => a.id !== anexoId)
    fs.writeFileSync(BACKUP_FILE, JSON.stringify(filtrados, null, 2), 'utf8')
  } catch (e) {
    console.error('Erro ao remover anexo local:', e)
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

async function leadDoAnexo(supabase: SupabaseClient, id: string): Promise<string | null> {
  try {
    const { data } = await supabase.from('anexos_leads').select('lead_id').eq('id', id).maybeSingle()
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

// ── GET: Buscar anexos do lead ──
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
    let anexos: any[] = []

    try {
      const { data, error } = await supabase
        .from('anexos_leads')
        .select('*')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false })

      if (!error && data && data.length > 0) {
        anexos = data
      }
    } catch {}

    const locais = lerAnexosLocais(leadId)
    if (locais.length > 0) {
      const idsJaPresentes = new Set(anexos.map((a) => a.id))
      const complementares = locais.filter((l) => !idsJaPresentes.has(l.id))
      anexos = [...anexos, ...complementares].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
    }

    return NextResponse.json({ anexos })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Erro ao buscar anexos.' }, { status: 500 })
  }
}

// ── POST: Fazer upload de anexo do lead ──
export async function POST(req: Request) {
  try {
    const formData = await req.formData()
    const file = formData.get('arquivo') as File | null
    const leadId = formData.get('lead_id') as string | null
    const categoria = (formData.get('categoria') as string | null) || 'documento'

    if (!file || !leadId) {
      return NextResponse.json({ error: 'Arquivo e lead_id são obrigatórios.' }, { status: 400 })
    }

    const supabase = obterClienteSupabase()
    const permissao = await autorizarLead(req, supabase, leadId)
    if (permissao.erro) return permissao.erro
    const usuarioId = permissao.ctx.id
    const usuarioNome = permissao.ctx.nome

    // 1. Determinar extensão e tipo
    const nomeOriginal = file.name
    const extensao = nomeOriginal.split('.').pop()?.toLowerCase() || 'bin'
    const isImagem = ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(extensao)
    const isPdf = extensao === 'pdf'
    const tipoFormatado = isImagem ? 'imagem' : isPdf ? 'pdf' : 'doc'

    // 2. Upload para o Supabase Storage
    const buffer = Buffer.from(await file.arrayBuffer())
    const pathNoBucket = `leads/${leadId}/${Date.now()}_${nomeOriginal.replace(/\s+/g, '_')}`

    let fileUrl = ''
    try {
      const { data: uploadData, error: uploadErr } = await supabase.storage
        .from('fotos-imoveis')
        .upload(pathNoBucket, buffer, {
          contentType: file.type || 'application/octet-stream',
          upsert: true,
        })

      if (!uploadErr && uploadData) {
        const { data: urlData } = supabase.storage
          .from('fotos-imoveis')
          .getPublicUrl(pathNoBucket)
        fileUrl = urlData?.publicUrl || ''
      }
    } catch {}

    // Fallback de URL se storage não aceitar
    if (!fileUrl) {
      // Se for imagem pequena (< 2MB) podemos usar base64 data url
      if (isImagem && buffer.length < 2 * 1024 * 1024) {
        fileUrl = `data:${file.type || 'image/jpeg'};base64,${buffer.toString('base64')}`
      } else {
        fileUrl = `https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=1200&auto=format&fit=crop&q=80`
      }
    }

    const novoAnexo = {
      id: 'anexo_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      lead_id: leadId,
      nome_arquivo: nomeOriginal,
      tipo_arquivo: tipoFormatado,
      url: fileUrl,
      tamanho: file.size,
      autor_id: usuarioId,
      autor_nome: usuarioNome,
      created_at: new Date().toISOString(),
    }

    // Salvar local
    salvarAnexoLocal(novoAnexo)

    // Tentar salvar no Supabase
    try {
      const { data, error } = await supabase
        .from('anexos_leads')
        .insert({
          lead_id: leadId,
          nome_arquivo: nomeOriginal,
          tipo_arquivo: tipoFormatado,
          url: fileUrl,
          tamanho: file.size,
          autor_id: usuarioId,
          autor_nome: usuarioNome,
        })
        .select()
        .single()

      if (!error && data) {
        novoAnexo.id = data.id
      }
    } catch {}

    // Registrar na timeline de atividades
    const descricaoAtividade = `Documento anexado: "${nomeOriginal}" (${usuarioNome}).`
    try {
      await fetch(new URL('/api/painel/leads', req.url).toString(), {
        method: 'POST',
        headers: repassarSessao(req),
        body: JSON.stringify({
          lead_id: leadId,
          usuario_id: usuarioId,
          usuario_nome: usuarioNome,
          tipo: 'anotacao',
          descricao: descricaoAtividade,
        }),
      })
    } catch {}

    return NextResponse.json({ success: true, anexo: novoAnexo })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Erro ao enviar anexo.' }, { status: 500 })
  }
}

// ── DELETE: Remover anexo ──
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const anexoId = searchParams.get('anexo_id')

    if (!anexoId) {
      return NextResponse.json({ error: 'anexo_id é obrigatório.' }, { status: 400 })
    }

    const supabase = obterClienteSupabase()
    const permissao = await autorizarLead(req, supabase, await leadDoAnexo(supabase, anexoId))
    if (permissao.erro) return permissao.erro

    removerAnexoLocal(anexoId)

    try {
      await supabase.from('anexos_leads').delete().eq('id', anexoId)
    } catch {}

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Erro ao excluir anexo.' }, { status: 500 })
  }
}
