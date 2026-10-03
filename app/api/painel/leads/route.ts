import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { salvarMetadadosLead } from '@/lib/leadsMetadata'
import { criarClienteAdmin } from '@/lib/supabase/admin'
import { exigirUsuario } from '@/lib/auth/servidor'
import { obterContextoConta, podeAcessarLead } from '@/lib/auth/contexto-conta'

function obterClienteSupabase() {
  return criarClienteAdmin()
}

// ── AUXILIAR: ARMAZENAMENTO PERSISTENTE LOCAL DE ATIVIDADES ──
const BACKUP_FILE = path.resolve(process.cwd(), 'data_atividades_leads.json')

function lerAtividadesLocais(leadId: string): any[] {
  try {
    if (!fs.existsSync(BACKUP_FILE)) return []
    const conteudo = fs.readFileSync(BACKUP_FILE, 'utf8')
    const todas: any[] = JSON.parse(conteudo || '[]')
    return todas.filter((a) => a.lead_id === leadId)
  } catch {
    return []
  }
}

function salvarAtividadeLocal(nova: any) {
  try {
    let todas: any[] = []
    if (fs.existsSync(BACKUP_FILE)) {
      todas = JSON.parse(fs.readFileSync(BACKUP_FILE, 'utf8') || '[]')
    }
    todas.unshift(nova)
    fs.writeFileSync(BACKUP_FILE, JSON.stringify(todas, null, 2), 'utf8')
  } catch (e) {
    console.error('Erro ao salvar em arquivo local:', e)
  }
}

// ── GET: Buscar histórico de atividades de um lead específico ──
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const leadId = searchParams.get('lead_id')

    if (!leadId) {
      return NextResponse.json({ error: 'lead_id é obrigatório.' }, { status: 400 })
    }

    const auth = await exigirUsuario(req)
    if (!auth.ok) return auth.resposta

    const supabase = obterClienteSupabase()
    const ctx = await obterContextoConta(supabase, auth.usuario)
    if (!(await podeAcessarLead(supabase, ctx, leadId))) {
      return NextResponse.json({ error: 'Sem permissão para acessar este lead.' }, { status: 403 })
    }

    let atividades: any[] = []

    // 1. Tentar buscar no Supabase
    try {
      const { data, error } = await supabase
        .from('atividades_leads')
        .select('*')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false })

      if (!error && data && data.length > 0) {
        atividades = data
      }
    } catch {}

    // 2. Se vazio ou tabela ainda não criada, mesclar com o backup local
    const locais = lerAtividadesLocais(leadId)
    if (locais.length > 0) {
      const idsJaPresentes = new Set(atividades.map((a) => a.id))
      const complementares = locais.filter((l) => !idsJaPresentes.has(l.id))
      atividades = [...atividades, ...complementares].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
    }

    return NextResponse.json({ atividades })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Erro ao buscar atividades do lead.' }, { status: 500 })
  }
}

