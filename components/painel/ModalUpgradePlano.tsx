'use client'

import { useState, useEffect } from 'react'
import styles from './ModalUpgradePlano.module.css'
import { Plano, SlugPlano, MetodoPagamento, PeriodicidadePlano } from '@/lib/types'
import {
  PLANOS_OFICIAIS,
  formatarMoeda,
  validarDowngrade,
  calcularPrecoPeriodicidade,
  calcularCustoUnitario,
} from '@/lib/planos'

import ModalCheckoutPlano from './ModalCheckoutPlano'

interface ModalUpgradePlanoProps {
  aberto: boolean
  onFechar: () => void
  planoAtual: Plano
  planoSugerido?: Plano | null
  imoveisAtivos: number
  onConfirmarPlano: (novoPlano: Plano, metodo: MetodoPagamento) => Promise<void>
  usuarioId?: string
  usuarioNome?: string
  usuarioEmail?: string
  usuarioTelefone?: string
  dataInicioAssinatura?: string
  dataFimCiclo?: string
}

export default function ModalUpgradePlano({
  aberto,
  onFechar,
  planoAtual,
  planoSugerido,
  imoveisAtivos,
  onConfirmarPlano,
  usuarioId = '',
  usuarioNome = '',
  usuarioEmail = '',
  usuarioTelefone = '',
  dataInicioAssinatura,
  dataFimCiclo,
}: ModalUpgradePlanoProps) {
  const [planoSelecionadoId, setPlanoSelecionadoId] = useState<SlugPlano>(
    planoSugerido?.id || planoAtual.id
  )
  const [periodicidade, setPeriodicidade] = useState<PeriodicidadePlano>('mensal')
  const [metodoPagamento, setMetodoPagamento] = useState<MetodoPagamento>('pix')
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [sucesso, setSucesso] = useState(false)
  const [mostrarTodosPlanos, setMostrarTodosPlanos] = useState(false)
  const [checkoutAberto, setCheckoutAberto] = useState(false)

  useEffect(() => {
    if (planoSugerido) {
      setPlanoSelecionadoId(planoSugerido.id)
      setMostrarTodosPlanos(false)
    }
  }, [planoSugerido, aberto])

  if (!aberto) return null

  const planoSelecionado =
    PLANOS_OFICIAIS.find((p) => p.id === planoSelecionadoId) || planoAtual
  const isMesmoPlano = planoSelecionado.id === planoAtual.id
  const isDowngrade = planoSelecionado.ordem < planoAtual.ordem
  const isGratis = planoSelecionado.id === 'gratis'

  // Cálculo detalhado dos valores e custo unitário de acordo com a periodicidade
  const detalhesPreco = calcularPrecoPeriodicidade(planoSelecionado.preco_mensal, periodicidade)
  const custoUnitarioDinamico = calcularCustoUnitario(
    planoSelecionado.preco_mensal,
    planoSelecionado.limite_imoveis_max,
    periodicidade
  )

  // Custo unitário do plano atual para comparação direta
  const custoUnitarioAtual =
    planoAtual.preco_mensal > 0 && planoAtual.limite_imoveis_max > 0
      ? planoAtual.preco_mensal / planoAtual.limite_imoveis_max
      : 0

  // Cálculo do término do ciclo atual
  const dataFimCalculada = (() => {
    if (dataFimCiclo) {
      return new Date(dataFimCiclo).toLocaleDateString('pt-BR')
    }
    const base = dataInicioAssinatura ? new Date(dataInicioAssinatura) : new Date()
    const fim = new Date(base)
    fim.setDate(fim.getDate() + 30)
    return fim.toLocaleDateString('pt-BR')
  })()

  // Validação de downgrade
  const validacao = validarDowngrade(planoSelecionado.id, imoveisAtivos)

  async function handleConfirmar() {
    if (!validacao.permitido) {
      setErro(validacao.mensagem || 'Você possui mais imóveis ativos do que este plano permite.')
      return
    }

    // Se for DOWNGRADE (redução de plano ou plano grátis), aplica diretamente sem cobrar novamente agora
    if (isDowngrade || planoSelecionado.id === 'gratis') {
      setCarregando(true)
      setErro(null)

      try {
        const res = await fetch('/api/pagamentos/alterar-plano', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            usuarioId,
            novoPlanoId: planoSelecionado.id,
            tipo: 'downgrade',
          }),
        })

        const data = await res.json()

        if (!res.ok) {
          throw new Error(data.error || 'Erro ao agendar redução de plano.')
        }

        await onConfirmarPlano(planoSelecionado, planoSelecionado.id === 'gratis' ? 'gratis' : 'cartao')
        setSucesso(true)
        setTimeout(() => {
          setSucesso(false)
          onFechar()
        }, 2200)
      } catch (e: unknown) {
        setErro(e instanceof Error ? e.message : 'Erro ao atualizar plano.')
      } finally {
        setCarregando(false)
      }
      return
    }

    // Se for UPGRADE (plano maior pago), abre o checkout para pagamento do novo plano
    if (planoSelecionado.preco_mensal > 0) {
      setCheckoutAberto(true)
      return
    }
  }

  return (
    <div className={styles.overlay} onClick={onFechar}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <button className={styles.btnFechar} onClick={onFechar} aria-label="Fechar">
          ✕
        </button>

        <div className={styles.cabecalho}>
          <h2 className={styles.titulo}>
            {isMesmoPlano ? 'Seu Plano Atual' : isDowngrade ? 'Alterar Plano' : 'Confirmar Upgrade'}
          </h2>
          <p className={styles.subtitulo}>
            {isMesmoPlano
              ? 'Você já está utilizando este plano'
              : `Ativação do plano ${planoSelecionado.nome} para sua conta`}
          </p>
        </div>

        {sucesso ? (
          <div className={styles.containerSucesso}>
            <div className={styles.iconeSucesso}>✓</div>
            <h3>Plano Atualizado com Sucesso!</h3>
            <p>Seu novo limite de anúncios já está ativo na plataforma.</p>
          </div>
        ) : (
          <>
            {erro && <div className={styles.alertaErro}>{erro}</div>}

            {/* FAIXA DE RESUMO DO PLANO ATUAL PARA COMPARAÇÃO (COMPACTA) */}
            {!mostrarTodosPlanos && !isMesmoPlano && (
              <div className={styles.faixaPlanoAtual}>
                <div className={styles.faixaPlanoAtualHeader}>
                  <span className={styles.tagPlanoAtual}>Plano Atual</span>
                  <strong className={styles.nomePlanoAtual}>{planoAtual.nome}</strong>
                  <span className={styles.faixaPlanoAtualPreco}>
                    ({planoAtual.preco_mensal > 0 ? `${formatarMoeda(planoAtual.preco_mensal)}/mês` : 'Grátis'})
                  </span>
                </div>

                <div className={styles.faixaPlanoAtualGrid}>
                  <div className={styles.itemPlanoAtual}>
                    <span className={styles.labelPlanoAtual}>📦 Cota:</span>
                    <strong className={styles.valorPlanoAtual}>
                      {imoveisAtivos}/{planoAtual.limite_imoveis_max >= 99999 ? '+500' : planoAtual.limite_imoveis_max}
                    </strong>
                  </div>

                  <div className={styles.itemPlanoAtual}>
                    <span className={styles.labelPlanoAtual}>🏷️ Custo/imóvel:</span>
                    <strong className={styles.valorPlanoAtual}>
                      {custoUnitarioAtual > 0 ? `${formatarMoeda(custoUnitarioAtual)}/mês` : 'Grátis'}
                    </strong>
                  </div>

                  <div className={styles.itemPlanoAtual}>
                    <span className={styles.labelPlanoAtual}>🚀 Destaque:</span>
                    <strong className={styles.valorPlanoAtual}>
                      {planoAtual.destaque_incluso ? 'Incluso' : 'Opcional'}
                    </strong>
                  </div>
                </div>
              </div>
            )}

            {/* CARD DE DESTAQUE DO PLANO ESCOLHIDO */}
            {!mostrarTodosPlanos ? (
              <div className={styles.cardResumoPlano}>
                <div className={styles.resumoTopo}>
                  <div>
                    <span className={styles.badgePlanoAlvo}>Novo Plano Selecionado</span>
                    <h3 className={styles.resumoNome}>{planoSelecionado.nome}</h3>
                  </div>
                  <div className={styles.resumoPrecoBox}>
                    {planoSelecionado.id === 'enterprise_plus' ? (
                      <span className={styles.valorSobConsulta}>Sob consulta</span>
                    ) : (
                      <>
                        <div className={styles.precoEquivLinha}>
                          <span className={styles.resumoValor}>
                            {formatarMoeda(detalhesPreco.valorMensalEquivalente)}
                          </span>
                          {planoSelecionado.preco_mensal > 0 && (
                            <span className={styles.resumoPeriodo}>/mês equiv.</span>
                          )}
                        </div>
                        {planoSelecionado.preco_mensal > 0 && (
                          <span className={styles.resumoPrecoTotal}>
                            {detalhesPreco.meses > 1
                              ? `Total: ${formatarMoeda(detalhesPreco.valorTotalComDesconto)} (${detalhesPreco.meses} meses)`
                              : `Total: ${formatarMoeda(planoSelecionado.preco_mensal)} / mês`}
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* SELETOR DE PERIODICIDADE E DESCONTOS PROMOCIONAIS */}
                {planoSelecionado.preco_mensal > 0 && !isDowngrade && (
                  <div className={styles.seletorCicloBox}>
                    <div className={styles.seletorCicloLabel}>
                      📅 Escolha o ciclo de pagamento:
                    </div>
                    <div className={styles.seletorCicloGrid}>
                      {[
                        { id: 'mensal', label: 'Mensal', tag: null },
                        { id: 'trimestral', label: '3 Meses', tag: '-10% OFF' },
                        { id: 'semestral', label: '6 Meses', tag: '-15% OFF' },
                        { id: 'anual', label: '1 Ano 🔥', tag: '-20% OFF' },
                      ].map((c) => {
                        const isAtivo = periodicidade === c.id
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => setPeriodicidade(c.id as any)}
                            className={`${styles.btnCiclo} ${isAtivo ? styles.btnCicloAtivo : ''}`}
                          >
                            <span>{c.label}</span>
                            {c.tag && (
                              <span className={styles.tagCicloOff}>
                                {c.tag}
                              </span>
                            )}
                          </button>
                        )
                      })}
                    </div>

                    <div className={`${styles.barraStatusCiclo} ${detalhesPreco.descontoPct > 0 ? styles.statusPromocional : styles.statusMensal}`}>
                      {detalhesPreco.descontoPct > 0 ? (
                        <>
                          <span>🎉 Economia de {formatarMoeda(detalhesPreco.economiaTotal)} ({detalhesPreco.descontoPct}% OFF)</span>
                          <span>Total: <strong>{formatarMoeda(detalhesPreco.valorTotalComDesconto)}</strong> ({detalhesPreco.meses} meses)</span>
                        </>
                      ) : (
                        <>
                          <span>Cobrança mensal padrão</span>
                          <span>Total: <strong>{formatarMoeda(planoSelecionado.preco_mensal)}</strong> / mês</span>
                        </>
                      )}
                    </div>
                  </div>
                )}

                <div className={styles.resumoBeneficios}>
                  <div className={styles.beneficioItem}>
                    <span>📦 Capacidade:</span>
                    <strong>
                      {planoSelecionado.limite_imoveis_max >= 99999
                        ? '+500 imóveis'
                        : `${planoSelecionado.limite_imoveis_max} imóveis ativos`}
                    </strong>
                  </div>

                  {custoUnitarioDinamico > 0 && (
                    <div className={styles.beneficioItem}>
                      <span>🏷️ Custo unitário:</span>
                      <strong style={{ color: detalhesPreco.descontoPct > 0 ? '#059669' : '#0f172a' }}>
                        {formatarMoeda(custoUnitarioDinamico)} / imóvel / mês
                      </strong>
                    </div>
                  )}

                  <div className={styles.beneficioItem}>
                    <span>🚀 Destaque no Mapa:</span>
                    <strong>{planoSelecionado.destaque_incluso ? 'Incluso' : 'Opcional'}</strong>
                  </div>
                </div>

                <button
                  type="button"
                  className={styles.btnTrocarPlano}
                  onClick={() => setMostrarTodosPlanos(true)}
                >
                  ⇄ Escolher outro plano
                </button>
              </div>
            ) : (
              /* Grade completa caso o usuário queira trocar */
              <div className={styles.secaoPlanos}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <label className={styles.labelSecao}>Selecione o plano desejado:</label>
                  <button
                    type="button"
                    style={{ background: 'none', border: 'none', color: '#3b82f6', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 600 }}
                    onClick={() => setMostrarTodosPlanos(false)}
                  >
                    ← Voltar ao selecionado
                  </button>
                </div>
                <div className={styles.gridPlanos}>
                  {PLANOS_OFICIAIS.map((plano) => {
                    const isAtual = plano.id === planoAtual.id
                    const isSelect = plano.id === planoSelecionadoId
                    const desabilitado = imoveisAtivos > plano.limite_imoveis_max

                    return (
                      <div
                        key={plano.id}
                        className={`
                          ${styles.cardPlanoItem}
                          ${isSelect ? styles.cardPlanoItemAtivo : ''}
                          ${isAtual ? styles.cardPlanoItemAtual : ''}
                          ${desabilitado ? styles.cardPlanoItemDesabilitado : ''}
                        `}
                        onClick={() => {
                          setPlanoSelecionadoId(plano.id)
                          setErro(null)
                          setMostrarTodosPlanos(false)
                        }}
                      >
                        <div className={styles.cardPlanoTopo}>
                          <span className={styles.nomePlano}>{plano.nome}</span>
                          {isAtual && <span className={styles.badgeAtual}>Atual</span>}
                        </div>

                        <div className={styles.capacidadePlano}>
                          <strong>{plano.limite_imoveis_max >= 99999 ? '+500' : plano.limite_imoveis_max}</strong>{' '}
                          {plano.limite_imoveis_max === 1 ? 'imóvel ativo' : 'imóveis ativos'}
                        </div>

                        <div className={styles.precoPlano}>
                          {plano.id === 'enterprise_plus' ? (
                            <span>Sob consulta</span>
                          ) : (
                            <>
                              <strong>{formatarMoeda(plano.preco_mensal)}</strong>
                              {plano.preco_mensal > 0 && <small>/mês</small>}
                            </>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* BANNER DE INFORMAÇÃO DE DOWNGRADE (SEM COBRANÇA AGORA) */}
            {isDowngrade && (
              <div style={{
                background: 'rgba(59, 130, 246, 0.08)',
                border: '1px solid rgba(59, 130, 246, 0.25)',
                borderRadius: '10px',
                padding: '12px 16px',
                marginTop: '12px',
                fontSize: '0.85rem',
                color: '#1e293b',
                lineHeight: '1.4'
              }}>
                <strong style={{ color: '#1d4ed8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  📉 Redução de Plano (Sem cobrança no ato)
                </strong>
                <p style={{ margin: '6px 0 0', color: '#475569' }}>
                  Você já possui o ciclo atual quitado até <strong>{dataFimCalculada}</strong>. Seu plano atual (<strong>{planoAtual.nome}</strong>) continuará 100% ativo até essa data.
                </p>
                <p style={{ margin: '4px 0 0', color: '#475569' }}>
                  A partir de <strong>{dataFimCalculada}</strong>, sua assinatura será renovada no valor reduzido de <strong>{formatarMoeda(planoSelecionado.preco_mensal)}/mês</strong>.
                </p>
                <div style={{ marginTop: '8px', fontWeight: 600, color: '#16a34a' }}>
                  ✓ Custo da alteração hoje: R$ 0,00
                </div>
              </div>
            )}

            {/* Ações Finais */}
            <div className={styles.rodapeAcoes}>
              <button className={styles.btnCancelar} onClick={onFechar}>
                Cancelar
              </button>

              {isMesmoPlano ? (
                <button className={styles.btnConfirmar} disabled>
                  Plano Atual
                </button>
              ) : (
                <button
                  className={styles.btnConfirmar}
                  onClick={handleConfirmar}
                  disabled={carregando || !validacao.permitido}
                >
                  {carregando
                    ? 'Processando...'
                    : isDowngrade
                    ? `📉 Confirmar Redução (R$ 0,00 Agora)`
                    : isGratis
                    ? 'Ativar Plano Grátis'
                    : `Prosseguir para Pagamento (${formatarMoeda(
                        calcularPrecoPeriodicidade(planoSelecionado.preco_mensal, periodicidade).valorTotalComDesconto
                      )}) ➔`}
                </button>
              )}
            </div>
          </>
        )}

        {/* MODAL DE CHECKOUT REAL (PIX / CARTÃO ASAAS) */}
        {checkoutAberto && (
          <ModalCheckoutPlano
            aberto={checkoutAberto}
            onFechar={() => {
              setCheckoutAberto(false)
              onFechar()
            }}
            plano={planoSelecionado}
            periodicidade={periodicidade}
            usuarioId={usuarioId}
            usuarioNome={usuarioNome}
            usuarioEmail={usuarioEmail}
            usuarioTelefone={usuarioTelefone}
            onPlanoAtivado={() => {
              onConfirmarPlano(planoSelecionado, metodoPagamento)
            }}
          />
        )}
      </div>
    </div>
  )
}
