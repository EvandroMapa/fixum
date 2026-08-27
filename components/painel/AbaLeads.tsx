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

const ETAPAS_KANBAN = [
  { id: 'novo', titulo: 'Novos', icone: '📥', cor: '#3b82f6' },
  { id: 'em_contato', titulo: 'Em Contato', icone: '💬', cor: '#0284c7' },
  { id: 'visita_agendada', titulo: 'Visita Agendada', icone: '📅', cor: '#8b5cf6' },
  { id: 'proposta', titulo: 'Proposta', icone: '💰', cor: '#f59e0b' },
  { id: 'fechado', titulo: 'Fechados', icone: '🏆', cor: '#10b981' },
  { id: 'perdido', titulo: 'Perdidos', icone: '❌', cor: '#ef4444' },
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

  // Sincroniza sempre que os leads do componente pai forem atualizados
  useEffect(() => {
    setLeadsLocais(leads)
  }, [leads])
  const [modoVisualizacao, setModoVisualizacao] = useState<ModoVisualizacao>('kanban')
  const [filtroCorretor, setFiltroCorretor] = useState<string>('todos')
  const [filtroImovel, setFiltroImovel] = useState<string>('todos')
  const [buscaTexto, setBuscaTexto] = useState<string>('')
  const [leadSelecionado, setLeadSelecionado] = useState<Lead | null>(null)
  const [arrastandoLeadId, setArrastandoLeadId] = useState<string | null>(null)
  const [colunaHoverId, setColunaHoverId] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<{ etapaId: string; index: number } | null>(null)
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

  // Sincronizar quando os leads externos forem atualizados
  useEffect(() => {
    setLeadsLocais(leads)
  }, [leads])

  const onRecarregarRef = useRef(onRecarregarDados)
  useEffect(() => {
    onRecarregarRef.current = onRecarregarDados
  })

  // Inscrição direta de Realtime para novos leads e atualizações
  useEffect(() => {
    const supabase = createClient()
    const canalNome = `realtime-aba-leads-sync`
    const canalLeads = supabase
      .channel(canalNome)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'leads' },
        (payload: any) => {
          console.log('[REALTIME-LEADS] Evento recebido em AbaLeads:', payload)
          if (onRecarregarRef.current) {
            onRecarregarRef.current()
          }
        }
      )
      .subscribe((status: string) => {
        console.log('[REALTIME-LEADS] Status da inscrição:', status)
      })

    return () => {
      supabase.removeChannel(canalLeads)
    }
  }, [])

  // ── LEADS NÃO ATRIBUÍDOS (FILA DE TRIAGEM) ──
  const leadsNaoAtribuidos = useMemo(() => {
    return leadsLocais.filter(
      (l) =>
        !l.corretor_id ||
        l.corretor_id === 'gestao' ||
        l.corretor_nome === 'Gestão da Imobiliária' ||
        l.corretor_nome === 'Equipe'
    )
  }, [leadsLocais])

  // ── 2. LISTA DE IMÓVEIS ÚNICOS PARA O FILTRO ──
  const listaImoveisFiltro = useMemo(() => {
    const mapa = new Map<string, string>()
    leadsLocais.forEach((l) => {
      if (l.imovel_id && l.imovel?.titulo) {
        mapa.set(l.imovel_id, l.imovel.titulo)
      }
    })
    return Array.from(mapa.entries()).map(([id, titulo]) => ({ id, titulo }))
  }, [leadsLocais])

  // ── 3. FILTRAGEM DOS LEADS ──
  const leadsFiltrados = useMemo(() => {
    return leadsLocais.filter((lead) => {
      // Filtro por corretor ou fila de triagem
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

      // Filtro por imóvel
      if (filtroImovel !== 'todos' && lead.imovel_id !== filtroImovel) {
        return false
      }

      // Busca por texto
      if (buscaTexto.trim()) {
        const termo = buscaTexto.toLowerCase()
        const matchNome = lead.nome?.toLowerCase().includes(termo)
        const matchTel = lead.telefone?.replace(/\D/g, '').includes(termo.replace(/\D/g, ''))
        const matchEmail = lead.email?.toLowerCase().includes(termo)
        const matchImovel = lead.imovel?.titulo?.toLowerCase().includes(termo)
        if (!matchNome && !matchTel && !matchEmail && !matchImovel) return false
      }

      return true
    })
  }, [leadsLocais, filtroCorretor, filtroImovel, buscaTexto])

  // Agrupamento dos leads por etapa do Kanban
  const leadsPorEtapa = useMemo(() => {
    const agrupado: Record<string, Lead[]> = {
      novo: [],
      em_contato: [],
      visita_agendada: [],
      proposta: [],
      fechado: [],
      perdido: [],
    }

    leadsFiltrados.forEach((l) => {
      const statusKey = l.status === 'negociacao' ? 'proposta' : l.status
      if (agrupado[statusKey]) {
        agrupado[statusKey].push(l)
      } else {
        agrupado.novo.push(l)
      }
    })

    return agrupado
  }, [leadsFiltrados])

  // Atribuição Rápida de um Lead em 1 clique
  async function handleAtribuirRapido(leadId: string, corretorId: string, corretorNome: string) {
    if (!corretorId) return

    const atualizados = leadsLocais.map((l) =>
      l.id === leadId
        ? { ...l, corretor_id: corretorId, corretor_nome: corretorNome }
        : l
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

  // Distribuição em Massa da Fila em Roleta (Round-Robin)
  async function handleDistribuirRoletaEmMassa() {
    if (listaCorretores.length === 0 || leadsNaoAtribuidos.length === 0) return

    setDistribuindoRoleta(true)
    try {
      const atualizados = [...leadsLocais]
      const chamadas: Promise<any>[] = []

      leadsNaoAtribuidos.forEach((lead, index) => {
        const corretor = listaCorretores[index % listaCorretores.length]
        const idx = atualizados.findIndex((l) => l.id === lead.id)
        if (idx !== -1) {
          atualizados[idx] = {
            ...atualizados[idx],
            corretor_id: corretor.id,
            corretor_nome: corretor.nome,
          }
        }

        chamadas.push(
          fetch('/api/painel/leads', {
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
        )
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

  // Mover etapa e posicionar no índice exato com UI OTIMISTA (0ms de latência)
  async function handleMoverParaPosicao(leadId: string, novoStatus: string, novoIndex?: number) {
    const leadAlvo = leadsLocais.find((l) => l.id === leadId)
    if (!leadAlvo) return
    const statusAnterior = leadAlvo.status
    const copiaOriginal = [...leadsLocais]

    // 1. Reordena na lista local
    const semLead = leadsLocais.filter((l) => l.id !== leadId)
    const leadAtualizado: Lead = { ...leadAlvo, status: novoStatus as Lead['status'] }

    // Regra de Homologação de Fechamento:
    // Ao arrastar para Fechados, fica sempre pendente para homologação explícita do gestor
    if (novoStatus === 'fechado') {
      if (leadAlvo.status_homologacao !== 'aprovado') {
        leadAtualizado.status_homologacao = 'pendente'
      }
    }

    let novaListaCompleta: Lead[] = []

    if (typeof novoIndex === 'number') {
      const leadsDaEtapa = semLead.filter(
        (l) => (l.status === 'negociacao' ? 'proposta' : l.status) === novoStatus
      )
      const outrosLeads = semLead.filter(
        (l) => (l.status === 'negociacao' ? 'proposta' : l.status) !== novoStatus
      )

      const indexSeguro = Math.max(0, Math.min(novoIndex, leadsDaEtapa.length))
      leadsDaEtapa.splice(indexSeguro, 0, leadAtualizado)

      novaListaCompleta = [...outrosLeads, ...leadsDaEtapa]
    } else {
      novaListaCompleta = [...semLead, leadAtualizado]
    }

    setLeadsLocais(novaListaCompleta)
    if (onAtualizarLeads) onAtualizarLeads(novaListaCompleta)

    // 2. Salva no backend se mudou de status
    if (statusAnterior !== novoStatus) {
      try {
        const res = await fetch('/api/painel/leads', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lead_id: leadId,
            status: novoStatus,
            status_homologacao: leadAtualizado.status_homologacao,
            homologado_por_id: leadAtualizado.homologado_por_id,
            homologado_por_nome: leadAtualizado.homologado_por_nome,
            data_homologacao: leadAtualizado.data_homologacao,
            usuario_autor_id: usuarioId,
            usuario_autor_nome: usuarioNome,
          }),
        })

        if (!res.ok) throw new Error('Falha ao persistir status')
      } catch (e) {
        console.error('Erro ao mover etapa:', e)
        // Rollback se falhar
        setLeadsLocais(copiaOriginal)
      }
    }
  }

  function handleMoverEtapa(leadId: string, novoStatus: string) {
    return handleMoverParaPosicao(leadId, novoStatus)
  }

  // Homologar Venda Fechada (Ação de Gestor / Imobiliária)
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

  // Recusar Homologação de Venda Fechada
  async function handleRecusarHomologacao(e: React.MouseEvent, lead: Lead) {
    e.stopPropagation()
    const novaLista = leadsLocais.map((l) =>
      l.id === lead.id
        ? {
            ...l,
            status: 'proposta' as const,
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
          status: 'proposta',
          status_homologacao: 'rejeitado',
          motivo_rejeicao_homologacao: 'Retornado para negociação pelo gestor',
          usuario_autor_id: usuarioId,
          usuario_autor_nome: usuarioNome,
          mensagem_atividade: `⚠️ Homologação de venda recusada pelo Gestor ${usuarioNome}. Lead retornado para a etapa de Proposta.`,
        }),
      })
    } catch (err) {
      console.error('Erro ao recusar homologação:', err)
    }
  }

  // Chamar WhatsApp rápido no card
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
    const urlImovel = typeof window !== 'undefined' && lead.imovel?.id
      ? `${window.location.origin}/imovel/${lead.imovel.id}`
      : ''

    const texto = `Olá ${lead.nome}! Sou ${usuarioNome} do portal de imóveis Fixum.\n\nVi seu interesse no imóvel *${lead.imovel?.titulo || 'anunciado na Fixum'}*.\n${urlImovel ? `🔗 ${urlImovel}\n\n` : ''}Como posso te ajudar?`

    const msg = encodeURIComponent(texto)
    window.open(`https://wa.me/55${telLimpo}?text=${msg}`, '_blank')
  }

  return (
    <div className={styles.container}>
      {/* ═══════════════════════════════════════════════════════════════
          2. FILA DE TRIAGEM (ALERTA COMPACTO PARA GESTOR/IMOBILIÁRIA)
          ═══════════════════════════════════════════════════════════════ */}
      {(isGestor || isImobiliaria) && leadsNaoAtribuidos.length > 0 && (
        <section className={styles.bannerTriagem}>
          <div className={styles.bannerTriagemTitulo}>
            <span className={styles.bannerTriagemPulso}>⚡</span>
            <strong>Fila de Triagem: {leadsNaoAtribuidos.length} {leadsNaoAtribuidos.length === 1 ? 'novo lead aguardando corretor' : 'novos leads aguardando corretor'}</strong>
          </div>
          <div className={styles.bannerTriagemAcoes}>
            {listaCorretores.length > 0 && (
              <button
                type="button"
                className={styles.btnRoletaEmMassa}
                onClick={handleDistribuirRoletaEmMassa}
                disabled={distribuindoRoleta}
                title="Distribuir leads da fila igualmente entre os corretores"
              >
                <span>🎲</span> {distribuindoRoleta ? 'Distribuindo...' : 'Distribuir em Roleta'}
              </button>
            )}
            <button
              type="button"
              className={`${styles.btnFiltrarTriagem} ${filtroCorretor === 'nao_atribuidos' ? styles.btnFiltrarTriagemAtivo : ''}`}
              onClick={() => setFiltroCorretor(filtroCorretor === 'nao_atribuidos' ? 'todos' : 'nao_atribuidos')}
            >
              <span>🔍</span> {filtroCorretor === 'nao_atribuidos' ? 'Ver Todos' : `Ver Fila (${leadsNaoAtribuidos.length})`}
            </button>
          </div>
        </section>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          3. BARRA DE CONTROLE, FILTROS E BUSCA
          ═══════════════════════════════════════════════════════════════ */}
      <section className={styles.barraControle}>
        <div className={styles.filtrosEsquerda}>
          {/* Alternador Kanban / Lista */}
          <div className={styles.toggleVisualizacao}>
            <button
              type="button"
              className={`${styles.btnToggle} ${modoVisualizacao === 'kanban' ? styles.btnToggleAtivo : ''}`}
              onClick={() => setModoVisualizacao('kanban')}
              title="Visualização em Funil (Kanban)"
            >
              <span>📊</span> Funil Kanban
            </button>
            <button
              type="button"
              className={`${styles.btnToggle} ${modoVisualizacao === 'lista' ? styles.btnToggleAtivo : ''}`}
              onClick={() => setModoVisualizacao('lista')}
              title="Visualização em Lista Detalhada"
            >
              <span>📋</span> Lista ({leadsFiltrados.length})
            </button>
          </div>

          {/* Filtro por Corretor (Apenas Gestor ou Imobiliária) */}
          {(isGestor || isImobiliaria) && listaCorretores.length > 0 && (
            <select
              className={styles.selectFiltro}
              value={filtroCorretor}
              onChange={(e) => setFiltroCorretor(e.target.value)}
            >
              <option value="todos">👔 Todos os Corretores</option>
              {leadsNaoAtribuidos.length > 0 && (
                <option value="nao_atribuidos" style={{ fontWeight: 'bold', color: '#d97706' }}>
                  ⚡ Fila de Triagem ({leadsNaoAtribuidos.length} aguardando)
                </option>
              )}
              {listaCorretores.map((c) => (
                <option key={c.id} value={c.id}>
                  Corretor: {c.nome}
                </option>
              ))}
            </select>
          )}

          {/* Botão de Reload / Sincronização (Apenas Ícone) */}
          <button
            type="button"
            className={`${styles.btnRecarregarIcone} ${atualizandoManual ? styles.btnRecarregando : ''}`}
            onClick={handleRecarregarManual}
            title="Atualizar lista de leads"
            disabled={atualizandoManual}
          >
            <span className={`${styles.iconeGiro} ${atualizandoManual ? styles.girando : ''}`}>🔄</span>
          </button>

          {/* Filtro por Imóvel */}
          {listaImoveisFiltro.length > 1 && (
            <select
              className={styles.selectFiltro}
              value={filtroImovel}
              onChange={(e) => setFiltroImovel(e.target.value)}
            >
              <option value="todos">🏢 Todos os Imóveis</option>
              {listaImoveisFiltro.map((im) => (
                <option key={im.id} value={im.id}>
                  {im.titulo}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Busca em Tempo Real */}
        <div className={styles.campoBuscaWrapper}>
          <span className={styles.iconeBusca}>🔍</span>
          <input
            type="text"
            placeholder="Buscar por cliente, WhatsApp ou imóvel..."
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
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          4. VISUALIZAÇÃO KANBAN (FUNIL DE VENDAS)
          ═══════════════════════════════════════════════════════════════ */}
      {modoVisualizacao === 'kanban' && (
        <section
          ref={kanbanRef}
          className={styles.kanbanContainer}
          onWheel={handleKanbanWheel}
        >
          {ETAPAS_KANBAN.map((etapa) => {
            const listaCards = leadsPorEtapa[etapa.id] || []
            const isColunaHover = colunaHoverId === etapa.id

            return (
              <div
                key={etapa.id}
                className={`${styles.colunaKanban} ${isColunaHover ? styles.colunaHover : ''}`}
                onDragOver={(e) => {
                  e.preventDefault()
                  e.dataTransfer.dropEffect = 'move'
                  if (listaCards.length === 0) {
                    setDropTarget({ etapaId: etapa.id, index: 0 })
                  }
                }}
                onDragEnter={() => setColunaHoverId(etapa.id)}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                    setColunaHoverId(null)
                    if (dropTarget?.etapaId === etapa.id) {
                      setDropTarget(null)
                    }
                  }
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  const leadId = e.dataTransfer.getData('text/plain') || arrastandoLeadId
                  const targetIndex = dropTarget?.etapaId === etapa.id ? dropTarget.index : undefined
                  setColunaHoverId(null)
                  setDropTarget(null)
                  setArrastandoLeadId(null)
                  if (leadId) {
                    handleMoverParaPosicao(leadId, etapa.id, targetIndex)
                  }
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

                {/* Lista de Cards da Etapa */}
                <div className={styles.colunaCards}>
                  {listaCards.length === 0 ? (
                    isColunaHover && dropTarget?.etapaId === etapa.id ? (
                      <div className={styles.dropPlaceholderVazio}>
                        <span>📥 Solte o lead aqui</span>
                      </div>
                    ) : (
                      <div className={styles.colunaVazia}>
                        <span>Nenhum lead nesta etapa</span>
                      </div>
                    )
                  ) : (
                    listaCards.map((lead, idx) => {
                      const minutosCriacao = Math.floor(
                        (Date.now() - new Date(lead.created_at).getTime()) / (1000 * 60)
                      )
                      const horasCriacao = Math.floor(minutosCriacao / 60)
                      const fezContato = !!lead.data_primeiro_contato
                      const isArrastando = arrastandoLeadId === lead.id
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
                        <div key={lead.id} className={styles.cardItemWrapper}>
                          {/* Placeholder antes do card se o drop for neste índice */}
                          {isDropAqui && (
                            <div className={styles.dropPlaceholder}>
                              <span>✨ Soltar nesta posição</span>
                            </div>
                          )}

                          <div
                            draggable={true}
                            onDragStart={(e) => {
                              e.dataTransfer.setData('text/plain', lead.id)
                              e.dataTransfer.effectAllowed = 'move'
                              setArrastandoLeadId(lead.id)
                            }}
                            onDragOver={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              const rect = e.currentTarget.getBoundingClientRect()
                              const offsetY = e.clientY - rect.top
                              const isLowerHalf = offsetY > rect.height / 2
                              const targetIndex = isLowerHalf ? idx + 1 : idx
                              setDropTarget({ etapaId: etapa.id, index: targetIndex })
                            }}
                            onDragEnd={() => {
                              setArrastandoLeadId(null)
                              setColunaHoverId(null)
                              setDropTarget(null)
                            }}
                            className={`${styles.cardKanban} ${isArrastando ? styles.cardArrastando : ''} ${isNaoAtribuido ? styles.cardNaoAtribuido : ''}`}
                            onClick={() => setLeadSelecionado(lead)}
                          >
                            {/* 1. Topo do Card */}
                            <div className={styles.cardTopo}>
                              <strong className={styles.cardNome} title={lead.nome}>{lead.nome}</strong>
                              <div className={styles.cardBadgesTopo}>
                                {isNaoAtribuido && (
                                  <span className={styles.badgeAguardandoCorretor} title="Aguardando atribuição de corretor">
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

                            {/* 2. Sub-linha de Contato & Data: Telefone formatado + Data / SLA */}
                            <div className={styles.cardLinhaSub}>
                              <div className={styles.cardTelefoneWrapper}>
                                {lead.telefone ? (
                                  <span className={styles.cardTelefone} title={`Telefone: ${formatarTelefone(lead.telefone)}`}>
                                    📱 {formatarTelefone(lead.telefone)}
                                  </span>
                                ) : (
                                  <span className={styles.cardTempo}>
                                    📅 {new Date(lead.created_at).toLocaleDateString('pt-BR', {
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
                                    {minutosCriacao < 60 ? `⏱️ ${minutosCriacao}m` : `🚨 ${horasCriacao}h s/ corretor`}
                                  </span>
                                ) : (
                                  <span>
                                    {horasCriacao >= 24 ? `🚨 +24h` : horasCriacao >= 2 ? `⏳ +${horasCriacao}h` : '⏳ Aguardando'}
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
                                  <span className={styles.cardImovelTitulo} title={lead.imovel.titulo}>
                                    {lead.imovel.titulo}
                                  </span>
                                  <strong className={styles.cardImovelPreco}>
                                    {formatarPreco(lead.imovel.preco || 0)}
                                  </strong>
                                </div>
                              </div>
                            )}

                            {/* Dados da Visita ou Proposta */}
                            {lead.data_visita ? (
                              <div className={styles.cardDestaqueVisita}>
                                📅 Visita: {new Date(lead.data_visita).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                              </div>
                            ) : lead.status === 'visita_agendada' ? (
                              <div className={styles.cardDestaquePendente} title="Clique no card para agendar a data">
                                📅 Agendar data da visita
                              </div>
                            ) : null}

                            {lead.valor_proposta ? (
                              <div className={styles.cardDestaqueProposta}>
                                💰 Proposta: {formatarPreco(lead.valor_proposta)}
                              </div>
                            ) : lead.status === 'proposta' ? (
                              <div className={styles.cardDestaquePendente} title="Clique no card para registrar o valor">
                                💰 Registrar valor da proposta
                              </div>
                            ) : null}

                            {/* 4. Destaque de Homologação de Fechamento */}
                            {lead.status === 'fechado' && (
                              lead.status_homologacao === 'pendente' ? (
                                <div className={styles.cardFaixaHomologacao} onClick={(e) => e.stopPropagation()}>
                                  <span className={styles.textoHomologacaoPendente}>⏳ Aguardando Gestor</span>
                                  {(isGestor || isImobiliaria) && (
                                    <div className={styles.botoesHomologacaoCard}>
                                      <button
                                        type="button"
                                        className={styles.btnHomologarRapido}
                                        onClick={(e) => handleHomologarVenda(e, lead)}
                                        title="Aprovar e homologar venda da equipe"
                                      >
                                        ✓ Homologar
                                      </button>
                                      <button
                                        type="button"
                                        className={styles.btnRecusarRapido}
                                        onClick={(e) => handleRecusarHomologacao(e, lead)}
                                        title="Recusar homologação e retornar para proposta"
                                      >
                                        ✕
                                      </button>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className={styles.cardDestaqueFechadoAprovado}>
                                  🏆 Venda Homologada
                                </div>
                              )
                            )}

                            {/* Rodapé do Card */}
                            <div className={styles.cardRodape}>
                              {isNaoAtribuido && (isGestor || isImobiliaria) && listaCorretores.length > 0 ? (
                                <div className={styles.wrapperAtribuirRapido} onClick={(e) => e.stopPropagation()}>
                                  <select
                                    className={styles.selectAtribuirPendente}
                                    value=""
                                    onChange={(e) => {
                                      const cId = e.target.value
                                      const cNome = listaCorretores.find((c) => c.id === cId)?.nome || ''
                                      handleAtribuirRapido(lead.id, cId, cNome)
                                    }}
                                    title="Atribuir corretor da equipe"
                                  >
                                    <option value="" disabled>⚡ Atribuir ▾</option>
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
                                  title="Conversar no WhatsApp"
                                >
                                  💬 WhatsApp
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

      {/* ═══════════════════════════════════════════════════════════════
          5. VISUALIZAÇÃO EM LISTA / TABELA DETALHADA
          ═══════════════════════════════════════════════════════════════ */}
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
                        className={`${styles.trLinha} ${isNaoAtribuido ? styles.cardNaoAtribuido : ''}`}
                      >
                        <td>
                          <div className={styles.tabelaCliente}>
                            <div className={styles.tabelaAvatar}>{lead.nome.charAt(0).toUpperCase()}</div>
                            <div>
                              <strong>{lead.nome}</strong>
                              <span className={styles.tabelaTelefone}>{lead.telefone || 'Sem telefone'}</span>
                            </div>
                          </div>
                        </td>
                        <td>
                          {lead.imovel ? (
                            <div className={styles.tabelaImovel}>
                              <span className={styles.tabelaImovelTitulo}>{lead.imovel.titulo}</span>
                              <span className={styles.tabelaImovelPreco}>
                                {formatarPreco(lead.imovel.preco || 0)}
                              </span>
                            </div>
                          ) : (
                            <span className={styles.textoCinza}>Geral</span>
                          )}
                        </td>
                        <td>
                          <span
                            className={`${styles.badgeStatusContato} ${
                              fezContato ? styles.badgeOk : horasCriacao >= 24 ? styles.badgeCritico : horasCriacao >= 2 ? styles.badgeAlerta : styles.badgePendente
                            }`}
                          >
                            {fezContato ? '✓ Feito' : isNaoAtribuido ? '⚠️ Aguardando Corretor' : `${horasCriacao}h sem retorno`}
                          </span>
                        </td>
                        <td>
                          {isNaoAtribuido && (isGestor || isImobiliaria) && listaCorretores.length > 0 ? (
                            <select
                              className={styles.selectAtribuirTabelaPendente}
                              value=""
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => {
                                const cId = e.target.value
                                const cNome = listaCorretores.find((c) => c.id === cId)?.nome || ''
                                handleAtribuirRapido(lead.id, cId, cNome)
                              }}
                              title="Atribuir corretor da equipe"
                            >
                              <option value="" disabled>⚡ Atribuir ▾</option>
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
                            {ETAPAS_KANBAN.map((et) => (
                              <option key={et.id} value={et.id}>
                                {et.titulo}
                              </option>
                            ))}
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

      {/* ═══════════════════════════════════════════════════════════════
          5. MODAL / GAVETA DE DETALHES DO LEAD SELECIONADO
          ═══════════════════════════════════════════════════════════════ */}
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
              const novaLista = leadsLocais.map((l) => (l.id === leadAtualizado.id ? { ...l, ...leadAtualizado } : l))
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
