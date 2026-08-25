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
  usuarioId?: string
  usuarioNome?: string
  usuarioEmail?: string
  usuarioTelefone?: string
}

export default function AbaMeuPlano({
  usoPlano,
  faturas,
  onAtualizarAssinatura,
  usuarioId = '',
  usuarioNome = '',
  usuarioEmail = '',
  usuarioTelefone = '',
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

      {/* ── CARD PRINCIPAL DO PLANO ATUAL ── */}
      <div className={styles.cardPlanoPrincipal}>
        <div className={styles.planoPrincipalTopo}>
          <div className={styles.planoInfoBasica}>
            <span className={styles.badgePlanoAtual}>Plano Atual</span>
            <h2 className={styles.nomePlanoAtual}>{plano.nome}</h2>
            <p className={styles.descricaoPlanoAtual}>{plano.descricao}</p>
          </div>
          <div className={styles.planoPrecoBox}>
            {plano.id === 'enterprise_plus' ? (
              <span className={styles.valorSobConsulta}>Sob consulta</span>
            ) : (
              <>
                <span className={styles.precoValor}>{formatarMoeda(plano.preco_mensal)}</span>
                {plano.preco_mensal > 0 && <span className={styles.precoPeriodo}>/mês</span>}
              </>
            )}
          </div>
        </div>

        {/* Barra de Utilização */}
        <div className={styles.secaoProgresso}>
          <div className={styles.progressoRotulos}>
            <span>
              <strong>{imoveisAtivos}</strong> de{' '}
              <strong>{limiteMaximo >= 99999 ? 'Ilimitados' : limiteMaximo}</strong> anúncios ativos utilizados
            </span>
            <span className={styles.progressoPorcentagem}>
              {limiteMaximo >= 99999 ? 'Uso Livre' : `${porcentagemUso}%`}
            </span>
          </div>

          <div className={styles.barraTrilho}>
            <div
              className={styles.barraPreenchimento}
              style={{
                width: `${Math.min(porcentagemUso, 100)}%`,
                backgroundColor: corProgresso,
              }}
            />
          </div>

          <div className={styles.progressoDetalhes}>
            <span>📦 {vagasRestantes >= 99999 ? 'Vagas ilimitadas' : `${vagasRestantes} vagas disponíveis`}</span>
            {imoveisPausados > 0 && (
              <span>⏸️ {imoveisPausados} {imoveisPausados === 1 ? 'imóvel pausado' : 'imóveis pausados'}</span>
            )}
          </div>
        </div>

        {/* Alerta de Limite Quase Esgotado ou Esgotado */}
        {atingiuLimite && (
          <div className={styles.alertaLimiteAtingido}>
            <span>⚠️</span>
            <div>
              <strong>Você atingiu o limite de anúncios ativos do seu plano.</strong>
              <p>Para publicar ou reativar novos imóveis, faça upgrade para um plano superior.</p>
            </div>
            <button className={styles.btnAlertaUpgrade} onClick={() => abrirModalUpgrade(proximoPlano || undefined)}>
              Upgrade Agora
            </button>
          </div>
        )}
      </div>

      {/* ── TODOS OS PLANOS DA TABELA OFICIAL ── */}
      <div className={styles.secaoTodosPlanos}>
        <div className={styles.secaoTitulo}>
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
        <div className={styles.secaoTitulo}>
          <h2>Histórico de Faturas e Pagamentos</h2>
          <p>Acompanhe todos os lançamentos e comprovantes da sua conta</p>
        </div>

        {faturas.length === 0 ? (
          <div className={styles.faturasVazio}>
            <span>📄</span>
            <p>Nenhuma fatura emitida até o momento.</p>
          </div>
        ) : (
          <div className={styles.tabelaWrapper}>
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
                {faturas.map((f) => (
                  <tr key={f.id}>
                    <td>{new Date(f.data_pagamento || f.created_at).toLocaleDateString('pt-BR')}</td>
                    <td><strong>{formatarMoeda(f.valor)}</strong></td>
                    <td>
                      <span className={styles.metodoTag}>
                        {f.metodo_pagamento === 'pix' ? '⚡ PIX' : f.metodo_pagamento === 'cartao' ? '💳 Cartão' : 'Grátis'}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`
                          ${styles.statusBadge}
                          ${f.status === 'pago' ? styles.statusPago : ''}
                          ${f.status === 'pendente' ? styles.statusPendente : ''}
                          ${f.status === 'atrasado' ? styles.statusAtrasado : ''}
                        `}
                      >
                        {f.status === 'pago' ? '✓ Pago' : f.status === 'pendente' ? '⏳ Pendente' : '⚠️ Atrasado'}
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
        <div className={styles.secaoTitulo}>
          <h2>Perguntas Frequentes</h2>
          <p>Tire suas dúvidas sobre o funcionamento dos planos e cotas</p>
        </div>

        <div className={styles.gridFaq}>
          <div className={styles.faqItem}>
            <h4>Como funciona o limite de imóveis?</h4>
            <p>
              O limite é contabilizado apenas sobre imóveis com status <strong>Ativo</strong> ou <strong>Publicado</strong>. Imóveis pausados ou rascunhos não ocupam vagas do seu plano.
            </p>
          </div>
          <div className={styles.faqItem}>
            <h4>Posso fazer upgrade a qualquer momento?</h4>
            <p>
              Sim! Ao fazer o upgrade, seu novo limite de anúncios é liberado imediatamente para cadastro e publicação de novos imóveis.
            </p>
          </div>
          <div className={styles.faqItem}>
            <h4>Posso pausar um imóvel para cadastrar outro?</h4>
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
        usuarioId={usuarioId}
        usuarioNome={usuarioNome}
        usuarioEmail={usuarioEmail}
        usuarioTelefone={usuarioTelefone}
      />
    </div>
  )
}
