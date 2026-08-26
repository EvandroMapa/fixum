import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { PLANOS_OFICIAIS } from '@/lib/planos'
import { ClienteAdmin360, CorretorEquipeItem, FaturaAdmin, CancelamentoAdmin, DevolucaoAdmin, ContestacaoAdmin } from '@/lib/admin-service'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://yxiaubwwzcnpmwfbvvrt.supabase.co'
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl4aWF1Ynd3emNucG13ZmJ2dnJ0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjY1OTM0NSwiZXhwIjoyMTAyMjM1MzQ1fQ.uHbg0JE9v929ErRqhuEeUxYXPvpIjAVK9Rs4YwSka3s'

export async function GET() {
  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // 1. Buscar todos os usuários do Auth (fonte da verdade de autenticação e metadados)
    const { data: authUsersData, error: authErr } = await supabase.auth.admin.listUsers()
    if (authErr) {
      return NextResponse.json({ error: authErr.message }, { status: 500 })
    }
    const authUsers = authUsersData.users || []

    // 2. Buscar Perfis
    const { data: perfisData } = await supabase.from('perfis').select('*')
    const listaPerfis = perfisData || []

    // 3. Buscar Imóveis
    const { data: imoveisData } = await supabase.from('imoveis').select('*').order('created_at', { ascending: false })
    const listaImoveis = imoveisData || []

    // 4. Buscar Assinaturas
    const { data: assinaturasData } = await supabase.from('assinaturas').select('*').order('created_at', { ascending: false })
    const listaAssinaturas = assinaturasData || []

    // 5. Buscar Faturas
    const { data: faturasData } = await supabase.from('faturas').select('*').order('created_at', { ascending: false })
    const listaFaturas = faturasData || []

    // 6. Buscar Devoluções
    const { data: devolucoesData } = await supabase.from('devolucoes_reembolsos').select('*').order('created_at', { ascending: false })

    // 7. Buscar Contestações
    const { data: contestacoesData } = await supabase.from('contestacoes_disputas').select('*').order('created_at', { ascending: false })

    // 8. Buscar Logs de Auditoria
    const { data: logsData } = await supabase.from('logs_auditoria_admin').select('*').order('created_at', { ascending: false }).limit(100)

    // 9. Buscar Configurações
    const { data: configsData } = await supabase.from('configuracoes_sistema').select('*')

    // Mapa de Perfis por ID
    const perfisMap: Record<string, any> = {}
    listaPerfis.forEach((p) => {
      perfisMap[p.id] = p
    })

    // Sincronizar e mesclar Auth Users + Perfis
    const usuariosCompletos: any[] = authUsers.map((u) => {
      const p = perfisMap[u.id] || {}
      const meta = u.user_metadata || {}

      const tipoReal = meta.tipo || meta.tipo_anunciante || p.tipo_anunciante || (meta.imobiliaria_id ? 'corretor' : 'proprietario')
      const imobIdReal = meta.imobiliaria_id || p.imobiliaria_id || null
      const nomeReal = p.nome || meta.nome || meta.full_name || meta.nome_fantasia || u.email?.split('@')[0] || 'Anunciante'

      return {
        id: u.id,
        email: u.email || p.email || '',
        nome: nomeReal,
        telefone: p.telefone || meta.telefone || meta.whatsapp,
        whatsapp: p.whatsapp || meta.whatsapp || meta.telefone,
        cpf_cnpj: p.cpf_cnpj || meta.cpf_cnpj || meta.cpf || meta.cnpj,
        creci: p.creci || meta.creci,
        cidade: p.cidade || meta.cidade,
        uf: p.uf || meta.uf || meta.estado,
        tipo_anunciante: tipoReal,
        imobiliaria_id: imobIdReal,
        status_conta: p.status_conta || 'ativo',
        notas_admin: p.notas_admin,
        motivo_suspensao: p.motivo_suspensao,
        created_at: u.created_at || p.created_at,
        plano_id: p.plano_id || meta.plano_id || 'gratis',
      }
    })

    // Sincronizar assincronamente a tabela perfis com o banco
    for (const u of usuariosCompletos) {
      if (!perfisMap[u.id] || perfisMap[u.id].tipo_anunciante !== u.tipo_anunciante || perfisMap[u.id].imobiliaria_id !== u.imobiliaria_id) {
        await supabase.from('perfis').upsert({
          id: u.id,
          email: u.email,
          nome: u.nome,
          telefone: u.telefone,
          whatsapp: u.whatsapp,
          cidade: u.cidade,
          uf: u.uf,
          creci: u.creci,
          tipo_anunciante: u.tipo_anunciante,
          imobiliaria_id: u.imobiliaria_id,
          status_conta: u.status_conta,
        }, { onConflict: 'id' }).select()
      }
    }

    // Mapa de Nomes e Tipos
    const mapaNomes: Record<string, { nome: string; email: string; tel?: string; cidade?: string; tipo: string; imobId?: string | null }> = {}
    usuariosCompletos.forEach((u) => {
      mapaNomes[u.id] = {
        nome: u.nome,
        email: u.email,
        tel: u.telefone || u.whatsapp,
        cidade: u.cidade,
        tipo: u.tipo_anunciante,
        imobId: u.imobiliaria_id,
      }
    })

    // Mapa de Imóveis Diretos
    const contagemDiretaImoveis: Record<string, { total: number; ativos: number; destaques: number }> = {}
    listaImoveis.forEach((im: any) => {
      const uid = im.anunciante_id
      if (!contagemDiretaImoveis[uid]) contagemDiretaImoveis[uid] = { total: 0, ativos: 0, destaques: 0 }
      contagemDiretaImoveis[uid].total += 1
      if (im.status === 'ativo' || im.status === 'publicado') contagemDiretaImoveis[uid].ativos += 1
      if (im.destaque) contagemDiretaImoveis[uid].destaques += 1
    })

    // Mapa de Faturas por Usuário
    const faturasPorUsuario: Record<string, { totalPagas: number; totalGasto: number; temAtraso: boolean }> = {}
    listaFaturas.forEach((f: any) => {
      const uid = f.usuario_id
      if (!faturasPorUsuario[uid]) faturasPorUsuario[uid] = { totalPagas: 0, totalGasto: 0, temAtraso: false }
      if (f.status === 'pago') {
        faturasPorUsuario[uid].totalPagas += 1
        faturasPorUsuario[uid].totalGasto += (Number(f.valor) || 0)
      }
      if (f.status === 'atrasado') {
        faturasPorUsuario[uid].temAtraso = true
      }
    })

    // Mapa de Assinaturas
    const mapaAssinaturas: Record<string, any> = {}
    listaAssinaturas.forEach((a: any) => {
      mapaAssinaturas[a.usuario_id] = a
    })

    // Mapear Equipe por Imobiliária
    const equipePorImobiliaria: Record<string, CorretorEquipeItem[]> = {}
    usuariosCompletos.forEach((u) => {
      if (u.imobiliaria_id) {
        if (!equipePorImobiliaria[u.imobiliaria_id]) {
          equipePorImobiliaria[u.imobiliaria_id] = []
        }
        const cDireta = contagemDiretaImoveis[u.id] || { total: 0, ativos: 0, destaques: 0 }
        equipePorImobiliaria[u.imobiliaria_id].push({
          id: u.id,
          nome: u.nome,
          email: u.email,
          telefone: u.telefone,
          creci: u.creci,
          total_imoveis: cDireta.total,
          imoveis_ativos: cDireta.ativos,
        })
      }
    })

    // Formatar Clientes 360° Consolidando Imóveis
    const clientesFormatados: ClienteAdmin360[] = usuariosCompletos.map((u) => {
      const isCorretorVinculado = !!u.imobiliaria_id
      const imobDonaNome = u.imobiliaria_id ? (mapaNomes[u.imobiliaria_id]?.nome || 'Imobiliária Vinculada') : undefined

      const cDireta = contagemDiretaImoveis[u.id] || { total: 0, ativos: 0, destaques: 0 }
      let totalImoveisConsolidado = cDireta.total
      let imoveisAtivosConsolidado = cDireta.ativos
      let imoveisDestaqueConsolidado = cDireta.destaques
      let totalImoveisEquipe = 0

      // Se for Imobiliária, consolidar com toda a equipe
      if (u.tipo_anunciante === 'imobiliaria') {
        const membros = equipePorImobiliaria[u.id] || []
        membros.forEach((m) => {
          const cMembro = contagemDiretaImoveis[m.id] || { total: 0, ativos: 0, destaques: 0 }
          totalImoveisConsolidado += cMembro.total
          imoveisAtivosConsolidado += cMembro.ativos
          imoveisDestaqueConsolidado += cMembro.destaques
          totalImoveisEquipe += cMembro.total
        })
      }

      const idContaDona = isCorretorVinculado ? u.imobiliaria_id : u.id
      const ass = mapaAssinaturas[idContaDona]
      const planoId = ass?.plano_id || (isCorretorVinculado ? 'imobiliaria' : (u.plano_id || 'gratis'))
      const planoObj = PLANOS_OFICIAIS.find((pl) => pl.id === planoId)
      const statsFat = faturasPorUsuario[u.id] || { totalPagas: 0, totalGasto: 0, temAtraso: false }

      return {
        id: u.id,
        nome: u.nome,
        email: u.email,
        telefone: u.telefone,
        whatsapp: u.whatsapp,
        cpf_cnpj: u.cpf_cnpj,
        creci: u.creci,
        tipo_anunciante: u.tipo_anunciante,
        status_conta: u.status_conta,
        plano_id: planoId,
        plano_nome: isCorretorVinculado ? `🏢 Corporativo (${imobDonaNome})` : (planoObj?.nome || planoId),
        plano_preco: isCorretorVinculado ? 0 : (planoObj?.preco_mensal || 0),
        cidade: u.cidade || (listaImoveis.find((i: any) => i.anunciante_id === u.id)?.cidade) || '',
        uf: u.uf || (listaImoveis.find((i: any) => i.anunciante_id === u.id)?.estado) || '',
        notas_admin: u.notas_admin,
        motivo_suspensao: u.motivo_suspensao,
        
        // Métricas Consolidadas de Imóveis
        total_imoveis: totalImoveisConsolidado,
        imoveis_ativos: imoveisAtivosConsolidado,
        imoveis_destaque: imoveisDestaqueConsolidado,
        imoveis_diretos: cDireta.total,
        imoveis_equipe: totalImoveisEquipe,

        total_faturas_pagas: isCorretorVinculado ? 0 : statsFat.totalPagas,
        valor_total_gasto: isCorretorVinculado ? 0 : statsFat.totalGasto,
        tem_inadimplencia: statsFat.temAtraso,
        created_at: u.created_at,

        imobiliaria_id: u.imobiliaria_id,
        imobiliaria_nome: imobDonaNome,
        is_corretor_vinculado: isCorretorVinculado,
        corretores_equipe: u.tipo_anunciante === 'imobiliaria' ? (equipePorImobiliaria[u.id] || []) : undefined,
      }
    })

    // Formatar Faturas
    const faturasFormatadas: FaturaAdmin[] = listaFaturas.map((f: any) => {
      const usu = mapaNomes[f.usuario_id] || { nome: 'Anunciante', email: '' }
      const ass = mapaAssinaturas[f.usuario_id]
      const planoObj = PLANOS_OFICIAIS.find((p) => p.id === (ass?.plano_id || 'gratis'))

      return {
        id: f.id,
        assinatura_id: f.assinatura_id,
        usuario_id: f.usuario_id,
        usuario_nome: usu.nome,
        usuario_email: usu.email,
        usuario_telefone: usu.tel,
        plano_id: ass?.plano_id || 'gratis',
        plano_nome: planoObj?.nome || 'Plano Fixum',
        valor: Number(f.valor) || 0,
        status: f.status || 'pendente',
        metodo_pagamento: f.metodo_pagamento || 'pix',
        data_vencimento: f.data_vencimento,
        data_pagamento: f.data_pagamento,
        asaas_payment_id: f.asaas_payment_id,
        asaas_invoice_url: f.asaas_invoice_url,
        comprovante_url: f.comprovante_url,
        cidade_origem: f.cidade_origem || usu.cidade,
        uf_origem: f.uf_origem,
        motivo_estorno: f.motivo_estorno,
        estornado_em: f.estornado_em,
        created_at: f.created_at,
      }
    })

    // Formatar Cancelamentos
    const cancelamentosFormatados: CancelamentoAdmin[] = listaAssinaturas
      .filter((a: any) => a.status === 'cancelado' || a.cancelado_em)
      .map((a: any) => {
        const usu = mapaNomes[a.usuario_id] || { nome: 'Anunciante', email: '' }
        const planoObj = PLANOS_OFICIAIS.find((p) => p.id === a.plano_id)
        return {
          id: a.id,
          usuario_id: a.usuario_id,
          usuario_nome: usu.nome,
          usuario_email: usu.email,
          plano_id: a.plano_id,
          plano_nome: planoObj?.nome || a.plano_id,
          valor_plano: planoObj?.preco_mensal || 0,
          motivo_cancelamento: a.motivo_cancelamento || 'Rescisão de assinatura',
          data_inicio: a.data_inicio,
          cancelado_em: a.cancelado_em || a.updated_at,
          cidade_origem: a.cidade_origem || usu.cidade,
        }
      })

    // Formatar Imóveis identificando Imobiliária Titular e Corretor Operador
    const imoveisFormatados = listaImoveis.map((im: any) => {
      const anunciantePerfil = mapaNomes[im.anunciante_id]
      const isCorretorDeEquipe = !!anunciantePerfil?.imobId
      const imobDona = isCorretorDeEquipe ? mapaNomes[anunciantePerfil.imobId!] : null

      return {
        ...im,
        anunciante_nome: isCorretorDeEquipe && imobDona
          ? imobDona.nome
          : (anunciantePerfil?.nome || 'Anunciante Fixum'),
        cadastrado_por_nome: isCorretorDeEquipe ? anunciantePerfil?.nome : undefined,
        is_equipe: isCorretorDeEquipe,
      }
    })

    return NextResponse.json({
      clientes: clientesFormatados,
      faturas: faturasFormatadas,
      cancelamentos: cancelamentosFormatados,
      devolucoes: devolucoesData || [],
      contestacoes: contestacoesData || [],
      imoveis: imoveisFormatados,
      logsAuditoria: logsData || [],
      configs: configsData || [],
    })
  } catch (err: any) {
    console.error('[API-ADMIN-DADOS-ERROR]:', err)
    return NextResponse.json({ error: err?.message || 'Erro ao carregar dados do admin' }, { status: 500 })
  }
}
