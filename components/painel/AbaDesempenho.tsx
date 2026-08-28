'use client'

import { useState, useMemo } from 'react'
import { type Lead, type Imovel } from '@/lib/types'
import { formatarPreco, obterIniciaisUsuario, obterGradienteUsuario } from '@/lib/utils'
import styles from './AbaDesempenho.module.css'

interface Props {
  leads: Lead[]
  imoveis: Imovel[]
  usuarioId: string
  usuarioNome: string
  isImobiliaria: boolean
  isGestor: boolean
  isCorretor: boolean
  isCorretorAutonomo: boolean
  isCorretorEquipe: boolean
  listaCorretores: { id: string; nome: string; avatar_url?: string | null }[]
  onNavegarAba?: (aba: string) => void
  onRecarregarDados?: () => void
}

type Periodo = '7d' | 'mes' | '90d' | 'ano' | 'tudo'

export default function AbaDesempenho({
  leads,
  imoveis,
  usuarioId,
  usuarioNome,
  isImobiliaria,
  isGestor,
  isCorretor,
  isCorretorAutonomo,
  isCorretorEquipe,
  listaCorretores,
  onNavegarAba,
  onRecarregarDados,
}: Props) {
  const [periodo, setPeriodo] = useState<Periodo>('mes')
  const [corretorFiltro, setCorretorFiltro] = useState<string>('todos')
  const [recarregando, setRecarregando] = useState(false)

  async function handleRecarregar() {
    if (!onRecarregarDados) return
    setRecarregando(true)
    try {
      await onRecarregarDados()
    } finally {
      setTimeout(() => setRecarregando(false), 500)
    }
  }

  // 1. Filtragem por Período
  const leadsFiltradosPorPeriodo = useMemo(() => {
    const agora = Date.now()
    const inicioMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime()
    const inicioAno = new Date(new Date().getFullYear(), 0, 1).getTime()

    return leads.filter((lead) => {
      const dataCriacao = new Date(lead.created_at).getTime()

      if (periodo === '7d' && agora - dataCriacao > 7 * 24 * 60 * 60 * 1000) return false
      if (periodo === 'mes' && dataCriacao < inicioMes) return false
      if (periodo === '90d' && agora - dataCriacao > 90 * 24 * 60 * 60 * 1000) return false
      if (periodo === 'ano' && dataCriacao < inicioAno) return false

      return true
    })
  }, [leads, periodo])

  const leadsFiltrados = useMemo(() => {
    if (corretorFiltro === 'todos') return leadsFiltradosPorPeriodo
    return leadsFiltradosPorPeriodo.filter((l) => l.corretor_id === corretorFiltro)
  }, [leadsFiltradosPorPeriodo, corretorFiltro])

  // 2. KPIs Executivos
  const metricas = useMemo(() => {
    const totalLeads = leadsFiltrados.length
    const contatados = leadsFiltrados.filter((l) => !!l.data_primeiro_contato)
    const visitas = leadsFiltrados.filter((l) => l.status === 'visita_agendada' || !!l.data_visita)
    const propostas = leadsFiltrados.filter((l) => l.status === 'proposta')
    const emNegociacao = leadsFiltrados.filter((l) => l.status === 'negociacao')
    const fechadosHomologados = leadsFiltrados.filter((l) => l.status === 'fechado' && l.status_homologacao !== 'pendente')
    const fechadosPendentes = leadsFiltrados.filter((l) => l.status === 'fechado' && l.status_homologacao === 'pendente')
    const perdidos = leadsFiltrados.filter((l) => l.status === 'perdido')

    const vgvPropostas = [...propostas, ...emNegociacao].reduce((acc, l) => acc + (l.valor_proposta || l.imovel?.preco || 0), 0)
    const vgvFechado = fechadosHomologados.reduce((acc, l) => acc + (l.valor_proposta || l.imovel?.preco || 0), 0)
    const vgvPendente = fechadosPendentes.reduce((acc, l) => acc + (l.valor_proposta || l.imovel?.preco || 0), 0)

    let somaMinutos = 0
    let contatadosComTempo = 0
    contatados.forEach((l) => {
      if (l.data_primeiro_contato) {
        const diffMs = new Date(l.data_primeiro_contato).getTime() - new Date(l.created_at).getTime()
        if (diffMs > 0) {
          somaMinutos += diffMs / (1000 * 60)
          contatadosComTempo++
        }
      }
    })

    const tempoMedioMinutos = contatadosComTempo > 0 ? Math.round(somaMinutos / contatadosComTempo) : 0
    const taxaConversao = totalLeads > 0 ? ((fechadosHomologados.length / totalLeads) * 100).toFixed(1) : '0.0'
    const taxaAtendimento = totalLeads > 0 ? Math.round((contatados.length / totalLeads) * 100) : 0
    const ticketMedio = fechadosHomologados.length > 0 ? Math.round(vgvFechado / fechadosHomologados.length) : 0

    return {
      totalLeads,
      contatados: contatados.length,
      taxaAtendimento,
      tempoMedioMinutos,
      visitas: visitas.length,
      propostas: propostas.length,
      emNegociacao: emNegociacao.length,
      fechados: fechadosHomologados.length,
      fechadosPendentes: fechadosPendentes.length,
      perdidos: perdidos.length,
      vgvPropostas,
      vgvFechado,
      vgvPendente,
      taxaConversao,
      ticketMedio,
    }
  }, [leadsFiltrados])

  // 3. Tabela Executiva de Corretores
  const tabelaCorretores = useMemo(() => {
    if (listaCorretores.length === 0) return []

    return listaCorretores
      .map((corretor) => {
        const leadsCorretor = leadsFiltradosPorPeriodo.filter((l) => l.corretor_id === corretor.id)
        const total = leadsCorretor.length
        const contatados = leadsCorretor.filter((l) => !!l.data_primeiro_contato)
        const noSla = leadsCorretor.filter((l) => {
          if (!l.data_primeiro_contato) return false
          const diffHs = (new Date(l.data_primeiro_contato).getTime() - new Date(l.created_at).getTime()) / (1000 * 60 * 60)
          return diffHs <= 2
        })
        const visitas = leadsCorretor.filter((l) => l.status === 'visita_agendada' || !!l.data_visita).length
        const propostas = leadsCorretor.filter((l) => l.status === 'proposta').length
        const negociacoes = leadsCorretor.filter((l) => l.status === 'negociacao').length
        const fechadosHomologados = leadsCorretor.filter((l) => l.status === 'fechado' && l.status_homologacao !== 'pendente').length
        const fechadosPendentes = leadsCorretor.filter((l) => l.status === 'fechado' && l.status_homologacao === 'pendente').length
        const vgvFechado = leadsCorretor
          .filter((l) => l.status === 'fechado' && l.status_homologacao !== 'pendente')
          .reduce((acc, l) => acc + (l.valor_proposta || l.imovel?.preco || 0), 0)

        const taxaConversao = total > 0 ? (fechadosHomologados / total) * 100 : 0
        const taxaSLA = total > 0 ? Math.round((noSla.length / total) * 100) : 0
        const ticketMedioCorretor = fechadosHomologados > 0 ? Math.round(vgvFechado / fechadosHomologados) : 0

        return {
          id: corretor.id,
          nome: corretor.nome,
          avatar_url: corretor.avatar_url || null,
          total,
          contatados: contatados.length,
          taxaSLA,
          visitas,
          propostas,
          negociacoes,
          fechados: fechadosHomologados,
          fechadosPendentes,
          vgvFechado,
          taxaConversao: taxaConversao.toFixed(1),
          ticketMedioCorretor,
        }
      })
      .sort((a, b) => b.vgvFechado - a.vgvFechado || b.fechados - a.fechados || b.total - a.total)
  }, [listaCorretores, leadsFiltradosPorPeriodo])

  // 4. Motivos de Perda
  const motivosPerda = useMemo(() => {
    const perdidos = leadsFiltrados.filter((l) => l.status === 'perdido')
    if (perdidos.length === 0) return []

    const contagem: Record<string, number> = {}
    perdidos.forEach((l) => {
      const motivo = l.motivo_perda || 'Sem retorno do cliente'
      contagem[motivo] = (contagem[motivo] || 0) + 1
    })

    return Object.entries(contagem)
      .map(([motivo, qtd]) => ({
        motivo,
        qtd,
        porcentagem: Math.round((qtd / perdidos.length) * 100),
      }))
      .sort((a, b) => b.qtd - a.qtd)
  }, [leadsFiltrados])

  return (
    <div className={styles.container}>
      {/* ── PAINEL INTEGRADO MASTER: FILTROS, KPIS, FUNIL & ANALYTICS ── */}
      <section className={styles.painelMasterMetricas}>
        {/* 1. CABEÇALHO & FILTROS GLOBAIS */}
        <div className={styles.masterCabecalho}>
          <div className={styles.topoInfo}>
            <h2 className={styles.topoTitulo}>
              Desempenho & Métricas
            </h2>
            <p className={styles.topoSubtitulo}>
              Visão consolidada do pipeline de vendas, produtividade e conversão de leads.
            </p>
          </div>

          <div className={styles.filtrosDireita}>
            {/* Seletor de Período */}
            <div className={styles.grupoPeriodos}>
              {(
                [
                  { id: '7d', label: '7 dias' },
                  { id: 'mes', label: 'Este Mês' },
                  { id: '90d', label: '90 dias' },
                  { id: 'ano', label: 'Este Ano' },
                  { id: 'tudo', label: 'Tudo' },
                ] as { id: Periodo; label: string }[]
              ).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`${styles.btnPeriodo} ${periodo === p.id ? styles.btnPeriodoAtivo : ''}`}
                  onClick={() => setPeriodo(p.id)}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Filtro por Corretor (Apenas Gestão / Imobiliária) */}
            {(isImobiliaria || isGestor) && listaCorretores.length > 0 && (
              <select
                className={styles.selectCorretorFiltro}
                value={corretorFiltro}
                onChange={(e) => setCorretorFiltro(e.target.value)}
              >
                <option value="todos">Toda a Equipe</option>
                {listaCorretores.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            )}

            {onRecarregarDados && (
              <button
                type="button"
                className={styles.btnAtualizar}
                onClick={handleRecarregar}
                disabled={recarregando}
                title="Atualizar dados"
              >
                {recarregando ? 'Atualizando...' : '↻ Atualizar'}
              </button>
            )}
          </div>
        </div>

        {/* 2. SCORECARD DE KPIS EXECUTIVOS */}
        <div className={styles.gridKpis}>
          {/* Total de Leads */}
          <div className={styles.cardKpi}>
            <span className={styles.kpiRotulo}>Total de Leads</span>
            <strong className={styles.kpiValor}>{metricas.totalLeads}</strong>
            <span className={styles.kpiSub}>{metricas.taxaAtendimento}% com atendimento iniciado</span>
          </div>

          {/* Velocidade de Resposta / SLA */}
          <div className={styles.cardKpi}>
            <span className={styles.kpiRotulo}>Tempo Médio de Resposta</span>
            <strong className={styles.kpiValor}>
              {metricas.tempoMedioMinutos < 60
                ? `${metricas.tempoMedioMinutos} min`
                : `${Math.round(metricas.tempoMedioMinutos / 60)} h`}
            </strong>
            <span className={styles.kpiSub}>Velocidade do 1º contato</span>
          </div>

          {/* VGV em Negociação */}
          <div className={styles.cardKpi}>
            <span className={styles.kpiRotulo}>VGV em Negociação</span>
            <strong className={styles.kpiValor}>{formatarPreco(metricas.vgvPropostas)}</strong>
            <span className={styles.kpiSub}>{metricas.propostas + metricas.emNegociacao} propostas e negociações</span>
          </div>

          {/* VGV Fechado */}
          <div className={styles.cardKpi}>
            <span className={styles.kpiRotulo}>VGV Fechado</span>
            <strong className={`${styles.kpiValor} ${styles.kpiValorDestaque}`}>{formatarPreco(metricas.vgvFechado)}</strong>
            <span className={styles.kpiSub}>{metricas.fechados} negócios homologados</span>
          </div>

          {/* Taxa de Conversão */}
          <div className={styles.cardKpi}>
            <span className={styles.kpiRotulo}>Taxa de Conversão</span>
            <strong className={styles.kpiValor}>{metricas.taxaConversao}%</strong>
            <span className={styles.kpiSub}>Leads ➔ Vendas Fechadas</span>
          </div>

          {/* Ticket Médio */}
          <div className={styles.cardKpi}>
            <span className={styles.kpiRotulo}>Ticket Médio</span>
            <strong className={styles.kpiValor}>{metricas.ticketMedio > 0 ? formatarPreco(metricas.ticketMedio) : '—'}</strong>
            <span className={styles.kpiSub}>Média por negócio fechado</span>
          </div>
        </div>

        {/* 3. GRID DUPLO: FUNIL DE VENDAS DO CRM & MOTIVOS DE PERDA */}
        <div className={styles.gridDuplo}>
          {/* Funil de Vendas do CRM */}
          <div className={styles.subBlocoAnalitico}>
            <div className={styles.subBlocoHeader}>
              <div>
                <h3 className={styles.subBlocoTitulo}>Funil de Vendas do CRM</h3>
                <p className={styles.subBlocoSubtitulo}>Volume e taxa de retenção por etapa do pipeline</p>
              </div>
              <span className={styles.secaoBadge}>{metricas.totalLeads} no funil</span>
            </div>

            <div className={styles.listaFunil}>
              {[
                { etapa: '1. Novos Contatos', qtd: metricas.totalLeads, cor: '#3b82f6' },
                { etapa: '2. Em Atendimento', qtd: metricas.contatados, cor: '#0284c7' },
                { etapa: '3. Visitas Agendadas', qtd: metricas.visitas, cor: '#6366f1' },
                { etapa: '4. Propostas', qtd: metricas.propostas, cor: '#f59e0b' },
                { etapa: '5. Em Negociação', qtd: metricas.emNegociacao, cor: '#ea580c' },
                { etapa: '6. Negócios Fechados', qtd: metricas.fechados, cor: '#16a34a' },
              ].map((item, idx) => {
                const perc = metricas.totalLeads > 0 ? Math.round((item.qtd / metricas.totalLeads) * 100) : 0
                return (
                  <div key={idx} className={styles.itemFunil}>
                    <div className={styles.itemFunilHeader}>
                      <span className={styles.itemFunilEtapa}>{item.etapa}</span>
                      <span className={styles.itemFunilQtd}>
                        <strong>{item.qtd}</strong> <span style={{ color: '#64748b', fontSize: '0.75rem' }}>({perc}%)</span>
                      </span>
                    </div>
                    <div className={styles.funilBarraTrilha}>
                      <div
                        className={styles.funilBarraPreenchida}
                        style={{ width: `${perc}%`, background: item.cor }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Motivos de Perda de Leads */}
          <div className={styles.subBlocoAnalitico}>
            <div className={styles.subBlocoHeader}>
              <div>
                <h3 className={styles.subBlocoTitulo}>Motivos de Perda / Descarte</h3>
                <p className={styles.subBlocoSubtitulo}>Diagnóstico de oportunidades não convertidas</p>
              </div>
              <span className={styles.secaoBadge}>{metricas.perdidos} perdas</span>
            </div>

            {motivosPerda.length === 0 ? (
              <div className={styles.vazioBox}>
                Nenhum lead com motivo de perda registrado no período selecionado.
              </div>
            ) : (
              <div className={styles.listaPerdas}>
                {motivosPerda.map((item, idx) => (
                  <div key={idx} className={styles.itemPerda}>
                    <div className={styles.itemPerdaHeader}>
                      <span className={styles.itemPerdaMotivo}>{item.motivo}</span>
                      <span className={styles.itemPerdaPorcentagem}>
                        {item.qtd} ({item.porcentagem}%)
                      </span>
                    </div>
                    <div className={styles.perdaBarraTrilha}>
                      <div
                        className={styles.perdaBarraPreenchida}
                        style={{ width: `${item.porcentagem}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 4. TABELA EXECUTIVA DE PRODUTIVIDADE DA EQUIPE (SE HOUVER EQUIPE) */}
        {(isImobiliaria || isGestor) && tabelaCorretores.length > 0 && (
          <div className={styles.subBlocoTabela}>
            <div className={styles.subBlocoHeader}>
              <div>
                <h3 className={styles.subBlocoTitulo}>Produtividade Comercial da Equipe</h3>
                <p className={styles.subBlocoSubtitulo}>Desempenho individual, SLA e volume financeiro no período</p>
              </div>
              <span className={styles.secaoBadge}>{tabelaCorretores.length} corretores ativos</span>
            </div>

            <div className={styles.tabelaWrapper}>
              <table className={styles.tabela}>
                <thead>
                  <tr>
                    <th style={{ width: '48px', textAlign: 'center' }}>#</th>
                    <th>Corretor</th>
                    <th style={{ textAlign: 'right' }}>Leads</th>
                    <th style={{ textAlign: 'center' }}>SLA (&lt; 2h)</th>
                    <th style={{ textAlign: 'right' }}>Visitas</th>
                    <th style={{ textAlign: 'right' }}>Propostas/Neg.</th>
                    <th style={{ textAlign: 'right' }}>Fechados</th>
                    <th style={{ textAlign: 'right' }}>VGV Fechado</th>
                    <th style={{ textAlign: 'right' }}>Conversão</th>
                    <th style={{ textAlign: 'right' }}>Ticket Médio</th>
                  </tr>
                </thead>
                <tbody>
                  {tabelaCorretores.map((c, i) => (
                    <tr key={c.id}>
                      <td style={{ textAlign: 'center', fontWeight: 600, color: '#64748b' }}>
                        {i + 1}
                      </td>
                      <td>
                        <div className={styles.corretorCell}>
                          {c.avatar_url ? (
                            <img
                              src={c.avatar_url}
                              alt={c.nome}
                              className={styles.corretorAvatar}
                            />
                          ) : (
                            <div
                              className={styles.corretorAvatarFallback}
                              style={{ background: obterGradienteUsuario(c.nome) }}
                            >
                              {obterIniciaisUsuario(c.nome)}
                            </div>
                          )}
                          <span className={styles.corretorNome}>{c.nome}</span>
                        </div>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{c.total}</td>
                      <td style={{ textAlign: 'center' }}>
                        <span className={c.taxaSLA >= 70 ? styles.badgeSlaBom : c.taxaSLA >= 40 ? styles.badgeSlaMedio : styles.badgeSlaBaixo}>
                          {c.taxaSLA}%
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>{c.visitas}</td>
                      <td style={{ textAlign: 'right' }}>
                        {c.propostas + c.negociacoes}
                        {c.negociacoes > 0 && (
                          <span style={{ fontSize: '0.72rem', color: '#ea580c', marginLeft: '4px', fontWeight: 600 }} title={`${c.negociacoes} em negociação avançada`}>
                            ({c.negociacoes} 🤝)
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <strong>{c.fechados}</strong>
                        {c.fechadosPendentes > 0 && (
                          <span className={styles.badgePendente} title={`${c.fechadosPendentes} aguardando homologação`}>
                            +{c.fechadosPendentes} pend.
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>
                        {formatarPreco(c.vgvFechado)}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600, color: Number(c.taxaConversao) > 0 ? '#15803d' : '#64748b' }}>
                        {c.taxaConversao}%
                      </td>
                      <td style={{ textAlign: 'right', color: '#475569' }}>
                        {c.ticketMedioCorretor > 0 ? formatarPreco(c.ticketMedioCorretor) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
