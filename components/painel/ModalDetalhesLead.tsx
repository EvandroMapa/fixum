'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { type Lead, type AtividadeLead, type CompromissoLead, type AnexoLead } from '@/lib/types'
import { formatarPreco, formatarTelefone } from '@/lib/utils'
import styles from './ModalDetalhesLead.module.css'

interface Props {
  lead: Lead
  usuarioId: string
  usuarioNome: string
  isGestor: boolean
  isImobiliaria: boolean
  listaCorretores: { id: string; nome: string }[]
  onFechar: () => void
  onAtualizarLead: (leadAtualizado?: Partial<Lead>) => void
}

type AbaModal = 'geral' | 'timeline' | 'agenda' | 'anexos'

export default function ModalDetalhesLead({
  lead,
  usuarioId,
  usuarioNome,
  isGestor,
  isImobiliaria,
  listaCorretores,
  onFechar,
  onAtualizarLead,
}: Props) {
  const [abaAtiva, setAbaAtiva] = useState<AbaModal>('geral')

  // ── ESTADOS DE ATIVIDADES / TIMELINE ──
  const [atividades, setAtividades] = useState<AtividadeLead[]>([])
  const [carregandoAtividades, setCarregandoAtividades] = useState(true)
  const [novaAnotacao, setNovaAnotacao] = useState('')
  const [salvandoAnotacao, setSalvandoAnotacao] = useState(false)
  const [processandoAcao, setProcessandoAcao] = useState(false)

  // ── ESTADOS DE AGENDA & COMPROMISSOS ──
  const [compromissos, setCompromissos] = useState<CompromissoLead[]>([])
  const [carregandoCompromissos, setCarregandoCompromissos] = useState(false)
  const [novoCompTitulo, setNovoCompTitulo] = useState('')
  const [novoCompTipo, setNovoCompTipo] = useState<'visita' | 'ligacao' | 'proposta' | 'reuniao' | 'outro'>('visita')
  const [novoCompDataHora, setNovoCompDataHora] = useState('')
  const [novoCompRespId, setNovoCompRespId] = useState(lead.corretor_id || usuarioId)
  const [salvandoCompromisso, setSalvandoCompromisso] = useState(false)

  // ── ESTADOS DE ANEXOS ──
  const [anexos, setAnexos] = useState<AnexoLead[]>([])
  const [carregandoAnexos, setCarregandoAnexos] = useState(false)
  const [enviandoAnexo, setEnviandoAnexo] = useState(false)
  const inputFileRef = useRef<HTMLInputElement>(null)

  // ── MODAIS DE AÇÃO RÁPIDA (RODAPÉ) ──
  const [modalPropostaAberto, setModalPropostaAberto] = useState(false)
  const [valorPropostaInput, setValorPropostaInput] = useState(lead.valor_proposta ? String(lead.valor_proposta) : '')
  const [modalPerdaAberto, setModalPerdaAberto] = useState(false)
  const [motivoPerdaInput, setMotivoPerdaInput] = useState(lead.motivo_perda || 'Sem resposta do cliente')

  // ── CARREGAR DADOS ──
  async function carregarAtividades() {
    try {
      setCarregandoAtividades(true)
      const res = await fetch(`/api/painel/leads?lead_id=${lead.id}`)
      const json = await res.json()
      if (json.atividades) setAtividades(json.atividades)
    } catch (e) {
      console.error('Erro ao carregar atividades:', e)
    } finally {
      setCarregandoAtividades(false)
    }
  }

  async function carregarCompromissos() {
    try {
      setCarregandoCompromissos(true)
      const res = await fetch(`/api/painel/leads/compromissos?lead_id=${lead.id}`)
      const json = await res.json()
      if (json.compromissos) setCompromissos(json.compromissos)
    } catch (e) {
      console.error('Erro ao carregar compromissos:', e)
    } finally {
      setCarregandoCompromissos(false)
    }
  }

  async function carregarAnexos() {
    try {
      setCarregandoAnexos(true)
      const res = await fetch(`/api/painel/leads/anexos?lead_id=${lead.id}`)
      const json = await res.json()
      if (json.anexos) setAnexos(json.anexos)
    } catch (e) {
      console.error('Erro ao carregar anexos:', e)
    } finally {
      setCarregandoAnexos(false)
    }
  }

  useEffect(() => {
    carregarAtividades()
    carregarCompromissos()
    carregarAnexos()
  }, [lead.id])

  // ── FECHAR COM A TECLA ESC ──
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (modalPropostaAberto) {
          setModalPropostaAberto(false)
          return
        }
        if (modalPerdaAberto) {
          setModalPerdaAberto(false)
          return
        }
        onFechar()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onFechar, modalPropostaAberto, modalPerdaAberto])

  // ── SALVAR ANOTAÇÃO ──
  async function handleAdicionarAnotacao(e: React.FormEvent) {
    e.preventDefault()
    const texto = novaAnotacao.trim()
    if (!texto) return

    const ativOtimista: AtividadeLead = {
      id: 'local_' + Date.now(),
      lead_id: lead.id,
      autor_id: usuarioId,
      autor_nome: usuarioNome,
      tipo: 'anotacao',
      descricao: texto,
      created_at: new Date().toISOString(),
    }

    setAtividades((prev) => [ativOtimista, ...prev])
    setNovaAnotacao('')

    try {
      setSalvandoAnotacao(true)
      const res = await fetch('/api/painel/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead_id: lead.id,
          usuario_id: usuarioId,
          usuario_nome: usuarioNome,
          tipo: 'anotacao',
          descricao: texto,
        }),
      })
      if (res.ok) onAtualizarLead()
    } catch (err) {
      console.error('Erro ao salvar anotação:', err)
    } finally {
      setSalvandoAnotacao(false)
    }
  }

  // ── ATUALIZAR CAMPO DO LEAD ──
  async function handleAtualizarCampo(payload: Record<string, any>) {
    try {
      setProcessandoAcao(true)
      const res = await fetch('/api/painel/leads', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead_id: lead.id,
          usuario_autor_id: usuarioId,
          usuario_autor_nome: usuarioNome,
          ...payload,
        }),
      })
      if (res.ok) {
        await carregarAtividades()
        onAtualizarLead({ ...lead, ...payload })
      }
    } catch (err) {
      console.error('Erro ao atualizar lead:', err)
    } finally {
      setProcessandoAcao(false)
    }
  }

  // ── REATRIBUIR CORRETOR OU RETORNAR À TRIAGEM ──
  async function handleReatribuirCorretor(novoCorretorId: string) {
    if (!novoCorretorId) {
      await handleAtualizarCampo({
        corretor_id: null,
        corretor_nome: null,
        mensagem_atividade: `Lead desvinculado e retornado para a Fila de Triagem por ${usuarioNome}.`,
      })
      return
    }

    const corretor = listaCorretores.find((c) => c.id === novoCorretorId)
    if (!corretor) return
    await handleAtualizarCampo({
      corretor_id: corretor.id,
      corretor_nome: corretor.nome,
      mensagem_atividade: `Lead atribuído ao corretor ${corretor.nome} por ${usuarioNome}.`,
    })
  }

  // ── AÇÕES RÁPIDAS (RODAPÉ) ──
  function handleChamarWhatsApp() {
    if (!lead.telefone) return
    if (!lead.data_primeiro_contato) {
      handleAtualizarCampo({
        primeiro_contato: true,
        mensagem_atividade: `Primeiro contato via WhatsApp iniciado por ${usuarioNome}.`,
      })
    }
    const telLimpo = lead.telefone.replace(/\D/g, '')
    const urlImovel = typeof window !== 'undefined' && lead.imovel?.id
      ? `${window.location.origin}/imovel/${lead.imovel.id}`
      : ''

    const codTexto = lead.imovel?.codigo ? ` (Ref: ${lead.imovel.codigo})` : ''
    const texto = `Olá ${lead.nome}! Sou ${usuarioNome} do portal de imóveis Fixum.\n\nVi seu interesse no imóvel *${lead.imovel?.titulo || 'anunciado na Fixum'}*${codTexto}.\n${urlImovel ? `🔗 ${urlImovel}\n\n` : ''}Como posso te ajudar?`

    const msg = encodeURIComponent(texto)
    window.open(`https://wa.me/55${telLimpo}?text=${msg}`, '_blank')
  }

  async function handleSalvarProposta() {
    const val = Number(valorPropostaInput.replace(/\D/g, ''))
    if (!val) return
    await handleAtualizarCampo({
      valor_proposta: val,
      status: 'proposta',
      mensagem_atividade: `Proposta de ${formatarPreco(val)} registrada por ${usuarioNome}.`,
    })
    setModalPropostaAberto(false)
  }

  async function handleSalvarPerda() {
    await handleAtualizarCampo({
      motivo_perda: motivoPerdaInput,
      status: 'perdido',
      mensagem_atividade: `Lead marcado como Perdido. Motivo: "${motivoPerdaInput}" (${usuarioNome}).`,
    })
    setModalPerdaAberto(false)
  }

  // ── GESTÃO DE COMPROMISSOS (AGENDA) ──
  async function handleCriarCompromisso(e: React.FormEvent) {
    e.preventDefault()
    if (!novoCompTitulo.trim() || !novoCompDataHora) return

    const respAlvo = listaCorretores.find((c) => c.id === novoCompRespId)
    const respNome = respAlvo ? respAlvo.nome : usuarioNome

    const compOtimista: CompromissoLead = {
      id: 'local_' + Date.now(),
      lead_id: lead.id,
      titulo: novoCompTitulo.trim(),
      tipo: novoCompTipo,
      data_hora: novoCompDataHora,
      concluido: false,
      responsavel_id: novoCompRespId,
      responsavel_nome: respNome,
      created_at: new Date().toISOString(),
    }

    setCompromissos((prev) => [...prev, compOtimista].sort((a, b) => new Date(a.data_hora).getTime() - new Date(b.data_hora).getTime()))
    setNovoCompTitulo('')
    setNovoCompDataHora('')

    try {
      setSalvandoCompromisso(true)
      const res = await fetch('/api/painel/leads/compromissos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead_id: lead.id,
          titulo: compOtimista.titulo,
          tipo: compOtimista.tipo,
          data_hora: compOtimista.data_hora,
          responsavel_id: compOtimista.responsavel_id,
          responsavel_nome: respNome,
          usuario_autor_id: usuarioId,
          usuario_autor_nome: usuarioNome,
        }),
      })

      if (res.ok) {
        await carregarCompromissos()
        await carregarAtividades()
        onAtualizarLead()
      }
    } catch (err) {
      console.error('Erro ao salvar compromisso:', err)
    } finally {
      setSalvandoCompromisso(false)
    }
  }

  async function handleToggleCompromisso(comp: CompromissoLead) {
    const novoStatus = !comp.concluido
    setCompromissos((prev) =>
      prev.map((c) => (c.id === comp.id ? { ...c, concluido: novoStatus } : c))
    )

    try {
      await fetch('/api/painel/leads/compromissos', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          compromisso_id: comp.id,
          lead_id: lead.id,
          concluido: novoStatus,
        }),
      })
    } catch (err) {
      console.error('Erro ao atualizar compromisso:', err)
    }
  }

  async function handleExcluirCompromisso(compromissoId: string) {
    setCompromissos((prev) => prev.filter((c) => c.id !== compromissoId))
    try {
      await fetch(`/api/painel/leads/compromissos?compromisso_id=${compromissoId}`, {
        method: 'DELETE',
      })
    } catch (err) {
      console.error('Erro ao excluir compromisso:', err)
    }
  }

  // Disparo de Lembrete no WhatsApp
  function handleDispararLembreteWhats(comp: CompromissoLead) {
    const dataFmt = new Date(comp.data_hora).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })

    const tipoNomes: Record<string, string> = {
      visita: '🏠 Visita Presencial',
      ligacao: '📞 Ligação / Follow-up',
      proposta: '📄 Envio de Proposta/Contrato',
      reuniao: '🤝 Reunião de Fechamento',
      outro: '⏰ Lembrete de Negociação',
    }

    const msgTexto = `🚨 *Lembrete de Compromisso - Fixum* 🚨\n\n📌 *Compromisso:* ${comp.titulo}\n🏷️ *Tipo:* ${tipoNomes[comp.tipo] || comp.tipo}\n⏰ *Data/Horário:* ${dataFmt}\n👤 *Cliente:* ${lead.nome}${lead.telefone ? ` (${lead.telefone})` : ''}\n🏢 *Imóvel:* ${lead.imovel?.titulo || 'Portfólio'}\n👔 *Responsável:* ${comp.responsavel_nome || 'Equipe'}\n\n_Não se esqueça de realizar o atendimento!_`

    const telDestino = lead.telefone ? lead.telefone.replace(/\D/g, '') : ''
    window.open(`https://wa.me/55${telDestino}?text=${encodeURIComponent(msgTexto)}`, '_blank')
  }

  // ── GESTÃO DE ANEXOS ──
  async function handleUploadArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      setEnviandoAnexo(true)
      const formData = new FormData()
      formData.append('arquivo', file)
      formData.append('lead_id', lead.id)
      formData.append('usuario_id', usuarioId)
      formData.append('usuario_nome', usuarioNome)

      const res = await fetch('/api/painel/leads/anexos', {
        method: 'POST',
        body: formData,
      })

      if (res.ok) {
        await carregarAnexos()
        await carregarAtividades()
      }
    } catch (err) {
      console.error('Erro ao enviar anexo:', err)
    } finally {
      setEnviandoAnexo(false)
      if (inputFileRef.current) inputFileRef.current.value = ''
    }
  }

  async function handleExcluirAnexo(anexoId: string) {
    setAnexos((prev) => prev.filter((a) => a.id !== anexoId))
    try {
      await fetch(`/api/painel/leads/anexos?anexo_id=${anexoId}`, {
        method: 'DELETE',
      })
    } catch (err) {
      console.error('Erro ao excluir anexo:', err)
    }
  }

  // Helpers
  const horasCriacao = Math.floor((Date.now() - new Date(lead.created_at).getTime()) / (1000 * 60 * 60))
  const fezContato = !!lead.data_primeiro_contato

  return (
    <div className={styles.overlay} onClick={onFechar}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* ═══════════════════════════════════════════════════════════════
            1. CABEÇALHO FIXO
            ═══════════════════════════════════════════════════════════════ */}
        <div className={styles.cabecalho}>
          <div className={styles.tituloBloco}>
            <div className={styles.avatarLead}>{lead.nome.charAt(0).toUpperCase()}</div>
            <div>
              <div className={styles.linhaNome}>
                <h2 className={styles.nomeLead}>{lead.nome}</h2>
                <span className={`${styles.badgeTemperatura} ${styles[`temp_${lead.temperatura || 'morno'}`]}`}>
                  {lead.temperatura === 'quente' ? '🔥 Quente' : lead.temperatura === 'frio' ? '❄️ Frio' : '☕ Morno'}
                </span>
                <span className={styles.badgeEtapa}>
                  Etapa: <strong>{lead.status.replace(/_/g, ' ')}</strong>
                </span>
              </div>
              <span className={styles.dataLead}>
                Criado em {new Date(lead.created_at).toLocaleString('pt-BR')}
              </span>
            </div>
          </div>

          <button type="button" className={styles.btnFechar} onClick={onFechar} title="Fechar">
            ✕
          </button>
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            2. BARRA DE ABAS FIXA
            ═══════════════════════════════════════════════════════════════ */}
        <div className={styles.navAbas}>
          <button
            type="button"
            className={`${styles.tabBtn} ${abaAtiva === 'geral' ? styles.tabBtnAtivo : ''}`}
            onClick={() => setAbaAtiva('geral')}
          >
            <span>📋</span> Visão Geral & Imóvel
          </button>

          <button
            type="button"
            className={`${styles.tabBtn} ${abaAtiva === 'timeline' ? styles.tabBtnAtivo : ''}`}
            onClick={() => setAbaAtiva('timeline')}
          >
            <span>📝</span> Linha do Tempo ({atividades.length})
          </button>

          <button
            type="button"
            className={`${styles.tabBtn} ${abaAtiva === 'agenda' ? styles.tabBtnAtivo : ''}`}
            onClick={() => setAbaAtiva('agenda')}
          >
            <span>📅</span> Agenda & Lembretes ({compromissos.filter((c) => !c.concluido).length})
          </button>

          <button
            type="button"
            className={`${styles.tabBtn} ${abaAtiva === 'anexos' ? styles.tabBtnAtivo : ''}`}
            onClick={() => setAbaAtiva('anexos')}
          >
            <span>📎</span> Documentos & Anexos ({anexos.length})
          </button>
        </div>

        {/* ── BANNER DE LEAD ARQUIVADO ── */}
        {(lead.arquivado || lead.status === 'arquivado') && (
          <div className={styles.bannerArquivado}>
            <div className={styles.bannerArquivadoInfo}>
              <span className={styles.iconeBannerArquivado}>📁</span>
              <div>
                <strong>Este Lead Está Arquivado</strong>
                <p>
                  O lead está fora do funil ativo de atendimento diário, mas todos os históricos,
                  atividades e documentos estão 100% preservados.
                </p>
              </div>
            </div>
            <button
              type="button"
              className={styles.btnDesarquivarBanner}
              disabled={processandoAcao}
              onClick={() =>
                handleAtualizarCampo({
                  arquivado: false,
                  status: lead.status === 'arquivado' ? 'novo' : lead.status,
                  mensagem_atividade: `📂 Lead DESARQUIVADO por ${usuarioNome} e retornado ao funil ativo.`,
                })
              }
            >
              📂 Desarquivar Lead
            </button>
          </div>
        )}

        {/* ── BANNER DE HOMOLOGAÇÃO DE VENDA (QUANDO FECHADO) ── */}
        {lead.status === 'fechado' && (
          lead.status_homologacao === 'pendente' ? (
            <div className={styles.bannerHomologacaoPendente}>
              <div className={styles.bannerHomologacaoInfo}>
                <span className={styles.iconeBannerHomologacao}>⏳</span>
                <div>
                  <strong>Fechamento de Negócio Aguardando Homologação do Gestor</strong>
                  <p>
                    {lead.corretor_nome ? `O corretor ${lead.corretor_nome}` : 'Um corretor da equipe'} marcou este lead como venda fechada.
                    {isGestor || isImobiliaria
                      ? ' Como gestor, confirme a validação da venda para oficializar o VGV e comissão no ranking.'
                      : ' O gestor da imobiliária precisa homologar esta venda para ela ser computada no ranking oficial.'}
                  </p>
                </div>
              </div>
              {(isGestor || isImobiliaria) && (
                <div className={styles.bannerHomologacaoAcoes}>
                  <button
                    type="button"
                    className={styles.btnAprovarHomologacao}
                    disabled={processandoAcao}
                    onClick={() =>
                      handleAtualizarCampo({
                        status_homologacao: 'aprovado',
                        homologado_por_id: usuarioId,
                        homologado_por_nome: usuarioNome,
                        data_homologacao: new Date().toISOString(),
                        mensagem_atividade: `🏆 Venda homologada e aprovada pelo Gestor ${usuarioNome}.`,
                      })
                    }
                  >
                    ✓ Homologar Venda
                  </button>
                  <button
                    type="button"
                    className={styles.btnRecusarHomologacao}
                    disabled={processandoAcao}
                    onClick={() =>
                      handleAtualizarCampo({
                        status: 'proposta',
                        status_homologacao: 'rejeitado',
                        motivo_rejeicao_homologacao: 'Retornado para negociação pelo gestor',
                        mensagem_atividade: `⚠️ Homologação de venda recusada pelo Gestor ${usuarioNome}. Lead retornado para a etapa de Proposta.`,
                      })
                    }
                  >
                    ✕ Recusar / Voltar
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className={styles.bannerHomologacaoAprovada}>
              <span>🏆 Venda homologada e confirmada por {lead.homologado_por_nome || 'Gestor'} em {lead.data_homologacao ? new Date(lead.data_homologacao).toLocaleDateString('pt-BR') : 'data recente'}.</span>
            </div>
          )
        )}

        {/* ═══════════════════════════════════════════════════════════════
            3. CONTEÚDO PRINCIPAL (COMPACTO E SEM SCROLL EXCESSIVO)
            ═══════════════════════════════════════════════════════════════ */}
        <div className={styles.conteudoAba}>
          {/* ── ABA 1: VISÃO GERAL & IMÓVEL ── */}
          {abaAtiva === 'geral' && (
            <div className={styles.gridGeralCompacto}>
              {/* Coluna Esquerda: Alerta e Contato */}
              <div className={styles.colunaGeralEsquerda}>
                {/* Alerta de 1º Contato */}
                <div
                  className={`${styles.alertaContato} ${
                    fezContato
                      ? styles.contatoOk
                      : horasCriacao >= 24
                      ? styles.contatoCritico
                      : horasCriacao >= 2
                      ? styles.contatoAlerta
                      : styles.contatoPendente
                  }`}
                >
                  <div className={styles.alertaIcone}>{fezContato ? '✅' : horasCriacao >= 24 ? '🚨' : '⏳'}</div>
                  <div className={styles.alertaTextos}>
                    <strong>{fezContato ? 'Primeiro Contato Realizado' : 'Primeiro Contato Pendente'}</strong>
                    <p>
                      {fezContato
                        ? `Atendido em ${new Date(lead.data_primeiro_contato!).toLocaleString('pt-BR')}`
                        : `Lead aguardando resposta há ${horasCriacao === 0 ? 'menos de 1 hora' : `${horasCriacao} horas`}.`}
                    </p>
                  </div>
                </div>

                {/* Dados de Contato do Prospect */}
                <div className={styles.cardDadosCompacto}>
                  <h3 className={styles.subtituloCard}>👤 Dados do Prospect / Interessado</h3>
                  <div className={styles.gridContato}>
                    <div className={styles.itemContato}>
                      <span className={styles.labelContato}>WhatsApp / Telefone:</span>
                      <span className={styles.valorContato}>{formatarTelefone(lead.telefone) || 'Não informado'}</span>
                    </div>
                    <div className={styles.itemContato}>
                      <span className={styles.labelContato}>E-mail:</span>
                      <span className={styles.valorContato}>{lead.email || 'Não informado'}</span>
                    </div>
                    <div className={styles.itemContato}>
                      <span className={styles.labelContato}>Origem:</span>
                      <span className={styles.valorContato}>🌐 Portal Fixum</span>
                    </div>
                    <div className={styles.itemContato}>
                      <span className={styles.labelContato}>Responsável:</span>
                      {(isGestor || isImobiliaria) && listaCorretores.length > 0 ? (
                        <select
                          className={styles.selectCorretor}
                          value={lead.corretor_id || ''}
                          onChange={(e) => handleReatribuirCorretor(e.target.value)}
                          disabled={processandoAcao}
                        >
                          <option value="">⚡ Sem Corretor (Fila de Triagem)</option>
                          {listaCorretores.map((c) => (
                            <option key={c.id} value={c.id}>
                              👔 {c.nome}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className={styles.valorContato}>👔 {lead.corretor_nome || 'Sem Corretor (Triagem)'}</span>
                      )}
                    </div>
                  </div>

                  {lead.mensagem && (
                    <div className={styles.caixaMensagem}>
                      <span className={styles.labelMensagem}>Mensagem do cliente:</span>
                      <p className={styles.textoMensagem}>"{lead.mensagem}"</p>
                    </div>
                  )}

                  {/* Destaque de Proposta Ativa */}
                  {lead.valor_proposta && (
                    <div className={styles.destaquePropostaGeral}>
                      <div className={styles.destaquePropostaIcone}>💰</div>
                      <div className={styles.destaquePropostaTextos}>
                        <span className={styles.destaquePropostaLabel}>Proposta Registrada:</span>
                        <strong className={styles.destaquePropostaValor}>{formatarPreco(lead.valor_proposta)}</strong>
                      </div>
                    </div>
                  )}

                  {/* Destaque de Visita Agendada */}
                  {lead.data_visita && (
                    <div className={styles.destaqueVisitaGeral}>
                      <div className={styles.destaqueVisitaIcone}>📅</div>
                      <div className={styles.destaqueVisitaTextos}>
                        <span className={styles.destaqueVisitaLabel}>Visita Agendada:</span>
                        <strong className={styles.destaqueVisitaValor}>
                          {new Date(lead.data_visita).toLocaleString('pt-BR', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </strong>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Coluna Direita: Imóvel de Interesse */}
              <div className={styles.colunaGeralDireita}>
                {lead.imovel ? (
                  <div className={styles.cardImovelCompacto}>
                    <h3 className={styles.subtituloCard}>🏢 Imóvel de Interesse</h3>
                    <div className={styles.imovelWrapperCompacto}>
                      {lead.imovel.fotos && lead.imovel.fotos[0] && (
                        <div className={styles.imovelThumbWrapper}>
                          <img
                            src={lead.imovel.fotos[0].url}
                            alt={lead.imovel.titulo}
                            className={styles.imovelThumb}
                          />
                        </div>
                      )}
                      <div className={styles.imovelInfoCompacto}>
                        <strong className={styles.imovelTituloCompacto}>{lead.imovel.titulo}</strong>
                        <span className={styles.imovelLocalCompacto}>
                          📍 {lead.imovel.bairro ? `${lead.imovel.bairro}, ` : ''}{lead.imovel.cidade}
                        </span>
                        <div className={styles.imovelPrecoCompacto}>
                          {formatarPreco(lead.imovel.preco || 0)}
                          {lead.imovel.negociacao === 'aluguel' ? '/mês' : ''}
                        </div>
                        {lead.imovel.codigo && (
                          <span className={styles.imovelCodigoBadge}>Cód: {lead.imovel.codigo}</span>
                        )}
                        <Link
                          href={`/imovel/${lead.imovel.id}`}
                          target="_blank"
                          className={styles.linkImovelDestaque}
                        >
                          Ver Anúncio Completo ↗
                        </Link>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className={styles.cardImovelVazio}>
                    <span>🏢</span>
                    <p>Lead de interesse geral no catálogo.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── ABA 2: LINHA DO TEMPO & ANOTAÇÕES ── */}
          {abaAtiva === 'timeline' && (
            <div className={styles.secaoTimeline}>
              {/* Form de Nova Anotação */}
              <form onSubmit={handleAdicionarAnotacao} className={styles.formAnotacao}>
                <textarea
                  className={styles.textareaAnotacao}
                  placeholder="Escreva uma anotação interna ou recado para a equipe sobre este lead..."
                  rows={2}
                  value={novaAnotacao}
                  onChange={(e) => setNovaAnotacao(e.target.value)}
                />
                <div className={styles.linhaBotaoAnotacao}>
                  <button
                    type="submit"
                    className={styles.btnSalvarAnotacao}
                    disabled={!novaAnotacao.trim() || salvandoAnotacao}
                  >
                    {salvandoAnotacao ? 'Salvando...' : 'Adicionar Anotação'}
                  </button>
                </div>
              </form>

              {/* Lista de Atividades */}
              <div className={styles.listaAtividades}>
                {carregandoAtividades ? (
                  <div className={styles.carregandoTimeline}>Carregando histórico...</div>
                ) : atividades.length === 0 ? (
                  <div className={styles.vazioTimeline}>
                    <span>💬</span>
                    <p>Nenhuma interação registrada ainda. Use o campo acima para adicionar anotações internas.</p>
                  </div>
                ) : (
                  atividades.map((atv) => {
                    const icones: Record<string, string> = {
                      criacao: '📥',
                      contato_whatsapp: '💬',
                      mudanca_status: '🔄',
                      anotacao: '📝',
                      visita_agendada: '📅',
                      proposta: '💰',
                      reatribuicao: '👔',
                    }
                    return (
                      <div key={atv.id} className={styles.itemAtividade}>
                        <div className={styles.iconeAtividade}>
                          {icones[atv.tipo] || '📌'}
                        </div>
                        <div className={styles.conteudoAtividade}>
                          <div className={styles.cabecalhoAtividade}>
                            <strong className={styles.autorAtividade}>{atv.autor_nome}</strong>
                            <span className={styles.dataAtividade}>
                              {new Date(atv.created_at).toLocaleString('pt-BR', {
                                day: '2-digit',
                                month: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                          <p className={styles.descricaoAtividade}>{atv.descricao}</p>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          )}

          {/* ── ABA 3: AGENDA & LEMBRETES WHATSAPP ── */}
          {abaAtiva === 'agenda' && (
            <div className={styles.secaoAgenda}>
              {/* Form de Novo Compromisso */}
              <form onSubmit={handleCriarCompromisso} className={styles.formCompromisso}>
                <h3 className={styles.subtituloCard}>📅 Agendar Novo Compromisso / Tarefa</h3>
                <div className={styles.gridFormCompromisso}>
                  <div className={styles.campoFormComp}>
                    <label className={styles.labelFormAcao}>Título do Compromisso:</label>
                    <input
                      type="text"
                      placeholder="Ex: Visita no imóvel com casal de compradores"
                      className={styles.inputFormAcao}
                      value={novoCompTitulo}
                      onChange={(e) => setNovoCompTitulo(e.target.value)}
                      required
                    />
                  </div>

                  <div className={styles.campoFormComp}>
                    <label className={styles.labelFormAcao}>Tipo de Tarefa:</label>
                    <select
                      className={styles.inputFormAcao}
                      value={novoCompTipo}
                      onChange={(e) => setNovoCompTipo(e.target.value as any)}
                    >
                      <option value="visita">🏠 Visita Presencial</option>
                      <option value="ligacao">📞 Ligação / Follow-up</option>
                      <option value="proposta">📄 Envio de Proposta/Contrato</option>
                      <option value="reuniao">🤝 Reunião de Fechamento</option>
                      <option value="outro">⏰ Outro Lembrete</option>
                    </select>
                  </div>

                  <div className={styles.campoFormComp}>
                    <label className={styles.labelFormAcao}>Data e Horário:</label>
                    <input
                      type="datetime-local"
                      className={styles.inputFormAcao}
                      value={novoCompDataHora}
                      onChange={(e) => setNovoCompDataHora(e.target.value)}
                      required
                    />
                  </div>

                  {(isGestor || isImobiliaria) && listaCorretores.length > 0 && (
                    <div className={styles.campoFormComp}>
                      <label className={styles.labelFormAcao}>Responsável:</label>
                      <select
                        className={styles.inputFormAcao}
                        value={novoCompRespId}
                        onChange={(e) => setNovoCompRespId(e.target.value)}
                      >
                        {listaCorretores.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.nome}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <div className={styles.linhaBotaoAnotacao}>
                  <button
                    type="submit"
                    className={styles.btnSalvarAcao}
                    disabled={!novoCompTitulo.trim() || !novoCompDataHora || salvandoCompromisso}
                  >
                    {salvandoCompromisso ? 'Agendando...' : '+ Adicionar na Agenda'}
                  </button>
                </div>
              </form>

              {/* Lista de Compromissos */}
              <div className={styles.listaCompromissos}>
                <h3 className={styles.subtituloCard}>
                  Compromissos Agendados ({compromissos.length})
                </h3>

                {carregandoCompromissos ? (
                  <div className={styles.carregandoTimeline}>Carregando agenda...</div>
                ) : compromissos.length === 0 ? (
                  <div className={styles.vazioTimeline}>
                    <span>📅</span>
                    <p>Nenhum compromisso marcado para este lead ainda.</p>
                  </div>
                ) : (
                  compromissos.map((comp) => {
                    const dataComp = new Date(comp.data_hora)
                    const atrasado = !comp.concluido && dataComp.getTime() < Date.now()

                    return (
                      <div
                        key={comp.id}
                        className={`${styles.itemCompromisso} ${comp.concluido ? styles.compConcluido : atrasado ? styles.compAtrasado : ''}`}
                      >
                        <div className={styles.compEsquerda}>
                          <input
                            type="checkbox"
                            checked={comp.concluido}
                            onChange={() => handleToggleCompromisso(comp)}
                            className={styles.checkboxComp}
                            title="Marcar como concluído"
                          />
                          <div className={styles.compTextos}>
                            <strong className={`${styles.compTitulo} ${comp.concluido ? styles.tituloRiscado : ''}`}>
                              {comp.titulo}
                            </strong>
                            <div className={styles.compMeta}>
                              <span>
                                ⏰ {dataComp.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                              </span>
                              {comp.responsavel_nome && <span>👔 {comp.responsavel_nome}</span>}
                              {atrasado && <span className={styles.badgeAtrasado}>🚨 Atrasado</span>}
                            </div>
                          </div>
                        </div>

                        <div className={styles.compDireita}>
                          <button
                            type="button"
                            className={styles.btnLembrarWhats}
                            onClick={() => handleDispararLembreteWhats(comp)}
                            title="Enviar lembrete formatado no WhatsApp"
                          >
                            💬 Lembrar no WhatsApp
                          </button>
                          <button
                            type="button"
                            className={styles.btnExcluirComp}
                            onClick={() => handleExcluirCompromisso(comp.id)}
                            title="Excluir compromisso"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          )}

          {/* ── ABA 4: DOCUMENTOS & ANEXOS ── */}
          {abaAtiva === 'anexos' && (
            <div className={styles.secaoAnexos}>
              <div className={styles.topoUploadAnexo}>
                <div className={styles.infoUpload}>
                  <h3 className={styles.subtituloCard}>📎 Documentos da Negociação</h3>
                  <p className={styles.textoUpload}>
                    Anexe documentos, certidões, comprovantes e minutas de contrato.
                  </p>
                </div>

                <div>
                  <input
                    ref={inputFileRef}
                    type="file"
                    style={{ display: 'none' }}
                    onChange={handleUploadArquivo}
                  />
                  <button
                    type="button"
                    className={styles.btnUploadAnexo}
                    onClick={() => inputFileRef.current?.click()}
                    disabled={enviandoAnexo}
                  >
                    <span>📁</span> {enviandoAnexo ? 'Enviando Arquivo...' : 'Anexar Documento / Foto'}
                  </button>
                </div>
              </div>

              {/* Grid de Anexos */}
              <div className={styles.gridAnexos}>
                {carregandoAnexos ? (
                  <div className={styles.carregandoTimeline}>Carregando anexos...</div>
                ) : anexos.length === 0 ? (
                  <div className={styles.vazioAnexos}>
                    <span>📁</span>
                    <h4>Nenhum documento anexado</h4>
                    <p>Clique no botão acima para adicionar arquivos PDF, fotos ou documentos.</p>
                  </div>
                ) : (
                  anexos.map((anexo) => {
                    const isImagem = anexo.tipo_arquivo === 'imagem'
                    const isPdf = anexo.tipo_arquivo === 'pdf'

                    return (
                      <div key={anexo.id} className={styles.cardAnexoItem}>
                        <div className={styles.iconeAnexoWrapper}>
                          {isImagem ? '🖼️' : isPdf ? '📄' : '📝'}
                        </div>
                        <div className={styles.infoAnexoItem}>
                          <strong className={styles.nomeAnexoItem} title={anexo.nome_arquivo}>
                            {anexo.nome_arquivo}
                          </strong>
                          <span className={styles.metaAnexoItem}>
                            Por {anexo.autor_nome} em {new Date(anexo.created_at).toLocaleDateString('pt-BR')}
                          </span>
                        </div>
                        <div className={styles.acoesAnexoItem}>
                          <a
                            href={anexo.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            download={anexo.nome_arquivo}
                            className={styles.btnBaixarAnexo}
                            title="Abrir ou Baixar Arquivo"
                          >
                            Abrir ↗
                          </a>
                          <button
                            type="button"
                            className={styles.btnExcluirAnexo}
                            onClick={() => handleExcluirAnexo(anexo.id)}
                            title="Excluir Anexo"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            4. RODAPÉ FIXO DE AÇÕES RÁPIDAS (EXCLUSIVO DA ABA VISÃO GERAL)
            ═══════════════════════════════════════════════════════════════ */}
        {abaAtiva === 'geral' && (
          <div className={styles.rodapeFixoAcoes}>
            <div className={styles.botoesRodapeGrid}>
              {lead.telefone && (
                <button
                  type="button"
                  className={styles.btnWhatsFixo}
                  onClick={handleChamarWhatsApp}
                  title="Conversar com o cliente no WhatsApp"
                >
                  <span>💬</span> WhatsApp
                </button>
              )}

              <button
                type="button"
                className={styles.btnAcaoSecundarioFixo}
                onClick={() => setAbaAtiva('agenda')}
                title="Abrir a agenda de visitas"
              >
                <span>📅</span> Agendar Visita
              </button>

              <button
                type="button"
                className={styles.btnAcaoSecundarioFixo}
                onClick={() => setModalPropostaAberto(true)}
                title="Registrar proposta ofertada"
              >
                <span>💰</span> {lead.valor_proposta ? 'Atualizar Proposta' : 'Registrar Proposta'}
              </button>

              {lead.status !== 'fechado' && (
                <button
                  type="button"
                  className={styles.btnAcaoFechamentoFixo}
                  onClick={() => {
                    handleAtualizarCampo({
                      status: 'fechado',
                      status_homologacao: 'pendente',
                      mensagem_atividade: `🏆 Negócio marcado como FECHADO por ${usuarioNome}. Enviado para homologação do Gestor.`,
                    })
                  }}
                  title="Fechar venda e enviar para homologação"
                >
                  <span>🏆</span> Fechar Venda
                </button>
              )}

              {lead.status !== 'perdido' && (
                <button
                  type="button"
                  className={styles.btnAcaoPerdaFixo}
                  onClick={() => setModalPerdaAberto(true)}
                  title="Marcar oportunidade como perdida"
                >
                  <span>❌</span> Marcar Perdido
                </button>
              )}

              {lead.arquivado || lead.status === 'arquivado' ? (
                <button
                  type="button"
                  className={styles.btnAcaoDesarquivarFixo}
                  disabled={processandoAcao}
                  onClick={() => {
                    handleAtualizarCampo({
                      arquivado: false,
                      status: lead.status === 'arquivado' ? 'novo' : lead.status,
                      mensagem_atividade: `📂 Lead DESARQUIVADO por ${usuarioNome} e retornado ao funil ativo.`,
                    })
                  }}
                  title="Desarquivar lead e voltar para o funil ativo"
                >
                  <span>📂</span> Desarquivar Lead
                </button>
              ) : lead.status === 'perdido' ? (
                <button
                  type="button"
                  className={styles.btnAcaoSecundarioFixo}
                  disabled={processandoAcao}
                  onClick={() => {
                    handleAtualizarCampo({
                      status: 'novo',
                      arquivado: false,
                      motivo_perda: null,
                      mensagem_atividade: `🔄 Lead REATIVADO por ${usuarioNome} e retornado para Novos.`,
                    })
                  }}
                  title="Reativar oportunidade e voltar para o funil ativo"
                >
                  <span>🔄</span> Reativar Lead
                </button>
              ) : (
                <button
                  type="button"
                  className={styles.btnAcaoSecundarioFixo}
                  disabled={processandoAcao}
                  onClick={() => {
                    handleAtualizarCampo({
                      arquivado: true,
                      mensagem_atividade: `📁 Lead arquivado por ${usuarioNome}.`,
                    })
                  }}
                  title="Arquivar lead"
                >
                  <span>📁</span> Arquivar
                </button>
              )}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════
            MODAIS OVERLAY DE PROPOSTA E PERDA
            ═══════════════════════════════════════════════════════════════ */}
        {modalPropostaAberto && (
          <div className={styles.miniOverlayAcao}>
            <div className={styles.miniCardAcao}>
              <h3 className={styles.subtituloCard}>💰 Registrar Valor da Proposta</h3>
              <p className={styles.textoMiniAcao}>Informe o valor ofertado pelo cliente nesta negociação:</p>
              <input
                type="text"
                placeholder="Ex: 450.000"
                className={styles.inputFormAcao}
                value={valorPropostaInput}
                onChange={(e) => setValorPropostaInput(e.target.value)}
                autoFocus
              />
              <div className={styles.miniLinhaBotoes}>
                <button
                  type="button"
                  className={styles.btnCancelarMini}
                  onClick={() => setModalPropostaAberto(false)}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className={styles.btnSalvarAcao}
                  onClick={handleSalvarProposta}
                  disabled={!valorPropostaInput || processandoAcao}
                >
                  Salvar Proposta
                </button>
              </div>
            </div>
          </div>
        )}

        {modalPerdaAberto && (
          <div className={styles.miniOverlayAcao}>
            <div className={styles.miniCardAcao}>
              <h3 className={styles.subtituloCard}>❌ Marcar Oportunidade como Perdida</h3>
              <p className={styles.textoMiniAcao}>Selecione o motivo pelo qual a negociação não avançou:</p>
              <select
                className={styles.inputFormAcao}
                value={motivoPerdaInput}
                onChange={(e) => setMotivoPerdaInput(e.target.value)}
              >
                <option value="Sem resposta do cliente">Sem resposta do cliente</option>
                <option value="Preço fora do orçamento">Preço fora do orçamento</option>
                <option value="Comprou/Alugou outro imóvel">Comprou/Alugou outro imóvel</option>
                <option value="Localização inadequada">Localização inadequada</option>
                <option value="Desistiu da negociação">Desistiu da negociação</option>
                <option value="Outro motivo">Outro motivo</option>
              </select>
              <div className={styles.miniLinhaBotoes}>
                <button
                  type="button"
                  className={styles.btnCancelarMini}
                  onClick={() => setModalPerdaAberto(false)}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className={styles.btnSalvarAcaoPerda}
                  onClick={handleSalvarPerda}
                  disabled={processandoAcao}
                >
                  Confirmar Perda
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
