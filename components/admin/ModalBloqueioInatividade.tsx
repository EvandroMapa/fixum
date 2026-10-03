'use client'

import React, { useState } from 'react'
import InputSenha from '@/components/ui/InputSenha'
import { desbloquearTelaComPin } from '@/lib/admin-auth'
import styles from './ModalBloqueioInatividade.module.css'
import Icone from '@/components/ui/Icone'

interface ModalBloqueioInatividadeProps {
  onDesbloqueado: () => void
  onEncerrarSessao: () => void
}

export default function ModalBloqueioInatividade({
  onDesbloqueado,
  onEncerrarSessao,
}: ModalBloqueioInatividadeProps) {
  const [pin, setPin] = useState('')
  const [erro, setErro] = useState<string | null>(null)

  async function handleDesbloquear(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)

    if (!pin.trim()) {
      setErro('Informe o PIN Master.')
      return
    }

    const sucesso = await desbloquearTelaComPin(pin)
    if (sucesso) {
      setPin('')
      onDesbloqueado()
    } else {
      setErro('PIN Master incorreto. Acesso administrativo permanece bloqueado.')
    }
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.cardBloqueio}>
        <div className={styles.iconeEscudo}><Icone nome="escudo" tamanho={16} /></div>
        <h2 className={styles.titulo}>Painel bloqueado por segurança</h2>
        <p className={styles.subtitulo}>
          A sessão executiva da Fixum foi bloqueada para proteger dados fiscais e cadastrais. Insira seu PIN Master para retomar o trabalho.
        </p>

        {erro && (
          <div className={styles.alertaErro}>
            <span><Icone nome="alerta" tamanho={16} /></span>
            <span>{erro}</span>
          </div>
        )}

        <form onSubmit={handleDesbloquear} className={styles.form}>
          <div className={styles.campo}>
            <label className={styles.label}>PIN Master / chave secreta Master</label>
            <InputSenha
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="Digite o PIN master"
              className={styles.inputPin}
              estiloDark={true}
              autoFocus
              required
            />
          </div>

          <button type="submit" className={styles.btnDesbloquear}>
 Desbloquear painel
 </button>
        </form>

        <div className={styles.rodape}>
          <button type="button" onClick={onEncerrarSessao} className={styles.btnSair}>
 Encerrar sessão e sair
 </button>
        </div>
      </div>
    </div>
  )
}
