'use client'

import React, { useState } from 'react'
import InputSenha from '@/components/ui/InputSenha'
import styles from './ModalEstornoFatura.module.css'

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
    cor: '#f59e0b',
  },
  {
    id: 'financeiro',
    titulo: '💳 Gestor Financeiro',
    descricao: 'Gestão de faturas, chargebacks, estornos, devoluções e relatórios de receita.',
    cor: '#3b82f6',
  },
  {
    id: 'suporte',
    titulo: '🎧 Suporte & Moderação',
    descricao: 'Aprovação de anúncios, conferência de clientes e atendimento a corretores/imobiliárias.',
    cor: '#10b981',
  },
]

export default function ModalNovoOperador({
  aberto,
  onFechar,
  onOperadorCriado,
  adminEmailLogado,
}: ModalNovoOperadorProps) {
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [cargo, setCargo] = useState<'master' | 'financeiro' | 'suporte'>('suporte')
  const [adminPin, setAdminPin] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  if (!aberto) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)

    if (!nome.trim() || !email.trim() || !senha || !adminPin.trim()) {
      setErro('Preencha todos os campos obrigatórios.')
      return
    }

    if (senha.length < 6) {
      setErro('A senha deve ter no mínimo 6 caracteres.')
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
        }),
      })

      const json = await res.json()
      if (!res.ok || json.error) {
        throw new Error(json.error || 'Erro ao cadastrar operador.')
      }

      onOperadorCriado()
      onFechar()
      setNome('')
      setEmail('')
      setSenha('')
      setAdminPin('')
    } catch (err: any) {
      setErro(err?.message || 'Falha ao cadastrar operador.')
    } finally {
      setCarregando(false)
    }
  }

  return (
    <div className={styles.overlay} onClick={onFechar}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Cabeçalho */}
        <div className={styles.cabecalho} style={{ background: '#0f172a' }}>
          <div className={styles.iconeAlerta} style={{ background: 'rgba(59, 130, 246, 0.2)' }}>
            👤
          </div>
          <div>
            <h2 className={styles.titulo}>Novo Operador Administrativo</h2>
            <p className={styles.subtitulo}>
              Cadastre um membro da equipe interna com permissões dedicadas no Backoffice
            </p>
          </div>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className={styles.corpo}>
          {erro && (
            <div className={styles.alertaErro}>
              <span>⚠️</span>
              <span>{erro}</span>
            </div>
          )}

          <div className={styles.grupoCampo}>
            <label className={styles.label}>
              <span>Nome Completo do Operador</span>
              <span className={styles.obrigatorio}>*</span>
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
              <span className={styles.obrigatorio}>*</span>
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
              <span className={styles.obrigatorio}>* (Mínimo 6 dígitos)</span>
            </label>
            <InputSenha
              name="operador-password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="••••••••••••"
              className={styles.input}
              estiloDark={true}
              required
            />
          </div>

          {/* Seletor de Cargo */}
          <div className={styles.grupoCampo}>
            <label className={styles.label}>
              <span>Nível de Acesso / Cargo</span>
              <span className={styles.obrigatorio}>*</span>
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {CARGOS_DISPONIVEIS.map((c) => (
                <div
                  key={c.id}
                  onClick={() => setCargo(c.id as any)}
                  style={{
                    background: cargo === c.id ? 'rgba(37, 99, 235, 0.15)' : '#0f172a',
                    border: `1.5px solid ${cargo === c.id ? '#3b82f6' : '#334155'}`,
                    borderRadius: '10px',
                    padding: '10px 14px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '3px' }}>
                    <strong style={{ color: '#ffffff', fontSize: '0.875rem' }}>{c.titulo}</strong>
                    {cargo === c.id && <span style={{ color: '#3b82f6', fontSize: '0.8rem', fontWeight: 800 }}>✓ Selecionado</span>}
                  </div>
                  <p style={{ margin: 0, fontSize: '0.725rem', color: '#94a3b8', lineHeight: 1.3 }}>
                    {c.descricao}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* PIN Master de Confirmação */}
          <div className={styles.grupoCampo} style={{ marginTop: '6px' }}>
            <label className={styles.label}>
              <span>Chave Secreta Master (PIN de Autorização)</span>
              <span className={styles.obrigatorio}>*</span>
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
              onClick={onFechar}
              disabled={carregando}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className={styles.btnConfirmar}
              style={{ background: '#2563eb' }}
              disabled={carregando}
            >
              {carregando ? 'Criando...' : '➕ Cadastrar Operador'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
