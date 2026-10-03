'use client'

import React from 'react'
import { formatarMoeda } from '@/lib/planos'
import { MetricasBI, PeriodoAnalytics } from '@/lib/admin-service'
import styles from './AbaAnalyticsRegional.module.css'
import Icone from '@/components/ui/Icone'

interface AbaAnalyticsRegionalProps {
  metricas: MetricasBI
  periodo: PeriodoAnalytics
  setPeriodo: (p: PeriodoAnalytics) => void
  regiao: string
  setRegiao: (r: string) => void
  cidadesDisponiveis: string[]
}

export default function AbaAnalyticsRegional({
  metricas,
  periodo,
  setPeriodo,
  regiao,
  setRegiao,
  cidadesDisponiveis,
}: AbaAnalyticsRegionalProps) {
  return (
    <div className={styles.containerAnalytics}>
      {/* ── BARRA DE FILTROS SUPERIOR (ESCOPO & PERÍODO) ── */}
      <div className={styles.barraFiltros}>
        <div className={styles.filtroGrupo}>
          <label className={styles.labelFiltro}>
            <span className={styles.iconeFiltro}><Icone nome="local" tamanho={16} /></span>
            <strong>Escopo geográfico / região:</strong>
          </label>
          <div className={styles.botoesRegiao}>
            <button
              type="button"
              className={`${styles.btnRegiao} ${regiao === 'todas' ? styles.btnRegiaoAtivo : ''}`}
              onClick={() => setRegiao('todas')}
            >
 Todas as regiões (geral)
 </button>
            {cidadesDisponiveis.map((cid) => (
              <button
                key={cid}
                type="button"
                className={`${styles.btnRegiao} ${regiao.toLowerCase() === cid.toLowerCase() ? styles.btnRegiaoAtivo : ''}`}
                onClick={() => setRegiao(cid)}
              >
                <Icone nome="local" tamanho={16} /> {cid}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.filtroPeriodo}>
          <label className={styles.labelFiltro}>
            <span className={styles.iconeFiltro}><Icone nome="calendario" tamanho={16} /></span>
            <strong>Período:</strong>
          </label>
          <div className={styles.seletorPeriodo}>
            {(['7d', '30d', 'mes', 'ano', 'tudo'] as PeriodoAnalytics[]).map((p) => {
              const labelMap: Record<PeriodoAnalytics, string> = {
                '7d': '7 Dias',
                '30d': '30 Dias',
                'mes': 'Este Mês',
                'ano': 'Este Ano',
                'tudo': 'Geral Completo',
              }
              return (
                <button
                  key={p}
                  type="button"
                  className={`${styles.btnPeriodo} ${periodo === p ? styles.btnPeriodoAtivo : ''}`}
                  onClick={() => setPeriodo(p)}
                >
                  {labelMap[p]}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── BADGE DE ESCOPO ATUAL ── */}
      <div className={styles.bannerEscopo}>
        <span>
          Visualizando inteligência e faturamento de: <strong>{regiao === 'todas' ? 'Toda a plataforma Fixum (geral)' : `Região de ${regiao}`}</strong>
        </span>
        <span className={styles.tagPeriodo}>
          {periodo === '7d' && 'Últimos 7 dias'}
          {periodo === '30d' && 'Últimos 30 dias'}
          {periodo === 'mes' && 'Mês Corrente'}
          {periodo === 'ano' && 'Ano Vigente'}
          {periodo === 'tudo' && 'Histórico Total'}
        </span>
      </div>

      {/* ── GRID DE KPIS PRINCIPAIS (RECEITA & VENDAS) ── */}
      <div className={styles.gridKpis}>
        {/* MRR */}
        <div className={`${styles.cardKpi} ${styles.kpiVerde}`}>
          <div className={styles.kpiInfo}>
            <span className={styles.kpiTitulo}>MRR (receita recorrente)</span>
            <div className={styles.kpiNumero}>{formatarMoeda(metricas.mrr)}</div>
            <span className={styles.kpiDesc}>Mensalidade ativa na região</span>
          </div>
          <div className={styles.kpiIcone}><Icone nome="moeda" tamanho={16} /></div>
        </div>

        {/* ARR */}
        <div className={`${styles.cardKpi} ${styles.kpiAzul}`}>
          <div className={styles.kpiInfo}>
            <span className={styles.kpiTitulo}>ARR projetado</span>
            <div className={styles.kpiNumero}>{formatarMoeda(metricas.arr)}</div>
            <span className={styles.kpiDesc}>Projeção anualizada (MRR x 12)</span>
          </div>
          <div className={styles.kpiIcone}><Icone nome="tendencia" tamanho={16} /></div>
        </div>

        {/* FATURAMENTO REALIZADO NO PERÍODO */}
        <div className={`${styles.cardKpi} ${styles.kpiRoxo}`}>
          <div className={styles.kpiInfo}>
            <span className={styles.kpiTitulo}>Faturamento no período</span>
            <div className={styles.kpiNumero}>{formatarMoeda(metricas.faturamentoPeriodo)}</div>
            <span className={styles.kpiDesc}>{metricas.totalVendasPeriodo} fatura(s) paga(s)</span>
          </div>
          <div className={styles.kpiIcone}><Icone nome="cartao" tamanho={16} /></div>
        </div>

        {/* TICKET MÉDIO */}
        <div className={`${styles.cardKpi} ${styles.kpiDourado}`}>
          <div className={styles.kpiInfo}>
            <span className={styles.kpiTitulo}>Ticket médio por venda</span>
            <div className={styles.kpiNumero}>{formatarMoeda(metricas.ticketMedio)}</div>
            <span className={styles.kpiDesc}>Valor médio por transação</span>
          </div>
          <div className={styles.kpiIcone}><Icone nome="etiqueta" tamanho={16} /></div>
        </div>
      </div>

      {/* ── GRID DE CRESCIMENTO: CONTRATAÇÕES vs CANCELAMENTOS (NET GROWTH & CHURN) ── */}
      <div className={styles.secaoHeader}>
        <h2 className={styles.secaoTitulo}>Contratações, cancelamentos & retenção</h2>
        <p className={styles.secaoSub}>Balanço líquido de clientes na região selecionada</p>
      </div>

      <div className={styles.gridGrowth}>
        {/* Novas Contratações */}
        <div className={styles.cardGrowth}>
          <div className={styles.growthTopo}>
            <span className={styles.growthBadgeVerde}>+ Contratações</span>
            <span className={styles.growthIcone}><Icone nome="check" tamanho={16} /></span>
          </div>
          <div className={styles.growthValorVerde}>+{metricas.contratacoesPeriodo}</div>
          <span className={styles.growthSub}>Novas assinaturas ativadas no período</span>
        </div>

        {/* Cancelamentos */}
        <div className={styles.cardGrowth}>
          <div className={styles.growthTopo}>
            <span className={styles.growthBadgeVermelho}>- Cancelamentos</span>
            <span className={styles.growthIcone}><Icone nome="sair" tamanho={16} /></span>
          </div>
          <div className={styles.growthValorVermelho}>-{metricas.cancelamentosPeriodo}</div>
          <span className={styles.growthSub}>Assinaturas rescindidas</span>
        </div>

        {/* Net Growth Líquido */}
        <div className={styles.cardGrowth}>
          <div className={styles.growthTopo}>
            <span className={styles.growthBadgeAzul}>Net growth (líquido)</span>
            <span className={styles.growthIcone}><Icone nome="documento" tamanho={16} /></span>
          </div>
          <div className={`${styles.growthValor} ${metricas.netGrowth >= 0 ? styles.growthPositivo : styles.growthNegativo}`}>
            {metricas.netGrowth >= 0 ? `+${metricas.netGrowth}` : metricas.netGrowth}
          </div>
          <span className={styles.growthSub}>Crescimento real da carteira</span>
        </div>

        {/* Taxa de Churn e Retenção */}
        <div className={styles.cardGrowth}>
          <div className={styles.growthTopo}>
            <span className={styles.growthBadgeRoxo}>Taxa de churn & retenção</span>
            <span className={styles.growthIcone}><Icone nome="alvo" tamanho={16} /></span>
          </div>
          <div className={styles.growthDuplo}>
            <div>
              <div className={styles.taxaValor}>{metricas.taxaChurn}%</div>
              <span className={styles.taxaSub}>Churn rate</span>
            </div>
            <div className={styles.divisorVertical} />
            <div>
              <div className={styles.taxaValorVerde}>{metricas.taxaRetencao}%</div>
              <span className={styles.taxaSub}>Retenção</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── SEÇÃO DE GRÁFICOS VISUAIS E COMPOSIÇÕES ── */}
      <div className={styles.gridGraficos}>
        {/* Vendas por Plano */}
        <div className={styles.cardGrafico}>
          <h3 className={styles.cardGraficoTitulo}>Distribuição de vendas por plano</h3>
          <div className={styles.listaBarras}>
            {metricas.vendasPorPlano.length === 0 ? (
              <div className={styles.vazio}>Nenhuma venda registrada no período selecionado.</div>
            ) : (
              metricas.vendasPorPlano.map((p) => {
                const maxValor = Math.max(...metricas.vendasPorPlano.map((x) => x.totalValor), 1)
                const pct = Math.round((p.totalValor / maxValor) * 100)
                return (
                  <div key={p.planoId} className={styles.itemBarra}>
                    <div className={styles.itemBarraCabecalho}>
                      <span className={styles.itemBarraNome}>{p.nome}</span>
                      <span className={styles.itemBarraValores}>
                        <strong>{formatarMoeda(p.totalValor)}</strong> ({p.quantidade} un)
                      </span>
                    </div>
                    <div className={styles.barraFundo}>
                      <div className={styles.barraPreenchimento} style={{ width: `${Math.max(pct, 5)}%` }} />
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Motivos de Cancelamento */}
        <div className={styles.cardGrafico}>
          <h3 className={styles.cardGraficoTitulo}>Principais motivos de cancelamento</h3>
          <div className={styles.listaBarras}>
            {metricas.motivosCancelamento.length === 0 ? (
              <div className={styles.vazio}>Nenhum cancelamento no período selecionado. Excelente retenção! </div>
            ) : (
              metricas.motivosCancelamento.map((m) => (
                <div key={m.motivo} className={styles.itemBarra}>
                  <div className={styles.itemBarraCabecalho}>
                    <span className={styles.itemBarraNome}>{m.motivo}</span>
                    <span className={styles.itemBarraValores}>
                      <strong>{m.percentual}%</strong> ({m.quantidade})
                    </span>
                  </div>
                  <div className={styles.barraFundo}>
                    <div
                      className={styles.barraPreenchimentoCancelamento}
                      style={{ width: `${Math.max(m.percentual, 5)}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── RANKING DE CIDADES / REGIÕES MAIS RENTÁVEIS ── */}
      {regiao === 'todas' && (
        <div className={styles.painelRanking}>
          <div className={styles.rankingHeader}>
            <h3 className={styles.rankingTitulo}>Desempenho regional por cidade (faturamento & churn)</h3>
          </div>
          <div className={styles.tabelaWrapper}>
            <table className={styles.tabela}>
              <thead>
                <tr>
                  <th>Cidade / região</th>
                  <th>Clientes ativos</th>
                  <th>Faturamento total</th>
                  <th>Índice de churn</th>
                  <th>Ação rápida</th>
                </tr>
              </thead>
              <tbody>
                {metricas.rankingCidades.map((rc, idx) => (
                  <tr key={rc.cidade}>
                    <td>
                      <div className={styles.cidadeCell}>
                        <span className={styles.badgePosicao}>#{idx + 1}</span>
                        <strong>{rc.cidade}</strong>
                      </div>
                    </td>
                    <td>{rc.clientes} anunciante(s)</td>
                    <td><strong>{formatarMoeda(rc.faturamento)}</strong></td>
                    <td>
                      <span className={`${styles.badgeTaxa} ${rc.churnRate > 20 ? styles.taxaAlta : styles.taxaBaixa}`}>
                        {rc.churnRate}%
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className={styles.btnFiltrarCidade}
                        onClick={() => setRegiao(rc.cidade)}
                      >
                        Filtrar região →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
