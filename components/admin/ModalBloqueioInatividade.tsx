'use client'

import React, { useEffect, useState } from 'react'
import { desbloquearTelaComCodigo, enviarCodigoAdmin } from '@/lib/admin-auth'
import styles from './ModalBloqueioInatividade.module.css'
import Icone from '@/components/ui/Icone'

interface ModalBloqueioInatividadeProps {
  onDesbloqueado: () => void
  onEncerrarSessao: () => void
}

/**
 * Tela de bloqueio por inatividade do painel admin.
 * Ao aparecer, já manda um código novo para o e-mail do administrador; com ele, o painel volta.
 */
export default function ModalBloqueioInatividade({
  onDesbloqueado,
  onEncerrarSessao,
}: ModalBloqueioInatividadeProps) {
  const [codigo, setCodigo] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [verificando, setVerificando] = useState(false)

  useEffect(() => {
    enviarCodigoAdmin().then((r) => {
      if (r.ok) setAviso('Enviamos um código de 6 dígitos para o seu e-mail.')
      else setErro(r.erro || 'Não foi possível enviar o código.')
    })
  }, [])

  async function handleReenviar() {
    setErro(null)
    const r = await enviarCodigoAdmin()
    if (r.ok) setAviso('Enviamos um novo código para o seu e-mail.')
    else setErro(r.erro || 'Não foi possível enviar o código.')
  }

  async function handleDesbloquear(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)

    if (codigo.length < 6) {
      setErro('Digite o código de 6 dígitos enviado ao seu e-mail.')
      return
    }

    setVerificando(true)
    const resultado = await desbloquearTelaComCodigo(codigo)
    setVerificando(false)
    if (resultado.ok) {
      setCodigo('')
      onDesbloqueado()
    } else {
      setErro(resultado.erro || 'Código incorreto ou expirado. O painel continua bloqueado.')
    }
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.cardBloqueio}>
        <div className={styles.iconeEscudo}><Icone nome="escudo" tamanho={16} /></div>
        <h2 className={styles.titulo}>Painel bloqueado por inatividade</h2>
        <p className={styles.subtitulo}>
          Para proteger os dados da plataforma, o painel bloqueia depois de 30 minutos parado. Digite o código enviado ao seu e-mail para continuar.
        </p>

        {erro && (
          <div className={styles.alertaErro}>
            <span><Icone nome="alerta" tamanho={16} /></span>
            <span>{erro}</span>
          </div>
        )}
        {!erro && aviso && <p className={styles.subtitulo}>{aviso}</p>}

        <form onSubmit={handleDesbloquear} className={styles.form}>
          <div className={styles.campo}>
            <label className={styles.label} htmlFor="codigo-desbloqueio">Código do e-mail</label>
            <input
              id="codigo-desbloqueio"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))}
              placeholder="000000"
              className={styles.inputPin}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              autoFocus
              required
            />
          </div>

          <button type="submit" className={styles.btnDesbloquear} disabled={verificando}>
            {verificando ? 'Verificando…' : 'Desbloquear painel'}
          </button>
        </form>

        <div className={styles.rodape}>
          <button type="button" onClick={handleReenviar} className={styles.btnSair}>
            Enviar novo código
          </button>
          <button type="button" onClick={onEncerrarSessao} className={styles.btnSair}>
            Encerrar sessão e sair
          </button>
        </div>
      </div>
    </div>
  )
}
