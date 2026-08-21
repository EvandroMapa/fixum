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
  const { confirmar } = useConfirm()

  const [carregando, setCarregando] = useState(false)
  const [temMfaAtivo, setTemMfaAtivo] = useState(false)
  const [fatorId, setFatorId] = useState<string | null>(null)
  const [qrCodeSvg, setQrCodeSvg] = useState<string | null>(null)
  const [segredoManual, setSegredoManual] = useState<string | null>(null)
  const [codigoConfirmacao, setCodigoConfirmacao] = useState('')
  const [etapaAtivacao, setEtapaAtivacao] = useState<'inicio' | 'qrcode' | 'sucesso'>('inicio')
  const [mensagemSucesso, setMensagemSucesso] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    if (!aberto) return
    async function verificarFatores() {
      setCarregando(true)
      try {
        const { data } = await supabase.auth.mfa.listFactors()
        const totpAtivo = data?.totp?.find((f: any) => f.status === 'verified')
        if (totpAtivo) {
          setTemMfaAtivo(true)
          setFatorId(totpAtivo.id)
        } else {
          setTemMfaAtivo(false)
          setFatorId(null)
        }
      } catch (e) {
        console.error('Erro ao verificar MFA:', e)
      } finally {
        setCarregando(false)
      }
    }
    verificarFatores()
  }, [aberto, supabase])

  async function handleIniciarAtivacaoMfa() {
    setCarregando(true)
    setErro(null)
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'Fixum Authenticator',
      })

      if (error) throw error

      setFatorId(data.id)
      setQrCodeSvg(data.totp.qr_code)
      setSegredoManual(data.totp.secret)
      setEtapaAtivacao('qrcode')
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : 'Erro ao iniciar ativação de 2FA')
    } finally {
      setCarregando(false)
    }
  }

  async function handleConfirmarCodigoMfa(e: React.FormEvent) {
    e.preventDefault()
    if (!fatorId) return
    setCarregando(true)
    setErro(null)

    try {
      const challenge = await supabase.auth.mfa.challenge({ factorId: fatorId })
      if (challenge.error) throw challenge.error

      const verify = await supabase.auth.mfa.verify({
        factorId: fatorId,
        challengeId: challenge.data.id,
        code: codigoConfirmacao.replace(/\D/g, ''),
      })

      if (verify.error) throw verify.error

      setTemMfaAtivo(true)
      setEtapaAtivacao('sucesso')
      setMensagemSucesso('Autenticação em 2 Fatores ativada com sucesso!')
    } catch (e: unknown) {
      setErro('Código inválido. Verifique o código gerado no aplicativo e tente novamente.')
    } finally {
      setCarregando(false)
    }
  }

  async function handleDesativarMfa() {
    if (!fatorId) return
    const confirma = await confirmar({
      titulo: 'Desativar 2FA?',
      mensagem: 'Deseja realmente desativar a Autenticação em 2 Fatores da sua conta? Sua conta ficará protegida apenas pela senha.',
      icone: '🔓',
      textoBotaoConfirmar: 'Sim, Desativar 2FA',
      tipo: 'aviso',
    })
    if (!confirma) return

    setCarregando(true)
    setErro(null)

    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId: fatorId })
      if (error) throw error

      setTemMfaAtivo(false)
      setFatorId(null)
      setEtapaAtivacao('inicio')
      setMensagemSucesso('2FA desativado com sucesso.')
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : 'Erro ao desativar 2FA')
    } finally {
      setCarregando(false)
    }
  }

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
            Proteja seus imóveis, leads e planos com autenticação avançada
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

        {/* ── SEÇÃO 2FA / MFA ── */}
        <div className={styles.secaoCard}>
          <div className={styles.secaoHeader}>
            <div>
              <h3>Autenticação em 2 Fatores (MFA / 2FA)</h3>
              <p>Exige um código temporário de 6 dígitos gerado no celular a cada login.</p>
            </div>
            <span className={`${styles.badgeStatus} ${temMfaAtivo ? styles.badgeAtivo : styles.badgeInativo}`}>
              {temMfaAtivo ? 'Ativado 🔒' : 'Desativado ⚠️'}
            </span>
          </div>

          {temMfaAtivo ? (
            <div className={styles.mfaAtivoBox}>
              <p>Sua conta está protegida com autenticação em duas etapas via aplicativo (TOTP).</p>
              <button
                type="button"
                className={styles.btnDesativarMfa}
                onClick={handleDesativarMfa}
                disabled={carregando}
              >
                Desativar 2FA
              </button>
            </div>
          ) : etapaAtivacao === 'qrcode' && qrCodeSvg ? (
            <form onSubmit={handleConfirmarCodigoMfa} className={styles.formAtivacao}>
              <div className={styles.instrucoesMfa}>
                <p>1. Abra o <strong>Google Authenticator</strong> ou <strong>Authy</strong> no seu celular.</p>
                <p>2. Escaneie o QR Code abaixo ou insira o código manual:</p>
              </div>

              <div className={styles.qrCodeWrapper}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrCodeSvg} alt="QR Code 2FA" className={styles.qrCodeImg} />
              </div>

              {segredoManual && (
                <div className={styles.segredoManual}>
                  <span>Código manual:</span>
                  <code>{segredoManual}</code>
                </div>
              )}

              <div className={styles.campoCodigo}>
                <label>3. Digite o código de 6 dígitos gerado:</label>
                <input
                  type="text"
                  placeholder="000000"
                  maxLength={6}
                  value={codigoConfirmacao}
                  onChange={(e) => setCodigoConfirmacao(e.target.value)}
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
            </form>
          ) : (
            <div className={styles.mfaInativoBox}>
              <p>Recomendado para corretores e imobiliárias que gerenciam planos e grandes volumes de anúncios.</p>
              <button
                type="button"
                className="btn btn-primario"
                onClick={handleIniciarAtivacaoMfa}
                disabled={carregando}
              >
                🔐 Ativar Autenticação em 2 Fatores
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