// ── PATCH: Atualizar status, 1º contato, corretor, visita ou proposta do lead ──
export async function PATCH(req: Request) {
  try {
    const body = await req.json()
    const {
      lead_id,
      status,
      corretor_id,
      corretor_nome,
      primeiro_contato,
      data_visita,
      valor_proposta,
      valor_fechamento,
      motivo_perda,
      temperatura,
      status_homologacao,
      homologado_por_id,
      homologado_por_nome,
      data_homologacao,
      motivo_rejeicao_homologacao,
      arquivado,
      data_arquivamento,
      mensagem_atividade,
    } = body

    if (!lead_id) {
      return NextResponse.json({ error: 'lead_id é obrigatório.' }, { status: 400 })
    }

    const auth = await exigirUsuario(req)
    if (!auth.ok) return auth.resposta

    const supabaseAuth = obterClienteSupabase()
    const ctx = await obterContextoConta(supabaseAuth, auth.usuario)
    if (!(await podeAcessarLead(supabaseAuth, ctx, lead_id))) {
      return NextResponse.json({ error: 'Sem permissão para alterar este lead.' }, { status: 403 })
    }

    // Corretor vinculado (não gestor) não pode homologar vendas nem repassar o lead para outra pessoa
    const corretorSemGestao = ctx.isCorretorVinculado && !ctx.isGestor
    const homologando = status_homologacao === 'aprovado' || status_homologacao === 'rejeitado'
    const repassando = corretor_id !== undefined && corretor_id !== ctx.id
    if (corretorSemGestao && (homologando || repassando)) {
      return NextResponse.json({ error: 'Permissão negada: ação exclusiva de gestores.' }, { status: 403 })
    }

    // 1. Salvar metadados enriquecidos (proposta, visita, corretor, temperatura, homologação, etc.)
    const metaSalva: Record<string, any> = {}
    if (valor_proposta !== undefined) metaSalva.valor_proposta = valor_proposta
    if (valor_fechamento !== undefined) metaSalva.valor_fechamento = valor_fechamento
    if (data_visita !== undefined) metaSalva.data_visita = data_visita
    if (corretor_id !== undefined) metaSalva.corretor_id = corretor_id
    if (corretor_nome !== undefined) metaSalva.corretor_nome = corretor_nome
    if (motivo_perda !== undefined) metaSalva.motivo_perda = motivo_perda
    if (temperatura !== undefined) metaSalva.temperatura = temperatura
    if (status_homologacao !== undefined) metaSalva.status_homologacao = status_homologacao
    if (homologado_por_id !== undefined) metaSalva.homologado_por_id = homologado_por_id
    if (homologado_por_nome !== undefined) metaSalva.homologado_por_nome = homologado_por_nome
    if (homologando) {
      // Quem homologa é sempre o usuário autenticado
      metaSalva.homologado_por_id = ctx.id
      metaSalva.homologado_por_nome = ctx.nome
    }
    if (data_homologacao !== undefined) metaSalva.data_homologacao = data_homologacao
    if (motivo_rejeicao_homologacao !== undefined) metaSalva.motivo_rejeicao_homologacao = motivo_rejeicao_homologacao
    if (arquivado !== undefined) metaSalva.arquivado = arquivado
    if (data_arquivamento !== undefined) metaSalva.data_arquivamento = data_arquivamento

    if (primeiro_contato) {
      metaSalva.data_primeiro_contato = new Date().toISOString()
    }
    metaSalva.data_ultimo_contato = new Date().toISOString()

    salvarMetadadosLead(lead_id, metaSalva)

    // 2. Atualizar status na tabela leads no Supabase (se houver alteração de status)
    const supabase = obterClienteSupabase()
    const novoStatusFinal =
      status ||
      (valor_proposta ? 'proposta' : null) ||
      (data_visita ? 'visita_agendada' : null) ||
      (motivo_perda ? 'perdido' : null) ||
      (primeiro_contato ? 'em_contato' : null)

    if (novoStatusFinal) {
      try {
        await supabase
          .from('leads')
          .update({ status: novoStatusFinal })
          .eq('id', lead_id)
      } catch (errDb) {
        console.error('Aviso ao atualizar status no banco:', errDb)
      }
    }

    // Registrar no histórico de atividades
    const autorId = ctx.id
    const autorNome = ctx.nome
    let tipoAtividade = 'mudanca_status'
    let descricaoAtividade = mensagem_atividade || ''

    if (status_homologacao === 'aprovado') {
      tipoAtividade = 'homologacao_venda'
      descricaoAtividade = descricaoAtividade || `🏆 Venda homologada e aprovada pelo Gestor ${autorNome}.`
    } else if (status_homologacao === 'rejeitado') {
      tipoAtividade = 'rejeicao_homologacao'
      descricaoAtividade = descricaoAtividade || `⚠️ Homologação de venda rejeitada pelo Gestor ${autorNome}.`
    } else if (primeiro_contato) {
      tipoAtividade = 'contato_whatsapp'
      descricaoAtividade = descricaoAtividade || 'Primeiro contato realizado via WhatsApp.'
    } else if (corretor_id !== undefined && corretor_nome) {
      tipoAtividade = 'reatribuicao'
      descricaoAtividade = descricaoAtividade || `Lead atribuído ao corretor ${corretor_nome}.`
    } else if (data_visita) {
      tipoAtividade = 'visita_agendada'
      const dataFormatada = new Date(data_visita).toLocaleString('pt-BR')
      descricaoAtividade = descricaoAtividade || `Visita agendada para ${dataFormatada}.`
    } else if (valor_proposta) {
      tipoAtividade = 'proposta'
      descricaoAtividade = descricaoAtividade || `Proposta de R$ ${Number(valor_proposta).toLocaleString('pt-BR')} registrada.`
    } else if (status) {
      tipoAtividade = 'mudanca_status'
      descricaoAtividade = descricaoAtividade || `Status alterado para "${status.replace(/_/g, ' ')}".`
    }

    if (descricaoAtividade) {
      const novaAtiv = {
        id: 'ativ_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        lead_id,
        autor_id: autorId,
        autor_nome: autorNome,
        tipo: tipoAtividade,
        descricao: descricaoAtividade,
        created_at: new Date().toISOString(),
      }

      salvarAtividadeLocal(novaAtiv)

      try {
        await supabase.from('atividades_leads').insert({
          lead_id,
          autor_id: autorId,
          autor_nome: autorNome,
          tipo: tipoAtividade,
          descricao: descricaoAtividade,
        })
      } catch {}
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Erro ao atualizar lead.' }, { status: 500 })
  }
}

// ── POST: Inserir nova anotação / atividade manual ──
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { lead_id, tipo, descricao } = body

    if (!lead_id || !descricao) {
      return NextResponse.json({ error: 'lead_id e descricao são obrigatórios.' }, { status: 400 })
    }

    const auth = await exigirUsuario(req)
    if (!auth.ok) return auth.resposta

    const supabase = obterClienteSupabase()
    const ctx = await obterContextoConta(supabase, auth.usuario)
    if (!(await podeAcessarLead(supabase, ctx, lead_id))) {
      return NextResponse.json({ error: 'Sem permissão para acessar este lead.' }, { status: 403 })
    }

    // Autor sempre é o usuário autenticado
    const usuario_id = ctx.id
    const usuario_nome = ctx.nome

    const novaAtividadeObj = {
      id: 'ativ_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      lead_id,
      autor_id: usuario_id || 'sistema',
      autor_nome: usuario_nome || 'Equipe Fixum',
      tipo: tipo || 'anotacao',
      descricao,
      created_at: new Date().toISOString(),
    }

    // Salvar no backup resiliente
    salvarAtividadeLocal(novaAtividadeObj)

    // Tentar salvar no Supabase se a tabela existir
    try {
      const { data, error } = await supabase
        .from('atividades_leads')
        .insert({
          lead_id,
          autor_id: usuario_id || 'sistema',
          autor_nome: usuario_nome || 'Equipe Fixum',
          tipo: tipo || 'anotacao',
          descricao,
        })
        .select()
        .single()

      if (!error && data) {
        novaAtividadeObj.id = data.id
      }
    } catch {}

    // Atualizar data de último contato no lead
    try {
      await supabase
        .from('leads')
        .update({ data_ultimo_contato: new Date().toISOString() })
        .eq('id', lead_id)
    } catch {}

    return NextResponse.json({ success: true, atividade: novaAtividadeObj })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Erro ao registrar anotação.' }, { status: 500 })
  }
}
