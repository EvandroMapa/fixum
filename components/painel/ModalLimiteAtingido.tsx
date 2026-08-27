'use client'

import styles from './ModalLimiteAtingido.module.css'
import { Plano } from '@/lib/types'
import { formatarMoeda } from '@/lib/planos'

interface ModalLimiteAtingidoProps {
  aberto: boolean
  onFechar: () => void
  planoAtual: Plano
  proximoPlano: Plano | null
  imoveisAtivos: number
  onFazerUpgrade: (planoAlvo?: Plano) => void
  acaoTentada?: 'novo_imovel' | 'reativar_imovel'
}

export default function ModalLimiteAtingido({
  aberto,
  onFechar,
  planoAtual,
  proximoPlano,
  imoveisAtivos,
  onFazerUpgrade,
  acaoTentada = 'novo_imovel',
}: ModalLimiteAtingidoProps) {
  if (!aberto) return null

  const isReativar = acaoTentada === 'reativar_imovel'

  return (
    <div className={styles.overlay} onClick={onFechar}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <button className={styles.btnFechar} onClick={onFechar} aria-label="Fechar">
          ✕
        </button>

        <div className={styles.iconeAlerta}>
          <span>🚀</span>
        </div>

        <h2 className={styles.titulo}>Você atingiu o limite do seu plano</h2>

        <p className={styles.descricao}>
          {isReativar
            ? `Seu plano atual (${planoAtual.nome}) permite até ${planoAtual.limite_imoveis_max} imóvel(is) ativo(s) e você já está utilizando ${imoveisAtivos} vaga(s).`
            : `Para publicar novos imóveis, faça upgrade do seu plano atual (${planoAtual.nome} — ${imoveisAtivos}/${planoAtual.limite_imoveis_max} ativos) para expandir sua carteira.`}
        </p>

        <div className={styles.cardComparativo}>
          <div className={styles.infoPlanoAtual}>
            <span className={styles.tagAtual}>Plano Atual</span>
            <h4>{planoAtual.nome}</h4>
            <p>{planoAtual.limite_imoveis_max} {planoAtual.limite_imoveis_max === 1 ? 'imóvel ativo' : 'imóveis ativos'}</p>
            <span className={styles.precoAtual}>{formatarMoeda(planoAtual.preco_mensal)}/mês</span>
          </div>

          {proximoPlano && (
            <>
              <div className={styles.setaUpgrade}>➜</div>
              <div className={styles.infoProximoPlano}>
                <span className={styles.tagRecomendado}>Recomendado</span>
                <h4>{proximoPlano.nome}</h4>
                <p>Até {proximoPlano.limite_imoveis_max} imóveis ativos</p>
                <span className={styles.precoProximo}>{formatarMoeda(proximoPlano.preco_mensal)}/mês</span>
                <span className={styles.custoUnitario}>
                  {proximoPlano.custo_unitario_max > 0 ? `(${formatarMoeda(proximoPlano.custo_unitario_max)} / imóvel / mês)` : ''}
                </span>
              </div>
            </>
          )}
        </div>

        <div className={styles.acoes}>
          {proximoPlano ? (
            <button
              className={styles.btnUpgrade}
              onClick={() => {
                onFechar()
                onFazerUpgrade(proximoPlano)
              }}
            >
              Fazer Upgrade para {proximoPlano.nome}
            </button>
          ) : (
            <button
              className={styles.btnUpgrade}
              onClick={() => {
                onFechar()
                onFazerUpgrade()
              }}
            >
              Ver todos os planos
            </button>
          )}

          <button className={styles.btnSecundario} onClick={onFechar}>
            Gerenciar imóveis existentes
          </button>
        </div>
      </div>
    </div>
  )
}
