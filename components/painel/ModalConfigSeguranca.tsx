'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useConfirm } from '@/contexts/ModalConfirmacaoContext'
import { listarTotpAtivos, removerTotp } from '@/lib/auth/mfa-cliente'
import CadastroTotp from '@/components/auth/CadastroTotp'
import InputSenha from '@/components/ui/InputSenha'
import styles from './ModalConfigSeguranca.module.css'
import Icone from '@/components/ui/Icone'

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
  const { confirmar } = useConfirm()

  const [carregando, setCarregando] = useState(false)
  const [fatorAtivoId, setFatorAtivoId] = useState<string | null>(null)
  const [cadastrandoApp, setCadastrandoApp] = useState(false)
  const [editandoSenha, setEditandoSenha] = useState(false)
  const [novaSenha, setNovaSenha] = useState('')
  const [confirmarSenha, setConfirmarSenha] = useState('')
  const [mensagemSucesso, setMensagemSucesso] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  const carregarStatus = useCallback(async () => {
    setCarregando(true)
    try {
      const ativos = await listarTotpAtivos(createClient())
      setFatorAtivoId(ativos[0]?.id ?? null)
    } catch (e) {
      console.error('Erro ao verificar verificação em duas etapas:', e)
    } finally {
      setCarregando(false)
    }
  }, [])

  // Ao abrir o modal: consulta o status do app autenticador e limpa mensagens anteriores
  useEffect(() => {
    if (!aberto) return
    async function prepararAbertura() {
      await carregarStatus()
      setMensagemSucesso(null)
      setErro(null)
      setCadastrandoApp(false)
      setEditandoSenha(false)
    }
    void prepararAbertura()
  }, [aberto, carregarStatus])

  async function aoConcluirCadastroApp() {
    setCadastrandoApp(false)
    await carregarStatus()
    setMensagemSucesso('Verificação em duas etapas ativada! A partir de agora, ao entrar, vamos pedir o código do seu app autenticador. Nos outros aparelhos já conectados, será preciso entrar de novo.')
  }

  async function handleDesativar2FA() {
    if (!fatorAtivoId) return
    const confirma = await confirmar({
      titulo: 'Desativar verificação em duas etapas?',
      mensagem: 'Sua conta deixa de pedir o código do app autenticador ao entrar e fica protegida só pelo acesso ao seu e-mail (ou senha).',
      icone: 'cadeado',
      textoBotaoConfirmar: 'Sim, desativar',
      tipo: 'aviso',
    })
    if (!confirma) return

    setCarregando(true)
    setErro(null)
    try {
      await removerTotp(createClient(), fatorAtivoId)
      setFatorAtivoId(null)
      setMensagemSucesso('Verificação em duas etapas desativada.')
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : 'Erro ao desativar a verificação em duas etapas.')
    } finally {
      setCarregando(false)
    }
  }

  async function handleSalvarSenha(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)
    if (novaSenha.length < 8) {
      setErro('A senha precisa ter pelo menos 8 caracteres.')
      return
    }
    if (novaSenha !== confirmarSenha) {
      setErro('As senhas digitadas não coincidem.')
      return
    }
    setCarregando(true)
    try {
      const { error } = await createClient().auth.updateUser({ password: novaSenha })
      if (error) throw error
      setEditandoSenha(false)
      setNovaSenha('')
      setConfirmarSenha('')
      setMensagemSucesso('Senha salva. Você pode entrar com ela ou continuar usando o código por e-mail.')
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : ''
      setErro(msg.includes('different from the old')
        ? 'A nova senha precisa ser diferente da atual.'
        : msg.includes('reauthentication') || msg.includes('recent')
        ? 'Por segurança, saia e entre de novo antes de trocar a senha.'
        : 'Não foi possível salvar a senha. Tente novamente.')
    } finally {
      setCarregando(false)
    }
  }

  async function handleDesconectarOutros() {
    setCarregando(true)
    setErro(null)
    try {
      await createClient().auth.signOut({ scope: 'others' })
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
          <Icone nome="fechar" tamanho={16} />
        </button>

        <div className={styles.cabecalho}>
          <span className={styles.iconeModal}><Icone nome="escudo" tamanho={16} /></span>
          <h2>Segurança da conta</h2>
          <p className={styles.subtitulo}>
            Conta: <strong>{usuarioEmail}</strong>
          </p>
        </div>

        {mensagemSucesso && (
          <div className={styles.alertaSucesso}>
            <Icone nome="check" tamanho={16} /> {mensagemSucesso}
          </div>
        )}

        {erro && (
          <div className={styles.alertaErro}>
            <Icone nome="alerta" tamanho={16} /> {erro}
          </div>
        )}

        {/* ── VERIFICAÇÃO EM DUAS ETAPAS (APP AUTENTICADOR) ── */}
        <div className={styles.secaoCard}>
          <div className={styles.secaoHeader}>
            <div>
              <h3>Verificação em duas etapas</h3>
              <p>Além do e-mail, pede um código do app autenticador do seu celular a cada login.</p>
            </div>
            <span className={`${styles.badgeStatus} ${fatorAtivoId ? styles.badgeAtivo : styles.badgeInativo}`}>
              {fatorAtivoId ? 'Ativada' : 'Desativada'}
            </span>
          </div>

          {fatorAtivoId ? (
            <div className={styles.mfaAtivoBox}>
              <p>Sua conta está protegida pelo app autenticador.</p>
              <button
                type="button"
                className={styles.btnDesativarMfa}
                onClick={handleDesativar2FA}
                disabled={carregando}
              >
                Desativar
              </button>
            </div>
          ) : cadastrandoApp ? (
            <CadastroTotp aoConcluir={aoConcluirCadastroApp} aoCancelar={() => setCadastrandoApp(false)} />
          ) : (
            <div className={styles.mfaInativoBox}>
              <p>Recomendado para corretores e imobiliárias, que lidam com leads e dados de clientes.</p>
              <button
                type="button"
                className="btn btn-primario"
                onClick={() => { setMensagemSucesso(null); setErro(null); setCadastrandoApp(true) }}
                disabled={carregando}
              >
                Ativar com app autenticador
              </button>
            </div>
          )}
        </div>

        {/* ── SENHA (OPCIONAL) ── */}
        <div className={styles.secaoCard}>
          <div className={styles.secaoHeader}>
            <div>
              <h3>Senha</h3>
              <p>Opcional. Você sempre pode entrar com um código enviado ao seu e-mail.</p>
            </div>
          </div>

          {editandoSenha ? (
            <form onSubmit={handleSalvarSenha} className={styles.formAtivacao} style={{ gap: '0.75rem', alignItems: 'stretch' }}>
              <InputSenha
                placeholder="Nova senha (mínimo 8 caracteres)"
                value={novaSenha}
                onChange={(e) => setNovaSenha(e.target.value)}
                autoComplete="new-password"
                required
              />
              <InputSenha
                placeholder="Repita a nova senha"
                value={confirmarSenha}
                onChange={(e) => setConfirmarSenha(e.target.value)}
                autoComplete="new-password"
                required
              />
              <div className={styles.acoesMfa}>
                <button type="submit" className="btn btn-primario" disabled={carregando}>
                  {carregando ? 'Salvando…' : 'Salvar senha'}
                </button>
                <button type="button" className="btn btn-outline" onClick={() => setEditandoSenha(false)}>
                  Cancelar
                </button>
              </div>
            </form>
          ) : (
            <div style={{ marginTop: '0.75rem' }}>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => { setMensagemSucesso(null); setErro(null); setEditandoSenha(true) }}
              >
                Criar ou trocar senha
              </button>
            </div>
          )}
        </div>

        {/* ── SESSÕES ATIVAS ── */}
        <div className={styles.secaoCard}>
          <div className={styles.secaoHeader}>
            <div>
              <h3>Sessões ativas e dispositivos</h3>
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
              Desconectar todas as outras sessões
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
