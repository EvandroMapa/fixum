'use client'

import { useState, useEffect, useRef } from 'react'
import styles from './MenuNotificacoes.module.css'

export interface NotificacaoItem {
  id: string
  usuario_id: string
  titulo: string
  mensagem: string
  tipo: 'revisao_pendente' | 'imovel_aprovado' | 'imovel_recusado' | 'info'
  imovel_id?: string
  lida: boolean
  created_at: string
}

interface MenuNotificacoesProps {
  usuarioId: string
  imobiliariaId?: string
  onClicarNotificacao?: (notificacao: NotificacaoItem) => void
}

export default function MenuNotificacoes({
  usuarioId,
  imobiliariaId,
  onClicarNotificacao,
}: MenuNotificacoesProps) {
  const [aberto, setAberto] = useState(false)
  const [notificacoes, setNotificacoes] = useState<NotificacaoItem[]>([])
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    carregarNotificacoes()
    const interval = setInterval(carregarNotificacoes, 15000)
    return () => clearInterval(interval)
  }, [usuarioId, imobiliariaId])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setAberto(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function carregarNotificacoes() {
    if (!usuarioId) return
    try {
      const res = await fetch(`/api/painel/notificacoes?usuario_id=${usuarioId}&imobiliaria_id=${imobiliariaId || usuarioId}`)
      const data = await res.json()
      if (data?.notificacoes) {
        setNotificacoes(data.notificacoes)
      }
    } catch {}
  }

  async function handleMarcarTodasLidas() {
    try {
      await fetch('/api/painel/notificacoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acao: 'marcar_todas_lidas', usuario_id: usuarioId }),
      })
      setNotificacoes((prev) => prev.map((n) => ({ ...n, lida: true })))
    } catch {}
  }

  async function handleClicarItem(notif: NotificacaoItem) {
    if (!notif.lida) {
      try {
        await fetch('/api/painel/notificacoes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ acao: 'marcar_lida', notificacaoId: notif.id }),
        })
        setNotificacoes((prev) => prev.map((n) => (n.id === notif.id ? { ...n, lida: true } : n)))
      } catch {}
    }

    if (onClicarNotificacao) {
      onClicarNotificacao(notif)
    }
    setAberto(false)
  }

  const naoLidas = notificacoes.filter((n) => !n.lida).length

  function iconePorTipo(tipo: NotificacaoItem['tipo']) {
    switch (tipo) {
      case 'revisao_pendente': return '⏳'
      case 'imovel_aprovado': return '🎉'
      case 'imovel_recusado': return '⚠️'
      default: return '🔔'
    }
  }

  return (
    <div className={styles.wrapper} ref={wrapperRef}>
      <button
        type="button"
        className={styles.btnSino}
        onClick={() => setAberto(!aberto)}
        title="Notificações e Avisos"
      >
        <span>🔔</span>
        {naoLidas > 0 && <span className={styles.badgeContador}>{naoLidas}</span>}
      </button>

      {aberto && (
        <div className={styles.dropdown}>
          <div className={styles.headerDropdown}>
            <span className={styles.headerTitulo}>Notificações ({naoLidas} novas)</span>
            {naoLidas > 0 && (
              <button
                type="button"
                className={styles.btnLimpar}
                onClick={handleMarcarTodasLidas}
              >
                Marcar lidas
              </button>
            )}
          </div>

          <div className={styles.listaNotificacoes}>
            {notificacoes.length === 0 ? (
              <div className={styles.vazio}>
                <span>🔕</span>
                <span>Nenhuma notificação no momento</span>
              </div>
            ) : (
              notificacoes.map((n) => (
                <div
                  key={n.id}
                  className={`${styles.itemNotificacao} ${!n.lida ? styles.itemNaoLida : ''}`}
                  onClick={() => handleClicarItem(n)}
                >
                  <span className={styles.iconeTipo}>{iconePorTipo(n.tipo)}</span>
                  <div className={styles.conteudoNotif}>
                    <span className={styles.tituloNotif}>{n.titulo}</span>
                    <span className={styles.mensagemNotif}>{n.mensagem}</span>
                    <span className={styles.dataNotif}>
                      {new Date(n.created_at).toLocaleDateString('pt-BR', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
