'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useConfirm } from '@/contexts/ModalConfirmacaoContext'
import styles from './ModalConfigSeguranca.module.css'

interface ModalConfigSegurancaProps {
  aberto: boolean
  onFechar: () => void
  usuarioEmail: string
}

export default function ModalConfigSeguranca({
  aberto,
  onFechar,
  usuarioEmail,
}: ModalConfigSegurancaProps) {
  const supabase = createClient()
  const { confirmar, alertar } = useConfirm()

  const [carregando, setCarregando] = useState(false)
  const [temMfaAtivo, setTemMfaAtivo] = useState(false)
  const [etapaAtivacao, setEtapaAtivacao] = useState<'inicio' | 'codigo' | 'sucesso'>('inicio')
  const [codigoConfirmacao, setCodigoConfirmacao] = useState('')
  const [timerReenvio, setTimerReenvio] = useState(0)
  const [mensagemSucesso, setMensagemSucesso] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    if (!aberto) return
    async function verificarStatus2FA() {
      setCarregando(true)
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const { data: perfil } = await supabase
            .from('perfis')
            .select('two_factor_enabled')
            .eq('id', user.id)
            .maybeSingle()

          const ativo = perfil?.two_factor_enabled === true || user.user_metadata?.two_factor_enabled === true
          setTemMfaAtivo(ativo)
        }
      } catch (e) {
        console.error('Erro ao verificar 2FA:', e)
      } finally {
        setCarregando(false)
      }
    }
    verificarStatus2FA()
  }, [aberto, supabase])

  // Timer regressivo de reenvio
  useEffect(() => {
    if (timerReenvio <= 0) return
    const interval = setInterval(() => {
      setTimerReenvio((prev) => prev - 1)
    }, 1000)
    return () => clearInterval(interval)
  }, [timerReenvio])

  // Iniciar ativação disparando código por e-mail
  async function handleIniciarAtivacao2FA() {
    setCarregando(true)
    setErro(null)
    setMensagemSucesso(null)

    try {
      const res = await fetch('/api/auth/otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          acao: 'enviar',
          email: usuarioEmail,
          motivo: 'ativar_2fa',
        }),
      })

      const json = await res.json()
      if (!res.ok || json.error) {
        throw new Error(json.error || 'Erro ao enviar código de verificação.')
      }

      setEtapaAtivacao('codigo')
      setTimerReenvio(60)
      setMensagemSucesso(`Enviamos um código de teste de 6 dígitos para o e-mail: ${usuarioEmail}`)
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : 'Erro ao iniciar ativação de 2FA')
    } finally {
      setCarregando(false)
    }
  }

  // Confirmar código de 6 dígitos e ativar 2FA
  async function handleConfirmarCodigo2FA(e: React.FormEvent) {
    e.preventDefault()
    setCarregando(true)
    setErro(null)

    try {
      const res = await fetch('/api/auth/otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          acao: 'validar',
          email: usuarioEmail,
          codigo: codigoConfirmacao,
          motivo: 'ativar_2fa',
        }),
      })

      const json = await res.json()
      if (!res.ok || json.error) {
        throw new Error(json.error || 'Código incorreto ou expirado.')
      }

      setTemMfaAtivo(true)
      setEtapaAtivacao('sucesso')
      setMensagemSucesso('Verificação em 2 Etapas ativada com sucesso! A cada login um código será enviado ao seu e-mail.')
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : 'Código incorreto ou expirado.')
    } finally {
      setCarregando(false)
    }
  }

  // Desativar 2FA
  async function handleDesativar2FA() {
    const confirma = await confirmar({
      titulo: 'Desativar Verificação em 2 Etapas?',
      mensagem: 'Deseja realmente desativar o 2FA por e-mail? Sua conta ficará protegida apenas pela senha.',
      icone: '🔓',
      textoBotaoConfirmar: 'Sim, Desativar 2FA',
      tipo: 'aviso',
    })
    if (!confirma) return

    setCarregando(true)
    setErro(null)

    try {
      const res = await fetch('/api/auth/otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          acao: 'desativar_2fa',
          email: usuarioEmail,
        }),
      })

      const json = await res.json()
      if (!res.ok || json.error) {
        throw new Error(json.error || 'Erro ao desativar 2FA.')
      }

      setTemMfaAtivo(false)
      setEtapaAtivacao('inicio')
      setMensagemSucesso('Verificação em 2 Etapas desativada com sucesso.')
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : 'Erro ao desativar 2FA')
    } finally {
      setCarregando(false)
    }
  }

  // Desconectar outras sessões
  async function handleDesconectarOutros() {
    setCarregando(true)
    setErro(null)
    try {
      await supabase.auth.signOut({ scope: 'others' })
      setMensagemSucesso('Todas as outras sessões ativas foram desconectadas.')
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : 'Erro ao desconectar sessões')
    } finally {
      setCarregando(false)
    }
  }

  if (!aberto) return null

  return (
    <div className={styles.overlay} onClick={onFechar}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <button className={styles.btnFechar} onClick={onFechar} aria-label="Fechar">
          ✕
        </button>

        <div className={styles.cabecalho}>
          <span className={styles.iconeModal}>🛡️</span>
          <h2>Segurança da Conta</h2>
          <p className={styles.subtitulo}>
            Proteja seus imóveis, leads e planos com autenticação em duas etapas via E-mail
          </p>
        </div>

        {mensagemSucesso && (
          <div className={styles.alertaSucesso}>
            ✓ {mensagemSucesso}
          </div>
        )}

        {erro && (
          <div className={styles.alertaErro}>
            ⚠️ {erro}
          </div>
        )}

        {/* ── SEÇÃO 2FA VIA E-MAIL ── */}
        <div className={styles.secaoCard}>
          <div className={styles.secaoHeader}>
            <div>
              <h3>Verificação em 2 Etapas por E-mail (2FA)</h3>
              <p>Receba um código de 6 dígitos na sua caixa de entrada a cada novo login.</p>
            </div>
            <span className={`${styles.badgeStatus} ${temMfaAtivo ? styles.badgeAtivo : styles.badgeInativo}`}>
              {temMfaAtivo ? 'Ativado 🔒' : 'Desativado ⚠️'}
            </span>
          </div>

          {temMfaAtivo ? (
            <div className={styles.mfaAtivoBox}>
              <p>
                Sua conta está protegida! Toda vez que você entrar, um código de segurança será enviado para: <strong>{usuarioEmail}</strong>.
              </p>
              <button
                type="button"
                className={styles.btnDesativarMfa}
                onClick={handleDesativar2FA}
                disabled={carregando}
              >
                Desativar 2FA
              </button>
            </div>
          ) : etapaAtivacao === 'codigo' ? (
            <form onSubmit={handleConfirmarCodigo2FA} className={styles.formAtivacao}>
              <div className={styles.instrucoesMfa}>
                <p>
                  1. Enviamos um código de segurança de 6 dígitos para <strong>{usuarioEmail}</strong>.
                </p>
                <p>2. Digite os números abaixo para confirmar a ativação:</p>
              </div>

              <div className={styles.campoCodigo}>
                <input
                  type="text"
                  placeholder="000000"
                  maxLength={6}
                  value={codigoConfirmacao}
                  onChange={(e) => setCodigoConfirmacao(e.target.value.replace(/\D/g, ''))}
                  className={styles.inputCodigo}
                  required
                  autoFocus
                />
              </div>

              <div className={styles.acoesMfa}>
                <button
                  type="submit"
                  className="btn btn-primario"
                  disabled={carregando || codigoConfirmacao.length < 6}
                >
                  {carregando ? 'Validando...' : 'Confirmar e Ativar 2FA'}
                </button>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setEtapaAtivacao('inicio')}
                >
                  Cancelar
                </button>
              </div>

              <div style={{ marginTop: '12px', textAlign: 'center' }}>
                <button
                  type="button"
                  onClick={handleIniciarAtivacao2FA}
                  disabled={carregando || timerReenvio > 0}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: timerReenvio > 0 ? '#94a3b8' : 'var(--cor-primaria)',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: timerReenvio > 0 ? 'not-allowed' : 'pointer',
                  }}
                >
                  {timerReenvio > 0 ? `Reenviar código em ${timerReenvio}s` : '🔄 Reenviar código para meu e-mail'}
                </button>
              </div>
            </form>
          ) : (
            <div className={styles.mfaInativoBox}>
              <p>Recomendado para corretores e imobiliárias que gerenciam planos e grandes volumes de anúncios.</p>
              <button
                type="button"
                className="btn btn-primario"
                onClick={handleIniciarAtivacao2FA}
                disabled={carregando}
              >
                🔐 Ativar Verificação por E-mail
              </button>
            </div>
          )}
        </div>

        {/* ── SEÇÃO SESSÕES ATIVAS ── */}
        <div className={styles.secaoCard}>
          <div className={styles.secaoHeader}>
            <div>
              <h3>Sessões Ativas e Dispositivos</h3>
              <p>Desconecte todos os outros computadores e celulares conectados à sua conta.</p>
            </div>
          </div>

          <div style={{ marginTop: '0.75rem' }}>
            <button
              type="button"
              className={styles.btnDesconectarOutros}
              onClick={handleDesconectarOutros}
              disabled={carregando}
            >
              🚪 Desconectar todas as outras sessões
            </button>
          </div>
        </div>

        <div className={styles.rodape}>
          <button type="button" className="btn btn-outline" onClick={onFechar}>
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}
