'use client'

import React, { useState, useEffect } from 'react'
import InputSenha from '@/components/ui/InputSenha'
import styles from './ModalNovoOperador.module.css'
import { OperadorAdmin } from '@/app/api/admin/operadores/route'

interface ModalEditarOperadorProps {
  operador: OperadorAdmin | null
  aberto: boolean
  onFechar: () => void
  onOperadorSalvo: () => void
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

export default function ModalEditarOperador({
  operador,
  aberto,
  onFechar,
  onOperadorSalvo,
  adminEmailLogado,
}: ModalEditarOperadorProps) {
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [cargo, setCargo] = useState<'master' | 'financeiro' | 'suporte'>('suporte')
  const [statusConta, setStatusConta] = useState<'ativo' | 'suspenso'>('ativo')
  const [adminPin, setAdminPin] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    if (operador) {
      setNome(operador.nome || '')
      setEmail(operador.email || '')
      setCargo(operador.cargo || 'suporte')
      setStatusConta(operador.status_conta || 'ativo')
      setAdminPin('')
      setErro(null)
    }
  }, [operador, aberto])

  if (!aberto || !operador) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)

    if (!nome.trim() || !email.trim()) {
      setErro('Nome e e-mail são obrigatórios.')
      return
    }

    if (!adminPin.trim()) {
      setErro('Informe a Chave Secreta Master para autorizar a alteração.')
      return
    }

    setCarregando(true)
    try {
      const res = await fetch('/api/admin/operadores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          acao: 'editar',
          operadorId: operador?.id,
          nome: nome.trim(),
          email: email.trim().toLowerCase(),
          cargo,
          status_conta: statusConta,
          adminPin: adminPin.trim(),
          adminEmail: adminEmailLogado,
        }),
      })

      const json = await res.json()
      if (!res.ok || json.error) {
        throw new Error(json.error || 'Erro ao salvar alterações do operador.')
      }

      onOperadorSalvo()
      onFechar()
    } catch (err: any) {
      setErro(err?.message || 'Falha ao salvar dados do operador.')
    } finally {
      setCarregando(false)
    }
  }

  return (
    <div className={styles.overlay} onClick={onFechar}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Cabeçalho */}
        <div className={styles.cabecalho}>
          <div className={styles.iconeTopo} style={{ background: 'rgba(59, 130, 246, 0.18)', borderColor: 'rgba(59, 130, 246, 0.35)' }}>
            ✏️
          </div>
          <div>
            <h2 className={styles.titulo}>Editar Operador</h2>
            <p className={styles.subtitulo}>
              Atualize as credenciais e o nível de acesso de <strong style={{ color: '#ffffff' }}>{operador.nome}</strong>
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
              <span>Nome Completo</span>
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
              disabled={operador.is_raiz}
              required
            />
            {operador.is_raiz && (
              <span style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '2px' }}>
                O e-mail da conta raiz não pode ser alterado.
              </span>
            )}
          </div>

          {/* Seletor de Cargo */}
          <div className={styles.grupoCampo}>
            <label className={styles.label}>
              <span>Nível de Acesso / Cargo</span>
              <span className={styles.obrigatorio}>* Selecione um</span>
            </label>
            {operador.is_raiz ? (
              <div
                className={`${styles.cardCargo} ${styles.cardCargoAtivo}`}
                style={{ cursor: 'default' }}
              >
                <strong style={{ color: '#ffffff', fontSize: '0.88rem' }}>👑 Master / Diretoria (Conta Raiz)</strong>
                <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: '#94a3b8' }}>
                  Superadministrador vitalício com acesso total irrestrito.
                </p>
              </div>
            ) : (
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
            )}
          </div>

          {/* Status da Conta (Ativo / Suspenso) */}
          {!operador.is_raiz && (
            <div className={styles.grupoCampo}>
              <label className={styles.label}>
                <span>Status da Conta</span>
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setStatusConta('ativo')}
                  style={{
                    padding: '10px',
                    borderRadius: '10px',
                    border: `1.5px solid ${statusConta === 'ativo' ? '#10b981' : '#334155'}`,
                    background: statusConta === 'ativo' ? 'rgba(16, 185, 129, 0.15)' : '#0f172a',
                    color: statusConta === 'ativo' ? '#34d399' : '#94a3b8',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                  }}
                >
                  <span>🟢</span>
                  <span>Conta Ativa</span>
                </button>

                <button
                  type="button"
                  onClick={() => setStatusConta('suspenso')}
                  style={{
                    padding: '10px',
                    borderRadius: '10px',
                    border: `1.5px solid ${statusConta === 'suspenso' ? '#ef4444' : '#334155'}`,
                    background: statusConta === 'suspenso' ? 'rgba(239, 68, 68, 0.15)' : '#0f172a',
                    color: statusConta === 'suspenso' ? '#f87171' : '#94a3b8',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                  }}
                >
                  <span>⏸️</span>
                  <span>Suspensa</span>
                </button>
              </div>
            </div>
          )}

          {/* PIN Master de Confirmação */}
          <div className={styles.grupoCampo} style={{ marginTop: '4px' }}>
            <label className={styles.label}>
              <span>Chave Secreta Master (PIN de Autorização)</span>
              <span className={styles.obrigatorio}>* Obrigatório</span>
            </label>
            <InputSenha
              name="admin-pin-editar-operador"
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
              disabled={carregando}
            >
              {carregando ? 'Salvando...' : '💾 Salvar Alterações'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
