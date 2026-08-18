'use client'

import { useState } from 'react'
import styles from './AbaMeuPlano.module.css'
import { Plano, Fatura, UsoPlano, MetodoPagamento } from '@/lib/types'
import { PLANOS_OFICIAIS, formatarMoeda, obterProximoPlano } from '@/lib/planos'
import ModalUpgradePlano from './ModalUpgradePlano'

interface AbaMeuPlanoProps {
  usoPlano: UsoPlano
  faturas: Fatura[]
  onAtualizarAssinatura: (novoPlano: Plano, metodo: MetodoPagamento) => Promise<void>
}

export default function AbaMeuPlano({
  usoPlano,
  faturas,
  onAtualizarAssinatura,
}: AbaMeuPlanoProps) {
  const [modalUpgradeAberto, setModalUpgradeAberto] = useState(false)
  const [planoAlvoModal, setPlanoAlvoModal] = useState<Plano | null>(null)

  const { plano, imoveisAtivos, imoveisPausados, limiteMaximo, porcentagemUso, atingiuLimite, vagasRestantes } = usoPlano
  const proximoPlano = obterProximoPlano(plano.id)

  function abrirModalUpgrade(planoEscolhido?: Plano) {
    setPlanoAlvoModal(planoEscolhido || proximoPlano || plano)
    setModalUpgradeAberto(true)
  }

  // Cor da barra de progresso
  const corProgresso = atingiuLimite
    ? '#ef4444' // vermelho
    : porcentagemUso >= 80
    ? '#f59e0b' // amarelo
    : '#10b981' // verde

  return (
    <div className={styles.container}>
      <div className={styles.cabecalhoAba}>
        <div>
          <h1 className={styles.tituloPrincipal}>Meu Plano & Assinatura</h1>
          <p className={styles.subtituloPrincipal}>
            Gerencie a capacidade de anúncios ativos e acompanhe sua utilização na Fixum
          </p>
        </div>
        <button className={styles.btnUpgradePrincipal} onClick={() => abrirModalUpgrade()}>
          ⚡ Fazer Upgrade
        </button>
      </div>

      {/* ── CARD PRINCIPAL DE STATUS ── */}
      <div className={styles.gridStatus}>
        <div className={styles.cardStatusPrincipal}>
          <div className={styles.cardStatusTopo}>
            <div>
              <span className={styles.tagStatusPlano}>Plano Atual</span>
              <h2 className={styles.nomePlanoDestaque}>{plano.nome}</h2>
            </div>
            <div className={styles.precoPlanoDestaque}>
              {plano.id === 'enterprise_plus' ? (
                <span>Sob consulta</span>
              ) : (
                <>
                  <span className={styles.valorPreco}>{formatarMoeda(plano.preco_mensal)}</span>
                  {plano.preco_mensal > 0 && <span className={styles.periodoPreco}>/mês</span>}
                </>
              )}
            </div>
          </div>

          <div className={styles.descricaoPlanoDestaque}>{plano.descricao}</div>

          {/* Barra de Progresso de Ocupação */}
          <div className={styles.secaoProgresso}>
            <div className={styles.progressoInfo}>
              <span>
                <strong>{imoveisAtivos}</strong> de <strong>{limiteMaximo >= 99999 ? '∞' : limiteMaximo}</strong> vagas ativas utilizadas
              </span>
              <span className={styles.porcentagemTexto}>{porcentagemUso}%</span>
            </div>

            <div className={styles.trilhaProgresso}>
              <div
                className={styles.barraProgresso}
                style={{ width: `${Math.min(100, Math.max(5, porcentagemUso))}%`, backgroundColor: corProgresso }}
              />
            </div>

            <div className={styles.estatisticasUso}>
              <span className={styles.tagMiniStat}>
                ✅ {imoveisAtivos} publicado(s)
              </span>
              <span className={styles.tagMiniStat}>
                ⏸️ {imoveisPausados} pausado(s)
              </span>
              <span className={styles.tagMiniStat}>
                {atingiuLimite ? (
                  <strong style={{ color: '#ef4444' }}>0 vagas restantes</strong>
                ) : (
                  <span>{vagasRestantes} vaga(s) disponível(is)</span>
                )}
              </span>
            </div>
          </div>

          {atingiuLimite && (
            <div className={styles.avisoLimite}>
              <span>⚠️</span>
              <p>
                Você atingiu o limite de imóveis ativos do seu plano. Para ativar novos anúncios, faça upgrade ou pause anúncios existentes.
              </p>
            </div>
          )}
        </div>

        {/* Card de Upgrade Recomendado */}
        {proximoPlano && (
          <div className={styles.cardProximoPlano}>
            <span className={styles.badgeProximo}>Próximo Nível</span>
            <h3>{proximoPlano.nome}</h3>
            <p className={styles.descricaoProximo}>
              Aumente sua capacidade para até <strong>{proximoPlano.limite_imoveis_max} imóveis ativos</strong> simultâneos.
            </p>

            <div className={styles.precoProximoBox}>
              <span className={styles.precoProximoValor}>{formatarMoeda(proximoPlano.preco_mensal)}</span>
              <span className={styles.precoProximoPeriodo}>/mês</span>
            </div>

            {proximoPlano.custo_unitario_max > 0 && (
              <div className={styles.custoEfetivoTag}>
                Custo de apenas {formatarMoeda(proximoPlano.custo_unitario_max)} por imóvel
              </div>
            )}

            <button
              className={styles.btnContratarProximo}
              onClick={() => abrirModalUpgrade(proximoPlano)}
            >
              Mudar para {proximoPlano.nome}
            </button>
          </div>
        )}
      </div>

      {/* ── TODOS OS PLANOS DA TABELA OFICIAL ── */}
      <div className={styles.secaoTodosPlanos}>
        <div className={styles.cabecalhoSecao}>
          <h2>Tabela de Planos e Capacidade</h2>
          <p>Escolha o plano que melhor atende ao tamanho da sua carteira de imóveis</p>
        </div>

        <div className={styles.gridTodosPlanos}>
          {PLANOS_OFICIAIS.map((p) => {
            const isAtual = p.id === plano.id
            const isProximo = proximoPlano?.id === p.id

            return (
              <div
                key={p.id}
                className={`
                  ${styles.cardTabelaPlano}
                  ${isAtual ? styles.cardTabelaPlanoAtual : ''}
                  ${isProximo ? styles.cardTabelaPlanoProximo : ''}
                `}
              >
                {isAtual && <span className={styles.badgeCardAtual}>Seu Plano Atual</span>}
                {isProximo && <span className={styles.badgeCardRecomendado}>Recomendado</span>}

                <h3 className={styles.cardPlanoNome}>{p.nome}</h3>

                <div className={styles.cardPlanoCapacidade}>
                  <strong>{p.limite_imoveis_max >= 99999 ? '+500' : p.limite_imoveis_max}</strong>{' '}
                  {p.limite_imoveis_max === 1 ? 'imóvel ativo' : 'imóveis ativos'}
                </div>

                <div className={styles.cardPlanoPreco}>
                  {p.id === 'enterprise_plus' ? (
                    <span className={styles.valorConsulta}>Sob consulta</span>
                  ) : (
                    <>
                      <span className={styles.cifrao}>R$</span>
                      <span className={styles.valorGrande}>
                        {p.preco_mensal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                      {p.preco_mensal > 0 && <span className={styles.mes}>/mês</span>}
                    </>
                  )}
                </div>

                {p.custo_unitario_max > 0 && (
                  <span className={styles.custoUnitarioItem}>
                    ~{formatarMoeda(p.custo_unitario_max)} / imóvel
                  </span>
                )}

                <p className={styles.cardPlanoDesc}>{p.descricao}</p>

                <div className={styles.cardPlanoAcao}>
                  {isAtual ? (
                    <button className={styles.btnPlanoAtual} disabled>
                      Plano Atual
                    </button>
                  ) : (
                    <button
                      className={isProximo ? styles.btnEscolherDestaque : styles.btnEscolherNormal}
                      onClick={() => abrirModalUpgrade(p)}
                    >
                      {p.ordem > plano.ordem ? 'Fazer Upgrade' : 'Selecionar'}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── HISTÓRICO DE FATURAS ── */}
      <div className={styles.secaoFaturas}>
        <div className={styles.cabecalhoSecao}>
          <h2>Histórico de Pagamentos</h2>
          <p>Visualize as faturas e cobranças das suas assinaturas</p>
        </div>

        {faturas.length === 0 ? (
          <div className={styles.vazioFaturas}>
            <span>🧾</span>
            <p>Nenhuma fatura registrada até o momento.</p>
          </div>
        ) : (
          <div className={styles.tabelaFaturasWrapper}>
            <table className={styles.tabelaFaturas}>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Valor</th>
                  <th>Forma de Pagamento</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {faturas.map((fat) => (
                  <tr key={fat.id}>
                    <td>{new Date(fat.created_at).toLocaleDateString('pt-BR')}</td>
                    <td><strong>{formatarMoeda(fat.valor)}</strong></td>
                    <td className={styles.formaPag}>{fat.metodo_pagamento.toUpperCase()}</td>
                    <td>
                      <span className={`${styles.statusBadge} ${styles[`status_${fat.status}`]}`}>
                        {fat.status === 'pago' ? 'Pago' : fat.status === 'pendente' ? 'Pendente' : fat.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── FAQ SOBRE OS PLANOS ── */}
      <div className={styles.secaoFaq}>
        <h2>Dúvidas Frequentes</h2>
        <div className={styles.gridFaq}>
          <div className={styles.faqItem}>
            <h4>O que conta como &quot;imóvel ativo&quot;?</h4>
            <p>
              Apenas imóveis com status <strong>publicado</strong> ou <strong>ativo</strong> consomem vagas do seu plano. Imóveis pausados ou em rascunho não contam.
            </p>
          </div>
          <div className={styles.faqItem}>
            <h4>Como funciona o upgrade?</h4>
            <p>
              Ao fazer o upgrade, seu novo limite de anúncios ativos é liberado imediatamente para você cadastrar e reativar imóveis.
            </p>
          </div>
          <div className={styles.faqItem}>
            <h4>Posso pausar um imóvel para liberar vaga?</h4>
            <p>
              Sim! A qualquer momento você pode pausar anúncios que não estão em negociação para liberar vagas para novos imóveis sem custo adicional.
            </p>
          </div>
          <div className={styles.faqItem}>
            <h4>A Fixum cobra comissão sobre vendas ou locações?</h4>
            <p>
              Não! A Fixum cobra apenas pela utilização da plataforma e capacidade de anúncios. 100% da negociação e comissão é sua.
            </p>
          </div>
        </div>
      </div>

      {/* Modal de Upgrade */}
      <ModalUpgradePlano
        aberto={modalUpgradeAberto}
        onFechar={() => setModalUpgradeAberto(false)}
        planoAtual={plano}
        planoSugerido={planoAlvoModal}
        imoveisAtivos={imoveisAtivos}
        onConfirmarPlano={onAtualizarAssinatura}
      />
    </div>
  )
}
