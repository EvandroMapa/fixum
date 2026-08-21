'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { obterIniciaisUsuario, obterGradienteUsuario } from '@/lib/utils'
import styles from './MenuUsuarioTopbar.module.css'

interface MenuUsuarioTopbarProps {
  usuarioId: string
  usuarioNome: string
  usuarioEmail: string
  isImobiliaria: boolean
  isCorretor: boolean
  imobiliariaDona: { id: string; nome: string } | null
  onAbrirConfiguracoes: () => void
  onAbrirSeguranca: () => void
  onSair: () => void
}

export default function MenuUsuarioTopbar({
  usuarioId,
  usuarioNome,
  usuarioEmail,
  isImobiliaria,
  isCorretor,
  imobiliariaDona,
  onAbrirConfiguracoes,
  onAbrirSeguranca,
  onSair,
}: MenuUsuarioTopbarProps) {
  const [aberto, setAberto] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const iniciais = obterIniciaisUsuario(usuarioNome, usuarioEmail)
  const gradiente = obterGradienteUsuario(usuarioId || usuarioEmail || usuarioNome)

  // Fechar ao clicar fora
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setAberto(false)
      }
    }
    if (aberto) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [aberto])

  // Fechar com tecla ESC
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && aberto) {
        setAberto(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [aberto])

  const labelPapel = isImobiliaria
    ? '🏢 Gestão Imobiliária'
    : isCorretor && imobiliariaDona
      ? `👔 Equipe ${imobiliariaDona.nome}`
      : isCorretor
        ? '👔 Corretor Autônomo'
        : '👤 Proprietário'

  return (
    <div className={styles.menuWrapper} ref={menuRef}>
      {/* Botão Avatar Interativo */}
      <button
        type="button"
        className={`${styles.avatarBotao} ${aberto ? styles.avatarBotaoAtivo : ''}`}
        style={{ background: gradiente }}
        onClick={() => setAberto(!aberto)}
        aria-expanded={aberto}
        aria-label="Abrir menu do usuário"
        title={`${usuarioNome || 'Minha Conta'} • Opções da Conta`}
      >
        {iniciais}
      </button>

      {/* Menu Dropdown Flutuante */}
      {aberto && (
        <div className={styles.dropdown}>
          {/* Header com Resumo do Perfil */}
          <div className={styles.cabecalhoUsuario}>
            <div className={styles.miniAvatar} style={{ background: gradiente }}>
              {iniciais}
            </div>
            <div className={styles.infoUsuario}>
              <span className={styles.nomeUsuario} title={usuarioNome}>
                {usuarioNome || 'Minha Conta'}
              </span>
              <span className={styles.emailUsuario} title={usuarioEmail}>
                {usuarioEmail}
              </span>
              <span className={styles.badgePapel}>{labelPapel}</span>
            </div>
          </div>

          {/* Lista de Opções */}
          <div className={styles.listaOpcoes}>
            <button
              type="button"
              className={styles.itemMenu}
              onClick={() => {
                setAberto(false)
                onAbrirConfiguracoes()
              }}
            >
              <span className={styles.iconeItem}>⚙️</span>
              <span>Configurações</span>
              <span className={styles.tagDestaque}>Novo</span>
            </button>

            <button
              type="button"
              className={styles.itemMenu}
              onClick={() => {
                setAberto(false)
                onAbrirSeguranca()
              }}
            >
              <span className={styles.iconeItem}>🛡️</span>
              <span>Segurança & 2FA</span>
            </button>

            <a
              href="/explorar"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.itemMenu}
              onClick={() => setAberto(false)}
            >
              <span className={styles.iconeItem}>🌐</span>
              <span>Ver Portal no Mapa</span>
              <span style={{ fontSize: '0.7rem', color: '#94a3b8', marginLeft: 'auto' }}>↗</span>
            </a>

            <div className={styles.divisor} />

            <button
              type="button"
              className={`${styles.itemMenu} ${styles.itemSair}`}
              onClick={() => {
                setAberto(false)
                onSair()
              }}
            >
              <span className={styles.iconeItem}>🚪</span>
              <span>Sair da Conta</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
