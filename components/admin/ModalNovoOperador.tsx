'use client'

import React, { useState } from 'react'
import InputSenha from '@/components/ui/InputSenha'
import styles from './ModalNovoOperador.module.css'

interface ModalNovoOperadorProps {
  aberto: boolean
  onFechar: () => void
  onOperadorCriado: () => void
  adminEmailLogado?: string
}

const CARGOS_DISPONIVEIS = [
  {
    id: 'master',
    titulo: '👑 Master / Diretoria',
    descricao: 'Acesso total e irrestrito (planos, financeiro, estornos e gestão de operadores).',
  },
  {
    id: 'financeiro',
    titulo: '💳 Gestor Financeiro',
    descricao: 'Gestão de faturas, chargebacks, estornos, devoluções e relatórios de receita.',
  },
  {
    id: 'suporte',
    titulo: '🎧 Suporte & Moderação',
    descricao: 'Aprovação de anúncios, conferência de clientes e atendimento a corretores/imobiliárias.',
  },
]

export default function ModalNovoOperador({
  aberto,
  onFechar,
  onOperadorCriado,
  adminEmailLogado = 'admin@fixum.com.br',
}: ModalNovoOperadorProps) {
  const [etapa, setEtapa] = useState<'formulario' | 'otp'>('formulario')
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [cargo, setCargo] = useState<'master' | 'financeiro' | 'suporte'>('suporte')
  const [adminPin, setAdminPin] = useState('')
  const [codigoOtp, setCodigoOtp] = useState('')
  const [timerReenvio, setTimerReenvio] = useState(0)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [sucesso, setSucesso] = useState<string | null>(null)

  if (!aberto) return null

  function resetarEFechar() {
    onFechar()
    setEtapa('formulario')
    setNome('')
    setEmail('')
    setSenha('')
    setAdminPin('')
    setCodigoOtp('')
    setErro(null)
    setSucesso(null)
  }

  // ── ETAPA 1: VALIDAR DADOS E ENVIAR CÓDIGO OTP PARA O E-MAIL DO ADMIN ──
  async function handleAvancarParaOtp(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)
    setSucesso(null)

    if (!nome.trim() || !email.trim() || !senha || !adminPin.trim()) {
      setErro('Preencha todos os campos obrigatórios.')
      return
    }

    if (senha.length < 6) {
      setErro('A senha do operador deve ter no mínimo 6 caracteres.')
      return
    }

    setCarregando(true)
    try {
      const emailNovoOperador = email.trim().toLowerCase()

      // Disparar código OTP diretamente para o e-mail informado do novo operador
      const res = await fetch('/api/auth/otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          acao: 'enviar',
          email: emailNovoOperador,
          motivo: 'criar_operador',
        }),
      })

      const json = await res.json()
      if (!res.ok || json.error) {
        throw new Error(json.error || 'Erro ao enviar código de autorização por e-mail.')
      }

      setEtapa('otp')
      setTimerReenvio(60)
      setSucesso(`Enviamos um código de confirmação de 6 dígitos para o e-mail do novo operador (${emailNovoOperador}).`)
    } catch (err: any) {
      setErro(err?.message || 'Falha ao solicitar código de confirmação.')
    } finally {
      setCarregando(false)
    }
  }

  // ── ETAPA 2: VALIDAR OTP E EFETIVAR A CRIAÇÃO DO OPERADOR ──
  async function handleConfirmarCriacao(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)

    if (!codigoOtp || codigoOtp.trim().length < 6) {
      setErro('Digite o código de 6 dígitos recebido por e-mail.')
      return
    }

    setCarregando(true)
    try {
      const res = await fetch('/api/admin/operadores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          acao: 'criar',
          nome: nome.trim(),
          email: email.trim().toLowerCase(),
          senha,
          cargo,
          adminPin: adminPin.trim(),
          adminEmail: adminEmailLogado,
          codigoOtp: codigoOtp.trim(),
        }),
      })

      const json = await res.json()
      if (!res.ok || json.error) {
        throw new Error(json.error || 'Código incorreto ou erro ao criar operador.')
      }

      onOperadorCriado()
      resetarEFechar()
    } catch (err: any) {
      setErro(err?.message || 'Falha ao cadastrar operador.')
    } finally {
      setCarregando(false)
    }
  }

  // Reenviar OTP
  async function handleReenviarOtp() {
    if (timerReenvio > 0) return
    setErro(null)
    setCarregando(true)

    try {
      const emailNovoOperador = email.trim().toLowerCase()
      const res = await fetch('/api/auth/otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          acao: 'enviar',
          email: emailNovoOperador,
          motivo: 'criar_operador',
        }),
      })

      const json = await res.json()
      if (!res.ok || json.error) {
        throw new Error(json.error || 'Falha ao reenviar código.')
      }

      setTimerReenvio(60)
      setSucesso(`Novo código de segurança enviado para ${emailNovoOperador}.`)
    } catch (err: any) {
      setErro(err?.message || 'Falha ao reenviar código.')
    } finally {
      setCarregando(false)
    }
  }

  return (
    <div className={styles.overlay} onClick={resetarEFechar}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Cabeçalho */}
        <div className={styles.cabecalho}>
          <div className={styles.iconeTopo}>
            {etapa === 'otp' ? '✉️' : '👤'}
          </div>
          <div>
            <h2 className={styles.titulo}>
              {etapa === 'otp' ? 'Confirmação de Segurança (2FA)' : 'Novo Operador Administrativo'}
            </h2>
            <p className={styles.subtitulo}>
              {etapa === 'otp'
                ? 'Autorização por código OTP para criação de conta institucional'
                : 'Cadastre um membro da equipe com permissões dedicadas no Backoffice'}
            </p>
          </div>
        </div>

        {/* ── ETAPA 1: FORMULÁRIO DE DADOS ── */}
        {etapa === 'formulario' && (
          <form onSubmit={handleAvancarParaOtp} className={styles.corpo}>
            {erro && (
              <div className={styles.alertaErro}>
                <span>⚠️</span>
                <span>{erro}</span>
              </div>
            )}

            <div className={styles.grupoCampo}>
              <label className={styles.label}>
                <span>Nome Completo do Operador</span>
                <span className={styles.obrigatorio}>* Obrigatório</span>
              </label>
              <input
                type="text"
                className={styles.input}
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: Carlos Eduardo Silva"
                required
                autoFocus
              />
            </div>

            <div className={styles.grupoCampo}>
              <label className={styles.label}>
                <span>E-mail Corporativo</span>
                <span className={styles.obrigatorio}>* Obrigatório</span>
              </label>
              <input
                type="email"
                className={styles.input}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Ex: suporte@fixum.com.br"
                required
              />
            </div>

            <div className={styles.grupoCampo}>
              <label className={styles.label}>
                <span>Senha Inicial de Acesso</span>
                <span className={styles.obrigatorio}>* Mínimo 6 dígitos</span>
              </label>
              <InputSenha
                name="operador-password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="Digite uma senha segura"
                className={styles.input}
                estiloDark={true}
                required
              />
            </div>

            {/* Seletor de Cargo */}
            <div className={styles.grupoCampo}>
              <label className={styles.label}>
                <span>Nível de Acesso / Cargo</span>
                <span className={styles.obrigatorio}>* Selecione um</span>
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {CARGOS_DISPONIVEIS.map((c) => {
                  const selecionado = cargo === c.id
                  return (
                    <div
                      key={c.id}
                      onClick={() => setCargo(c.id as any)}
                      className={`${styles.cardCargo} ${selecionado ? styles.cardCargoAtivo : styles.cardCargoInativo}`}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '3px' }}>
                        <strong style={{ color: '#ffffff', fontSize: '0.88rem' }}>{c.titulo}</strong>
                        {selecionado && (
                          <span style={{ color: '#38bdf8', fontSize: '0.78rem', fontWeight: 800 }}>
                            ✓ Selecionado
                          </span>
                        )}
                      </div>
                      <p style={{ margin: 0, fontSize: '0.75rem', color: '#94a3b8', lineHeight: 1.35 }}>
                        {c.descricao}
                      </p>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* PIN Master de Confirmação */}
            <div className={styles.grupoCampo} style={{ marginTop: '4px' }}>
              <label className={styles.label}>
                <span>Chave Secreta Master (PIN de Autorização)</span>
                <span className={styles.obrigatorio}>* Obrigatório</span>
              </label>
              <InputSenha
                name="admin-pin-novo-operador"
                value={adminPin}
                onChange={(e) => setAdminPin(e.target.value)}
                placeholder="Digite a Chave Secreta Master"
                className={styles.input}
                estiloDark={true}
                required
              />
            </div>

            {/* Ações */}
            <div className={styles.rodape}>
              <button
                type="button"
                className={styles.btnCancelar}
                onClick={resetarEFechar}
                disabled={carregando}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className={styles.btnConfirmar}
                disabled={carregando}
              >
                {carregando ? 'Enviando Código...' : 'Avançar para Verificação OTP ➔'}
              </button>
            </div>
          </form>
        )}

        {/* ── ETAPA 2: DIGITAÇÃO DO CÓDIGO OTP DE 6 DÍGITOS ── */}
        {etapa === 'otp' && (
          <form onSubmit={handleConfirmarCriacao} className={styles.corpo}>
            {sucesso && (
              <div style={{
                background: 'rgba(34, 197, 94, 0.15)',
                border: '1px solid rgba(34, 197, 94, 0.3)',
                borderRadius: '10px',
                padding: '12px 16px',
                color: '#4ade80',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}>
                <span>✓</span>
                <span>{sucesso}</span>
              </div>
            )}

            {erro && (
              <div className={styles.alertaErro}>
                <span>⚠️</span>
                <span>{erro}</span>
              </div>
            )}

            <div style={{ textAlign: 'center', padding: '8px 0' }}>
              <p style={{ color: '#cbd5e1', fontSize: '0.875rem', margin: '0 0 6px 0' }}>
                Para validação da conta, informe o código de 6 dígitos enviado para:
              </p>
              <strong style={{ color: '#38bdf8', fontSize: '0.95rem' }}>
                {email.trim().toLowerCase()}
              </strong>
            </div>

            <div className={styles.grupoCampo}>
              <label className={styles.label} style={{ textAlign: 'center', display: 'block' }}>
                Código de 6 Dígitos
              </label>
              <input
                type="text"
                maxLength={6}
                value={codigoOtp}
                onChange={(e) => setCodigoOtp(e.target.value.replace(/\D/g, ''))}
                placeholder="123456"
                className={styles.input}
                style={{
                  textAlign: 'center',
                  fontSize: '1.5rem',
                  letterSpacing: '0.35em',
                  fontWeight: 800,
                  color: '#38bdf8',
                  padding: '12px',
                }}
                autoFocus
                required
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px' }}>
              <button
                type="button"
                onClick={() => setEtapa('formulario')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                ← Voltar aos dados
              </button>

              <button
                type="button"
                onClick={handleReenviarOtp}
                disabled={carregando || timerReenvio > 0}
                style={{
                  background: 'none',
                  border: 'none',
                  color: timerReenvio > 0 ? '#64748b' : '#38bdf8',
                  fontSize: '0.8rem',
                  cursor: timerReenvio > 0 ? 'not-allowed' : 'pointer',
                  fontWeight: 600,
                }}
              >
                {timerReenvio > 0 ? `Reenviar em ${timerReenvio}s` : '🔄 Reenviar código'}
              </button>
            </div>

            <div className={styles.rodape}>
              <button
                type="button"
                className={styles.btnCancelar}
                onClick={resetarEFechar}
                disabled={carregando}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className={styles.btnConfirmar}
                disabled={carregando || codigoOtp.length < 6}
              >
                {carregando ? 'Criando Operador...' : '✓ Confirmar e Cadastrar'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
