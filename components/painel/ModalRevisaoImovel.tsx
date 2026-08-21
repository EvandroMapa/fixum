'use client'

import { useState } from 'react'
import Link from 'next/link'
import { type Imovel, type Plano } from '@/lib/types'
import { formatarPreco, labelTipoImovel, fotoPrincipal } from '@/lib/utils'
import { useConfirm } from '@/contexts/ModalConfirmacaoContext'
import LinhaTempoRevisao from './LinhaTempoRevisao'
import styles from './ModalRevisaoImovel.module.css'

interface ModalRevisaoImovelProps {
  aberto: boolean
  onFechar: () => void
  imovel: Imovel | null
  nomeCorretor: string
  gestorId: string
  gestorNome: string
  usoPlano: {
    plano: Plano
    imoveisAtivos: number
    limiteMaximo: number
    atingiuLimite: boolean
  }
  onSucesso: () => Promise<void>
  onAbrirEdicao?: (id: string) => void
}

export default function ModalRevisaoImovel({
  aberto,
  onFechar,
  imovel,
  nomeCorretor,
  gestorId,
  gestorNome,
  usoPlano,
  onSucesso,
  onAbrirEdicao,
}: ModalRevisaoImovelProps) {
  const [salvando, setSalvando] = useState(false)
  const [exibirRecusa, setExibirRecusa] = useState(false)
  const [motivoRecusa, setMotivoRecusa] = useState('')
  const [chaveHistorico, setChaveHistorico] = useState(0)
  const { alertar, confirmar } = useConfirm()

  if (!aberto || !imovel) return null

  async function handleAprovar() {
    if (usoPlano.atingiuLimite) {
      await alertar({
        titulo: 'Cota Corporativa Atingida',
        mensagem: `A imobiliária atingiu o limite de ${usoPlano.limiteMaximo} anúncios ativos do plano ${usoPlano.plano.nome}. Faça upgrade ou pause um anúncio antes de aprovar este novo imóvel.`,
        icone: '⚠️',
        tipo: 'aviso',
      })
      return
    }

    setSalvando(true)
    try {
      // 1. Grava o evento de aprovação no histórico e notifica o corretor
      await fetch('/api/painel/imoveis/revisar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imovelId: imovel.id,
          autorId: gestorId,
          autorNome: gestorNome,
          autorPapel: 'gestor',
          tipoEvento: 'aprovacao',
          mensagem: 'Anúncio revisado e aprovado com sucesso.',
          corretorId: imovel.anunciante_id,
          imovelTitulo: imovel.titulo,
        }),
      })

      // 2. Dispara a ação de aprovação geral
      const res = await fetch('/api/painel/imoveis/acoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          acao: 'aprovar_imovel',
          imoveisIds: [imovel.id],
          usuarioId: gestorId,
          gestorNome,
        }),
      })

      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erro ao aprovar imóvel.')

      await alertar({
        titulo: 'Imóvel Aprovado!',
        mensagem: 'O anúncio foi aprovado e já está publicado e visível no mapa público do Fixum.',
        icone: '🎉',
        tipo: 'sucesso',
      })
      await onSucesso()
      onFechar()
    } catch (err: any) {
      await alertar({
        titulo: 'Erro ao Aprovar',
        mensagem: err.message || 'Ocorreu um erro ao aprovar o imóvel.',
        tipo: 'perigo',
      })
    } finally {
      setSalvando(false)
    }
  }

  async function handleConfirmarRecusa() {
    if (!motivoRecusa.trim()) {
      await alertar({
        titulo: 'Motivo Obrigatório',
        mensagem: 'Por favor, descreva o motivo da solicitação de ajustes para orientar o corretor.',
        icone: '✍️',
        tipo: 'aviso',
      })
      return
    }

    setSalvando(true)
    try {
      // 1. Grava no histórico colaborativo e notifica o corretor
      const res = await fetch('/api/painel/imoveis/revisar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imovelId: imovel.id,
          autorId: gestorId,
          autorNome: gestorNome,
          autorPapel: 'gestor',
          tipoEvento: 'solicitacao_ajuste',
          mensagem: motivoRecusa.trim(),
          corretorId: imovel.anunciante_id,
          imovelTitulo: imovel.titulo,
        }),
      })

      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erro ao recusar imóvel.')

      await alertar({
        titulo: 'Ajustes Solicitados',
        mensagem: `A solicitação com suas orientações foi enviada com sucesso para o corretor ${nomeCorretor}.`,
        icone: '📬',
        tipo: 'info',
      })
      await onSucesso()
      onFechar()
    } catch (err: any) {
      await alertar({
        titulo: 'Erro ao Solicitar Ajustes',
        mensagem: err.message || 'Ocorreu um erro ao processar a solicitação de ajustes.',
        tipo: 'perigo',
      })
    } finally {
      setSalvando(false)
    }
  }

  const isAtivo = imovel.status === 'ativo' || imovel.status === 'publicado'
  const isPausado = imovel.status === 'pausado'
  const fotos = imovel.fotos && imovel.fotos.length > 0 ? imovel.fotos : []

  return (
    <div className={styles.overlay} onClick={onFechar}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerTitle}>
            <span className={styles.iconeHeader}>{isAtivo ? '🛡️' : '🔍'}</span>
            <div>
              <h2>{isAtivo ? 'Auditoria & Moderação de Imóvel' : isPausado ? 'Auditoria de Imóvel Pausado' : 'Revisão e Moderação de Anúncio'}</h2>
              <div className={styles.subtituloHeader}>
                Corretor responsável: <strong>{nomeCorretor}</strong> • {isAtivo ? '🟢 Ativo no Mapa Público' : isPausado ? '⏸️ Pausado' : '⏳ Aguardando aprovação'}
              </div>
            </div>
          </div>
          <button type="button" className={styles.btnFechar} onClick={onFechar}>
            ✕
          </button>
        </div>

        {/* Corpo */}
        <div className={styles.corpo}>
          {/* Banner de Auditoria se estiver Ativo */}
          {isAtivo && (
            <div style={{
              background: '#fffbeb',
              border: '1.5px solid #fde68a',
              borderRadius: '0.75rem',
              padding: '0.85rem 1rem',
              fontSize: '0.825rem',
              color: '#92400e',
              lineHeight: '1.4',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}>
              <span style={{ fontSize: '1.3rem' }}>🛡️</span>
              <span>
                <strong>Auditoria da Gestão:</strong> Este anúncio está atualmente no ar. Ao clicar em <strong>"Solicitar Ajustes"</strong>, ele será <strong>imediatamente suspenso do mapa público</strong> para proteger a imobiliária e reatribuído ao corretor com as suas orientações.
              </span>
            </div>
          )}

          {/* Galeria de Fotos */}
          <div>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '6px' }}>
              📸 Fotos do Imóvel ({fotos.length}):
            </span>
            {fotos.length > 0 ? (
              <div className={styles.galeriaPreview}>
                {fotos.map((f, i) => (
                  <div
                    key={f.id || i}
                    className={styles.fotoItem}
                    style={{ backgroundImage: `url(${f.url})` }}
                  >
                    {f.principal && <span className={styles.badgeFotoPrincipal}>Principal</span>}
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ padding: '1rem', background: '#f1f5f9', borderRadius: '8px', color: '#64748b', fontSize: '0.85rem' }}>
                ⚠️ Nenhuma foto cadastrada neste anúncio.
              </div>
            )}
          </div>

          {/* Dados do Imóvel */}
          <div className={styles.cardDados}>
            <div className={styles.linhaTituloPreco}>
              <div>
                <h3 className={styles.tituloImovel}>{imovel.titulo}</h3>
                <span style={{ fontSize: '0.825rem', color: '#64748b' }}>
                  📍 {imovel.cidade} {imovel.bairro ? `• ${imovel.bairro}` : ''} {imovel.endereco ? `• ${imovel.endereco}` : ''}
                </span>
              </div>
              <div className={styles.precoImovel}>
                {formatarPreco(imovel.preco, imovel.negociacao)}
              </div>
            </div>

            <div className={styles.gridAtributos}>
              <div className={styles.itemAtributo}>
                <span className={styles.labelAtributo}>Tipo</span>
                <span className={styles.valorAtributo}>{labelTipoImovel(imovel.tipo)}</span>
              </div>
              <div className={styles.itemAtributo}>
                <span className={styles.labelAtributo}>Negociação</span>
                <span className={styles.valorAtributo} style={{ textTransform: 'capitalize' }}>{imovel.negociacao}</span>
              </div>
              <div className={styles.itemAtributo}>
                <span className={styles.labelAtributo}>Área</span>
                <span className={styles.valorAtributo}>{imovel.area ? `${imovel.area} m²` : 'N/I'}</span>
              </div>
              <div className={styles.itemAtributo}>
                <span className={styles.labelAtributo}>Quartos</span>
                <span className={styles.valorAtributo}>{imovel.quartos || '0'}</span>
              </div>
              <div className={styles.itemAtributo}>
                <span className={styles.labelAtributo}>Banheiros</span>
                <span className={styles.valorAtributo}>{imovel.banheiros || '0'}</span>
              </div>
              <div className={styles.itemAtributo}>
                <span className={styles.labelAtributo}>Vagas</span>
                <span className={styles.valorAtributo}>{imovel.vagas || '0'}</span>
              </div>
            </div>

            {imovel.descricao && (
              <div>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                  Descrição do Anúncio:
                </span>
                <div className={styles.descricaoTexto}>
                  {imovel.descricao}
                </div>
              </div>
            )}
          </div>

          {/* ── LINHA DO TEMPO & HISTÓRICO DE MODERAÇÃO ── */}
          <LinhaTempoRevisao
            imovelId={imovel.id}
            motivoRejeicaoAtual={imovel.descricao_motivo_rejeicao}
            atualizarChave={chaveHistorico}
          />
        </div>

        {/* Rodapé com Decisão do Gestor */}
        <div className={styles.rodape}>
          {!exibirRecusa ? (
            <>
              {onAbrirEdicao ? (
                <button
                  type="button"
                  className={styles.btnEditar}
                  onClick={() => {
                    onFechar()
                    onAbrirEdicao(imovel.id)
                  }}
                  title="Editar e corrigir informações diretamente antes de publicar"
                >
                  ✏️ Editar Anúncio
                </button>
              ) : (
                <Link
                  href={`/painel/editar-imovel/${imovel.id}`}
                  className={styles.btnEditar}
                  title="Editar e corrigir informações diretamente antes de publicar"
                >
                  ✏️ Editar Anúncio
                </Link>
              )}

              <div className={styles.botoesAcao}>
                <button
                  type="button"
                  className={styles.btnRecusar}
                  onClick={() => setExibirRecusa(true)}
                  disabled={salvando}
                  style={isAtivo ? { background: '#fffbeb', borderColor: '#f59e0b', color: '#b45309' } : {}}
                >
                  {isAtivo ? '⚠️ Solicitar Ajustes (Suspender do Mapa)' : '❌ Solicitar Ajustes'}
                </button>

                <button
                  type="button"
                  className={styles.btnAprovar}
                  onClick={handleAprovar}
                  disabled={salvando}
                >
                  {salvando ? 'Salvando...' : isAtivo ? '✅ Manter Publicado' : '✅ Aprovar e Publicar no Mapa'}
                </button>
              </div>
            </>
          ) : (
            /* Formulário de Ajustes no Próprio Rodapé */
            <div className={styles.boxRecusaRodape}>
              <div className={styles.boxRecusaHeader}>
                <span className={styles.boxRecusaTitulo}>
                  ⚠️ O que o corretor <strong>{nomeCorretor}</strong> precisa corrigir?
                </span>
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                  O corretor receberá esta instrução no painel dele.
                </span>
              </div>
              <textarea
                className={styles.textareaRecusa}
                placeholder="Descreva as alterações necessárias (ex: Adicionar fotos da fachada, revisar o valor do condomínio, ajustar a descrição...)"
                value={motivoRecusa}
                onChange={(e) => setMotivoRecusa(e.target.value)}
                autoFocus
                rows={3}
              />
              <div className={styles.boxRecusaBotoes}>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    setExibirRecusa(false)
                    setMotivoRecusa('')
                  }}
                  disabled={salvando}
                >
                  Voltar
                </button>
                <button
                  type="button"
                  className="btn btn-sm"
                  style={{ background: '#dc2626', color: '#ffffff', fontWeight: 700, padding: '0.5rem 1.25rem' }}
                  onClick={handleConfirmarRecusa}
                  disabled={salvando || !motivoRecusa.trim()}
                >
                  {salvando ? 'Enviando...' : '📤 Enviar Ajustes para o Corretor'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
