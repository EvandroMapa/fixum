'use client'

import React, { useState } from 'react'
import InputSenha from '@/components/ui/InputSenha'
import styles from './ModalEstornoFatura.module.css'
import { OperadorAdmin } from '@/app/api/admin/operadores/route'

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
  const [adminPin, setAdminPin] = useState('')
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

    if (!adminPin.trim()) {
      setErro('Insira a Chave Secreta Master para autorizar.')
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
          adminPin: adminPin.trim(),
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
      setAdminPin('')
    } catch (err: any) {
      setErro(err?.message || 'Falha ao alterar senha.')
    } finally {
      setCarregando(false)
    }
  }

  return (
    <div className={styles.overlay} onClick={onFechar}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.cabecalho} style={{ background: '#0f172a' }}>
          <div className={styles.iconeAlerta} style={{ background: 'rgba(245, 158, 11, 0.2)' }}>
            🔑
          </div>
          <div>
            <h2 className={styles.titulo}>Redefinir Senha de Operador</h2>
            <p className={styles.subtitulo}>
              Operador: <strong>{operador.nome}</strong> ({operador.email})
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className={styles.corpo}>
          {erro && (
            <div className={styles.alertaErro}>
              <span>⚠️</span>
              <span>{erro}</span>
            </div>
          )}

          <div className={styles.grupoCampo}>
            <label className={styles.label}>
              <span>Nova Senha</span>
              <span className={styles.obrigatorio}>* (Mínimo 6 dígitos)</span>
            </label>
            <InputSenha
              name="nova-senha-operador"
              value={novaSenha}
              onChange={(e) => setNovaSenha(e.target.value)}
              placeholder="••••••••••••"
              className={styles.input}
              estiloDark={true}
              required
              autoFocus
            />
          </div>

          <div className={styles.grupoCampo}>
            <label className={styles.label}>
              <span>Motivo / Justificativa da Alteração</span>
              <span className={styles.obrigatorio}>* (Auditoria)</span>
            </label>
            <input
              type="text"
              className={styles.input}
              value={justificativa}
              onChange={(e) => setJustificativa(e.target.value)}
              placeholder="Ex: Solicitação de troca pelo operador ou rotação periódica"
              required
            />
          </div>

          <div className={styles.grupoCampo}>
            <label className={styles.label}>
              <span>Chave Secreta Master (PIN de Autorização)</span>
              <span className={styles.obrigatorio}>*</span>
            </label>
            <InputSenha
              name="admin-pin-redefinir-senha"
              value={adminPin}
              onChange={(e) => setAdminPin(e.target.value)}
              placeholder="Digite a Chave Secreta Master"
              className={styles.input}
              estiloDark={true}
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
              style={{ background: '#f59e0b', color: '#0f172a', fontWeight: 800 }}
              disabled={carregando}
            >
              {carregando ? 'Salvando...' : 'Salvar Nova Senha'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
