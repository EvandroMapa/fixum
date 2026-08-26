'use client'

import React, { useState } from 'react'
import { FaturaAdmin } from '@/lib/admin-service'
import { formatarMoeda } from '@/lib/planos'
import InputSenha from '@/components/ui/InputSenha'
import styles from './ModalEstornoFatura.module.css'

interface ModalEstornoFaturaProps {
  fatura: FaturaAdmin | null
  onFechar: () => void
  onConfirmarEstorno: (dados: {
    faturaId: string
    usuarioId: string
    valor: number
    motivo: string
    tipoReembolso: string
    justificativa: string
    adminPin: string
  }) => Promise<void>
}

const MOTIVOS_ESTORNO = [
  'Direito de Arrependimento (Art. 49 CDC — 7 dias)',
  'Cobrança em Duplicidade / Erro de Faturamento',
  'Acordo Comercial / Cortesia Administrativa',
  'Insatisfação com o Serviço / Cancelamento Imediato',
  'Fraude Confirmada / Suspeita de Cartão Clonado',
  'Outro Motivo Operacional',
]

export default function ModalEstornoFatura({
  fatura,
  onFechar,
  onConfirmarEstorno,
}: ModalEstornoFaturaProps) {
  const [motivo, setMotivo] = useState(MOTIVOS_ESTORNO[0])
  const [tipoReembolso, setTipoReembolso] = useState('pix')
  const [justificativa, setJustificativa] = useState('')
  const [adminPin, setAdminPin] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  if (!fatura) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!fatura) return
    setErro(null)

    if (!justificativa.trim()) {
      setErro('A justificativa é obrigatória para a auditoria de segurança.')
      return
    }

    if (!adminPin.trim()) {
      setErro('Insira o PIN Master / Chave Secreta para autorizar o estorno.')
      return
    }

    setCarregando(true)
    try {
      await onConfirmarEstorno({
        faturaId: fatura.id,
        usuarioId: fatura.usuario_id,
        valor: fatura.valor,
        motivo,
        tipoReembolso,
        justificativa,
        adminPin,
      })
      onFechar()
    } catch (err: any) {
      setErro(err?.message || 'Falha ao processar devolução/estorno.')
    } finally {
      setCarregando(false)
    }
  }

  return (
    <div className={styles.overlay} onClick={onFechar}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.cabecalho}>
          <div className={styles.iconeAlerta}>↩️</div>
          <div>
            <h2 className={styles.titulo}>Processar Devolução / Estorno</h2>
            <p className={styles.subtitulo}>Ação financeira sensível — Requer autorização Master</p>
          </div>
          <button type="button" className={styles.btnFechar} onClick={onFechar}>✕</button>
        </div>

        {erro && (
          <div className={styles.boxErro}>
            <span>⚠️</span>
            <span>{erro}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className={styles.formulario}>
          {/* Card Resumo da Fatura */}
          <div className={styles.cardFatura}>
            <div className={styles.faturaLinha}>
              <span className={styles.faturaLabel}>Cliente Beneficiário:</span>
              <strong className={styles.faturaValor}>{fatura.usuario_nome} ({fatura.usuario_email})</strong>
            </div>
            <div className={styles.faturaLinha}>
              <span className={styles.faturaLabel}>Valor da Fatura:</span>
              <span className={styles.valorDestaque}>{formatarMoeda(fatura.valor)}</span>
            </div>
            <div className={styles.faturaLinha}>
              <span className={styles.faturaLabel}>Método Original:</span>
              <span className={styles.faturaMetodo}>{fatura.metodo_pagamento === 'pix' ? 'PIX Instantâneo' : 'Cartão de Crédito'}</span>
            </div>
            {fatura.asaas_payment_id && (
              <div className={styles.faturaLinha}>
                <span className={styles.faturaLabel}>Código Gateway Asaas:</span>
                <span className={styles.codigoAsaas}>{fatura.asaas_payment_id}</span>
              </div>
            )}
          </div>

          {/* Motivo do Estorno */}
          <div className={styles.campo}>
            <label className={styles.label}>Motivo do Reembolso:</label>
            <select
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              className={styles.select}
            >
              {MOTIVOS_ESTORNO.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          {/* Canal de Reembolso */}
          <div className={styles.campo}>
            <label className={styles.label}>Canal de Devolução:</label>
            <select
              value={tipoReembolso}
              onChange={(e) => setTipoReembolso(e.target.value)}
              className={styles.select}
            >
              <option value="pix">PIX (Chave do Cliente)</option>
              <option value="estorno_gateway">Estorno Automático no Asaas (Cartão/PIX)</option>
              <option value="manual">Transferência Bancária Manual</option>
            </select>
          </div>

          {/* Justificativa Obrigatória */}
          <div className={styles.campo}>
            <label className={styles.label}>
              <span>Justificativa Obrigatória da Equipe:</span>
              <span style={{ color: '#f87171', fontSize: '0.75rem' }}>* Trilha de Auditoria</span>
            </label>
            <textarea
              rows={3}
              value={justificativa}
              onChange={(e) => setJustificativa(e.target.value)}
              placeholder="Descreva o motivo detalhado, protocolo de atendimento ou comprovante..."
              className={styles.textarea}
              required
            />
          </div>

          {/* PIN Master de Segurança */}
          <div className={styles.campo}>
            <label className={styles.label}>
              <span>PIN Master / Chave Secreta Master:</span>
              <span style={{ color: '#f87171', fontSize: '0.75rem' }}>* Blindagem de Segurança</span>
            </label>
            <InputSenha
              value={adminPin}
              onChange={(e) => setAdminPin(e.target.value)}
              placeholder="Chave de segurança master"
              className={styles.inputPin}
              estiloDark={true}
              required
            />
          </div>

          <div className={styles.avisoRegra}>
            💡 <strong>Atenção:</strong> Ao confirmar o estorno, a fatura será marcada como <code>reembolsado</code>, o plano do usuário será rebaixado para <code>gratis</code> e um log imutável de auditoria será gerado no Supabase.
          </div>

          <div className={styles.rodape}>
            <button type="button" className={styles.btnCancelar} onClick={onFechar}>
              Cancelar
            </button>
            <button
              type="submit"
              disabled={carregando}
              className={styles.btnConfirmar}
            >
              {carregando ? 'Processando...' : `↩️ Confirmar Devolução de ${formatarMoeda(fatura.valor)}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
