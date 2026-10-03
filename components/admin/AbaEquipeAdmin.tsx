'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { OperadorAdmin } from '@/app/api/admin/operadores/route'
import ModalNovoOperador from './ModalNovoOperador'
import ModalAlterarSenhaOperador from './ModalAlterarSenhaOperador'
import ModalEditarOperador from './ModalEditarOperador'
import { obterIniciaisUsuario, obterGradienteUsuario } from '@/lib/utils'
import { useConfirm } from '@/contexts/ModalConfirmacaoContext'
import styles from '@/app/admin/page.module.css'
import Icone from '@/components/ui/Icone'

interface AbaEquipeAdminProps {
  adminEmailLogado?: string
  adminPinPadrao?: string
}

export default function AbaEquipeAdmin({ adminEmailLogado }: AbaEquipeAdminProps) {
  const { confirmar, alertar } = useConfirm()
  const [operadores, setOperadores] = useState<OperadorAdmin[]>([])
  const [carregando, setCarregando] = useState(true)
  const [busca, setBusca] = useState('')
  const [filtroCargo, setFiltroCargo] = useState<string>('todos')
  const [filtroStatus, setFiltroStatus] = useState<string>('todos')

  // Modais
  const [modalNovoAberto, setModalNovoAberto] = useState(false)
  const [operadorParaSenha, setOperadorParaSenha] = useState<OperadorAdmin | null>(null)
  const [operadorParaEditar, setOperadorParaEditar] = useState<OperadorAdmin | null>(null)

  const carregarOperadores = useCallback(async () => {
    setCarregando(true)
    try {
      const res = await fetch('/api/admin/operadores')
      const json = await res.json()
      if (json.operadores) {
        setOperadores(json.operadores)
      }
    } catch (err) {
      console.error('Erro ao buscar operadores:', err)
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    carregarOperadores()
  }, [carregarOperadores])

  // Filtragem
  const operadoresFiltrados = operadores.filter((op) => {
    const matchBusca =
      !busca ||
      op.nome.toLowerCase().includes(busca.toLowerCase()) ||
      op.email.toLowerCase().includes(busca.toLowerCase())
    const matchCargo = filtroCargo === 'todos' || op.cargo === filtroCargo
    const matchStatus = filtroStatus === 'todos' || op.status_conta === filtroStatus
    return matchBusca && matchCargo && matchStatus
  })

  // Ação de Alterar Status (Suspender / Reativar)
  async function handleAlternarStatus(op: OperadorAdmin) {
    if (op.is_raiz) {
      await alertar({
        titulo: 'Operação bloqueada',
        mensagem: 'A conta raiz admin@fixum.com.br é o superadministrador e não pode ser suspensa.',
        tipo: 'aviso',
        icone: 'escudo',
      })
      return
    }

    const novoStatus = op.status_conta === 'ativo' ? 'suspenso' : 'ativo'
    const acaoTexto = novoStatus === 'suspenso' ? 'Suspender Acesso' : 'Reativar Acesso'

    const confirmou = await confirmar({
      titulo: `${acaoTexto} de ${op.nome}?`,
      mensagem:
        novoStatus === 'suspenso'
          ? `O operador ${op.email} não conseguirá mais efetuar login no Backoffice até ser reativado.`
          : `O operador ${op.email} voltará a ter acesso às ferramentas administrativas da Fixum.`,
      icone: novoStatus === 'suspenso' ? '' : '▶️',
      tipo: novoStatus === 'suspenso' ? 'perigo' : 'primario',
      textoBotaoConfirmar: `Sim, ${acaoTexto}`,
    })

    if (!confirmou) return

    try {
      const res = await fetch('/api/admin/operadores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          acao: 'alterar_status',
          operadorId: op.id,
          novoStatus,
          justificativa: `Alteração de status realizada por ${adminEmailLogado || 'admin'}`,
          adminEmail: adminEmailLogado,
        }),
      })

      const json = await res.json()
      if (!res.ok || json.error) {
        throw new Error(json.error || 'Falha ao alterar status.')
      }

      await alertar({
        titulo: 'Status atualizado',
        mensagem: `O operador ${op.nome} foi ${novoStatus === 'suspenso' ? 'suspenso' : 'reativado'} com sucesso.`,
        tipo: 'sucesso',
        icone: 'check',
      })

      carregarOperadores()
    } catch (err: any) {
      await alertar({
        titulo: 'Erro',
        mensagem: err?.message || 'Falha ao processar solicitação.',
        tipo: 'perigo',
        icone: 'alerta',
      })
    }
  }

  // Ação de Excluir Operador
  async function handleExcluirOperador(op: OperadorAdmin) {
    if (op.is_raiz) {
      await alertar({
        titulo: 'Operação bloqueada',
        mensagem: 'A conta raiz admin@fixum.com.br não pode ser excluída.',
        tipo: 'aviso',
        icone: 'escudo',
      })
      return
    }

    const confirmou = await confirmar({
      titulo: `Excluir operador ${op.nome}?`,
      mensagem: `Esta ação revogará definitivamente todas as credenciais de ${op.email}. O registro será arquivado na trilha de auditoria.`,
      icone: 'lixeira',
      tipo: 'perigo',
      textoBotaoConfirmar: 'Sim, Excluir Operador',
    })

    if (!confirmou) return

    try {
      const res = await fetch('/api/admin/operadores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          acao: 'excluir',
          operadorId: op.id,
          justificativa: `Exclusão permanente solicitada por ${adminEmailLogado || 'admin'}`,
          adminEmail: adminEmailLogado,
        }),
      })

      const json = await res.json()
      if (!res.ok || json.error) {
        throw new Error(json.error || 'Falha ao excluir operador.')
      }

      await alertar({
        titulo: 'Operador excluído',
        mensagem: `A conta de ${op.nome} foi removida da equipe administrativa.`,
        tipo: 'sucesso',
        icone: 'check',
      })

      carregarOperadores()
    } catch (err: any) {
      await alertar({
        titulo: 'Erro',
        mensagem: err?.message || 'Falha ao excluir operador.',
        tipo: 'perigo',
        icone: 'alerta',
      })
    }
  }

  function labelCargo(cargo: string) {
    switch (cargo) {
      case 'master':
        return { label: 'Master / diretoria', cor: '#E3A72F', bg: 'rgba(227, 167, 47, 0.12)' }
      case 'financeiro':
        return { label: 'Gestor financeiro', cor: '#2C5F8A', bg: 'rgba(44, 95, 138, 0.12)' }
      case 'suporte':
        return { label: 'Suporte & moderação', cor: '#3F8A66', bg: 'rgba(46, 107, 78, 0.12)' }
      default:
        return { label: 'Operador', cor: '#A39A8A', bg: 'rgba(163, 154, 138, 0.12)' }
    }
  }

  return (
    <div className={styles.secao}>
      {/* Cabeçalho da Aba com Ação de Criar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#ffffff', margin: 0 }}>
 Equipe & administradores Fixum
 </h2>
          <p style={{ fontSize: '0.85rem', color: '#A39A8A', margin: '4px 0 0' }}>
            Gestão exclusiva de operadores e acessos institucionais do Backoffice
          </p>
        </div>

        <button
          type="button"
          onClick={() => setModalNovoAberto(true)}
          style={{
            background: 'linear-gradient(135deg, #16201C, #22302A)',
            border: 'none',
            borderRadius: '10px',
            color: '#ffffff',
            fontWeight: 700,
            fontSize: '0.875rem',
            padding: '10px 18px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 4px 14px rgba(22, 32, 28, 0.35)',
            transition: 'transform 0.15s ease',
          }}
        >
          <span><Icone nome="mais" tamanho={16} /></span>
          <span>Novo operador administrativo</span>
        </button>
      </div>

      {/* Barra de Filtros e Busca */}
      <div className={styles.painelCard} style={{ marginBottom: '20px', padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px' }}>
          {/* Busca por Texto */}
          <div style={{ flex: '1', minWidth: '240px', position: 'relative' }}>
            <input
              type="text"
              placeholder="Buscar por nome ou e-mail corporativo..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className={styles.inputBusca}
              style={{
                width: '100%',
                background: '#16201C',
                border: '1.5px solid #3F3B34',
                borderRadius: '10px',
                padding: '10px 14px',
                color: '#ffffff',
                fontSize: '0.875rem',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Filtros de Cargo e Status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <select
              value={filtroCargo}
              onChange={(e) => setFiltroCargo(e.target.value)}
              className={styles.selectFiltro}
              style={{
                background: '#16201C',
                border: '1.5px solid #3F3B34',
                borderRadius: '10px',
                padding: '10px 14px',
                color: '#ffffff',
                fontSize: '0.85rem',
                outline: 'none',
              }}
            >
              <option value="todos">Todos os cargos</option>
              <option value="master">Master / diretoria</option>
              <option value="financeiro">Gestor financeiro</option>
              <option value="suporte">Suporte & moderação</option>
            </select>

            <select
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value)}
              className={styles.selectFiltro}
              style={{
                background: '#16201C',
                border: '1.5px solid #3F3B34',
                borderRadius: '10px',
                padding: '10px 14px',
                color: '#ffffff',
                fontSize: '0.85rem',
                outline: 'none',
              }}
            >
              <option value="todos">Todos os status</option>
              <option value="ativo">Ativos</option>
              <option value="suspenso">Suspensos</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tabela de Operadores */}
      <div className={styles.tabelaWrapper}>
        <table className={styles.tabela}>
          <thead>
            <tr>
              <th>Operador / administrador</th>
              <th>Cargo / nível</th>
              <th>Status</th>
              <th>Último acesso</th>
              <th>Data cadastro</th>
              <th style={{ textAlign: 'right' }}>Ações de segurança</th>
            </tr>
          </thead>
          <tbody>
            {carregando ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: '#A39A8A' }}>
                  Carregando operadores administrativos...
                </td>
              </tr>
            ) : operadoresFiltrados.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: '#A39A8A' }}>
                  Nenhum operador administrativo encontrado com os filtros atuais.
                </td>
              </tr>
            ) : (
              operadoresFiltrados.map((op) => {
                const infoCargo = labelCargo(op.cargo)
                const iniciais = obterIniciaisUsuario(op.nome, op.email)
                const gradiente = obterGradienteUsuario(op.id || op.email)

                return (
                  <tr key={op.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div
                          style={{
                            width: '38px',
                            height: '38px',
                            borderRadius: '10px',
                            background: gradiente,
                            color: '#ffffff',
                            fontWeight: 800,
                            fontSize: '0.875rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          {iniciais}
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <strong style={{ color: '#ffffff', fontSize: '0.9rem' }}>{op.nome}</strong>
                            {op.is_raiz && (
                              <span
                                style={{
                                  fontSize: '0.65rem',
                                  fontWeight: 800,
                                  background: 'rgba(212, 64, 31, 0.2)',
                                  color: '#E8836B',
                                  border: '1px solid rgba(212, 64, 31, 0.4)',
                                  padding: '1px 6px',
                                  borderRadius: '999px',
                                  textTransform: 'uppercase',
                                }}
                              >
                                Conta raiz
                              </span>
                            )}
                          </div>
                          <span style={{ fontSize: '0.785rem', color: '#A39A8A' }}>{op.email}</span>
                        </div>
                      </div>
                    </td>

                    <td>
                      <span
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          color: infoCargo.cor,
                          background: infoCargo.bg,
                          padding: '4px 10px',
                          borderRadius: '8px',
                          border: `1px solid ${infoCargo.cor}33`,
                          display: 'inline-block',
                        }}
                      >
                        {infoCargo.label}
                      </span>
                    </td>

                    <td>
                      {op.status_conta === 'suspenso' ? (
                        <span style={{ color: '#E8836B', background: 'rgba(212, 64, 31, 0.15)', padding: '3px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700 }}>
 Suspenso
 </span>
                      ) : (
                        <span style={{ color: '#7DBB98', background: 'rgba(46, 107, 78, 0.15)', padding: '3px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700 }}>
 Ativo
 </span>
                      )}
                    </td>

                    <td style={{ fontSize: '0.8rem', color: '#CFC6B6' }}>
                      {op.last_sign_in_at
                        ? new Date(op.last_sign_in_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
                        : 'Nunca acessou'}
                    </td>

                    <td style={{ fontSize: '0.8rem', color: '#A39A8A' }}>
                      {new Date(op.created_at).toLocaleDateString('pt-BR')}
                    </td>

                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                        {/* Editar Operador */}
                        <button
                          type="button"
                          onClick={() => setOperadorParaEditar(op)}
                          className={styles.btnAcaoTabela}
                          title="Editar cadastro e permissões"
                          style={{
                            background: '#22302A',
                            border: '1px solid #3F3B34',
                            color: '#F0A58F',
                            borderRadius: '8px',
                            padding: '6px 10px',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
 Editar
 </button>

                        {/* Redefinir Senha */}
                        <button
                          type="button"
                          onClick={() => setOperadorParaSenha(op)}
                          className={styles.btnAcaoTabela}
                          title="Redefinir senha do operador"
                          style={{
                            background: '#22302A',
                            border: '1px solid #3F3B34',
                            color: '#E8B84A',
                            borderRadius: '8px',
                            padding: '6px 10px',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
 Senha
 </button>

                        {/* Suspender / Reativar (bloqueado na conta raiz) */}
                        {!op.is_raiz && (
                          <button
                            type="button"
                            onClick={() => handleAlternarStatus(op)}
                            className={styles.btnAcaoTabela}
                            title={op.status_conta === 'suspenso' ? 'Reativar acesso' : 'Suspender acesso'}
                            style={{
                              background: op.status_conta === 'suspenso' ? 'rgba(46, 107, 78, 0.15)' : 'rgba(212, 64, 31, 0.15)',
                              border: `1px solid ${op.status_conta === 'suspenso' ? '#3F8A66' : '#D4401F'}`,
                              color: op.status_conta === 'suspenso' ? '#7DBB98' : '#E8836B',
                              borderRadius: '8px',
                              padding: '6px 10px',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            {op.status_conta === 'suspenso' ? '▶️ Ativar' : 'Suspender'}
                          </button>
                        )}

                        {/* Excluir (bloqueado na conta raiz) */}
                        {!op.is_raiz && (
                          <button
                            type="button"
                            onClick={() => handleExcluirOperador(op)}
                            className={styles.btnAcaoTabela}
                            title="Excluir definitivamente"
                            style={{
                              background: '#22302A',
                              border: '1px solid #3F3B34',
                              color: '#A39A8A',
                              borderRadius: '8px',
                              padding: '6px 10px',
                              fontSize: '0.75rem',
                              cursor: 'pointer',
                            }}
                          >
                            <Icone nome="lixeira" tamanho={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modais */}
      <ModalNovoOperador
        aberto={modalNovoAberto}
        onFechar={() => setModalNovoAberto(false)}
        onOperadorCriado={carregarOperadores}
        adminEmailLogado={adminEmailLogado}
      />

      <ModalEditarOperador
        aberto={!!operadorParaEditar}
        operador={operadorParaEditar}
        onFechar={() => setOperadorParaEditar(null)}
        onOperadorSalvo={carregarOperadores}
        adminEmailLogado={adminEmailLogado}
      />

      <ModalAlterarSenhaOperador
        operador={operadorParaSenha}
        onFechar={() => setOperadorParaSenha(null)}
        onSenhaAlterada={carregarOperadores}
        adminEmailLogado={adminEmailLogado}
      />
    </div>
  )
}
