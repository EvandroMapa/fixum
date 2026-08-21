'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { obterIniciaisUsuario, obterGradienteUsuario } from '@/lib/utils'
import styles from './LinhaTempoRevisao.module.css'

export interface EventoRevisao {
  id: string
  imovel_id: string
  autor_id: string
  autor_nome: string
  autor_papel: 'gestor' | 'gestor_principal' | 'corretor'
  tipo_evento: 'submissao_inicial' | 'solicitacao_ajuste' | 'resposta_corretor' | 'aprovacao' | 'edicao_dados'
  mensagem?: string
  created_at: string
}

interface LinhaTempoRevisaoProps {
  imovelId: string
  motivoRejeicaoAtual?: string | null
  atualizarChave?: number
}

export default function LinhaTempoRevisao({
  imovelId,
  motivoRejeicaoAtual,
  atualizarChave,
}: LinhaTempoRevisaoProps) {
  const supabase = createClient()
  const [eventos, setEventos] = useState<EventoRevisao[]>([])
  const [carregando, setCarregando] = useState(true)

  async function carregarHistorico(silencioso = false) {
    try {
      if (!silencioso) setCarregando(true)
      const res = await fetch(`/api/painel/imoveis/revisar?imovelId=${imovelId}`)
      const data = await res.json()
      if (data.historico) {
        setEventos(data.historico)
      }
    } catch {
      // Silêncio
    } finally {
      if (!silencioso) setCarregando(false)
    }
  }

  useEffect(() => {
    if (imovelId) {
      carregarHistorico()
    }
  }, [imovelId, atualizarChave])

  // Realtime para novas mensagens no chat de moderação
  useEffect(() => {
    if (!imovelId) return

    const canalHistorico = supabase
      .channel(`revisao-chat-${imovelId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'historico_revisao_imoveis',
          filter: `imovel_id=eq.${imovelId}`,
        },
        () => {
          carregarHistorico(true)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(canalHistorico)
    }
  }, [imovelId, supabase])

  function formatarDataHora(iso: string) {
    if (!iso) return ''
    try {
      const data = new Date(iso)
      return data.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return ''
    }
  }

  function getEstiloTipo(tipo: EventoRevisao['tipo_evento']) {
    switch (tipo) {
      case 'solicitacao_ajuste':
        return styles.itemTimelineSolicitacao
      case 'aprovacao':
        return styles.itemTimelineAprovacao
      case 'resposta_corretor':
        return styles.itemTimelineResposta
      default:
        return ''
    }
  }

  function getIconeETitulo(tipo: EventoRevisao['tipo_evento']) {
    switch (tipo) {
      case 'solicitacao_ajuste':
        return { icone: '⚠️', titulo: 'Ajustes Solicitados pelo Gestor' }
      case 'resposta_corretor':
        return { icone: '📤', titulo: 'Reenviado para Revisão com Correções' }
      case 'aprovacao':
        return { icone: '✅', titulo: 'Anúncio Aprovado e Publicado' }
      case 'submissao_inicial':
        return { icone: '📝', titulo: 'Cadastro Submetido para Revisão' }
      default:
        return { icone: '💬', titulo: 'Atualização no Anúncio' }
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.tituloSecao}>
        <span>💬</span>
        <span>Histórico de Moderação & Mensagens ({eventos.length})</span>
      </div>

      {carregando ? (
        <div style={{ fontSize: '0.8rem', color: '#64748b', padding: '0.5rem 0' }}>
          Carregando mensagens da moderação...
        </div>
      ) : eventos.length === 0 ? (
        // Se não houver histórico gravado mas tiver motivoRejeicaoAtual do banco
        motivoRejeicaoAtual ? (
          <div className={`${styles.itemTimeline} ${styles.itemTimelineSolicitacao}`}>
            <div
              className={styles.avatarAutor}
              style={{ background: 'linear-gradient(135deg, #d97706, #b45309)' }}
            >
              GS
            </div>
            <div className={styles.conteudoItem}>
              <div className={styles.cabecalhoItem}>
                <span className={styles.autorNome}>Gestor da Imobiliária</span>
                <span className={`${styles.badgePapel} ${styles.badgeGestor}`}>Gestor</span>
              </div>
              <div className={styles.mensagemTexto}>{motivoRejeicaoAtual}</div>
            </div>
          </div>
        ) : (
          <div className={styles.boxSemHistorico}>
            Nenhuma observação ou ajuste registrado para este anúncio.
          </div>
        )
      ) : (
        <div className={styles.listaTimeline}>
          {eventos.map((ev) => {
            const { icone, titulo } = getIconeETitulo(ev.tipo_evento)
            const isGestor = ev.autor_papel === 'gestor' || ev.autor_papel === 'gestor_principal'

            return (
              <div
                key={ev.id}
                className={`${styles.itemTimeline} ${getEstiloTipo(ev.tipo_evento)}`}
              >
                <div
                  className={styles.avatarAutor}
                  style={{ background: obterGradienteUsuario(ev.autor_id || ev.autor_nome) }}
                  title={`${ev.autor_nome} (${ev.autor_papel})`}
                >
                  {obterIniciaisUsuario(ev.autor_nome)}
                </div>

                <div className={styles.conteudoItem}>
                  <div className={styles.cabecalhoItem}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span className={styles.autorNome}>{ev.autor_nome}</span>
                      <span
                        className={`${styles.badgePapel} ${isGestor ? styles.badgeGestor : styles.badgeCorretor}`}
                      >
                        {isGestor ? 'Gestor' : 'Corretor'}
                      </span>
                    </div>
                    <span className={styles.dataHora}>{formatarDataHora(ev.created_at)}</span>
                  </div>

                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span>{icone}</span>
                    <span>{titulo}</span>
                  </div>

                  {ev.mensagem && (
                    <div className={styles.mensagemTexto}>"{ev.mensagem}"</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
