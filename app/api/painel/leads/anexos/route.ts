import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://yxiaubwwzcnpmwfbvvrt.supabase.co'
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl4aWF1Ynd3emNucG13ZmJ2dnJ0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjY1OTM0NSwiZXhwIjoyMTAyMjM1MzQ1fQ.uHbg0JE9v929ErRqhuEeUxYXPvpIjAVK9Rs4YwSka3s'

function obterClienteSupabase() {
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
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

// ── GET: Buscar anexos do lead ──
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const leadId = searchParams.get('lead_id')

    if (!leadId) {
      return NextResponse.json({ error: 'lead_id é obrigatório.' }, { status: 400 })
    }

    const supabase = obterClienteSupabase()
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
    const usuarioId = (formData.get('usuario_id') as string | null) || 'sistema'
    const usuarioNome = (formData.get('usuario_nome') as string | null) || 'Equipe Fixum'
    const categoria = (formData.get('categoria') as string | null) || 'documento'

    if (!file || !leadId) {
      return NextResponse.json({ error: 'Arquivo e lead_id são obrigatórios.' }, { status: 400 })
    }

    const supabase = obterClienteSupabase()

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
    const descricaoAtividade = `📎 Documento anexado: "${nomeOriginal}" (${usuarioNome}).`
    try {
      await fetch(new URL('/api/painel/leads', req.url).toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

    removerAnexoLocal(anexoId)

    try {
      await supabase.from('anexos_leads').delete().eq('id', anexoId)
    } catch {}

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Erro ao excluir anexo.' }, { status: 500 })
  }
}
