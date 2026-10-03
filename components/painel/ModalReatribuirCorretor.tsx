'use client'

import { useState } from 'react'
import { useConfirm } from '@/contexts/ModalConfirmacaoContext'
import styles from './ModalReatribuirCorretor.module.css'
import Icone from '@/components/ui/Icone'

interface ModalReatribuirCorretorProps {
  aberto: boolean
  onFechar: () => void
  imoveisIds: string[]
  titulosImoveis: string[]
  responsavelAtualNome?: string
  imobiliariaId: string
  imobiliariaNome: string
  corretores: { id: string; nome: string }[]
  usuarioAtualId: string
  onSucesso: () => void
}

export default function ModalReatribuirCorretor({
  aberto,
  onFechar,
  imoveisIds,
  titulosImoveis,
  responsavelAtualNome,
  imobiliariaId,
  imobiliariaNome,
  corretores,
  usuarioAtualId,
  onSucesso,
}: ModalReatribuirCorretorProps) {
  const [corretorDestinoId, setCorretorDestinoId] = useState<string>(imobiliariaId)
  const [salvando, setSalvando] = useState(false)
  const { alertar } = useConfirm()

  if (!aberto || imoveisIds.length === 0) return null

  const isMultiplo = imoveisIds.length > 1

  async function handleConfirmar() {
    if (!corretorDestinoId) return

    setSalvando(true)
    try {
      const res = await fetch('/api/painel/imoveis/acoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          acao: 'reatribuir_corretor',
          imoveisIds,
          novoAnuncianteId: corretorDestinoId,
          usuarioId: usuarioAtualId,
        }),
      })

      const json = await res.json()
      if (!res.ok) {
        throw new Error(json.error || 'Erro ao reatribuir corretor.')
      }

      onSucesso()
      onFechar()
    } catch (err: any) {
      await alertar({
        titulo: 'Erro ao transferir',
        mensagem: err.message || 'Ocorreu um erro ao transferir o imóvel.',
        tipo: 'perigo',
      })
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className={styles.overlay} onClick={onFechar}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.headerTitle}>
            <span className={styles.iconeHeader}><Icone nome="maleta" tamanho={16} /></span>
            <h2>{isMultiplo ? 'Transferir imóveis em lote' : 'Reatribuir corretor responsável'}</h2>
          </div>
          <button type="button" className={styles.btnFechar} onClick={onFechar}>
            <Icone nome="fechar" tamanho={16} />
          </button>
        </div>

        <div className={styles.corpo}>
          <p className={styles.descricao}>
            Selecione qual corretor da equipe ou se a própria imobiliária assumirá a responsabilidade
            {isMultiplo ? ` por estes ${imoveisIds.length} imóveis selecionados.` : ' por este imóvel.'}
          </p>

          <div className={styles.alertaImoveis}>
            <div className={styles.linhaInfoImovel}>
              <span className={styles.alertaTitulo}>
                {isMultiplo ? `Imóveis Selecionados (${imoveisIds.length}):` : 'Imóvel:'}
              </span>
              <span className={styles.alertaTexto}>
                {isMultiplo
                  ? titulosImoveis.slice(0, 3).join(', ') + (titulosImoveis.length > 3 ? ` e mais ${titulosImoveis.length - 3}...` : '')
                  : titulosImoveis[0] || 'Imóvel selecionado'}
              </span>
            </div>

            {responsavelAtualNome && (
              <div className={styles.linhaResponsavelAtual}>
                <span className={styles.alertaTitulo}>Responsável atual:</span>
                <span className={styles.badgeResponsavelAtual}>
                  <Icone nome="usuario" tamanho={16} /> <strong>{responsavelAtualNome}</strong>
                </span>
              </div>
            )}
          </div>

          <div className={styles.campoGrupo}>
            <label className={styles.label}>Novo responsável:</label>
            <select
              className={styles.select}
              value={corretorDestinoId}
              onChange={(e) => setCorretorDestinoId(e.target.value)}
            >
              <option value={imobiliariaId}><Icone nome="predio" tamanho={16} /> {imobiliariaNome} (Gestão direta da imobiliária)</option>
              {corretores.map((c) => (
                <option key={c.id} value={c.id}>
                  <Icone nome="usuario" tamanho={16} /> {c.nome} (Corretor da equipe)
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className={styles.rodape}>
          <button
            type="button"
            className={styles.btnCancelar}
            onClick={onFechar}
            disabled={salvando}
          >
            Cancelar
          </button>
          <button
            type="button"
            className={styles.btnConfirmar}
            onClick={handleConfirmar}
            disabled={salvando || !corretorDestinoId}
          >
            {salvando ? 'Transferindo...' : 'Confirmar transferência'}
          </button>
        </div>
      </div>
    </div>
  )
}
