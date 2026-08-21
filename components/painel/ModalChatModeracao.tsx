'use client'

import { useState, useEffect, useRef } from 'react'
import { type Imovel } from '@/lib/types'
import { fotoPrincipal, formatarPreco, labelTipoImovel, obterIniciaisUsuario, obterGradienteUsuario } from '@/lib/utils'
import styles from './ModalChatModeracao.module.css'

export interface EventoHistorico {
  id: string
  imovel_id: string
  autor_id: string
  autor_nome: string
  autor_papel: 'gestor' | 'gestor_principal' | 'corretor'
  tipo_evento: 'submissao_inicial' | 'solicitacao_ajuste' | 'resposta_corretor' | 'aprovacao' | 'edicao_dados' | 'mensagem_chat'
  mensagem?: string
  created_at: string
}

interface ModalChatModeracaoProps {
  imovel: Imovel
  usuarioId: string
  usuarioNome: string
  isImobiliaria: boolean
  nomesAnunciantes: Record<string, string>
  imobiliariaDona: { id: string; nome: string } | null
  onClose: () => void
}

export default function ModalChatModeracao({
  imovel,
  usuarioId,
  usuarioNome,
  isImobiliaria,
  nomesAnunciantes,
  imobiliariaDona,
  onClose,
}: ModalChatModeracaoProps) {
  const [mensagens, setMensagens] = useState<EventoHistorico[]>([])
  const [carregando, setCarregando] = useState(true)
  const [textoMensagem, setTextoMensagem] = useState('')
  const [enviando, setEnviando] = useState(false)
  const feedContainerRef = useRef<HTMLDivElement>(null)
  const feedEndRef = useRef<HTMLDivElement>(null)
  const primeiraCargaFeitaRef = useRef(false)

  const nomeCorretor = nomesAnunciantes[imovel.anunciante_id] || 'Corretor'
  const isDonoOuCorretor = usuarioId === imovel.anunciante_id

  // 1. Carregar histórico inicial
  async function carregarHistorico(silencioso = false) {
    try {
      if (!silencioso) setCarregando(true)
      const res = await fetch(`/api/painel/imoveis/revisar?imovelId=${imovel.id}`)
      const data = await res.json()
      if (data.historico) {
        setMensagens(data.historico)
        if (typeof window !== 'undefined' && usuarioId) {
          localStorage.setItem(`chat_leitura_${usuarioId}_${imovel.id}`, new Date().toISOString())
        }
      }
    } catch {
      // Silêncio
    } finally {
      if (!silencioso) setCarregando(false)
    }
  }

  useEffect(() => {
    carregarHistorico()
  }, [imovel.id])

  // 2. Polling a cada 3s para novas mensagens (substitui Realtime que não funciona no browser)
  useEffect(() => {
    const intervalo = setInterval(() => {
      carregarHistorico(true)
    }, 3000)

    return () => clearInterval(intervalo)
  }, [imovel.id])

  // 3. Auto-scroll para o final (Instantâneo na abertura, suave nas mensagens seguintes)
  useEffect(() => {
    if (carregando) return

    if (!primeiraCargaFeitaRef.current) {
      // Primeira abertura: posiciona direto no final instantaneamente sem animação de scroll
      requestAnimationFrame(() => {
        if (feedContainerRef.current) {
          feedContainerRef.current.scrollTop = feedContainerRef.current.scrollHeight
        }
        feedEndRef.current?.scrollIntoView({ behavior: 'instant' as ScrollBehavior })
        primeiraCargaFeitaRef.current = true
      })
    } else {
      // Mensagens novas subsequentes: scroll suave para acompanhar
      feedEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [mensagens, carregando])

  // 4. Fechar com a tecla ESC
  useEffect(() => {
    function handleGlobalKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleGlobalKeyDown)
    return () => window.removeEventListener('keydown', handleGlobalKeyDown)
  }, [onClose])

  // 4. Enviar mensagem
  async function handleEnviarMensagem(e?: React.FormEvent) {
    if (e) e.preventDefault()
    if (!textoMensagem.trim() || enviando) return

    const textoParaEnviar = textoMensagem.trim()
    setTextoMensagem('')
    setEnviando(true)

    // Otimistic update
    const idTemp = 'temp_' + Date.now()
    const msgOtimista: EventoHistorico = {
      id: idTemp,
      imovel_id: imovel.id,
      autor_id: usuarioId,
      autor_nome: usuarioNome || (isImobiliaria ? 'Gestor' : 'Corretor'),
      autor_papel: isImobiliaria ? 'gestor' : 'corretor',
      tipo_evento: 'mensagem_chat',
      mensagem: textoParaEnviar,
      created_at: new Date().toISOString(),
    }
    setMensagens((prev) => [...prev, msgOtimista])

    try {
      await fetch('/api/painel/imoveis/revisar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imovelId: imovel.id,
          autorId: usuarioId,
          autorNome: usuarioNome || (isImobiliaria ? 'Gestor' : 'Corretor'),
          autorPapel: isImobiliaria ? 'gestor' : 'corretor',
          tipoEvento: 'mensagem_chat',
          mensagem: textoParaEnviar,
          imobiliariaId: imobiliariaDona?.id || (isImobiliaria ? usuarioId : null),
          corretorId: imovel.anunciante_id,
          imovelTitulo: imovel.titulo,
        }),
      })
      carregarHistorico(true)
    } catch {
      // Se falhar, recarrega
      carregarHistorico(true)
    } finally {
      setEnviando(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleEnviarMensagem()
    }
  }

  function formatarHora(iso: string) {
    if (!iso) return ''
    try {
      const d = new Date(iso)
      return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    } catch {
      return ''
    }
  }

  function formatarData(iso: string) {
    if (!iso) return ''
    try {
      const d = new Date(iso)
      return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
    } catch {
      return ''
    }
  }

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modalBox} onClick={(e) => e.stopPropagation()}>
        {/* ── CABEÇALHO DO CHAT ── */}
        <div className={styles.headerChat}>
          <div className={styles.infoImovelHeader}>
            <div
              className={styles.fotoMiniatura}
              style={{ backgroundImage: `url(${fotoPrincipal(imovel)})` }}
            />
            <div className={styles.dadosImovelTexto}>
              <h3 className={styles.tituloImovel} title={imovel.titulo}>
                {imovel.titulo}
              </h3>
              <div className={styles.subtituloHeader}>
                <span>{labelTipoImovel(imovel.tipo)}</span>
                <span>•</span>
                <span>{formatarPreco(imovel.preco, imovel.negociacao)}</span>
                <span>•</span>
                <span
                  className={styles.badgeStatusHeader}
                  style={{
                    background:
                      imovel.status === 'em_analise' || imovel.status === 'rascunho'
                        ? '#fef3c7'
                        : imovel.status === 'ativo' || imovel.status === 'publicado'
                          ? '#ecfdf5'
                          : '#f1f5f9',
                    color:
                      imovel.status === 'em_analise' || imovel.status === 'rascunho'
                        ? '#b45309'
                        : imovel.status === 'ativo' || imovel.status === 'publicado'
                          ? '#059669'
                          : '#475569',
                  }}
                >
                  {imovel.status === 'em_analise' || imovel.status === 'rascunho'
                    ? '⏳ Em Revisão'
                    : imovel.status === 'ativo' || imovel.status === 'publicado'
                      ? '🟢 Ativo'
                      : '⏸️ Pausado'}
                </span>
              </div>
              <div style={{ fontSize: '0.675rem', color: '#64748b', marginTop: '1px' }}>
                👤 Corretor: <strong>{nomeCorretor}</strong>
              </div>
            </div>
          </div>

          <button
            type="button"
            className={styles.btnFechar}
            onClick={onClose}
            title="Fechar chat"
          >
            ✕
          </button>
        </div>

        {/* ── FEED DE MENSAGENS (ESTILO WHATSAPP) ── */}
        <div ref={feedContainerRef} className={styles.feedMensagens}>
          {/* Pílula Inicial de Boas-Vindas */}
          <div className={styles.pilulaCentral}>
            🔒 Chat seguro de moderação e auditoria do anúncio
          </div>

          {carregando ? (
            <div style={{ textAlign: 'center', color: '#64748b', fontSize: '0.775rem', padding: '1rem' }}>
              Carregando histórico de mensagens...
            </div>
          ) : mensagens.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#64748b', fontSize: '0.8rem', padding: '2rem 1rem' }}>
              Nenhuma mensagem trocada ainda. Inicie a conversa abaixo para alinhar os ajustes deste anúncio! 💬
            </div>
          ) : (
            mensagens.map((msg) => {
              const isMinhaMensagem = msg.autor_id === usuarioId
              const isGestor = msg.autor_papel === 'gestor' || msg.autor_papel === 'gestor_principal'

              // Pílulas de Sistema para Eventos de Status
              if (msg.tipo_evento === 'solicitacao_ajuste') {
                return (
                  <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div className={`${styles.pilulaCentral} ${styles.pilulaAjuste}`}>
                      <span>⚠️</span>
                      <span>
                        <strong>{msg.autor_nome}</strong> solicitou ajustes no anúncio • {formatarHora(msg.created_at)}
                      </span>
                    </div>
                    {msg.mensagem && (
                      <div className={`${styles.linhaMensagem} ${isMinhaMensagem ? styles.linhaMensagemMinha : styles.linhaMensagemOutro}`}>
                        <div className={`${styles.balaoMensagem} ${isMinhaMensagem ? styles.balaoMeu : styles.balaoOutro}`}>
                          {!isMinhaMensagem && (
                            <div className={styles.autorInfoBalao}>
                              <span className={styles.autorNomeGestor}>{msg.autor_nome}</span>
                              <span className={`${styles.badgePapelBalao} ${styles.badgeGestorBalao}`}>🛡️ Gestor</span>
                            </div>
                          )}
                          <p className={styles.textoMensagem}>{msg.mensagem}</p>
                          <div className={styles.metaMensagem}>
                            <span>{formatarHora(msg.created_at)}</span>
                            {isMinhaMensagem && <span>✓✓</span>}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )
              }

              if (msg.tipo_evento === 'resposta_corretor') {
                return (
                  <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div className={`${styles.pilulaCentral} ${styles.pilulaReenvio}`}>
                      <span>📤</span>
                      <span>
                        <strong>{msg.autor_nome}</strong> aplicou os ajustes e reenviou para revisão • {formatarHora(msg.created_at)}
                      </span>
                    </div>
                    {msg.mensagem && (
                      <div className={`${styles.linhaMensagem} ${isMinhaMensagem ? styles.linhaMensagemMinha : styles.linhaMensagemOutro}`}>
                        <div className={`${styles.balaoMensagem} ${isMinhaMensagem ? styles.balaoMeu : styles.balaoOutro}`}>
                          {!isMinhaMensagem && (
                            <div className={styles.autorInfoBalao}>
                              <span className={styles.autorNomeCorretor}>{msg.autor_nome}</span>
                              <span className={`${styles.badgePapelBalao} ${styles.badgeCorretorBalao}`}>👔 Corretor</span>
                            </div>
                          )}
                          <p className={styles.textoMensagem}>{msg.mensagem}</p>
                          <div className={styles.metaMensagem}>
                            <span>{formatarHora(msg.created_at)}</span>
                            {isMinhaMensagem && <span>✓✓</span>}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )
              }

              if (msg.tipo_evento === 'aprovacao') {
                return (
                  <div key={msg.id} className={`${styles.pilulaCentral} ${styles.pilulaAprovado}`}>
                    <span>✅</span>
                    <span>
                      <strong>{msg.autor_nome}</strong> aprovou e publicou o anúncio no mapa • {formatarHora(msg.created_at)}
                    </span>
                  </div>
                )
              }

              if (msg.tipo_evento === 'submissao_inicial') {
                return (
                  <div key={msg.id} className={styles.pilulaCentral}>
                    <span>📝</span>
                    <span>
                      Anúncio submetido para moderação por <strong>{msg.autor_nome}</strong> • {formatarHora(msg.created_at)}
                    </span>
                  </div>
                )
              }

              // Mensagem normal do chat
              return (
                <div
                  key={msg.id}
                  className={`${styles.linhaMensagem} ${isMinhaMensagem ? styles.linhaMensagemMinha : styles.linhaMensagemOutro}`}
                >
                  <div className={`${styles.balaoMensagem} ${isMinhaMensagem ? styles.balaoMeu : styles.balaoOutro}`}>
                    {!isMinhaMensagem && (
                      <div className={styles.autorInfoBalao}>
                        <span className={isGestor ? styles.autorNomeGestor : styles.autorNomeCorretor}>
                          {msg.autor_nome}
                        </span>
                        <span
                          className={`${styles.badgePapelBalao} ${isGestor ? styles.badgeGestorBalao : styles.badgeCorretorBalao}`}
                        >
                          {isGestor ? '🛡️ Gestor' : '👔 Corretor'}
                        </span>
                      </div>
                    )}

                    <p className={styles.textoMensagem}>{msg.mensagem}</p>

                    <div className={styles.metaMensagem}>
                      <span>{formatarHora(msg.created_at)}</span>
                      {isMinhaMensagem && <span>✓✓</span>}
                    </div>
                  </div>
                </div>
              )
            })
          )}
          <div ref={feedEndRef} />
        </div>

        {/* ── RODAPÉ DE ENVIO DE MENSAGEM ── */}
        <form className={styles.rodapeChat} onSubmit={handleEnviarMensagem}>
          <div className={styles.inputMensagemWrapper}>
            <textarea
              className={styles.textareaMensagem}
              placeholder="Digite uma mensagem..."
              rows={1}
              value={textoMensagem}
              onChange={(e) => setTextoMensagem(e.target.value)}
              onKeyDown={handleKeyDown}
            />
          </div>

          <button
            type="submit"
            className={styles.btnEnviar}
            disabled={!textoMensagem.trim() || enviando}
            title="Enviar mensagem (Enter)"
          >
            {enviando ? '⏳' : '➤'}
          </button>
        </form>
      </div>
    </div>
  )
}
