'use client'

import { useState, useEffect } from 'react'
import styles from './ModalUpgradePlano.module.css'
import { Plano, SlugPlano, MetodoPagamento } from '@/lib/types'
import { PLANOS_OFICIAIS, formatarMoeda, validarDowngrade } from '@/lib/planos'

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
}: ModalUpgradePlanoProps) {
  const [planoSelecionadoId, setPlanoSelecionadoId] = useState<SlugPlano>(
    planoSugerido?.id || planoAtual.id
  )
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

  // Validação de downgrade
  const validacao = validarDowngrade(planoSelecionado.id, imoveisAtivos)

  async function handleConfirmar() {
    if (!validacao.permitido) {
      setErro(validacao.mensagem || 'Você possui mais imóveis ativos do que este plano permite.')
      return
    }

    // Se for plano pago, abre o checkout com PIX / Cartão
    if (planoSelecionado.preco_mensal > 0) {
      setCheckoutAberto(true)
      return
    }

    setCarregando(true)
    setErro(null)

    try {
      await onConfirmarPlano(planoSelecionado, 'gratis')
      setSucesso(true)
      setTimeout(() => {
        setSucesso(false)
        onFechar()
      }, 1500)
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : 'Erro ao atualizar plano.')
    } finally {
      setCarregando(false)
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

            {/* CARD DE DESTAQUE DO PLANO ESCOLHIDO */}
            {!mostrarTodosPlanos ? (
              <div className={styles.cardResumoPlano}>
                <div className={styles.resumoTopo}>
                  <div>
                    <span className={styles.badgePlanoAlvo}>Plano Selecionado</span>
                    <h3 className={styles.resumoNome}>{planoSelecionado.nome}</h3>
                    <p className={styles.resumoDesc}>{planoSelecionado.descricao}</p>
                  </div>
                  <div className={styles.resumoPrecoBox}>
                    {planoSelecionado.id === 'enterprise_plus' ? (
                      <span className={styles.valorSobConsulta}>Sob consulta</span>
                    ) : (
                      <>
                        <span className={styles.resumoValor}>
                          {formatarMoeda(planoSelecionado.preco_mensal)}
                        </span>
                        {planoSelecionado.preco_mensal > 0 && (
                          <span className={styles.resumoPeriodo}>/mês</span>
                        )}
                      </>
                    )}
                  </div>
                </div>

                <div className={styles.resumoBeneficios}>
                  <div className={styles.beneficioItem}>
                    <span>📦 Capacidade:</span>
                    <strong>
                      {planoSelecionado.limite_imoveis_max >= 99999
                        ? 'Ilimitados (+500)'
                        : `${planoSelecionado.limite_imoveis_max} anúncios ativos`}
                    </strong>
                  </div>
                  {planoSelecionado.custo_unitario_max > 0 && (
                    <div className={styles.beneficioItem}>
                      <span>🏷️ Custo unitário:</span>
                      <strong>~{formatarMoeda(planoSelecionado.custo_unitario_max)} / imóvel</strong>
                    </div>
                  )}
                  <div className={styles.beneficioItem}>
                    <span>🚀 Destaque no Mapa:</span>
                    <strong>Incluso</strong>
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
                    : isGratis
                    ? 'Ativar Plano Grátis'
                    : `Prosseguir para Pagamento (${formatarMoeda(planoSelecionado.preco_mensal)}/mês) ➔`}
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
