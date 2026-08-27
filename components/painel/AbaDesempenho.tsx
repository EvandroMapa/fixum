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

  // 2. KPIs Globais
  const metricas = useMemo(() => {
    const totalLeads = leadsFiltrados.length
    const contatados = leadsFiltrados.filter((l) => !!l.data_primeiro_contato)
    const visitas = leadsFiltrados.filter((l) => l.status === 'visita_agendada' || !!l.data_visita)
    const propostas = leadsFiltrados.filter((l) => l.status === 'proposta' || l.status === 'negociacao' || !!l.valor_proposta)
    const fechadosHomologados = leadsFiltrados.filter((l) => l.status === 'fechado' && l.status_homologacao !== 'pendente')
    const fechadosPendentes = leadsFiltrados.filter((l) => l.status === 'fechado' && l.status_homologacao === 'pendente')
    const perdidos = leadsFiltrados.filter((l) => l.status === 'perdido')

    // VGV de propostas e fechados homologados
    const vgvPropostas = propostas.reduce((acc, l) => acc + (l.valor_proposta || l.imovel?.preco || 0), 0)
    const vgvFechado = fechadosHomologados.reduce((acc, l) => acc + (l.valor_proposta || l.imovel?.preco || 0), 0)
    const vgvPendente = fechadosPendentes.reduce((acc, l) => acc + (l.valor_proposta || l.imovel?.preco || 0), 0)

    // Tempo médio de 1º contato (em minutos)
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

    return {
      totalLeads,
      contatados: contatados.length,
      taxaAtendimento,
      tempoMedioMinutos,
      visitas: visitas.length,
      propostas: propostas.length,
      fechados: fechadosHomologados.length,
      fechadosPendentes: fechadosPendentes.length,
      perdidos: perdidos.length,
      vgvPropostas,
      vgvFechado,
      vgvPendente,
      taxaConversao,
    }
  }, [leadsFiltrados])

  // 3. Ranking de Corretores
  const rankingCorretores = useMemo(() => {
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
        const propostas = leadsCorretor.filter((l) => l.status === 'proposta' || l.status === 'negociacao' || !!l.valor_proposta).length
        const fechadosHomologados = leadsCorretor.filter((l) => l.status === 'fechado' && l.status_homologacao !== 'pendente').length
        const fechadosPendentes = leadsCorretor.filter((l) => l.status === 'fechado' && l.status_homologacao === 'pendente').length
        const vgvFechado = leadsCorretor
          .filter((l) => l.status === 'fechado' && l.status_homologacao !== 'pendente')
          .reduce((acc, l) => acc + (l.valor_proposta || l.imovel?.preco || 0), 0)

        const taxaConversao = total > 0 ? (fechadosHomologados / total) * 100 : 0
        const taxaSLA = total > 0 ? Math.round((noSla.length / total) * 100) : 0

        // Score ponderado para ranking: Fechamento Homologado (100 pts), Proposta (30 pts), Visita (10 pts), Atendimento no SLA (5 pts)
        const score = fechadosHomologados * 100 + propostas * 30 + visitas * 10 + noSla.length * 5

        return {
          id: corretor.id,
          nome: corretor.nome,
          avatar_url: corretor.avatar_url || null,
          total,
          contatados: contatados.length,
          taxaSLA,
          visitas,
          propostas,
          fechados: fechadosHomologados,
          fechadosPendentes,
          vgvFechado,
          taxaConversao: taxaConversao.toFixed(1),
          score,
        }
      })
      .sort((a, b) => b.score - a.score || b.fechados - a.fechados || b.vgvFechado - a.vgvFechado)
  }, [listaCorretores, leadsFiltradosPorPeriodo])

  // 4. Motivos de Perda Agrupados
  const motivosPerda = useMemo(() => {
    const perdidos = leadsFiltrados.filter((l) => l.status === 'perdido')
    if (perdidos.length === 0) return []

    const contagem: Record<string, number> = {}
    perdidos.forEach((l) => {
      const motivo = l.motivo_perda || 'Sem resposta do cliente'
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
      {/* ── CABEÇALHO EXCLUSIVO PARA IMPRESSÃO / EXPORTAÇÃO PDF ── */}
      <div className={styles.cabecalhoImpressao}>
        <div className={styles.cabecalhoImpressaoTopo}>
          <div>
            <h1 className={styles.imobiliariaImpressaoTitulo}>FIXUM IMÓVEIS • RELATÓRIO EXECUTIVO</h1>
            <h2 className={styles.subtituloImpressao}>Inteligência de Vendas, SLA e Ranking de Produtividade</h2>
          </div>
          <div className={styles.dataEmissaoImpressao}>
            <span><strong>Imobiliária:</strong> {usuarioNome}</span>
            <span><strong>Emissão:</strong> {new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}</span>
            <span><strong>Período:</strong> {periodo === '7d' ? 'Últimos 7 dias' : periodo === 'mes' ? 'Mês Atual' : periodo === '90d' ? 'Últimos 90 dias' : periodo === 'ano' ? 'Ano Atual' : 'Histórico Geral'}</span>
          </div>
        </div>
      </div>

      {/* ── 1. TOPO & FILTROS ── */}
      <section className={styles.topoFiltros}>
        <div className={styles.topoInfo}>
          <h2 className={styles.topoTitulo}>
            <span>📈</span> Inteligência de Vendas & Desempenho
          </h2>
          <p className={styles.topoSubtitulo}>
            Métricas de conversão, velocidade de resposta (SLA) e ranking de corretores da Fixum.
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
                { id: 'ano', label: 'Ano' },
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
              <option value="todos">👔 Toda a Equipe</option>
              {listaCorretores.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          )}

          {/* Botão Exportar Relatório PDF */}
          <button
            type="button"
            className={styles.btnExportarPdf}
            onClick={() => window.print()}
            title="Exportar ou imprimir relatório em PDF"
          >
            <span>📄</span> Exportar PDF
          </button>
        </div>
      </section>

      {/* ── 2. KPIS EXECUTIVOS ── */}
      <section className={styles.gridKpis}>
        {/* Total de Leads */}
        <div className={styles.cardKpi}>
          <div className={`${styles.kpiIconeWrapper} ${styles.kpiAzul}`}>👥</div>
          <div className={styles.kpiInfo}>
            <strong className={styles.kpiValor}>{metricas.totalLeads}</strong>
            <span className={styles.kpiLabel}>Leads Recebidos</span>
            <span className={styles.kpiSubinfo}>{metricas.taxaAtendimento}% atendidos</span>
          </div>
        </div>

        {/* Tempo de Resposta */}
        <div className={styles.cardKpi}>
          <div className={`${styles.kpiIconeWrapper} ${styles.kpiLaranja}`}>⚡</div>
          <div className={styles.kpiInfo}>
            <strong className={styles.kpiValor}>
              {metricas.tempoMedioMinutos < 60
                ? `${metricas.tempoMedioMinutos}m`
                : `${Math.round(metricas.tempoMedioMinutos / 60)}h`}
            </strong>
            <span className={styles.kpiLabel}>Tempo Médio de 1º Contato</span>
            <span className={styles.kpiSubinfo}>SLA Ideal: &lt; 2h</span>
          </div>
        </div>

        {/* VGV em Negociação */}
        <div className={styles.cardKpi}>
          <div className={`${styles.kpiIconeWrapper} ${styles.kpiRoxo}`}>💼</div>
          <div className={styles.kpiInfo}>
            <strong className={styles.kpiValor}>{formatarPreco(metricas.vgvPropostas)}</strong>
            <span className={styles.kpiLabel}>VGV em Negociação</span>
            <span className={styles.kpiSubinfo}>{metricas.propostas} propostas ativas</span>
          </div>
        </div>

        {/* VGV Fechado & Taxa de Conversão */}
        <div className={styles.cardKpi}>
          <div className={`${styles.kpiIconeWrapper} ${styles.kpiVerde}`}>🏆</div>
          <div className={styles.kpiInfo}>
            <strong className={styles.kpiValor}>{formatarPreco(metricas.vgvFechado)}</strong>
            <span className={styles.kpiLabel}>VGV Fechado ({metricas.taxaConversao}%)</span>
            <span className={styles.kpiSubinfo}>{metricas.fechados} negócios concluídos</span>
          </div>
        </div>
      </section>

      {/* ── 3. PÓDIO TOP 3 CORRETORES (SE HOUVER EQUIPE) ── */}
      {(isImobiliaria || isGestor) && rankingCorretores.length >= 2 && (
        <section className={styles.secaoPodio}>
          <div className={styles.secaoCabecalho}>
            <div className={styles.secaoTitulo}>
              <span>🏆</span> Pódio de Vendas da Imobiliária
            </div>
            <span className={styles.secaoBadge}>Top 3 do Período</span>
          </div>

          <div className={styles.gridPodio}>
            {/* 2º Lugar (Prata) */}
            {rankingCorretores[1] && (
              <div className={`${styles.cardPodio} ${styles.podioPrata}`}>
                <span className={styles.medalhaBadge}>🥈</span>
                <span className={styles.seloHomenagemSecundario}>VICE-CAMPEÃO</span>
                {rankingCorretores[1].avatar_url ? (
                  <img
                    src={rankingCorretores[1].avatar_url}
                    alt={rankingCorretores[1].nome}
                    className={`${styles.podioFotoImg} ${styles.podioFotoPrata}`}
                  />
                ) : (
                  <div
                    className={`${styles.podioAvatar} ${styles.podioAvatarPrata}`}
                    style={{ background: obterGradienteUsuario(rankingCorretores[1].nome) }}
                  >
                    {obterIniciaisUsuario(rankingCorretores[1].nome)}
                  </div>
                )}
                <strong className={styles.podioNome}>{rankingCorretores[1].nome}</strong>
                <div className={styles.podioEstatisticas}>
                  <div className={styles.podioStatItem}>
                    <span className={styles.podioStatValor}>{rankingCorretores[1].fechados}</span>
                    <span className={styles.podioStatLabel}>Fechados</span>
                  </div>
                  <div className={styles.podioStatItem}>
                    <span className={styles.podioStatValor}>{formatarPreco(rankingCorretores[1].vgvFechado)}</span>
                    <span className={styles.podioStatLabel}>VGV</span>
                  </div>
                </div>
                <span className={styles.podioTaxaBadge}>{rankingCorretores[1].taxaConversao}% Conversão</span>
              </div>
            )}

            {/* 1º Lugar (Ouro - Grande Campeão / Homenagem) */}
            {rankingCorretores[0] && (
              <div className={`${styles.cardPodio} ${styles.podioOuro}`}>
                <span className={styles.medalhaBadge}>🥇</span>
                <span className={styles.seloCampeaoHomenagem}>👑 CORRETOR DESTAQUE</span>
                {rankingCorretores[0].avatar_url ? (
                  <img
                    src={rankingCorretores[0].avatar_url}
                    alt={rankingCorretores[0].nome}
                    className={`${styles.podioFotoImg} ${styles.podioFotoOuro}`}
                  />
                ) : (
                  <div
                    className={`${styles.podioAvatar} ${styles.podioAvatarOuro}`}
                    style={{ background: obterGradienteUsuario(rankingCorretores[0].nome) }}
                  >
                    {obterIniciaisUsuario(rankingCorretores[0].nome)}
                  </div>
                )}
                <strong className={`${styles.podioNome} ${styles.podioNomeOuro}`}>{rankingCorretores[0].nome}</strong>
                <div className={styles.podioEstatisticas}>
                  <div className={styles.podioStatItem}>
                    <span className={styles.podioStatValor}>{rankingCorretores[0].fechados}</span>
                    <span className={styles.podioStatLabel}>Fechados</span>
                  </div>
                  <div className={styles.podioStatItem}>
                    <span className={styles.podioStatValor}>{formatarPreco(rankingCorretores[0].vgvFechado)}</span>
                    <span className={styles.podioStatLabel}>VGV</span>
                  </div>
                </div>
                <span className={styles.podioTaxaBadge} style={{ background: '#d97706' }}>
                  {rankingCorretores[0].taxaConversao}% Conversão
                </span>
              </div>
            )}

            {/* 3º Lugar (Bronze) */}
            {rankingCorretores[2] && (
              <div className={`${styles.cardPodio} ${styles.podioBronze}`}>
                <span className={styles.medalhaBadge}>🥉</span>
                <span className={styles.seloHomenagemSecundario}>3º LUGAR</span>
                {rankingCorretores[2].avatar_url ? (
                  <img
                    src={rankingCorretores[2].avatar_url}
                    alt={rankingCorretores[2].nome}
                    className={`${styles.podioFotoImg} ${styles.podioFotoBronze}`}
                  />
                ) : (
                  <div
                    className={`${styles.podioAvatar} ${styles.podioAvatarBronze}`}
                    style={{ background: obterGradienteUsuario(rankingCorretores[2].nome) }}
                  >
                    {obterIniciaisUsuario(rankingCorretores[2].nome)}
                  </div>
                )}
                <strong className={styles.podioNome}>{rankingCorretores[2].nome}</strong>
                <div className={styles.podioEstatisticas}>
                  <div className={styles.podioStatItem}>
                    <span className={styles.podioStatValor}>{rankingCorretores[2].fechados}</span>
                    <span className={styles.podioStatLabel}>Fechados</span>
                  </div>
                  <div className={styles.podioStatItem}>
                    <span className={styles.podioStatValor}>{formatarPreco(rankingCorretores[2].vgvFechado)}</span>
                    <span className={styles.podioStatLabel}>VGV</span>
                  </div>
                </div>
                <span className={styles.podioTaxaBadge}>{rankingCorretores[2].taxaConversao}% Conversão</span>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── 4. TABELA COMPLETA DE DESEMPENHO DOS CORRETORES ── */}
      {(isImobiliaria || isGestor) && rankingCorretores.length > 0 && (
        <section className={styles.cardSecao}>
          <div className={styles.secaoCabecalho}>
            <div className={styles.secaoTitulo}>
              <span>📊</span> Tabela Geral de Produtividade dos Corretores
            </div>
            <span className={styles.secaoBadge}>{rankingCorretores.length} corretores</span>
          </div>

          <div className={styles.tabelaRankingWrapper}>
            <table className={styles.tabelaRanking}>
              <thead>
                <tr>
                  <th>Pos.</th>
                  <th>Corretor</th>
                  <th>Leads</th>
                  <th>SLA (&lt; 2h)</th>
                  <th>Visitas</th>
                  <th>Propostas</th>
                  <th>Fechados</th>
                  <th>VGV Fechado</th>
                  <th>Conversão</th>
                </tr>
              </thead>
              <tbody>
                {rankingCorretores.map((c, i) => (
                  <tr key={c.id}>
                    <td className={styles.posicaoCell}>
                      {i === 0 ? '🥇 1º' : i === 1 ? '🥈 2º' : i === 2 ? '🥉 3º' : `${i + 1}º`}
                    </td>
                    <td>
                      <div className={styles.corretorCell}>
                        {c.avatar_url ? (
                          <img
                            src={c.avatar_url}
                            alt={c.nome}
                            className={styles.corretorAvatarMiniImg}
                          />
                        ) : (
                          <div
                            className={styles.corretorAvatarMini}
                            style={{ background: obterGradienteUsuario(c.nome) }}
                          >
                            {obterIniciaisUsuario(c.nome)}
                          </div>
                        )}
                        <span className={styles.corretorNomeTexto}>{c.nome}</span>
                      </div>
                    </td>
                    <td><strong>{c.total}</strong></td>
                    <td>
                      <div className={styles.barraTaxaSLA}>
                        <div className={styles.progressoTrilha}>
                          <div
                            className={styles.progressoPreenchido}
                            style={{
                              width: `${c.taxaSLA}%`,
                              background: c.taxaSLA >= 70 ? '#16a34a' : c.taxaSLA >= 40 ? '#f59e0b' : '#ef4444',
                            }}
                          />
                        </div>
                        <span>{c.taxaSLA}%</span>
                      </div>
                    </td>
                    <td>{c.visitas}</td>
                    <td>{c.propostas}</td>
                    <td>
                      <strong>{c.fechados}</strong>{' '}
                      {c.fechadosPendentes > 0 ? (
                        <span style={{ color: '#d97706', fontSize: '0.72rem', fontWeight: 600 }} title={`${c.fechadosPendentes} fechamento(s) aguardando homologação do gestor`}>
                          (+{c.fechadosPendentes} ⏳)
                        </span>
                      ) : null}
                    </td>
                    <td><strong>{formatarPreco(c.vgvFechado)}</strong></td>
                    <td>
                      <span
                        style={{
                          fontWeight: '800',
                          color: Number(c.taxaConversao) > 0 ? '#16a34a' : '#64748b',
                        }}
                      >
                        {c.taxaConversao}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ── 5. GRID DUPLO: FUNIL DE CONVERSÃO & MOTIVOS DE PERDA ── */}
      <div className={styles.gridDuplo}>
        {/* Funil de Vendas Global */}
        <section className={styles.cardSecao}>
          <div className={styles.secaoCabecalho}>
            <div className={styles.secaoTitulo}>
              <span>🔻</span> Funil de Conversão do CRM
            </div>
            <span className={styles.secaoBadge}>{metricas.totalLeads} no funil</span>
          </div>

          <div className={styles.listaFunil}>
            {[
              { etapa: 'Novos Contatos', qtd: metricas.totalLeads, cor: '#3b82f6' },
              { etapa: 'Atendimento Iniciado', qtd: metricas.contatados, cor: '#0ea5e9' },
              { etapa: 'Visitas Agendadas', qtd: metricas.visitas, cor: '#8b5cf6' },
              { etapa: 'Propostas em Negociação', qtd: metricas.propostas, cor: '#f59e0b' },
              { etapa: 'Negócios Fechados', qtd: metricas.fechados, cor: '#10b981' },
            ].map((item, idx) => {
              const perc = metricas.totalLeads > 0 ? Math.round((item.qtd / metricas.totalLeads) * 100) : 0
              return (
                <div key={idx} className={styles.itemFunil}>
                  <div className={styles.itemFunilHeader}>
                    <span className={styles.itemFunilEtapa}>{item.etapa}</span>
                    <span className={styles.itemFunilQtd}>
                      {item.qtd} ({perc}%)
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
        </section>

        {/* Motivos de Perda */}
        <section className={styles.cardSecao}>
          <div className={styles.secaoCabecalho}>
            <div className={styles.secaoTitulo}>
              <span>📉</span> Motivos de Perda de Leads
            </div>
            <span className={styles.secaoBadge}>{metricas.perdidos} perdas</span>
          </div>

          {motivosPerda.length === 0 ? (
            <p style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '0.82rem', padding: '1rem 0' }}>
              Nenhum lead com motivo de perda registrado no período selecionado.
            </p>
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
        </section>
      </div>
    </div>
  )
}
