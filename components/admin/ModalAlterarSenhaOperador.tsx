'use client'

import React, { useState } from 'react'
import InputSenha from '@/components/ui/InputSenha'
import styles from './ModalNovoOperador.module.css'
import { OperadorAdmin } from '@/app/api/admin/operadores/route'
import Icone from '@/components/ui/Icone'

interface ModalAlterarSenhaOperadorProps {
  operador: OperadorAdmin | null
  onFechar: () => void
  onSenhaAlterada: () => void
  adminEmailLogado?: string
}

export default function ModalAlterarSenhaOperador({
  operador,
  onFechar,
  onSenhaAlterada,
  adminEmailLogado,
}: ModalAlterarSenhaOperadorProps) {
  const [novaSenha, setNovaSenha] = useState('')
  const [justificativa, setJustificativa] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  if (!operador) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)

    if (!novaSenha || novaSenha.length < 6) {
      setErro('A nova senha deve ter no mínimo 6 caracteres.')
      return
    }

    if (!justificativa.trim()) {
      setErro('Informe o motivo da redefinição para registro de auditoria.')
      return
    }

    setCarregando(true)
    try {
      const res = await fetch('/api/admin/operadores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          acao: 'alterar_senha',
          operadorId: operador?.id,
          novaSenha,
          justificativa: justificativa.trim(),
          adminEmail: adminEmailLogado,
        }),
      })

      const json = await res.json()
      if (!res.ok || json.error) {
        throw new Error(json.error || 'Falha ao redefinir senha.')
      }

      onSenhaAlterada()
      onFechar()
      setNovaSenha('')
      setJustificativa('')
    } catch (err: any) {
      setErro(err?.message || 'Falha ao alterar senha.')
    } finally {
      setCarregando(false)
    }
  }

  return (
    <div className={styles.overlay} onClick={onFechar}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.cabecalho}>
          <div className={styles.iconeTopo} style={{ background: 'rgba(227, 167, 47, 0.18)', borderColor: 'rgba(227, 167, 47, 0.35)' }}>
            <Icone nome="chave" tamanho={16} />
          </div>
          <div>
            <h2 className={styles.titulo}>Redefinir senha de operador</h2>
            <p className={styles.subtitulo}>
              Operador: <strong style={{ color: '#ffffff' }}>{operador.nome}</strong> ({operador.email})
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className={styles.corpo}>
          {erro && (
            <div className={styles.alertaErro}>
              <span><Icone nome="alerta" tamanho={16} /></span>
              <span>{erro}</span>
            </div>
          )}

          <div className={styles.grupoCampo}>
            <label className={styles.label}>
              <span>Nova senha</span>
              <span className={styles.obrigatorio}>* Mínimo 6 dígitos</span>
            </label>
            <InputSenha
              name="nova-senha-operador"
              value={novaSenha}
              onChange={(e) => setNovaSenha(e.target.value)}
              placeholder="Digite a nova senha"
              className={styles.input}
              estiloDark={true}
              required
              autoFocus
            />
          </div>

          <div className={styles.grupoCampo}>
            <label className={styles.label}>
              <span>Motivo / justificativa da alteração</span>
              <span className={styles.obrigatorio}>* Registro de auditoria</span>
            </label>
            <input
              type="text"
              className={styles.input}
              value={justificativa}
              onChange={(e) => setJustificativa(e.target.value)}
              placeholder="Ex: Rotação periódica ou solicitação do operador"
              required
            />
          </div>

          <div className={styles.rodape}>
            <button
              type="button"
              className={styles.btnCancelar}
              onClick={onFechar}
              disabled={carregando}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className={styles.btnConfirmar}
              style={{ background: 'linear-gradient(135deg, #C08A1E, #8A5F12)' }}
              disabled={carregando}
            >
              {carregando ? 'Alterando...' : 'Confirmar nova senha'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
