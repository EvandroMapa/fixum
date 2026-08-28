'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { type Lead } from '@/lib/types'
import { formatarPreco, formatarTelefone } from '@/lib/utils'
import ModalDetalhesLead from './ModalDetalhesLead'
import styles from './AbaLeads.module.css'

interface Props {
  leads: Lead[]
  usuarioId: string
  usuarioNome: string
  isGestor: boolean
  isImobiliaria: boolean
  listaCorretores: { id: string; nome: string }[]
  onRecarregarDados: () => void
  onAtualizarLeads?: (novosLeads: Lead[]) => void
}

type ModoVisualizacao = 'kanban' | 'lista'
type FiltroStatusPipeline = 'abertos' | 'fechados' | 'perdidos' | 'arquivados'

const ETAPAS_KANBAN_ATIVAS = [
  { id: 'novo', titulo: 'Novos', icone: '📥', cor: '#3b82f6' },
  { id: 'em_contato', titulo: 'Em Contato', icone: '💬', cor: '#0284c7' },
  { id: 'visita_agendada', titulo: 'Visita Agendada', icone: '📅', cor: '#8b5cf6' },
  { id: 'proposta', titulo: 'Proposta', icone: '💰', cor: '#f59e0b' },
  { id: 'negociacao', titulo: 'Em Negociação', icone: '🤝', cor: '#ea580c' },
]

