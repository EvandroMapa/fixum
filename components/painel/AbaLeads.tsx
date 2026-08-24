'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { type Lead } from '@/lib/types'
import { formatarPreco } from '@/lib/utils'
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
}: Props) {
  const [leadsLocais, setLeadsLocais] = useState<Lead[]>(leads)
  const [modoVisualizacao, setModoVisualizacao] = useState<ModoVisualizacao>('kanban')
  const [filtroCorretor, setFiltroCorretor] = useState<string>('todos')
  const [filtroImovel, setFiltroImovel] = useState<string>('todos')
  const [buscaTexto, setBuscaTexto] = useState<string>('')
  const [leadSelecionado, setLeadSelecionado] = useState<Lead | null>(null)
  const [arrastandoLeadId, setArrastandoLeadId] = useState<string | null>(null)
  const [colunaHoverId, setColunaHoverId] = useState<string | null>(null)
  const [atualizandoManual, setAtualizandoManual] = useState(false)

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
      .subscribe((status) => {
        console.log('[REALTIME-LEADS] Status da inscrição:', status)
      })

    return () => {
      supabase.removeChannel(canalLeads)
    }
  }, [])

  // ── 1. MÉTRICAS E KPIS DO FUNIL ──
  const metricas = useMemo(() => {
    const total = leadsLocais.length
    const semContato = leadsLocais.filter((l) => l.status === 'novo' && !l.data_primeiro_contato).length
    const emAtendimento = leadsLocais.filter((l) => l.status === 'em_contato').length
    const visitas = leadsLocais.filter((l) => l.status === 'visita_agendada').length
    const propostas = leadsLocais.filter((l) => l.status === 'proposta' || l.status === 'negociacao').length
    const fechados = leadsLocais.filter((l) => l.status === 'fechado').length
    const taxaConversao = total > 0 ? Math.round((fechados / total) * 100) : 0

    return { total, semContato, emAtendimento, visitas, propostas, fechados, taxaConversao }
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
      // Filtro por corretor
      if (filtroCorretor !== 'todos' && lead.corretor_id !== filtroCorretor) {
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

  // Mover etapa com UI OTIMISTA instantânea (0ms de latência)
  async function handleMoverEtapa(leadId: string, novoStatus: string) {
    const statusAnterior = leadsLocais.find((l) => l.id === leadId)?.status
    if (statusAnterior === novoStatus) return

    // 1. Move o card na interface imediatamente
    setLeadsLocais((prev) =>
      prev.map((l) => (l.id === leadId ? { ...l, status: novoStatus as Lead['status'] } : l))
    )

    // 2. Salva no backend em background
    try {
      const res = await fetch('/api/painel/leads', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead_id: leadId,
          status: novoStatus,
          usuario_autor_id: usuarioId,
          usuario_autor_nome: usuarioNome,
        }),
      })

      if (!res.ok) throw new Error('Falha ao persistir status')
    } catch (e) {
      console.error('Erro ao mover etapa:', e)
      // Rollback se falhar
      if (statusAnterior) {
        setLeadsLocais((prev) =>
          prev.map((l) => (l.id === leadId ? { ...l, status: statusAnterior } : l))
        )
      }
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
          1. CARDS DE MÉTRICAS E KPIS DO CRM
          ═══════════════════════════════════════════════════════════════ */}
      <section className={styles.gridMetricas}>
        <div className={styles.cardMetrica}>
          <div className={styles.metricaIcone} style={{ background: '#eff6ff', color: '#1d4ed8' }}>
            👥
          </div>
          <div className={styles.metricaInfo}>
            <strong className={styles.metricaValor}>{metricas.total}</strong>
            <span className={styles.metricaLabel}>Total de Leads</span>
          </div>
        </div>

        <div className={`${styles.cardMetrica} ${metricas.semContato > 0 ? styles.metricaAlerta : ''}`}>
          <div
            className={styles.metricaIcone}
            style={{
              background: metricas.semContato > 0 ? '#fef2f2' : '#f0fdf4',
              color: metricas.semContato > 0 ? '#dc2626' : '#16a34a',
            }}
          >
            {metricas.semContato > 0 ? '🚨' : '✅'}
          </div>
          <div className={styles.metricaInfo}>
            <strong className={styles.metricaValor}>{metricas.semContato}</strong>
            <span className={styles.metricaLabel}>
              {metricas.semContato > 0 ? 'Aguardando 1º Contato' : 'Todos Atendidos'}
            </span>
          </div>
        </div>

        <div className={styles.cardMetrica}>
          <div className={styles.metricaIcone} style={{ background: '#f5f3ff', color: '#7c3aed' }}>
            📅
          </div>
          <div className={styles.metricaInfo}>
            <strong className={styles.metricaValor}>{metricas.visitas}</strong>
            <span className={styles.metricaLabel}>Visitas Agendadas</span>
          </div>
        </div>

        <div className={styles.cardMetrica}>
          <div className={styles.metricaIcone} style={{ background: '#fffbeb', color: '#d97706' }}>
            💰
          </div>
          <div className={styles.metricaInfo}>
            <strong className={styles.metricaValor}>{metricas.propostas}</strong>
            <span className={styles.metricaLabel}>Propostas Ativas</span>
          </div>
        </div>

        <div className={styles.cardMetrica}>
          <div className={styles.metricaIcone} style={{ background: '#ecfdf5', color: '#059669' }}>
            🏆
          </div>
          <div className={styles.metricaInfo}>
            <strong className={styles.metricaValor}>{metricas.fechados}</strong>
            <span className={styles.metricaLabel}>Negócios Fechados ({metricas.taxaConversao}%)</span>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          2. BARRA DE CONTROLE, FILTROS E BUSCA
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
          3. VISUALIZAÇÃO KANBAN (FUNIL DE VENDAS)
          ═══════════════════════════════════════════════════════════════ */}
      {modoVisualizacao === 'kanban' && (
        <section className={styles.kanbanContainer}>
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
                }}
                onDragEnter={() => setColunaHoverId(etapa.id)}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                    setColunaHoverId(null)
                  }
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  setColunaHoverId(null)
                  const leadId = e.dataTransfer.getData('text/plain') || arrastandoLeadId
                  if (leadId) {
                    handleMoverEtapa(leadId, etapa.id)
                  }
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

                {/* Lista de Cards da Etapa */}
                <div className={styles.colunaCards}>
                  {listaCards.length === 0 ? (
                    <div className={styles.colunaVazia}>
                      <span>{isColunaHover ? 'Solte para mover aqui' : 'Nenhum lead nesta etapa'}</span>
                    </div>
                  ) : (
                    listaCards.map((lead) => {
                      const horasCriacao = Math.floor(
                        (Date.now() - new Date(lead.created_at).getTime()) / (1000 * 60 * 60)
                      )
                      const fezContato = !!lead.data_primeiro_contato
                      const isArrastando = arrastandoLeadId === lead.id

                      return (
                        <div
                          key={lead.id}
                          draggable={true}
                          onDragStart={(e) => {
                            e.dataTransfer.setData('text/plain', lead.id)
                            e.dataTransfer.effectAllowed = 'move'
                            setArrastandoLeadId(lead.id)
                          }}
                          onDragEnd={() => {
                            setArrastandoLeadId(null)
                            setColunaHoverId(null)
                          }}
                          className={`${styles.cardKanban} ${isArrastando ? styles.cardArrastando : ''}`}
                          onClick={() => setLeadSelecionado(lead)}
                        >
                          {/* Topo do Card */}
                          <div className={styles.cardTopo}>
                            <div className={styles.cardClienteInfo}>
                              <strong className={styles.cardNome}>{lead.nome}</strong>
                              <span className={styles.cardTempo}>
                                {new Date(lead.created_at).toLocaleDateString('pt-BR', {
                                  day: '2-digit',
                                  month: '2-digit',
                                })}
                              </span>
                            </div>

                            {/* Badge de Temperatura */}
                            {lead.temperatura === 'quente' && (
                              <span className={styles.badgeQuente} title="Lead de Alta Prioridade">
                                🔥 Quente
                              </span>
                            )}
                          </div>

                          {/* Alerta de 1º Contato (Visão de Gestão) */}
                          <div
                            className={`${styles.tagContato} ${
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
                            ) : (
                              <span>
                                {horasCriacao >= 24 ? '🚨 Sem contato (+24h)' : horasCriacao >= 2 ? '⏳ Sem contato (+2h)' : '⏳ Aguardando 1º contato'}
                              </span>
                            )}
                          </div>

                          {/* Imóvel de Interesse */}
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
                                <span className={styles.cardImovelTitulo}>{lead.imovel.titulo}</span>
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

                          {/* Rodapé do Card */}
                          <div className={styles.cardRodape}>
                            <span className={styles.cardCorretorTag} title="Corretor responsável">
                              👔 {lead.corretor_nome || 'Equipe'}
                            </span>

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
          4. VISUALIZAÇÃO EM LISTA / TABELA DETALHADA
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

                    return (
                      <tr key={lead.id} onClick={() => setLeadSelecionado(lead)} className={styles.trLinha}>
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
                            {fezContato ? '✓ Feito' : `${horasCriacao}h sem retorno`}
                          </span>
                        </td>
                        <td>
                          <span className={styles.tabelaCorretor}>👔 {lead.corretor_nome || 'Equipe'}</span>
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
          onAtualizarLead={() => {
            onRecarregarDados()
          }}
        />
      )}
    </div>
  )
}