export default function AbaLeads({
  leads,
  usuarioId,
  usuarioNome,
  isGestor,
  isImobiliaria,
  listaCorretores,
  onRecarregarDados,
  onAtualizarLeads,
}: Props) {
  const [leadsLocais, setLeadsLocais] = useState<Lead[]>(leads)

  useEffect(() => {
    setLeadsLocais(leads)
  }, [leads])

  const [modoVisualizacao, setModoVisualizacao] = useState<ModoVisualizacao>('kanban')
  const [filtroStatusPipeline, setFiltroStatusPipeline] = useState<FiltroStatusPipeline>('abertos')
  const [filtroCorretor, setFiltroCorretor] = useState<string>('todos')
  const [filtroImovel, setFiltroImovel] = useState<string>('todos')
  const [buscaTexto, setBuscaTexto] = useState<string>('')
  const [leadSelecionado, setLeadSelecionado] = useState<Lead | null>(null)

  // Drag and Drop
  const [arrastandoLeadId, setArrastandoLeadId] = useState<string | null>(null)
  const [colunaHoverId, setColunaHoverId] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<{ etapaId: string; index: number } | null>(null)
  const [dropZoneRodapeHover, setDropZoneRodapeHover] = useState<'fechado' | 'perdido' | null>(null)

  // Modais de Ação Rápida no Drop
  const [leadParaFechamento, setLeadParaFechamento] = useState<Lead | null>(null)
  const [valorFechamentoInput, setValorFechamentoInput] = useState<string>('')
  const [leadParaPerda, setLeadParaPerda] = useState<Lead | null>(null)
  const [motivoPerdaInput, setMotivoPerdaInput] = useState<string>('Sem resposta do cliente')
  const [processandoAcao, setProcessandoAcao] = useState(false)

  const [atualizandoManual, setAtualizandoManual] = useState(false)
  const [distribuindoRoleta, setDistribuindoRoleta] = useState(false)

  const kanbanRef = useRef<HTMLDivElement>(null)

  const handleKanbanWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (kanbanRef.current && e.shiftKey && e.deltaY !== 0) {
      e.preventDefault()
      kanbanRef.current.scrollLeft += e.deltaY * 1.5
    }
  }

  async function handleRecarregarManual() {
    setAtualizandoManual(true)
    try {
      if (onRecarregarDados) {
        await onRecarregarDados()
      }
    } finally {
      setTimeout(() => setAtualizandoManual(false), 600)
    }
  }

  const onRecarregarRef = useRef(onRecarregarDados)
  useEffect(() => {
    onRecarregarRef.current = onRecarregarDados
  })

  // Inscrição Realtime
  useEffect(() => {
    const supabase = createClient()
    const canalLeads = supabase
      .channel('realtime-aba-leads-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'leads' },
        () => {
          if (onRecarregarRef.current) onRecarregarRef.current()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(canalLeads)
    }
  }, [])

  // Contagens do Pipeline
  const contagensPipeline = useMemo(() => {
    let abertos = 0
    let fechados = 0
    let perdidos = 0
    let arquivados = 0

    leadsLocais.forEach((l) => {
      if (l.arquivado || l.status === 'arquivado') {
        arquivados++
      } else if (l.status === 'fechado') {
        fechados++
      } else if (l.status === 'perdido') {
        perdidos++
      } else {
        abertos++
      }
    })

    return {
      abertos,
      fechados,
      perdidos,
      arquivados,
      todos: leadsLocais.length,
    }
  }, [leadsLocais])

  // Leads não atribuídos (Triagem)
  const leadsNaoAtribuidos = useMemo(() => {
    return leadsLocais.filter(
      (l) =>
        (!l.arquivado && l.status !== 'arquivado') &&
        (!l.corretor_id ||
          l.corretor_id === 'gestao' ||
          l.corretor_nome === 'Gestão da Imobiliária' ||
          l.corretor_nome === 'Equipe')
    )
  }, [leadsLocais])

  // Imóveis únicos para filtro
  const listaImoveisFiltro = useMemo(() => {
    const mapa = new Map<string, string>()
    leadsLocais.forEach((l) => {
      if (l.imovel_id && l.imovel?.titulo) {
        mapa.set(l.imovel_id, l.imovel.titulo)
      }
    })
    return Array.from(mapa.entries()).map(([id, titulo]) => ({ id, titulo }))
  }, [leadsLocais])

  // Leads Filtrados
  const leadsFiltrados = useMemo(() => {
    return leadsLocais.filter((lead) => {
      const isArquivado = lead.arquivado || lead.status === 'arquivado'
      if (filtroStatusPipeline === 'abertos') {
        if (isArquivado || lead.status === 'fechado' || lead.status === 'perdido') return false
      } else if (filtroStatusPipeline === 'fechados') {
        if (isArquivado || lead.status !== 'fechado') return false
      } else if (filtroStatusPipeline === 'perdidos') {
        if (isArquivado || lead.status !== 'perdido') return false
      } else if (filtroStatusPipeline === 'arquivados') {
        if (!isArquivado) return false
      }

      if (filtroCorretor === 'nao_atribuidos') {
        const isNaoAtribuido =
          !lead.corretor_id ||
          lead.corretor_id === 'gestao' ||
          lead.corretor_nome === 'Gestão da Imobiliária' ||
          lead.corretor_nome === 'Equipe'
        if (!isNaoAtribuido) return false
      } else if (filtroCorretor !== 'todos' && lead.corretor_id !== filtroCorretor) {
        return false
      }

      if (filtroImovel !== 'todos' && lead.imovel_id !== filtroImovel) {
        return false
      }

      if (buscaTexto.trim()) {
        const termo = buscaTexto.toLowerCase()
        const matchNome = lead.nome?.toLowerCase().includes(termo)
        const matchTel = lead.telefone?.replace(/\D/g, '').includes(termo.replace(/\D/g, ''))
        const matchEmail = lead.email?.toLowerCase().includes(termo)
        const matchImovel = lead.imovel?.titulo?.toLowerCase().includes(termo)
        const matchCodigo = lead.imovel?.codigo?.toLowerCase().includes(termo)
        if (!matchNome && !matchTel && !matchEmail && !matchImovel && !matchCodigo) return false
      }

      return true
    })
  }, [leadsLocais, filtroStatusPipeline, filtroCorretor, filtroImovel, buscaTexto])

  // Agrupamento por etapa ativa
  const leadsPorEtapa = useMemo(() => {
    const agrupado: Record<string, Lead[]> = {
      novo: [],
      em_contato: [],
      visita_agendada: [],
      proposta: [],
      negociacao: [],
    }

    leadsFiltrados.forEach((l) => {
      const statusKey = l.status
      if (agrupado[statusKey]) {
        agrupado[statusKey].push(l)
      } else if (statusKey === 'novo' || !agrupado[statusKey]) {
        agrupado.novo.push(l)
      }
    })

    return agrupado
  }, [leadsFiltrados])

  // Atribuição Rápida
  async function handleAtribuirRapido(leadId: string, corretorId: string, corretorNome: string) {
    if (!corretorId) return
    const atualizados = leadsLocais.map((l) =>
      l.id === leadId ? { ...l, corretor_id: corretorId, corretor_nome: corretorNome } : l
    )
    setLeadsLocais(atualizados)
    if (onAtualizarLeads) onAtualizarLeads(atualizados)

    try {
      await fetch('/api/painel/leads', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead_id: leadId,
          corretor_id: corretorId,
          corretor_nome: corretorNome,
          usuario_autor_id: usuarioId,
          usuario_autor_nome: usuarioNome,
          mensagem_atividade: `Lead atribuído ao corretor ${corretorNome} por ${usuarioNome}.`,
        }),
      })
    } catch (err) {
      console.error('Erro ao atribuir corretor:', err)
    }
  }

  // Distribuição Roleta em Massa
  async function handleDistribuirRoletaEmMassa() {
    if (listaCorretores.length === 0 || leadsNaoAtribuidos.length === 0) return
    setDistribuindoRoleta(true)
    try {
      const atualizados = [...leadsLocais]
      const chamadas = leadsNaoAtribuidos.map((lead, index) => {
        const corretor = listaCorretores[index % listaCorretores.length]
        const idx = atualizados.findIndex((l) => l.id === lead.id)
        if (idx !== -1) {
          atualizados[idx] = {
            ...atualizados[idx],
            corretor_id: corretor.id,
            corretor_nome: corretor.nome,
          }
        }
        return fetch('/api/painel/leads', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lead_id: lead.id,
            corretor_id: corretor.id,
            corretor_nome: corretor.nome,
            usuario_autor_id: usuarioId,
            usuario_autor_nome: usuarioNome,
            mensagem_atividade: `Lead distribuído automaticamente em roleta para ${corretor.nome}.`,
          }),
        })
      })

      setLeadsLocais(atualizados)
      if (onAtualizarLeads) onAtualizarLeads(atualizados)
      await Promise.all(chamadas)
      if (onRecarregarDados) onRecarregarDados()
    } catch (err) {
      console.error('Erro ao distribuir leads em roleta:', err)
    } finally {
      setDistribuindoRoleta(false)
    }
  }

  // Mover etapa com UI Otimista
  async function handleMoverParaPosicao(leadId: string, novoStatus: string, novoIndex?: number) {
    const leadAlvo = leadsLocais.find((l) => l.id === leadId)
    if (!leadAlvo) return
    const statusAnterior = leadAlvo.status
    const copiaOriginal = [...leadsLocais]

    const semLead = leadsLocais.filter((l) => l.id !== leadId)
    const leadAtualizado: Lead = { ...leadAlvo, status: novoStatus as Lead['status'], arquivado: false }

    let novaListaCompleta: Lead[] = []

    if (typeof novoIndex === 'number') {
      const leadsDaEtapa = semLead.filter((l) => l.status === novoStatus)
      const outrosLeads = semLead.filter((l) => l.status !== novoStatus)

      const indexSeguro = Math.max(0, Math.min(novoIndex, leadsDaEtapa.length))
      leadsDaEtapa.splice(indexSeguro, 0, leadAtualizado)

      novaListaCompleta = [...outrosLeads, ...leadsDaEtapa]
    } else {
      novaListaCompleta = [...semLead, leadAtualizado]
    }

    setLeadsLocais(novaListaCompleta)
    if (onAtualizarLeads) onAtualizarLeads(novaListaCompleta)

    if (statusAnterior !== novoStatus) {
      try {
        const res = await fetch('/api/painel/leads', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lead_id: leadId,
            status: novoStatus,
            arquivado: false,
            usuario_autor_id: usuarioId,
            usuario_autor_nome: usuarioNome,
          }),
        })
        if (!res.ok) throw new Error('Falha ao persistir status')
      } catch (e) {
        console.error('Erro ao mover etapa:', e)
        setLeadsLocais(copiaOriginal)
      }
    }
  }

  function handleMoverEtapa(leadId: string, novoStatus: string) {
    return handleMoverParaPosicao(leadId, novoStatus)
  }

  // Drop no Rodapé
  function handleDropFechamento(leadId: string) {
    const lead = leadsLocais.find((l) => l.id === leadId)
    if (!lead) return
    setArrastandoLeadId(null)
    setDropZoneRodapeHover(null)
    setValorFechamentoInput(
      lead.valor_proposta
        ? String(lead.valor_proposta)
        : lead.imovel?.preco
        ? String(lead.imovel.preco)
        : ''
    )
    setLeadParaFechamento(lead)
  }

  function handleDropPerda(leadId: string) {
    const lead = leadsLocais.find((l) => l.id === leadId)
    if (!lead) return
    setArrastandoLeadId(null)
    setDropZoneRodapeHover(null)
    setMotivoPerdaInput('Sem resposta do cliente')
    setLeadParaPerda(lead)
  }

  // Confirmação de Fechamento
  async function handleConfirmarFechamento() {
    if (!leadParaFechamento) return
    setProcessandoAcao(true)
    const valorNum =
      parseFloat(valorFechamentoInput.replace(/\D/g, '')) ||
      leadParaFechamento.valor_proposta ||
      leadParaFechamento.imovel?.preco ||
      0

    const leadAtualizado: Lead = {
      ...leadParaFechamento,
      status: 'fechado',
      valor_proposta: valorNum,
      valor_fechamento: valorNum,
      status_homologacao: 'pendente',
      arquivado: false,
    }

    const novaLista = leadsLocais.map((l) =>
      l.id === leadParaFechamento.id ? leadAtualizado : l
    )
    setLeadsLocais(novaLista)
    if (onAtualizarLeads) onAtualizarLeads(novaLista)

    try {
      await fetch('/api/painel/leads', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead_id: leadParaFechamento.id,
          status: 'fechado',
          valor_proposta: valorNum,
          valor_fechamento: valorNum,
          status_homologacao: 'pendente',
          arquivado: false,
          usuario_autor_id: usuarioId,
          usuario_autor_nome: usuarioNome,
          mensagem_atividade: `🏆 Negócio marcado como FECHADO no valor de ${formatarPreco(valorNum)}. Enviado para homologação do Gestor.`,
        }),
      })
      setLeadParaFechamento(null)
      if (onRecarregarDados) onRecarregarDados()
    } catch (e) {
      console.error('Erro ao fechar venda:', e)
    } finally {
      setProcessandoAcao(false)
    }
  }

  // Confirmação de Perda
  async function handleConfirmarPerda() {
    if (!leadParaPerda) return
    setProcessandoAcao(true)

    const leadAtualizado: Lead = {
      ...leadParaPerda,
      status: 'perdido',
      motivo_perda: motivoPerdaInput,
      arquivado: false,
    }

    const novaLista = leadsLocais.map((l) =>
      l.id === leadParaPerda.id ? leadAtualizado : l
    )
    setLeadsLocais(novaLista)
    if (onAtualizarLeads) onAtualizarLeads(novaLista)

    try {
      await fetch('/api/painel/leads', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead_id: leadParaPerda.id,
          status: 'perdido',
          motivo_perda: motivoPerdaInput,
          arquivado: false,
          usuario_autor_id: usuarioId,
          usuario_autor_nome: usuarioNome,
          mensagem_atividade: `❌ Oportunidade marcada como PERDIDA. Motivo: "${motivoPerdaInput}".`,
        }),
      })
      setLeadParaPerda(null)
      if (onRecarregarDados) onRecarregarDados()
    } catch (e) {
      console.error('Erro ao marcar perda:', e)
    } finally {
      setProcessandoAcao(false)
    }
  }

  // Reativar Lead
  async function handleReativarLead(e: React.MouseEvent, lead: Lead) {
    e.stopPropagation()
    const leadAtualizado: Lead = {
      ...lead,
      status: 'novo',
      arquivado: false,
      motivo_perda: undefined,
    }

    const novaLista = leadsLocais.map((l) => (l.id === lead.id ? leadAtualizado : l))
    setLeadsLocais(novaLista)
    if (onAtualizarLeads) onAtualizarLeads(novaLista)

    try {
      await fetch('/api/painel/leads', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead_id: lead.id,
          status: 'novo',
          arquivado: false,
          motivo_perda: null,
          usuario_autor_id: usuarioId,
          usuario_autor_nome: usuarioNome,
          mensagem_atividade: `🔄 Oportunidade REATIVADA por ${usuarioNome} e retornada para a etapa de Novos Leads.`,
        }),
      })
      if (onRecarregarDados) onRecarregarDados()
    } catch (err) {
      console.error('Erro ao reativar lead:', err)
    }
  }

  // Arquivar Lead
  async function handleArquivarLead(e: React.MouseEvent, lead: Lead) {
    e.stopPropagation()
    const agora = new Date().toISOString()
    const leadAtualizado: Lead = {
      ...lead,
      arquivado: true,
      data_arquivamento: agora,
    }

    const novaLista = leadsLocais.map((l) => (l.id === lead.id ? leadAtualizado : l))
    setLeadsLocais(novaLista)
    if (onAtualizarLeads) onAtualizarLeads(novaLista)

    try {
      await fetch('/api/painel/leads', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead_id: lead.id,
          arquivado: true,
          data_arquivamento: agora,
          usuario_autor_id: usuarioId,
          usuario_autor_nome: usuarioNome,
          mensagem_atividade: `📁 Lead arquivado por ${usuarioNome}.`,
        }),
      })
      if (onRecarregarDados) onRecarregarDados()
    } catch (err) {
      console.error('Erro ao arquivar lead:', err)
    }
  }

  // Desarquivar Lead (Restaura o lead para o funil ativo)
  async function handleDesarquivarLead(e: React.MouseEvent, lead: Lead) {
    e.stopPropagation()
    const statusRestaurado = lead.status === 'arquivado' ? 'novo' : lead.status
    const leadAtualizado: Lead = {
      ...lead,
      arquivado: false,
      status: statusRestaurado,
    }

    const novaLista = leadsLocais.map((l) => (l.id === lead.id ? leadAtualizado : l))
    setLeadsLocais(novaLista)
    if (onAtualizarLeads) onAtualizarLeads(novaLista)

    try {
      await fetch('/api/painel/leads', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead_id: lead.id,
          arquivado: false,
          status: statusRestaurado,
          usuario_autor_id: usuarioId,
          usuario_autor_nome: usuarioNome,
          mensagem_atividade: `📂 Lead DESARQUIVADO por ${usuarioNome} e retornado para o funil ativo.`,
        }),
      })
      if (onRecarregarDados) onRecarregarDados()
    } catch (err) {
      console.error('Erro ao desarquivar lead:', err)
    }
  }

  // Homologar Venda
  async function handleHomologarVenda(e: React.MouseEvent, lead: Lead) {
    e.stopPropagation()
    const agora = new Date().toISOString()
    const novaLista = leadsLocais.map((l) =>
      l.id === lead.id
        ? {
            ...l,
            status_homologacao: 'aprovado' as const,
            homologado_por_id: usuarioId,
            homologado_por_nome: usuarioNome,
            data_homologacao: agora,
          }
        : l
    )
    setLeadsLocais(novaLista)
    if (onAtualizarLeads) onAtualizarLeads(novaLista)

    try {
      await fetch('/api/painel/leads', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead_id: lead.id,
          status_homologacao: 'aprovado',
          homologado_por_id: usuarioId,
          homologado_por_nome: usuarioNome,
          data_homologacao: agora,
          usuario_autor_id: usuarioId,
          usuario_autor_nome: usuarioNome,
          mensagem_atividade: `🏆 Venda homologada e aprovada pelo Gestor ${usuarioNome}.`,
        }),
      })
    } catch (err) {
      console.error('Erro ao homologar venda:', err)
    }
  }

  // Recusar Homologação
  async function handleRecusarHomologacao(e: React.MouseEvent, lead: Lead) {
    e.stopPropagation()
    const novaLista = leadsLocais.map((l) =>
      l.id === lead.id
        ? {
            ...l,
            status: 'negociacao' as const,
            status_homologacao: 'rejeitado' as const,
            motivo_rejeicao_homologacao: 'Retornado para negociação pelo gestor',
          }
        : l
    )
    setLeadsLocais(novaLista)
    if (onAtualizarLeads) onAtualizarLeads(novaLista)

    try {
      await fetch('/api/painel/leads', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead_id: lead.id,
          status: 'negociacao',
          status_homologacao: 'rejeitado',
          motivo_rejeicao_homologacao: 'Retornado para negociação pelo gestor',
          usuario_autor_id: usuarioId,
          usuario_autor_nome: usuarioNome,
          mensagem_atividade: `⚠️ Homologação de venda recusada pelo Gestor ${usuarioNome}. Lead retornado para a etapa de Negociação.`,
        }),
      })
    } catch (err) {
      console.error('Erro ao recusar homologação:', err)
    }
  }

  // WhatsApp
  function handleChamarWhatsCard(e: React.MouseEvent, lead: Lead) {
    e.stopPropagation()
    if (!lead.telefone) return

    if (!lead.data_primeiro_contato) {
      fetch('/api/painel/leads', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead_id: lead.id,
          primeiro_contato: true,
          usuario_autor_id: usuarioId,
          usuario_autor_nome: usuarioNome,
          mensagem_atividade: `Primeiro contato via WhatsApp iniciado por ${usuarioNome}.`,
        }),
      }).then(() => onRecarregarDados())
    }

    const telLimpo = lead.telefone.replace(/\D/g, '')
    const urlImovel =
      typeof window !== 'undefined' && lead.imovel?.id
        ? `${window.location.origin}/imovel/${lead.imovel.id}`
        : ''
    const codTexto = lead.imovel?.codigo ? ` (Ref: ${lead.imovel.codigo})` : ''
    const texto = `Olá ${lead.nome}! Sou ${usuarioNome} do portal de imóveis Fixum.\n\nVi seu interesse no imóvel *${lead.imovel?.titulo || 'anunciado na Fixum'}*${codTexto}.\n${urlImovel ? `🔗 ${urlImovel}\n\n` : ''}Como posso te ajudar?`

    const msg = encodeURIComponent(texto)
    window.open(`https://wa.me/55${telLimpo}?text=${msg}`, '_blank')
  }

  return (
    <div className={styles.container}>
      {/* 1. FILA DE TRIAGEM */}
      {(isGestor || isImobiliaria) && leadsNaoAtribuidos.length > 0 && (
        <section className={styles.bannerTriagem}>
          <div className={styles.bannerTriagemTitulo}>
            <span className={styles.badgeAlertaTriagem}>🚨 Fila de Triagem</span>
            <strong>
              {leadsNaoAtribuidos.length === 1
                ? '1 lead recebido aguarda atribuição de corretor'
                : `${leadsNaoAtribuidos.length} leads recebidos aguardam atribuição`}
            </strong>
          </div>

          <div className={styles.bannerTriagemAcoes}>
            <button
              type="button"
              className={styles.btnVerTriagem}
              onClick={() =>
                setFiltroCorretor(
                  filtroCorretor === 'nao_atribuidos' ? 'todos' : 'nao_atribuidos'
                )
              }
            >
              {filtroCorretor === 'nao_atribuidos'
                ? '✕ Ver Toda a Equipe'
                : '🔍 Filtrar Fila de Triagem'}
            </button>

            {listaCorretores.length > 0 && (
              <button
                type="button"
                className={styles.btnRoletaMassa}
                onClick={handleDistribuirRoletaEmMassa}
                disabled={distribuindoRoleta}
                title="Distribuir igualmente todos os leads da triagem entre os corretores da equipe"
              >
                {distribuindoRoleta ? 'Distribuindo...' : '⚡ Distribuir em Roleta'}
              </button>
            )}
          </div>
        </section>
      )}

      {/* 2. BARRA DE CONTROLE: STATUS DO PIPELINE + FILTROS + BUSCA */}
      <section className={styles.barraControle}>
        {/* Pílulas de Status do Pipeline */}
        <div className={styles.pillsStatusPipeline}>
          <button
            type="button"
            className={`${styles.btnPillStatus} ${
              filtroStatusPipeline === 'abertos' ? styles.btnPillAtivoAbertos : ''
            }`}
            onClick={() => setFiltroStatusPipeline('abertos')}
          >
            <span>🟢 Em Aberto</span>
            <span className={styles.badgePillQtd}>{contagensPipeline.abertos}</span>
          </button>

          <button
            type="button"
            className={`${styles.btnPillStatus} ${
              filtroStatusPipeline === 'fechados' ? styles.btnPillAtivoFechados : ''
            }`}
            onClick={() => setFiltroStatusPipeline('fechados')}
          >
            <span>🏆 Fechados</span>
            <span className={styles.badgePillQtd}>{contagensPipeline.fechados}</span>
          </button>

          <button
            type="button"
            className={`${styles.btnPillStatus} ${
              filtroStatusPipeline === 'perdidos' ? styles.btnPillAtivoPerdidos : ''
            }`}
            onClick={() => setFiltroStatusPipeline('perdidos')}
          >
            <span>❌ Perdidos</span>
            <span className={styles.badgePillQtd}>{contagensPipeline.perdidos}</span>
          </button>

          <button
            type="button"
            className={`${styles.btnPillStatus} ${
              filtroStatusPipeline === 'arquivados' ? styles.btnPillAtivoArquivados : ''
            }`}
            onClick={() => setFiltroStatusPipeline('arquivados')}
          >
            <span>📁 Arquivados</span>
            <span className={styles.badgePillQtd}>{contagensPipeline.arquivados}</span>
          </button>
        </div>

        {/* Filtros da Direita */}
        <div className={styles.filtrosDireita}>
          <div className={styles.toggleVisualizacao}>
            <button
              type="button"
              className={`${styles.btnToggle} ${
                modoVisualizacao === 'kanban' ? styles.btnToggleAtivo : ''
              }`}
              onClick={() => setModoVisualizacao('kanban')}
              title="Visualização em Funil Kanban"
            >
              <span>📊</span>
            </button>
            <button
              type="button"
              className={`${styles.btnToggle} ${
                modoVisualizacao === 'lista' ? styles.btnToggleAtivo : ''
              }`}
              onClick={() => setModoVisualizacao('lista')}
              title="Visualização em Lista / Tabela"
            >
              <span>📋</span>
            </button>
          </div>

          {(isGestor || isImobiliaria) && listaCorretores.length > 0 && (
            <select
              className={styles.selectFiltro}
              value={filtroCorretor}
              onChange={(e) => setFiltroCorretor(e.target.value)}
            >
              <option value="todos">👔 Toda a Equipe</option>
              <option value="nao_atribuidos">🚨 Fila de Triagem</option>
              {listaCorretores.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          )}

          {listaImoveisFiltro.length > 0 && (
            <select
              className={styles.selectFiltro}
              value={filtroImovel}
              onChange={(e) => setFiltroImovel(e.target.value)}
            >
              <option value="todos">🏠 Todos os Imóveis</option>
              {listaImoveisFiltro.map((im) => (
                <option key={im.id} value={im.id}>
                  {im.titulo}
                </option>
              ))}
            </select>
          )}

          <div className={styles.campoBuscaWrapper}>
            <span className={styles.iconeBusca}>🔍</span>
            <input
              type="text"
              placeholder="Buscar cliente, imóvel..."
              className={styles.inputBusca}
              value={buscaTexto}
              onChange={(e) => setBuscaTexto(e.target.value)}
            />
            {buscaTexto && (
              <button
                type="button"
                className={styles.btnLimparBusca}
                onClick={() => setBuscaTexto('')}
              >
                ✕
              </button>
            )}
          </div>

          <button
            type="button"
            className={styles.btnRecarregarIcone}
            onClick={handleRecarregarManual}
            disabled={atualizandoManual}
            title="Sincronizar CRM"
          >
            <span className={`${styles.iconeGiro} ${atualizandoManual ? styles.girando : ''}`}>
              ↻
            </span>
          </button>
        </div>
      </section>

      {/* 3. KANBAN DE ETAPAS ATIVAS */}
      {filtroStatusPipeline === 'abertos' && modoVisualizacao === 'kanban' && (
        <section
          ref={kanbanRef}
          className={styles.kanbanContainer}
          onWheel={handleKanbanWheel}
        >
          {ETAPAS_KANBAN_ATIVAS.map((etapa) => {
            const listaCards = leadsPorEtapa[etapa.id] || []
            const isHover = colunaHoverId === etapa.id

            return (
              <div
                key={etapa.id}
                className={`${styles.colunaKanban} ${isHover ? styles.colunaHover : ''}`}
                onDragOver={(e) => {
                  e.preventDefault()
                  setColunaHoverId(etapa.id)
                  if (listaCards.length === 0) {
                    setDropTarget({ etapaId: etapa.id, index: 0 })
                  }
                }}
                onDragLeave={() => {
                  setColunaHoverId(null)
                  setDropTarget(null)
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  setColunaHoverId(null)
                  if (arrastandoLeadId) {
                    const idx = dropTarget?.etapaId === etapa.id ? dropTarget.index : undefined
                    handleMoverParaPosicao(arrastandoLeadId, etapa.id, idx)
                  }
                  setDropTarget(null)
                  setArrastandoLeadId(null)
                }}
              >
                {/* Topo da Coluna */}
                <div className={styles.colunaCabecalho} style={{ borderTopColor: etapa.cor }}>
                  <div className={styles.colunaTituloWrapper}>
                    <span className={styles.colunaIcone}>{etapa.icone}</span>
                    <strong className={styles.colunaTitulo}>{etapa.titulo}</strong>
                  </div>
                  <span className={styles.colunaContador}>{listaCards.length}</span>
                </div>

                {/* Lista de Cards */}
                <div className={styles.colunaCards}>
                  {listaCards.length === 0 ? (
                    <div
                      className={styles.colunaVazia}
                      onDragOver={(e) => {
                        e.preventDefault()
                        setDropTarget({ etapaId: etapa.id, index: 0 })
                      }}
                    >
                      <p>Nenhum lead nesta etapa</p>
                    </div>
                  ) : (
                    listaCards.map((lead, idx) => {
                      const minutosCriacao = Math.floor(
                        (Date.now() - new Date(lead.created_at).getTime()) / (1000 * 60)
                      )
                      const horasCriacao = Math.floor(minutosCriacao / 60)
                      const fezContato = !!lead.data_primeiro_contato
                      const isNaoAtribuido =
                        !lead.corretor_id ||
                        lead.corretor_id === 'gestao' ||
                        lead.corretor_nome === 'Gestão da Imobiliária' ||
                        lead.corretor_nome === 'Equipe'

                      const isDropAqui =
                        dropTarget?.etapaId === etapa.id &&
                        dropTarget.index === idx &&
                        arrastandoLeadId !== lead.id

                      return (
                        <div
                          key={lead.id}
                          className={styles.cardItemWrapper}
                          onDragOver={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            const rect = e.currentTarget.getBoundingClientRect()
                            const meio = rect.top + rect.height / 2
                            const insertIndex = e.clientY < meio ? idx : idx + 1
                            setDropTarget({ etapaId: etapa.id, index: insertIndex })
                          }}
                        >
                          {/* Placeholder antes do card */}
                          {isDropAqui && (
                            <div className={styles.dropPlaceholder}>
                              <span>✨ Soltar nesta posição</span>
                            </div>
                          )}

                          <div
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.setData('text/plain', lead.id)
                              setArrastandoLeadId(lead.id)
                            }}
                            onDragEnd={() => {
                              setArrastandoLeadId(null)
                              setColunaHoverId(null)
                              setDropTarget(null)
                              setDropZoneRodapeHover(null)
                            }}
                            onClick={() => setLeadSelecionado(lead)}
                            className={`${styles.cardKanban} ${
                              arrastandoLeadId === lead.id ? styles.cardArrastando : ''
                            } ${isNaoAtribuido ? styles.cardNaoAtribuido : ''}`}
                          >
                            {/* 1. Topo do Card */}
                            <div className={styles.cardTopo}>
                              <strong className={styles.cardNome} title={lead.nome}>
                                {lead.nome}
                              </strong>
                              <div className={styles.cardBadgesTopo}>
                                {isNaoAtribuido && (
                                  <span
                                    className={styles.badgeAguardandoCorretor}
                                    title="Aguardando atribuição de corretor"
                                  >
                                    🔔 Triagem
                                  </span>
                                )}
                                {lead.temperatura === 'quente' && (
                                  <span className={styles.badgeQuente} title="Lead de Alta Prioridade">
                                    🔥 Quente
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* 2. Sub-linha de Contato & SLA */}
                            <div className={styles.cardLinhaSub}>
                              <div className={styles.cardTelefoneWrapper}>
                                {lead.telefone ? (
                                  <span
                                    className={styles.cardTelefone}
                                    title={`Telefone: ${formatarTelefone(lead.telefone)}`}
                                  >
                                    📱 {formatarTelefone(lead.telefone)}
                                  </span>
                                ) : (
                                  <span className={styles.cardTempo}>
                                    📅{' '}
                                    {new Date(lead.created_at).toLocaleDateString('pt-BR', {
                                      day: '2-digit',
                                      month: '2-digit',
                                    })}
                                  </span>
                                )}
                              </div>

                              <div
                                className={`${styles.tagContatoCompacta} ${
                                  fezContato
                                    ? styles.tagContatoOk
                                    : horasCriacao >= 24
                                    ? styles.tagContatoCritico
                                    : horasCriacao >= 2
                                    ? styles.tagContatoAlerta
                                    : styles.tagContatoPendente
                                }`}
                              >
                                {fezContato ? (
                                  <span>✓ Contatado</span>
                                ) : isNaoAtribuido ? (
                                  <span>
                                    {minutosCriacao < 60
                                      ? `⏱️ ${minutosCriacao}m`
                                      : `🚨 ${horasCriacao}h s/ corretor`}
                                  </span>
                                ) : (
                                  <span>
                                    {horasCriacao >= 24
                                      ? `🚨 +24h`
                                      : horasCriacao >= 2
                                      ? `⏳ +${horasCriacao}h`
                                      : '⏳ Aguardando'}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* 3. Imóvel de Interesse */}
                            {lead.imovel && (
                              <div className={styles.cardImovelInfo}>
                                {lead.imovel.fotos?.[0] && (
                                  <img
                                    src={lead.imovel.fotos[0].url}
                                    alt=""
                                    className={styles.cardImovelThumb}
                                  />
                                )}
                                <div className={styles.cardImovelTextos}>
                                  <div className={styles.cardImovelLinhaCabecalho}>
                                    {lead.imovel.codigo && (
                                      <span
                                        className={styles.badgeCodigoCardLead}
                                        title={`Código de Referência: ${lead.imovel.codigo}`}
                                      >
                                        Ref: {lead.imovel.codigo}
                                      </span>
                                    )}
                                    <span
                                      className={styles.cardImovelTitulo}
                                      title={lead.imovel.titulo}
                                    >
                                      {lead.imovel.titulo}
                                    </span>
                                  </div>
                                  <strong className={styles.cardImovelPreco}>
                                    {formatarPreco(lead.imovel.preco || 0)}
                                  </strong>
                                </div>
                              </div>
                            )}

                            {/* Dados da Visita ou Proposta */}
                            {lead.data_visita ? (
                              <div className={styles.cardDestaqueVisita}>
                                📅 Visita:{' '}
                                {new Date(lead.data_visita).toLocaleString('pt-BR', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </div>
                            ) : lead.status === 'visita_agendada' ? (
                              <div
                                className={styles.cardDestaquePendente}
                                title="Clique no card para agendar a data"
                              >
                                📅 Agendar data da visita
                              </div>
                            ) : null}

                            {lead.valor_proposta ? (
                              <div className={styles.cardDestaqueProposta}>
                                {lead.status === 'negociacao'
                                  ? '🤝 Negociação: '
                                  : '💰 Proposta: '}
                                {formatarPreco(lead.valor_proposta)}
                              </div>
                            ) : lead.status === 'proposta' || lead.status === 'negociacao' ? (
                              <div
                                className={styles.cardDestaquePendente}
                                title="Clique no card para registrar o valor"
                              >
                                {lead.status === 'negociacao'
                                  ? '🤝 Em negociação de valores'
                                  : '💰 Registrar valor da proposta'}
                              </div>
                            ) : null}

                            {/* Rodapé do Card */}
                            <div className={styles.cardRodape}>
                              {isNaoAtribuido &&
                              (isGestor || isImobiliaria) &&
                              listaCorretores.length > 0 ? (
                                <div
                                  className={styles.wrapperAtribuirRapido}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <select
                                    className={styles.selectAtribuirPendente}
                                    value=""
                                    onChange={(e) => {
                                      const cId = e.target.value
                                      const cNome =
                                        listaCorretores.find((c) => c.id === cId)?.nome || ''
                                      handleAtribuirRapido(lead.id, cId, cNome)
                                    }}
                                    title="Atribuir corretor da equipe"
                                  >
                                    <option value="" disabled>
                                      ⚡ Atribuir ▾
                                    </option>
                                    {listaCorretores.map((c) => (
                                      <option key={c.id} value={c.id}>
                                        👔 {c.nome}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              ) : (
                                <span className={styles.cardCorretorTag} title="Corretor responsável">
                                  👔 {lead.corretor_nome || 'Sem corretor'}
                                </span>
                              )}

                              {lead.telefone && (
                                <button
                                  type="button"
                                  className={styles.btnWhatsCard}
                                  onClick={(e) => handleChamarWhatsCard(e, lead)}
                                  title="Chamar no WhatsApp"
                                >
                                  <span>💬</span> WhatsApp
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Placeholder no final da lista */}
                          {idx === listaCards.length - 1 &&
                            dropTarget?.etapaId === etapa.id &&
                            dropTarget.index === listaCards.length &&
                            arrastandoLeadId !== lead.id && (
                              <div className={styles.dropPlaceholder}>
                                <span>✨ Soltar no final</span>
                              </div>
                            )}
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            )
          })}
        </section>
      )}

      {/* 4. VISUALIZAÇÕES DEDICADAS: FECHADOS / PERDIDOS / ARQUIVADOS */}
      {filtroStatusPipeline !== 'abertos' && modoVisualizacao === 'kanban' && (
        <section className={styles.secaoDedicadaContainer}>
          <div className={styles.secaoDedicadaHeader}>
            <div>
              <h3 className={styles.secaoDedicadaTitulo}>
                {filtroStatusPipeline === 'fechados' && '🏆 Vendas & Negócios Fechados'}
                {filtroStatusPipeline === 'perdidos' && '❌ Oportunidades Perdidas / Descartadas'}
                {filtroStatusPipeline === 'arquivados' && '📁 Leads Arquivados'}
              </h3>
              <p className={styles.secaoDedicadaSub}>
                {filtroStatusPipeline === 'fechados' &&
                  'Histórico de transações concluídas e homologação de vendas da equipe.'}
                {filtroStatusPipeline === 'perdidos' &&
                  'Diagnóstico de motivos de perda e reativação rápida de clientes.'}
                {filtroStatusPipeline === 'arquivados' &&
                  'Leads arquivados por tempo ou ação manual com histórico preservado.'}
              </p>
            </div>
            <span className={styles.secaoDedicadaBadge}>{leadsFiltrados.length} registros</span>
          </div>

          {leadsFiltrados.length === 0 ? (
            <div className={styles.vazioDedicada}>
              <span>🔍</span>
              <h4>Nenhum lead nesta categoria</h4>
              <p>Os leads marcados como {filtroStatusPipeline} aparecerão organizados aqui.</p>
            </div>
          ) : (
            <div className={styles.gridCardsDedicados}>
              {leadsFiltrados.map((lead) => (
                <div
                  key={lead.id}
                  className={styles.cardDedicadoItem}
                  onClick={() => setLeadSelecionado(lead)}
                >
                  <div className={styles.cardDedicadoTopo}>
                    <div className={styles.cardDedicadoCliente}>
                      <strong>{lead.nome}</strong>
                      <span>{formatarTelefone(lead.telefone) || 'Sem telefone'}</span>
                    </div>

                    {lead.status === 'fechado' &&
                      (lead.status_homologacao === 'pendente' ? (
                        <span className={styles.badgePendenteHomologacao}>⏳ Aguardando Gestor</span>
                      ) : (
                        <span className={styles.badgeFechadoAprovado}>🏆 Homologado</span>
                      ))}

                    {lead.status === 'perdido' && (
                      <span className={styles.badgeMotivoPerda} title={lead.motivo_perda}>
                        ❌ {lead.motivo_perda || 'Descartado'}
                      </span>
                    )}

                    {(lead.arquivado || lead.status === 'arquivado') && (
                      <span className={styles.badgeArquivado}>📁 Arquivado</span>
                    )}
                  </div>

                  {lead.imovel && (
                    <div className={styles.imovelDedicadoInfo}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                        {lead.imovel.codigo && (
                          <span className={styles.badgeCodigoCardLead} title="Código do Imóvel">
                            Ref: {lead.imovel.codigo}
                          </span>
                        )}
                        <span className={styles.imovelDedicadoTitulo}>{lead.imovel.titulo}</span>
                      </div>
                      <strong className={styles.imovelDedicadoValor}>
                        {formatarPreco(
                          lead.valor_fechamento || lead.valor_proposta || lead.imovel.preco || 0
                        )}
                      </strong>
                    </div>
                  )}

                  <div className={styles.cardDedicadoRodape}>
                    <span className={styles.metaCorretorData}>
                      👔 {lead.corretor_nome || 'Sem corretor'} •{' '}
                      {new Date(lead.created_at).toLocaleDateString('pt-BR')}
                    </span>

                    <div
                      className={styles.acoesDedicadasBotoes}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {lead.status === 'fechado' &&
                        lead.status_homologacao === 'pendente' &&
                        (isGestor || isImobiliaria) && (
                          <>
                            <button
                              type="button"
                              className={styles.btnAprovarDedicado}
                              onClick={(e) => handleHomologarVenda(e, lead)}
                              title="Homologar venda"
                            >
                              ✓ Homologar
                            </button>
                            <button
                              type="button"
                              className={styles.btnRecusarDedicado}
                              onClick={(e) => handleRecusarHomologacao(e, lead)}
                              title="Recusar homologação"
                            >
                              ✕
                            </button>
                          </>
                        )}

                      {lead.arquivado || lead.status === 'arquivado' ? (
                        <button
                          type="button"
                          className={styles.btnDesarquivarDedicado}
                          onClick={(e) => handleDesarquivarLead(e, lead)}
                          title="Desarquivar lead e mover de volta para o funil ativo"
                        >
                          📂 Desarquivar
                        </button>
                      ) : lead.status === 'perdido' ? (
                        <button
                          type="button"
                          className={styles.btnReativarDedicado}
                          onClick={(e) => handleReativarLead(e, lead)}
                          title="Reativar oportunidade e mover de volta para Novos"
                        >
                          🔄 Reativar
                        </button>
                      ) : (
                        <button
                          type="button"
                          className={styles.btnArquivarDedicado}
                          onClick={(e) => handleArquivarLead(e, lead)}
                          title="Arquivar lead"
                        >
                          📁 Arquivar
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* 5. VISUALIZAÇÃO EM LISTA / TABELA DETALHADA */}
      {modoVisualizacao === 'lista' && (
        <section className={styles.tabelaContainer}>
          {leadsFiltrados.length === 0 ? (
            <div className={styles.vazio}>
              <span>🔍</span>
              <h3>Nenhum lead encontrado</h3>
              <p>Tente ajustar os filtros ou a busca para localizar seus atendimentos.</p>
            </div>
          ) : (
            <div className={styles.tabelaWrapper}>
              <table className={styles.tabela}>
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>Imóvel de Interesse</th>
                    <th>1º Contato</th>
                    <th>Corretor</th>
                    <th>Status / Etapa</th>
                    <th>Data</th>
                    <th style={{ textAlign: 'right' }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {leadsFiltrados.map((lead) => {
                    const horasCriacao = Math.floor(
                      (Date.now() - new Date(lead.created_at).getTime()) / (1000 * 60 * 60)
                    )
                    const fezContato = !!lead.data_primeiro_contato
                    const isNaoAtribuido =
                      !lead.corretor_id ||
                      lead.corretor_id === 'gestao' ||
                      lead.corretor_nome === 'Gestão da Imobiliária' ||
                      lead.corretor_nome === 'Equipe'

                    return (
                      <tr
                        key={lead.id}
                        onClick={() => setLeadSelecionado(lead)}
                        className={`${styles.trLinha} ${
                          isNaoAtribuido ? styles.cardNaoAtribuido : ''
                        }`}
                      >
                        <td>
                          <div className={styles.tabelaCliente}>
                            <div className={styles.tabelaAvatar}>
                              {lead.nome.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <strong>{lead.nome}</strong>
                              <span className={styles.tabelaTelefone}>
                                {lead.telefone || 'Sem telefone'}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td>
                          {lead.imovel ? (
                            <div className={styles.tabelaImovel}>
                              {lead.imovel.codigo && (
                                <span
                                  className={styles.badgeCodigoCardLead}
                                  style={{ width: 'fit-content', marginBottom: '2px' }}
                                  title="Código de Referência"
                                >
                                  Ref: {lead.imovel.codigo}
                                </span>
                              )}
                              <span className={styles.tabelaImovelTitulo}>
                                {lead.imovel.titulo}
                              </span>
                              <span className={styles.tabelaImovelPreco}>
                                {formatarPreco(
                                  lead.valor_fechamento ||
                                    lead.valor_proposta ||
                                    lead.imovel.preco ||
                                    0
                                )}
                              </span>
                            </div>
                          ) : (
                            <span className={styles.textoCinza}>Geral</span>
                          )}
                        </td>
                        <td>
                          <span
                            className={`${styles.badgeStatusContato} ${
                              fezContato
                                ? styles.badgeOk
                                : horasCriacao >= 24
                                ? styles.badgeCritico
                                : horasCriacao >= 2
                                ? styles.badgeAlerta
                                : styles.badgePendente
                            }`}
                          >
                            {fezContato
                              ? '✓ Feito'
                              : isNaoAtribuido
                              ? '⚠️ Aguardando Corretor'
                              : `${horasCriacao}h sem retorno`}
                          </span>
                        </td>
                        <td>
                          {isNaoAtribuido &&
                          (isGestor || isImobiliaria) &&
                          listaCorretores.length > 0 ? (
                            <select
                              className={styles.selectAtribuirTabelaPendente}
                              value=""
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => {
                                const cId = e.target.value
                                const cNome =
                                  listaCorretores.find((c) => c.id === cId)?.nome || ''
                                handleAtribuirRapido(lead.id, cId, cNome)
                              }}
                              title="Atribuir corretor da equipe"
                            >
                              <option value="" disabled>
                                ⚡ Atribuir ▾
                              </option>
                              {listaCorretores.map((c) => (
                                <option key={c.id} value={c.id}>
                                  👔 {c.nome}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span className={styles.tabelaCorretor}>
                              👔 {lead.corretor_nome || 'Sem corretor'}
                            </span>
                          )}
                        </td>
                        <td>
                          <select
                            className={styles.selectStatusTabela}
                            value={lead.status}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => handleMoverEtapa(lead.id, e.target.value)}
                          >
                            <option value="novo">📥 Novos</option>
                            <option value="em_contato">💬 Em Contato</option>
                            <option value="visita_agendada">📅 Visita Agendada</option>
                            <option value="proposta">💰 Proposta</option>
                            <option value="negociacao">🤝 Em Negociação</option>
                            <option value="fechado">🏆 Fechados</option>
                            <option value="perdido">❌ Perdidos</option>
                          </select>
                        </td>
                        <td>
                          <span className={styles.tabelaData}>
                            {new Date(lead.created_at).toLocaleDateString('pt-BR')}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            type="button"
                            className={styles.btnVerLead}
                            onClick={(e) => {
                              e.stopPropagation()
                              setLeadSelecionado(lead)
                            }}
                          >
                            Ver CRM ➔
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* 6. BARRA FLUTUANTE DE DESCARTE / FECHAMENTO (AO ARRASTAR CARD) */}
      {arrastandoLeadId && (
        <div className={styles.barraAcoesDescarteRodape}>
          <div
            className={`${styles.dropZoneAcao} ${styles.dropZoneGanho} ${
              dropZoneRodapeHover === 'fechado' ? styles.dropZoneGanhoHover : ''
            }`}
            onDragOver={(e) => {
              e.preventDefault()
              setDropZoneRodapeHover('fechado')
            }}
            onDragLeave={() => setDropZoneRodapeHover(null)}
            onDrop={(e) => {
              e.preventDefault()
              handleDropFechamento(arrastandoLeadId)
            }}
          >
            <span className={styles.dropZoneIcone}>🏆</span>
            <div>
              <strong className={styles.dropZoneTitulo}>Fechar Venda / Ganho</strong>
              <span className={styles.dropZoneSub}>Solte aqui para oficializar o fechamento</span>
            </div>
          </div>

          <div
            className={`${styles.dropZoneAcao} ${styles.dropZonePerda} ${
              dropZoneRodapeHover === 'perdido' ? styles.dropZonePerdaHover : ''
            }`}
            onDragOver={(e) => {
              e.preventDefault()
              setDropZoneRodapeHover('perdido')
            }}
            onDragLeave={() => setDropZoneRodapeHover(null)}
            onDrop={(e) => {
              e.preventDefault()
              handleDropPerda(arrastandoLeadId)
            }}
          >
            <span className={styles.dropZoneIcone}>❌</span>
            <div>
              <strong className={styles.dropZoneTitulo}>Marcar como Perdido</strong>
              <span className={styles.dropZoneSub}>Solte aqui para registrar o motivo da perda</span>
            </div>
          </div>
        </div>
      )}

      {/* 7. MODAIS DE CONFIRMAÇÃO DE FECHAMENTO E PERDA */}
      {leadParaFechamento && (
        <div className={styles.overlayAcaoModal}>
          <div className={styles.cardAcaoModal}>
            <div className={styles.cardAcaoModalTopo}>
              <span className={styles.iconeAcaoModal}>🏆</span>
              <div>
                <h3>Confirmar Fechamento de Venda</h3>
                <p>Oficialize a conclusão do negócio para {leadParaFechamento.nome}</p>
              </div>
            </div>

            <div className={styles.corpoAcaoModal}>
              <label className={styles.labelAcaoModal}>Valor Final Fechado (R$):</label>
              <input
                type="text"
                className={styles.inputAcaoModal}
                placeholder="Ex: 500.000"
                value={valorFechamentoInput}
                onChange={(e) => setValorFechamentoInput(e.target.value)}
                autoFocus
              />
              <span className={styles.avisoHomologacaoModal}>
                ℹ️ Esta venda ficará aguardando homologação do gestor para ser contabilizada no
                ranking oficial da imobiliária.
              </span>
            </div>

            <div className={styles.rodapeAcaoModal}>
              <button
                type="button"
                className={styles.btnCancelarModal}
                onClick={() => setLeadParaFechamento(null)}
                disabled={processandoAcao}
              >
                Cancelar
              </button>
              <button
                type="button"
                className={styles.btnConfirmarFechamentoModal}
                onClick={handleConfirmarFechamento}
                disabled={processandoAcao}
              >
                {processandoAcao ? 'Gravando...' : '✓ Confirmar Venda'}
              </button>
            </div>
          </div>
        </div>
      )}

      {leadParaPerda && (
        <div className={styles.overlayAcaoModal}>
          <div className={styles.cardAcaoModal}>
            <div className={styles.cardAcaoModalTopo}>
              <span className={styles.iconeAcaoModal}>❌</span>
              <div>
                <h3>Marcar Oportunidade como Perdida</h3>
                <p>Registre o motivo do descarte para inteligência comercial</p>
              </div>
            </div>

            <div className={styles.corpoAcaoModal}>
              <label className={styles.labelAcaoModal}>Motivo da Perda:</label>
              <select
                className={styles.selectAcaoModal}
                value={motivoPerdaInput}
                onChange={(e) => setMotivoPerdaInput(e.target.value)}
                autoFocus
              >
                <option value="Sem resposta do cliente">Sem resposta do cliente</option>
                <option value="Preço fora do orçamento">Preço fora do orçamento</option>
                <option value="Comprou/Alugou outro imóvel">Comprou/Alugou outro imóvel</option>
                <option value="Localização inadequada">Localização inadequada</option>
                <option value="Desistiu da negociação">Desistiu da negociação</option>
                <option value="Outro motivo">Outro motivo</option>
              </select>
            </div>

            <div className={styles.rodapeAcaoModal}>
              <button
                type="button"
                className={styles.btnCancelarModal}
                onClick={() => setLeadParaPerda(null)}
                disabled={processandoAcao}
              >
                Cancelar
              </button>
              <button
                type="button"
                className={styles.btnConfirmarPerdaModal}
                onClick={handleConfirmarPerda}
                disabled={processandoAcao}
              >
                {processandoAcao ? 'Gravando...' : 'Confirmar Perda'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. MODAL DE DETALHES COMPLETOS DO LEAD */}
      {leadSelecionado && (
        <ModalDetalhesLead
          lead={leadSelecionado}
          usuarioId={usuarioId}
          usuarioNome={usuarioNome}
          isGestor={isGestor}
          isImobiliaria={isImobiliaria}
          listaCorretores={listaCorretores}
          onFechar={() => setLeadSelecionado(null)}
          onAtualizarLead={(leadAtualizado) => {
            if (leadAtualizado) {
              const novaLista = leadsLocais.map((l) =>
                l.id === leadAtualizado.id ? { ...l, ...leadAtualizado } : l
              )
              setLeadsLocais(novaLista)
              if (onAtualizarLeads) onAtualizarLeads(novaLista)
            }
            onRecarregarDados()
          }}
        />
      )}
    </div>
  )
}
