'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { type Imovel, type Lead, type Plano } from '@/lib/types'
import { formatarPreco, labelTipoImovel, fotoPrincipal, obterIniciaisUsuario, obterGradienteUsuario } from '@/lib/utils'
import { useConfirm } from '@/contexts/ModalConfirmacaoContext'
import ModalReatribuirCorretor from './ModalReatribuirCorretor'
import ModalRevisaoImovel from './ModalRevisaoImovel'
import ModalEditarImovel from './ModalEditarImovel'
import ModalChatModeracao from './ModalChatModeracao'
import MarcaDaguaTeste from '@/components/ui/MarcaDaguaTeste'
import styles from './AbaImoveis.module.css'

interface AbaImoveisProps {
  imoveis: Imovel[]
  leads: Lead[]
  usuarioId: string
  usuarioNome: string
  isImobiliaria: boolean
  isCorretor: boolean
  podeExcluir?: boolean
  imobiliariaDona: { id: string; nome: string } | null
  nomesAnunciantes: Record<string, string>
  listaCorretores: { id: string; nome: string }[]
  usoPlano: {
    plano: Plano
    imoveisAtivos: number
    imoveisPausados: number
    limiteMaximo: number
    porcentagemUso: number
    atingiuLimite: boolean
  }
  proximoPlano: Plano | null
  onAbrirModalNovo: () => void
  onDispararUpgrade: (plano?: Plano) => void
  onAlterarStatus: (id: string, novoStatus: string) => Promise<void>
  onExcluirImovel: (id: string, titulo: string) => Promise<void>
  onRecarregarDados: () => Promise<void>
  ultimoEventoChat?: any
}

type ModoVisualizacao = 'cards' | 'tabela'
type Ordenacao = 'recentes' | 'preco_menor' | 'preco_maior' | 'titulo' | 'leads'

export default function AbaImoveis({
  imoveis,
  leads,
  usuarioId,
  usuarioNome,
  isImobiliaria,
  isCorretor,
  podeExcluir = true,
  imobiliariaDona,
  nomesAnunciantes,
  listaCorretores,
  usoPlano,
  proximoPlano,
  onAbrirModalNovo,
  onDispararUpgrade,
  onAlterarStatus,
  onExcluirImovel,
  onRecarregarDados,
  ultimoEventoChat,
}: AbaImoveisProps) {
  // Estados de Filtros e Pesquisa (Multi-Select com Checkboxes)
  const [busca, setBusca] = useState('')

  const [filtroCorretores, setFiltroCorretores] = useState<string[]>([])
  const [popoverCorretorAberto, setPopoverCorretorAberto] = useState(false)
  const popoverCorretorRef = useRef<HTMLDivElement>(null)

  const [filtroStatus, setFiltroStatus] = useState<string[]>([])
  const [popoverStatusAberto, setPopoverStatusAberto] = useState(false)
  const popoverStatusRef = useRef<HTMLDivElement>(null)

  const [filtroNegociacoes, setFiltroNegociacoes] = useState<string[]>([])
  const [popoverNegociacaoAberto, setPopoverNegociacaoAberto] = useState(false)
  const popoverNegociacaoRef = useRef<HTMLDivElement>(null)

  const [ordenacao, setOrdenacao] = useState<Ordenacao>('recentes')
  const [modoVisualizacao, setModoVisualizacao] = useState<ModoVisualizacao>('cards')

  // Fechar popovers ao clicar fora
  useEffect(() => {
    function handleClickFora(e: MouseEvent) {
      const target = e.target as Node
      if (popoverCorretorRef.current && !popoverCorretorRef.current.contains(target)) {
        setPopoverCorretorAberto(false)
      }
      if (popoverStatusRef.current && !popoverStatusRef.current.contains(target)) {
        setPopoverStatusAberto(false)
      }
      if (popoverNegociacaoRef.current && !popoverNegociacaoRef.current.contains(target)) {
        setPopoverNegociacaoAberto(false)
      }
    }
    document.addEventListener('mousedown', handleClickFora)
    return () => {
      document.removeEventListener('mousedown', handleClickFora)
    }
  }, [])

  // Helpers de Correspondência Multi-Select
  function matchStatus(st: string, filtros: string[]) {
    if (filtros.length === 0) return true
    return filtros.some((f) => {
      if (f === 'em_analise') return st === 'em_analise' || st === 'rascunho'
      if (f === 'ativo') return st === 'ativo' || st === 'publicado'
      if (f === 'vendido') return st === 'vendido' || st === 'alugado'
      return st === f
    })
  }

  function matchNegociacao(neg: string, filtros: string[]) {
    if (filtros.length === 0) return true
    return filtros.includes(neg)
  }

  function matchCorretor(anuncianteId: string, filtros: string[]) {
    if (filtros.length === 0) return true
    return filtros.includes(anuncianteId)
  }

  // Estados de Seleção em Lote
  const [selecionados, setSelecionados] = useState<string[]>([])
  const [executandoLote, setExecutandoLote] = useState(false)
  const { confirmar, alertar } = useConfirm()

  // Estados do Modal de Reatribuição
  const [modalReatribuirAberto, setModalReatribuirAberto] = useState(false)
  const [imoveisParaReatribuir, setImoveisParaReatribuir] = useState<string[]>([])

  // Estados do Modal de Revisão / Moderação pelo Gestor
  const [imovelEmRevisao, setImovelEmRevisao] = useState<Imovel | null>(null)

  // Estados do Modal de Edição Sobreposto com Backdrop Blur
  const [imovelIdParaEditar, setImovelIdParaEditar] = useState<string | null>(null)

  // Estados do Modal de Chat de Moderação Estilo WhatsApp
  const [imovelChatAberto, setImovelChatAberto] = useState<Imovel | null>(null)
  const [mensagensNaoLidasPorImovel, setMensagensNaoLidasPorImovel] = useState<Record<string, number>>({})
  const supabase = createClient()

  // Carregar contagens de mensagens não lidas por imóvel
  async function carregarMensagensNaoLidas() {
    if (!imoveis || imoveis.length === 0) return
    const ids = imoveis.map((i) => i.id)
    try {
      const res = await fetch(`/api/painel/imoveis/revisar?imoveisIds=${ids.join(',')}`)
      const data = await res.json()
      if (data.mapa) {
        const mapaContagens: Record<string, number> = {}
        for (const imovelId of Object.keys(data.mapa)) {
          // Se o chat deste imóvel estiver aberto neste momento, já está sendo visualizado!
          if (imovelChatAberto && imovelChatAberto.id === imovelId) {
            if (typeof window !== 'undefined') {
              localStorage.setItem(`chat_leitura_${usuarioId}_${imovelId}`, new Date().toISOString())
            }
            continue
          }

          const msgs = data.mapa[imovelId] as Array<{ id: string; autor_id: string; created_at: string }>
          const keyStorage = `chat_leitura_${usuarioId}_${imovelId}`
          const ultimaLeitura = typeof window !== 'undefined' ? localStorage.getItem(keyStorage) : null

          const naoLidas = msgs.filter((m) => {
            if (m.autor_id === usuarioId) return false
            if (!ultimaLeitura) return true
            return new Date(m.created_at) > new Date(ultimaLeitura)
          }).length

          if (naoLidas > 0) {
            mapaContagens[imovelId] = naoLidas
          }
        }
        setMensagensNaoLidasPorImovel(mapaContagens)
      }
    } catch {}
  }

  useEffect(() => {
    carregarMensagensNaoLidas()
  }, [imoveis, usuarioId])

  // Polling de 5s para atualizar badges de mensagens não lidas
  useEffect(() => {
    if (!imoveis || imoveis.length === 0) return
    const intervalo = setInterval(() => {
      carregarMensagensNaoLidas()
    }, 5000)
    return () => clearInterval(intervalo)
  }, [imoveis, usuarioId, imovelChatAberto])

  // Reagir a eventos Realtime de chat propagados pelo page.tsx (canal painel-realtime-sync)
  useEffect(() => {
    if (!ultimoEventoChat) return
    const novo = ultimoEventoChat
    if (novo && novo.autor_id !== usuarioId && novo.imovel_id) {
      if (imovelChatAberto && imovelChatAberto.id === novo.imovel_id) {
        if (typeof window !== 'undefined') {
          localStorage.setItem(`chat_leitura_${usuarioId}_${novo.imovel_id}`, new Date().toISOString())
        }
        return
      }
      setMensagensNaoLidasPorImovel((prev) => ({
        ...prev,
        [novo.imovel_id]: (prev[novo.imovel_id] || 0) + 1,
      }))
    }
  }, [ultimoEventoChat, usuarioId, imovelChatAberto])

  function abrirChatImovel(imovel: Imovel) {
    if (typeof window !== 'undefined') {
      localStorage.setItem(`chat_leitura_${usuarioId}_${imovel.id}`, new Date().toISOString())
    }
    setMensagensNaoLidasPorImovel((prev) => {
      const clone = { ...prev }
      delete clone[imovel.id]
      return clone
    })
    setImovelChatAberto(imovel)
  }

  function fecharChatImovel() {
    if (imovelChatAberto && typeof window !== 'undefined') {
      localStorage.setItem(`chat_leitura_${usuarioId}_${imovelChatAberto.id}`, new Date().toISOString())
    }
    if (imovelChatAberto) {
      const fecharId = imovelChatAberto.id
      setMensagensNaoLidasPorImovel((prev) => {
        const clone = { ...prev }
        delete clone[fecharId]
        return clone
      })
    }
    setImovelChatAberto(null)
  }

  // Mapa de contagem de leads por imóvel
  const mapaLeadsPorImovel = useMemo(() => {
    const mapa: Record<string, number> = {}
    leads.forEach((l) => {
      if (l.imovel_id) {
        mapa[l.imovel_id] = (mapa[l.imovel_id] || 0) + 1
      }
    })
    return mapa
  }, [leads])

  // Contadores para os Cards de Resumo Gerais do Topo
  const statsGerais = useMemo(() => {
    const total = imoveis.length
    const ativos = imoveis.filter((i) => i.status === 'publicado' || i.status === 'ativo').length
    const emRevisao = imoveis.filter((i) => i.status === 'em_analise' || i.status === 'rascunho').length
    const pausados = imoveis.filter((i) => i.status === 'pausado').length
    const negociados = imoveis.filter((i) => i.status === 'vendido' || i.status === 'alugado').length
    const totalVenda = imoveis.filter((i) => i.negociacao === 'venda').length
    const totalAluguel = imoveis.filter((i) => i.negociacao === 'aluguel').length
    const totalLeads = leads.length
    return { total, ativos, emRevisao, pausados, negociados, totalVenda, totalAluguel, totalLeads }
  }, [imoveis, leads])

  // ── CONTAGENS FACETADAS EM CASCATA PARA OS 3 DROPDOWNS ──
  // 1. Contagens para o Select de Corretor
  const contagensCorretor = useMemo(() => {
    const base = imoveis.filter((i) => matchStatus(i.status, filtroStatus) && matchNegociacao(i.negociacao, filtroNegociacoes))
    const total = base.length
    const diretos = base.filter((i) => i.anunciante_id === usuarioId).length
    const porCorretor: Record<string, number> = {}
    for (const c of listaCorretores) {
      porCorretor[c.id] = base.filter((i) => i.anunciante_id === c.id).length
    }
    return { total, diretos, porCorretor }
  }, [imoveis, filtroStatus, filtroNegociacoes, usuarioId, listaCorretores])

  // 2. Contagens para o Select de Status
  const contagensStatus = useMemo(() => {
    const base = imoveis.filter((i) => matchCorretor(i.anunciante_id, filtroCorretores) && matchNegociacao(i.negociacao, filtroNegociacoes))
    const total = base.length
    const emRevisao = base.filter((i) => i.status === 'em_analise' || i.status === 'rascunho').length
    const ativos = base.filter((i) => i.status === 'ativo' || i.status === 'publicado').length
    const pausados = base.filter((i) => i.status === 'pausado').length
    const negociados = base.filter((i) => i.status === 'vendido' || i.status === 'alugado').length
    return { total, emRevisao, ativos, pausados, negociados }
  }, [imoveis, filtroCorretores, filtroNegociacoes])

  // 3. Contagens para o Select de Negociação
  const contagensNegociacao = useMemo(() => {
    const base = imoveis.filter((i) => matchCorretor(i.anunciante_id, filtroCorretores) && matchStatus(i.status, filtroStatus))
    const total = base.length
    const venda = base.filter((i) => i.negociacao === 'venda').length
    const aluguel = base.filter((i) => i.negociacao === 'aluguel').length
    return { total, venda, aluguel }
  }, [imoveis, filtroCorretores, filtroStatus])

  // Filtragem e Ordenação
  const imoveisFiltrados = useMemo(() => {
    return imoveis
      .filter((imovel) => {
        if (!matchCorretor(imovel.anunciante_id, filtroCorretores)) return false
        if (!matchStatus(imovel.status, filtroStatus)) return false
        if (!matchNegociacao(imovel.negociacao, filtroNegociacoes)) return false

        // Busca por texto
        if (busca.trim()) {
          const termo = busca.toLowerCase()
          const titulo = (imovel.titulo || '').toLowerCase()
          const bairro = (imovel.bairro || '').toLowerCase()
          const cidade = (imovel.cidade || '').toLowerCase()
          const tipo = (labelTipoImovel(imovel.tipo) || '').toLowerCase()
          const codigo = (imovel.codigo || '').toLowerCase()
          const idCurto = imovel.id.substring(0, 8).toLowerCase()

          if (!titulo.includes(termo) && !bairro.includes(termo) && !cidade.includes(termo) && !tipo.includes(termo) && !codigo.includes(termo) && !idCurto.includes(termo)) {
            return false
          }
        }

        return true
      })
      .sort((a, b) => {
        if (ordenacao === 'recentes') {
          return new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime()
        }
        if (ordenacao === 'preco_menor') {
          return (a.preco || 0) - (b.preco || 0)
        }
        if (ordenacao === 'preco_maior') {
          return (b.preco || 0) - (a.preco || 0)
        }
        if (ordenacao === 'titulo') {
          return (a.titulo || '').localeCompare(b.titulo || '')
        }
        if (ordenacao === 'leads') {
          const leadsA = mapaLeadsPorImovel[a.id] || 0
          const leadsB = mapaLeadsPorImovel[b.id] || 0
          return leadsB - leadsA
        }
        return 0
      })
  }, [imoveis, filtroCorretores, filtroStatus, filtroNegociacoes, busca, ordenacao, mapaLeadsPorImovel])

  // Seleção Múltipla
  const todosFiltradosSelecionados = imoveisFiltrados.length > 0 && imoveisFiltrados.every((i) => selecionados.includes(i.id))

  function handleToggleSelecionarTodos() {
    if (todosFiltradosSelecionados) {
      setSelecionados([])
    } else {
      setSelecionados(imoveisFiltrados.map((i) => i.id))
    }
  }

  function handleToggleItem(id: string) {
    setSelecionados((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    )
  }

  // Ações em Lote
  async function handleAcaoLote(acao: 'pausar' | 'ativar' | 'excluir') {
    if (selecionados.length === 0) return

    if (acao === 'ativar') {
      const vagasDisponiveis = Math.max(0, usoPlano.limiteMaximo - usoPlano.imoveisAtivos)
      if (selecionados.length > vagasDisponiveis && usoPlano.limiteMaximo < 99999) {
        await alertar({
          titulo: 'Limite do Plano Atingido',
          mensagem: `Você selecionou ${selecionados.length} imóveis, mas possui apenas ${vagasDisponiveis} vaga(s) disponível(is) no seu plano atual. Faça upgrade para ativar mais anúncios simultâneos.`,
          icone: '⚠️',
          tipo: 'aviso',
        })
        return
      }
    }

    if (acao === 'excluir') {
      if (!podeExcluir) {
        await alertar({
          titulo: 'Ação Não Permitida',
          mensagem: 'Apenas gestores da imobiliária têm permissão para excluir anúncios.',
          icone: '🔒',
          tipo: 'aviso',
        })
        return
      }

      const confirmou = await confirmar({
        titulo: 'Excluir Imóveis Selecionados?',
        mensagem: `Tem certeza que deseja excluir permanentemente os ${selecionados.length} imóveis selecionados? Esta ação não poderá ser desfeita.`,
        icone: '🗑️',
        textoBotaoConfirmar: `Sim, Excluir (${selecionados.length})`,
        tipo: 'perigo',
        destrutivo: true,
      })
      if (!confirmou) return
    }

    setExecutandoLote(true)
    try {
      const endpointAcao = acao === 'excluir' ? 'excluir_lote' : 'alterar_status'
      const novoStatus = acao === 'pausar' ? 'pausado' : acao === 'ativar' ? 'ativo' : undefined

      const res = await fetch('/api/painel/imoveis/acoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          acao: endpointAcao,
          imoveisIds: selecionados,
          novoStatus,
          usuarioId,
        }),
      })

      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erro na operação em lote.')

      setSelecionados([])
      await onRecarregarDados()
    } catch (err: any) {
      await alertar({
        titulo: 'Aviso',
        mensagem: err.message || 'Erro ao processar ação em lote.',
        tipo: 'perigo',
      })
    } finally {
      setExecutandoLote(false)
    }
  }

  function aplicarFiltroRapidoStatus(statusAlvo: 'todos' | 'em_analise' | 'ativo' | 'pausado' | 'vendido') {
    if (statusAlvo === 'todos') {
      setFiltroStatus([])
    } else {
      setFiltroStatus([statusAlvo])
    }
    // Zera os filtros secundários e a pesquisa para garantir uma visão direta e limpa
    setFiltroCorretores([])
    setFiltroNegociacoes([])
    setBusca('')
  }

  function abrirModalReatribuir(imoveisIds: string[]) {
    setImoveisParaReatribuir(imoveisIds)
    setModalReatribuirAberto(true)
  }

  async function copiarLinkImovel(id: string) {
    const url = `${window.location.origin}/imovel/${id}`
    navigator.clipboard.writeText(url)
    await alertar({
      titulo: 'Link Copiado!',
      mensagem: 'O link do imóvel foi copiado para a sua área de transferência.',
      icone: '📋',
      tipo: 'sucesso',
    })
  }

function IconeWhatsApp({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'inline-block', verticalAlign: 'middle' }}
    >
      <path d="M12.031 2c-5.508 0-9.984 4.477-9.984 9.984 0 1.761.458 3.479 1.328 4.996L2 22l5.166-1.355a9.945 9.945 0 004.865 1.258h.004c5.508 0 9.984-4.477 9.984-9.984 0-2.668-1.039-5.176-2.926-7.063A9.927 9.927 0 0012.031 2zm0 18.293h-.003a8.272 8.272 0 01-4.221-1.151l-.303-.18-3.136.822.837-3.056-.197-.314a8.27 8.27 0 01-1.268-4.43c0-4.57 3.719-8.289 8.292-8.289 2.215 0 4.297.863 5.863 2.43 1.566 1.566 2.428 3.649 2.428 5.864 0 4.571-3.719 8.29-8.291 8.29zm4.542-6.205c-.249-.125-1.472-.726-1.7-.809-.228-.083-.394-.125-.56.125-.166.249-.643.809-.788.975-.145.166-.29.187-.539.062-.249-.125-1.052-.388-2.003-1.236-.74-.66-1.24-1.476-1.385-1.725-.145-.249-.015-.384.11-.508.112-.111.249-.29.373-.435.125-.145.166-.249.249-.415.083-.166.042-.311-.021-.435-.062-.125-.56-1.349-.768-1.847-.202-.486-.407-.42-.56-.428l-.477-.008c-.166 0-.435.062-.663.311-.228.249-.871.851-.871 2.075 0 1.224.892 2.407 1.016 2.573.125.166 1.756 2.681 4.254 3.759.594.257 1.059.41 1.421.525.598.19 1.142.163 1.572.099.479-.071 1.472-.602 1.68-1.183.208-.581.208-1.079.145-1.183-.062-.104-.228-.166-.477-.291z" />
    </svg>
  )
}

  function compartilharWhatsApp(imovel: Imovel) {
    const url = `${window.location.origin}/imovel/${imovel.id}`
    const refTexto = imovel.codigo ? `\nRef: ${imovel.codigo}` : ''
    const texto = encodeURIComponent(
      `*FIXUM Imóveis*\n\n*${imovel.titulo}*${refTexto}\n${imovel.cidade}${imovel.bairro ? ` - ${imovel.bairro}` : ''}\n${formatarPreco(imovel.preco, imovel.negociacao)}\n\nConfira as fotos e detalhes no FIXUM:\n${url}`
    )
    window.open(`https://wa.me/?text=${texto}`, '_blank')
  }

  return (
    <div className={styles.container}>
      {/* ── CABEÇALHO & BOTÕES DE AÇÃO ── */}
      <div className={styles.cabecalho}>
        <div className={styles.cabecalhoSuperior}>
          <div>
            <h1 className={styles.tituloSecao}>Gestão de Imóveis</h1>
            <p className={styles.subtituloSecao}>
              {isCorretor
                ? 'Gerencie seus anúncios submetidos e acompanhe o status de revisão da gestão'
                : isImobiliaria
                  ? `Central de moderação e portfólio • ${usoPlano.imoveisAtivos} de ${usoPlano.limiteMaximo >= 99999 ? '∞' : usoPlano.limiteMaximo} vagas ativas em uso`
                  : 'Gerencie seu portfólio e anúncios no Fixum'}
            </p>
          </div>

          <div className={styles.botoesTopo}>
            <button
              type="button"
              onClick={onAbrirModalNovo}
              className="btn btn-primario btn-md"
              style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <span>+</span> Cadastrar Novo Imóvel
            </button>
          </div>
        </div>

        {/* ── CARDS DE RESUMO DE MÉTRICAS (COM FILTROS CLICÁVEIS) ── */}
        <div className={styles.gridMetricas}>
          <div
            className={styles.cardMetrica}
            onClick={() => aplicarFiltroRapidoStatus('todos')}
            style={{ cursor: 'pointer', borderColor: filtroStatus.length === 0 ? '#2563eb' : undefined }}
            title="Clique para ver todos os imóveis"
          >
            <div className={styles.iconeMetrica} style={{ background: '#eff6ff', color: '#1d4ed8' }}>
              🏢
            </div>
            <div className={styles.infoMetrica}>
              <span className={styles.valorMetrica}>{statsGerais.total}</span>
              <span className={styles.labelMetrica}>Total no Portfólio</span>
            </div>
          </div>

          {/* Card de Imóveis em Revisão / Pendentes para o Gestor */}
          {statsGerais.emRevisao > 0 && (
            <div
              className={styles.cardMetrica}
              onClick={() => aplicarFiltroRapidoStatus('em_analise')}
              style={{
                cursor: 'pointer',
                background: filtroStatus.includes('em_analise') ? '#fffbeb' : '#ffffff',
                borderColor: '#f59e0b',
                borderWidth: '2px',
              }}
              title="Clique para filtrar apenas imóveis em revisão"
            >
              <div className={styles.iconeMetrica} style={{ background: '#fef3c7', color: '#b45309' }}>
                ⏳
              </div>
              <div className={styles.infoMetrica}>
                <span className={styles.valorMetrica} style={{ color: '#b45309' }}>{statsGerais.emRevisao}</span>
                <span className={styles.labelMetrica} style={{ fontWeight: 700, color: '#b45309' }}>
                  Em Revisão
                </span>
              </div>
            </div>
          )}

          <div
            className={styles.cardMetrica}
            onClick={() => aplicarFiltroRapidoStatus('ativo')}
            style={{ cursor: 'pointer', borderColor: filtroStatus.includes('ativo') ? '#059669' : undefined }}
            title="Clique para filtrar imóveis ativos"
          >
            <div className={styles.iconeMetrica} style={{ background: '#ecfdf5', color: '#059669' }}>
              🟢
            </div>
            <div className={styles.infoMetrica}>
              <span className={styles.valorMetrica}>{statsGerais.ativos}</span>
              <span className={styles.labelMetrica}>Ativos no Mapa</span>
            </div>
          </div>

          <div
            className={styles.cardMetrica}
            onClick={() => aplicarFiltroRapidoStatus('pausado')}
            style={{ cursor: 'pointer', borderColor: filtroStatus.includes('pausado') ? '#d97706' : undefined }}
            title="Clique para filtrar imóveis pausados"
          >
            <div className={styles.iconeMetrica} style={{ background: '#fffbeb', color: '#d97706' }}>
              ⏸️
            </div>
            <div className={styles.infoMetrica}>
              <span className={styles.valorMetrica}>{statsGerais.pausados}</span>
              <span className={styles.labelMetrica}>Pausados</span>
            </div>
          </div>

          <div
            className={styles.cardMetrica}
            onClick={() => aplicarFiltroRapidoStatus('vendido')}
            style={{ cursor: 'pointer', borderColor: filtroStatus.includes('vendido') ? '#7c3aed' : undefined }}
            title="Clique para filtrar negociados"
          >
            <div className={styles.iconeMetrica} style={{ background: '#f5f3ff', color: '#7c3aed' }}>
              🏷️
            </div>
            <div className={styles.infoMetrica}>
              <span className={styles.valorMetrica}>{statsGerais.negociados}</span>
              <span className={styles.labelMetrica}>Negociados</span>
            </div>
          </div>

          <div className={styles.cardMetrica}>
            <div className={styles.iconeMetrica} style={{ background: '#fef2f2', color: '#dc2626' }}>
              👥
            </div>
            <div className={styles.infoMetrica}>
              <span className={styles.valorMetrica}>{statsGerais.totalLeads}</span>
              <span className={styles.labelMetrica}>Leads Recebidos</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── BANNER DE ALERTA DE IMÓVEIS AGUARDANDO REVISÃO PARA GESTORES ── */}
      {isImobiliaria && statsGerais.emRevisao > 0 && !filtroStatus.includes('em_analise') && (
        <div style={{
          background: 'linear-gradient(90deg, #fffbeb 0%, #fef3c7 100%)',
          border: '1.5px solid #fde68a',
          borderRadius: '0.875rem',
          padding: '0.875rem 1.25rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          flexWrap: 'wrap'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '1.35rem' }}>⏳</span>
            <div>
              <strong style={{ color: '#92400e', fontSize: '0.9rem' }}>
                Existem {statsGerais.emRevisao} anúncio(s) cadastrado(s) pela equipe aguardando sua revisão e aprovação.
              </strong>
              <div style={{ color: '#b45309', fontSize: '0.8rem' }}>
                Avalie as fotos e informações para publicar diretamente no mapa.
              </div>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-sm"
            style={{ background: '#b45309', color: '#ffffff', fontWeight: 700 }}
            onClick={() => aplicarFiltroRapidoStatus('em_analise')}
          >
            Ver Imóveis p/ Revisão ({statsGerais.emRevisao})
          </button>
        </div>
      )}

      {/* ── ALERTA DE COTA SE ATINGIU LIMITE ── */}
      {usoPlano.atingiuLimite && (
        <div className={styles.alertaCotaAtingida}>
          <div className={styles.alertaCotaConteudo}>
            <span style={{ fontSize: '1.25rem' }}>⚠️</span>
            <span className={styles.alertaCotaTexto}>
              {isCorretor
                ? 'A cota corporativa da imobiliária atingiu o limite de anúncios ativos. Novos anúncios revisados precisarão de vagas liberadas.'
                : `Você atingiu o limite de ${usoPlano.limiteMaximo} imóvel(is) ativo(s) do plano ${usoPlano.plano.nome}. Faça upgrade para publicar mais.`}
            </span>
          </div>
          {!isCorretor && proximoPlano && (
            <button
              type="button"
              className={`btn btn-primario btn-sm ${styles.btnAlertaUpgrade}`}
              onClick={() => onDispararUpgrade(proximoPlano)}
            >
              ⚡ Upgrade para {proximoPlano.nome}
            </button>
          )}
        </div>
      )}

      {/* ── BARRA DE PESQUISA E FILTROS AVANÇADOS ── */}
      <div className={styles.barraFerramentas}>
        <div className={styles.linhaBusca}>
          <div className={styles.campoBuscaWrapper}>
            <span className={styles.iconeBusca}>🔍</span>
            <input
              type="text"
              placeholder="Buscar por título, bairro, cidade, tipo ou código..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className={styles.inputBusca}
            />
            {busca.trim().length > 0 && (
              <button
                type="button"
                className={styles.btnLimparBusca}
                onClick={() => setBusca('')}
                title="Limpar busca"
              >
                ✕
              </button>
            )}
          </div>

          <div className={styles.grupoVisualizacao}>
            <button
              type="button"
              className={`${styles.btnViewMode} ${modoVisualizacao === 'cards' ? styles.btnViewModeAtivo : ''}`}
              onClick={() => setModoVisualizacao('cards')}
              title="Visualizar em Cartões"
            >
              🔲 Cards
            </button>
            <button
              type="button"
              className={`${styles.btnViewMode} ${modoVisualizacao === 'tabela' ? styles.btnViewModeAtivo : ''}`}
              onClick={() => setModoVisualizacao('tabela')}
              title="Visualizar em Tabela Compacta"
            >
              📑 Tabela
            </button>
          </div>
        </div>

        <div className={styles.linhaFiltros}>
          <div className={styles.grupoFiltrosSelects}>
            {/* 1. FILTRO DE CORRETORES (Multi-Select com Checkboxes) */}
            {isImobiliaria && (
              <div className={styles.popoverWrapper} ref={popoverCorretorRef}>
                <button
                  type="button"
                  className={`${styles.btnGatilhoMultiSelect} ${filtroCorretores.length > 0 ? styles.btnGatilhoAtivo : ''}`}
                  onClick={() => {
                    setPopoverCorretorAberto((prev) => !prev)
                    setPopoverStatusAberto(false)
                    setPopoverNegociacaoAberto(false)
                  }}
                  title="Filtrar por corretores"
                  style={{ paddingRight: filtroCorretores.length > 0 ? '1.85rem' : '0.65rem' }}
                >
                  <span>
                    {filtroCorretores.length === 0
                      ? `👥 Toda a Equipe (${contagensCorretor.total})`
                      : filtroCorretores.length === 1
                        ? filtroCorretores[0] === usuarioId
                          ? `🏢 Imobiliária (${contagensCorretor.diretos})`
                          : `👤 ${nomesAnunciantes[filtroCorretores[0]] || 'Corretor'} (${contagensCorretor.porCorretor[filtroCorretores[0]] || 0})`
                        : `👥 ${filtroCorretores.length} corretores (${filtroCorretores.reduce((acc, id) => (id === usuarioId ? acc + (contagensCorretor.diretos || 0) : acc + (contagensCorretor.porCorretor[id] || 0)), 0)})`}
                  </span>
                  <span style={{ fontSize: '0.65rem', marginLeft: '2px', opacity: 0.7 }}>▾</span>
                </button>

                {filtroCorretores.length > 0 && (
                  <button
                    type="button"
                    className={styles.btnXSelect}
                    onClick={(e) => {
                      e.stopPropagation()
                      setFiltroCorretores([])
                    }}
                    title="Limpar seleção de corretores"
                  >
                    ✕
                  </button>
                )}

                {popoverCorretorAberto && (
                  <div className={styles.popoverDropdown}>
                    {/* Opção Todos */}
                    <div
                      className={`${styles.popoverItem} ${filtroCorretores.length === 0 ? styles.popoverItemSelecionado : ''}`}
                      onClick={() => setFiltroCorretores([])}
                    >
                      <div className={styles.popoverItemLeft}>
                        <input
                          type="checkbox"
                          checked={filtroCorretores.length === 0}
                          readOnly
                          style={{ accentColor: '#2563eb', pointerEvents: 'none' }}
                        />
                        <span>👥 Toda a Equipe</span>
                      </div>
                      <span className={styles.popoverContador}>{contagensCorretor.total}</span>
                    </div>

                    {/* Opção Imobiliária Direto */}
                    <div
                      className={`${styles.popoverItem} ${filtroCorretores.includes(usuarioId) ? styles.popoverItemSelecionado : ''}`}
                      onClick={() => {
                        setFiltroCorretores((prev) =>
                          prev.includes(usuarioId) ? prev.filter((id) => id !== usuarioId) : [...prev, usuarioId]
                        )
                      }}
                    >
                      <div className={styles.popoverItemLeft}>
                        <input
                          type="checkbox"
                          checked={filtroCorretores.includes(usuarioId)}
                          readOnly
                          style={{ accentColor: '#2563eb', pointerEvents: 'none' }}
                        />
                        <div
                          style={{
                            width: '20px',
                            height: '20px',
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, #1e293b, #475569)',
                            color: '#ffffff',
                            fontSize: '9px',
                            fontWeight: 800,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          IM
                        </div>
                        <span>🏢 Diretos da Imobiliária</span>
                      </div>
                      <span className={styles.popoverContador}>{contagensCorretor.diretos}</span>
                    </div>

                    <div style={{ height: '1px', background: '#f1f5f9', margin: '2px 0' }} />

                    {/* Lista de Corretores com Avatares */}
                    <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      {listaCorretores.map((c) => {
                        const selecionado = filtroCorretores.includes(c.id)
                        const iniciais = obterIniciaisUsuario(c.nome)
                        const gradiente = obterGradienteUsuario(c.id)
                        const qtd = contagensCorretor.porCorretor[c.id] || 0

                        return (
                          <div
                            key={c.id}
                            className={`${styles.popoverItem} ${selecionado ? styles.popoverItemSelecionado : ''}`}
                            onClick={() => {
                              setFiltroCorretores((prev) =>
                                prev.includes(c.id) ? prev.filter((id) => id !== c.id) : [...prev, c.id]
                              )
                            }}
                          >
                            <div className={styles.popoverItemLeft}>
                              <input
                                type="checkbox"
                                checked={selecionado}
                                readOnly
                                style={{ accentColor: '#2563eb', pointerEvents: 'none' }}
                              />
                              <div
                                style={{
                                  width: '20px',
                                  height: '20px',
                                  borderRadius: '50%',
                                  background: gradiente,
                                  color: '#ffffff',
                                  fontSize: '9px',
                                  fontWeight: 800,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  flexShrink: 0,
                                }}
                              >
                                {iniciais}
                              </div>
                              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '150px' }}>
                                {c.nome}
                              </span>
                            </div>
                            <span className={styles.popoverContador}>{qtd}</span>
                          </div>
                        )
                      })}
                    </div>

                    {/* Rodapé com Ações Rápidas */}
                    <div className={styles.popoverRodape}>
                      <button
                        type="button"
                        style={{ background: 'transparent', border: 'none', color: '#64748b', fontSize: '0.725rem', cursor: 'pointer', textDecoration: 'underline' }}
                        onClick={() => setFiltroCorretores([])}
                      >
                        Limpar
                      </button>
                      <button
                        type="button"
                        className="btn btn-primario btn-sm"
                        style={{ fontSize: '0.725rem', padding: '3px 8px', borderRadius: '4px' }}
                        onClick={() => setPopoverCorretorAberto(false)}
                      >
                        Concluir
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 2. FILTRO DE STATUS (Multi-Select com Checkboxes) */}
            <div className={styles.popoverWrapper} ref={popoverStatusRef}>
              <button
                type="button"
                className={`${styles.btnGatilhoMultiSelect} ${filtroStatus.length > 0 ? styles.btnGatilhoAtivo : ''}`}
                onClick={() => {
                  setPopoverStatusAberto((prev) => !prev)
                  setPopoverCorretorAberto(false)
                  setPopoverNegociacaoAberto(false)
                }}
                title="Filtrar por status"
                style={{
                  paddingRight: filtroStatus.length > 0 ? '1.85rem' : '0.65rem',
                  borderColor: filtroStatus.includes('em_analise') ? '#f59e0b' : undefined,
                  background: filtroStatus.includes('em_analise') ? '#fffbeb' : undefined,
                }}
              >
                <span>
                  {filtroStatus.length === 0
                    ? `🏷️ Todos os Status (${contagensStatus.total})`
                    : filtroStatus.length === 1
                      ? filtroStatus[0] === 'em_analise'
                        ? `⏳ Em Revisão (${contagensStatus.emRevisao})`
                        : filtroStatus[0] === 'ativo'
                          ? `🟢 Ativos (${contagensStatus.ativos})`
                          : filtroStatus[0] === 'pausado'
                            ? `⏸️ Pausados (${contagensStatus.pausados})`
                            : filtroStatus[0] === 'vendido'
                              ? `🏷️ Negociados (${contagensStatus.negociados})`
                              : `📝 Em Revisão (${contagensStatus.emRevisao})`
                      : `🏷️ ${filtroStatus.length} status (${filtroStatus.reduce((acc, st) => {
                          if (st === 'em_analise') return acc + contagensStatus.emRevisao
                          if (st === 'ativo') return acc + contagensStatus.ativos
                          if (st === 'pausado') return acc + contagensStatus.pausados
                          if (st === 'vendido') return acc + contagensStatus.negociados
                          return acc
                        }, 0)})`}
                </span>
                <span style={{ fontSize: '0.65rem', marginLeft: '2px', opacity: 0.7 }}>▾</span>
              </button>

              {filtroStatus.length > 0 && (
                <button
                  type="button"
                  className={styles.btnXSelect}
                  onClick={(e) => {
                    e.stopPropagation()
                    setFiltroStatus([])
                  }}
                  title="Limpar seleção de status"
                >
                  ✕
                </button>
              )}

              {popoverStatusAberto && (
                <div className={styles.popoverDropdown}>
                  {/* Opção Todos */}
                  <div
                    className={`${styles.popoverItem} ${filtroStatus.length === 0 ? styles.popoverItemSelecionado : ''}`}
                    onClick={() => setFiltroStatus([])}
                  >
                    <div className={styles.popoverItemLeft}>
                      <input
                        type="checkbox"
                        checked={filtroStatus.length === 0}
                        readOnly
                        style={{ accentColor: '#2563eb', pointerEvents: 'none' }}
                      />
                      <span>🏷️ Todos os Status</span>
                    </div>
                    <span className={styles.popoverContador}>{contagensStatus.total}</span>
                  </div>

                  <div style={{ height: '1px', background: '#f1f5f9', margin: '2px 0' }} />

                  {/* Lista de Status */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    {/* Em Revisão */}
                    <div
                      className={`${styles.popoverItem} ${filtroStatus.includes('em_analise') ? styles.popoverItemSelecionado : ''}`}
                      onClick={() => {
                        setFiltroStatus((prev) =>
                          prev.includes('em_analise') ? prev.filter((s) => s !== 'em_analise') : [...prev, 'em_analise']
                        )
                      }}
                      style={{ color: '#b45309', fontWeight: 600 }}
                    >
                      <div className={styles.popoverItemLeft}>
                        <input
                          type="checkbox"
                          checked={filtroStatus.includes('em_analise')}
                          readOnly
                          style={{ accentColor: '#f59e0b', pointerEvents: 'none' }}
                        />
                        <span>⏳ Em Revisão</span>
                      </div>
                      <span className={styles.popoverContador} style={{ background: '#fef3c7', color: '#b45309' }}>
                        {contagensStatus.emRevisao}
                      </span>
                    </div>

                    {/* Ativos */}
                    <div
                      className={`${styles.popoverItem} ${filtroStatus.includes('ativo') ? styles.popoverItemSelecionado : ''}`}
                      onClick={() => {
                        setFiltroStatus((prev) =>
                          prev.includes('ativo') ? prev.filter((s) => s !== 'ativo') : [...prev, 'ativo']
                        )
                      }}
                    >
                      <div className={styles.popoverItemLeft}>
                        <input
                          type="checkbox"
                          checked={filtroStatus.includes('ativo')}
                          readOnly
                          style={{ accentColor: '#059669', pointerEvents: 'none' }}
                        />
                        <span>🟢 Ativos no Mapa</span>
                      </div>
                      <span className={styles.popoverContador}>{contagensStatus.ativos}</span>
                    </div>

                    {/* Pausados */}
                    <div
                      className={`${styles.popoverItem} ${filtroStatus.includes('pausado') ? styles.popoverItemSelecionado : ''}`}
                      onClick={() => {
                        setFiltroStatus((prev) =>
                          prev.includes('pausado') ? prev.filter((s) => s !== 'pausado') : [...prev, 'pausado']
                        )
                      }}
                    >
                      <div className={styles.popoverItemLeft}>
                        <input
                          type="checkbox"
                          checked={filtroStatus.includes('pausado')}
                          readOnly
                          style={{ accentColor: '#6366f1', pointerEvents: 'none' }}
                        />
                        <span>⏸️ Pausados</span>
                      </div>
                      <span className={styles.popoverContador}>{contagensStatus.pausados}</span>
                    </div>

                    {/* Negociados */}
                    <div
                      className={`${styles.popoverItem} ${filtroStatus.includes('vendido') ? styles.popoverItemSelecionado : ''}`}
                      onClick={() => {
                        setFiltroStatus((prev) =>
                          prev.includes('vendido') ? prev.filter((s) => s !== 'vendido') : [...prev, 'vendido']
                        )
                      }}
                    >
                      <div className={styles.popoverItemLeft}>
                        <input
                          type="checkbox"
                          checked={filtroStatus.includes('vendido')}
                          readOnly
                          style={{ accentColor: '#7c3aed', pointerEvents: 'none' }}
                        />
                        <span>🏷️ Negociados</span>
                      </div>
                      <span className={styles.popoverContador}>{contagensStatus.negociados}</span>
                    </div>
                  </div>

                  {/* Rodapé com Ações Rápidas */}
                  <div className={styles.popoverRodape}>
                    <button
                      type="button"
                      style={{ background: 'transparent', border: 'none', color: '#64748b', fontSize: '0.725rem', cursor: 'pointer', textDecoration: 'underline' }}
                      onClick={() => setFiltroStatus([])}
                    >
                      Limpar
                    </button>
                    <button
                      type="button"
                      className="btn btn-primario btn-sm"
                      style={{ fontSize: '0.725rem', padding: '3px 8px', borderRadius: '4px' }}
                      onClick={() => setPopoverStatusAberto(false)}
                    >
                      Concluir
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* 3. FILTRO DE NEGOCIAÇÃO / MODALIDADE (Multi-Select com Checkboxes) */}
            <div className={styles.popoverWrapper} ref={popoverNegociacaoRef}>
              <button
                type="button"
                className={`${styles.btnGatilhoMultiSelect} ${filtroNegociacoes.length > 0 ? styles.btnGatilhoAtivo : ''}`}
                onClick={() => {
                  setPopoverNegociacaoAberto((prev) => !prev)
                  setPopoverCorretorAberto(false)
                  setPopoverStatusAberto(false)
                }}
                title="Filtrar por modalidade"
                style={{ paddingRight: filtroNegociacoes.length > 0 ? '1.85rem' : '0.65rem' }}
              >
                <span>
                  {filtroNegociacoes.length === 0
                    ? `🤝 Todas as Modalidades (${contagensNegociacao.total})`
                    : filtroNegociacoes.length === 1
                      ? filtroNegociacoes[0] === 'venda'
                        ? `💰 Venda (${contagensNegociacao.venda})`
                        : `🔑 Aluguel (${contagensNegociacao.aluguel})`
                      : `🤝 ${filtroNegociacoes.length} modalidades (${filtroNegociacoes.reduce((acc, neg) => {
                          if (neg === 'venda') return acc + contagensNegociacao.venda
                          if (neg === 'aluguel') return acc + contagensNegociacao.aluguel
                          return acc
                        }, 0)})`}
                </span>
                <span style={{ fontSize: '0.65rem', marginLeft: '2px', opacity: 0.7 }}>▾</span>
              </button>

              {filtroNegociacoes.length > 0 && (
                <button
                  type="button"
                  className={styles.btnXSelect}
                  onClick={(e) => {
                    e.stopPropagation()
                    setFiltroNegociacoes([])
                  }}
                  title="Limpar seleção de modalidades"
                >
                  ✕
                </button>
              )}

              {popoverNegociacaoAberto && (
                <div className={styles.popoverDropdown}>
                  {/* Opção Todos */}
                  <div
                    className={`${styles.popoverItem} ${filtroNegociacoes.length === 0 ? styles.popoverItemSelecionado : ''}`}
                    onClick={() => setFiltroNegociacoes([])}
                  >
                    <div className={styles.popoverItemLeft}>
                      <input
                        type="checkbox"
                        checked={filtroNegociacoes.length === 0}
                        readOnly
                        style={{ accentColor: '#2563eb', pointerEvents: 'none' }}
                      />
                      <span>🤝 Todas as Modalidades</span>
                    </div>
                    <span className={styles.popoverContador}>{contagensNegociacao.total}</span>
                  </div>

                  <div style={{ height: '1px', background: '#f1f5f9', margin: '2px 0' }} />

                  {/* Lista de Modalidades */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    {/* Venda */}
                    <div
                      className={`${styles.popoverItem} ${filtroNegociacoes.includes('venda') ? styles.popoverItemSelecionado : ''}`}
                      onClick={() => {
                        setFiltroNegociacoes((prev) =>
                          prev.includes('venda') ? prev.filter((n) => n !== 'venda') : [...prev, 'venda']
                        )
                      }}
                    >
                      <div className={styles.popoverItemLeft}>
                        <input
                          type="checkbox"
                          checked={filtroNegociacoes.includes('venda')}
                          readOnly
                          style={{ accentColor: '#2563eb', pointerEvents: 'none' }}
                        />
                        <span>💰 Venda</span>
                      </div>
                      <span className={styles.popoverContador}>{contagensNegociacao.venda}</span>
                    </div>

                    {/* Aluguel */}
                    <div
                      className={`${styles.popoverItem} ${filtroNegociacoes.includes('aluguel') ? styles.popoverItemSelecionado : ''}`}
                      onClick={() => {
                        setFiltroNegociacoes((prev) =>
                          prev.includes('aluguel') ? prev.filter((n) => n !== 'aluguel') : [...prev, 'aluguel']
                        )
                      }}
                    >
                      <div className={styles.popoverItemLeft}>
                        <input
                          type="checkbox"
                          checked={filtroNegociacoes.includes('aluguel')}
                          readOnly
                          style={{ accentColor: '#2563eb', pointerEvents: 'none' }}
                        />
                        <span>🔑 Aluguel</span>
                      </div>
                      <span className={styles.popoverContador}>{contagensNegociacao.aluguel}</span>
                    </div>

                  </div>

                  {/* Rodapé com Ações Rápidas */}
                  <div className={styles.popoverRodape}>
                    <button
                      type="button"
                      style={{ background: 'transparent', border: 'none', color: '#64748b', fontSize: '0.725rem', cursor: 'pointer', textDecoration: 'underline' }}
                      onClick={() => setFiltroNegociacoes([])}
                    >
                      Limpar
                    </button>
                    <button
                      type="button"
                      className="btn btn-primario btn-sm"
                      style={{ fontSize: '0.725rem', padding: '3px 8px', borderRadius: '4px' }}
                      onClick={() => setPopoverNegociacaoAberto(false)}
                    >
                      Concluir
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Botão Limpar Filtros Inline */}
            {(filtroCorretores.length > 0 || filtroStatus.length > 0 || filtroNegociacoes.length > 0 || busca.trim().length > 0) && (
              <button
                type="button"
                className={styles.btnLimparFiltrosInline}
                onClick={() => {
                  setFiltroCorretores([])
                  setFiltroStatus([])
                  setFiltroNegociacoes([])
                  setBusca('')
                }}
                title="Limpar todos os filtros e pesquisa"
              >
                ✕ Limpar filtros
              </button>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>Ordenar:</span>
            <select
              value={ordenacao}
              onChange={(e) => setOrdenacao(e.target.value as Ordenacao)}
              className={styles.selectFiltro}
            >
              <option value="recentes">Mais Recentes</option>
              <option value="leads">Mais Leads / Interesse</option>
              <option value="preco_menor">Menor Preço</option>
              <option value="preco_maior">Maior Preço</option>
              <option value="titulo">Título A-Z</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── BARRA FLUTUANTE DE AÇÕES EM LOTE ── */}
      {selecionados.length > 0 && (
        <div className={styles.barraAcoesLote}>
          <div className={styles.infoLote}>
            <span className={styles.badgeQtdLote}>{selecionados.length}</span>
            <span>imóvel(is) selecionado(s)</span>
          </div>

          <div className={styles.botoesLote}>
            <button
              type="button"
              className={styles.btnLote}
              onClick={() => handleAcaoLote('ativar')}
              disabled={executandoLote}
            >
              ▶️ Ativar no Mapa
            </button>
            <button
              type="button"
              className={styles.btnLote}
              onClick={() => handleAcaoLote('pausar')}
              disabled={executandoLote}
            >
              ⏸️ Pausar
            </button>
            {isImobiliaria && (
              <button
                type="button"
                className={styles.btnLote}
                onClick={() => abrirModalReatribuir(selecionados)}
                disabled={executandoLote}
              >
                👔 Transferir Corretor
              </button>
            )}
            {podeExcluir && (
              <button
                type="button"
                className={`${styles.btnLote} ${styles.btnLotePerigo}`}
                onClick={() => handleAcaoLote('excluir')}
                disabled={executandoLote}
              >
                🗑️ Excluir Selecionados
              </button>
            )}
            <button
              type="button"
              className={styles.btnLote}
              onClick={() => setSelecionados([])}
              style={{ background: 'transparent', border: 'none', textDecoration: 'underline' }}
            >
              Desmarcar todos
            </button>
          </div>
        </div>
      )}

      {/* ── CONTROLE DE SELEÇÃO GLOBAL ── */}
      {imoveisFiltrados.length > 0 && (
        <div className={styles.cabecalhoSelecao}>
          <label className={styles.checkboxTodos}>
            <input
              type="checkbox"
              checked={todosFiltradosSelecionados}
              onChange={handleToggleSelecionarTodos}
              style={{ width: '16px', height: '16px', accentColor: '#2563eb', cursor: 'pointer' }}
            />
            <span>Selecionar todos os {imoveisFiltrados.length} imóveis exibidos</span>
          </label>

          <span>Exibindo {imoveisFiltrados.length} de {imoveis.length} imóveis</span>
        </div>
      )}

      {/* ── LISTAGEM DE IMÓVEIS: VAZIO OU RESULTADOS ── */}
      {imoveisFiltrados.length === 0 ? (
        <div className={styles.estadoVazio}>
          <span className={styles.iconeVazio}>🏢</span>
          <h3 className={styles.tituloVazio}>
            {imoveis.length === 0
              ? 'Nenhum imóvel cadastrado no portfólio'
              : filtroStatus.includes('em_analise')
                ? 'Nenhum imóvel em revisão no momento! 🎉'
                : 'Nenhum imóvel encontrado'}
          </h3>
          <p className={styles.textoVazio}>
            {imoveis.length === 0
              ? 'Comece cadastrando seu primeiro imóvel para que ele seja exibido no mapa do Fixum.'
              : filtroStatus.includes('em_analise')
                ? 'Todos os anúncios da equipe já foram revisados e publicados.'
                : 'Tente alterar os termos de busca ou filtros selecionados acima.'}
          </p>
          {imoveis.length === 0 ? (
            <button
              type="button"
              onClick={onAbrirModalNovo}
              className="btn btn-primario btn-md"
              style={{ fontWeight: 700 }}
            >
              Cadastrar primeiro imóvel
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setBusca('')
                setFiltroCorretores([])
                setFiltroStatus([])
                setFiltroNegociacoes([])
              }}
              className="btn btn-outline btn-sm"
            >
              Limpar Filtros
            </button>
          )}
        </div>
      ) : modoVisualizacao === 'cards' ? (
        /* ── MODO CARDS (GRID MODERNO) ── */
        <div className={styles.gridCards}>
          {imoveisFiltrados.map((imovel) => {
            const isSelecionado = selecionados.includes(imovel.id)
            const status = imovel.status
            const isAtivo = status === 'publicado' || status === 'ativo'
            const isEmRevisao = status === 'em_analise' || status === 'rascunho'
            const isPausado = status === 'pausado'
            const isVendido = status === 'vendido' || status === 'alugado'
            const isRascunho = status === 'rascunho' && !isEmRevisao
            const qtdLeads = mapaLeadsPorImovel[imovel.id] || 0
            const nomeResponsavel = nomesAnunciantes[imovel.anunciante_id] || 'Imobiliária'

            return (
              <div
                key={imovel.id}
                className={`${styles.cardImovel} ${isSelecionado ? styles.cardImovelSelecionado : ''}`}
                style={{
                  borderWidth: isEmRevisao || isPausado ? '3px' : undefined,
                  borderStyle: isEmRevisao || isPausado ? 'solid' : undefined,
                  borderColor: isEmRevisao ? '#f59e0b' : isPausado ? '#6366f1' : undefined,
                  boxShadow: isEmRevisao
                    ? '0 10px 28px rgba(245, 158, 11, 0.22), 0 2px 8px rgba(245, 158, 11, 0.12)'
                    : isPausado
                      ? '0 10px 28px rgba(99, 102, 241, 0.22), 0 2px 8px rgba(99, 102, 241, 0.12)'
                      : undefined,
                  background: isEmRevisao ? '#fffdfa' : isPausado ? '#fafafe' : undefined,
                }}
              >
                {/* ── FOTO DO IMÓVEL ── */}
                <div
                  className={styles.cardFotoContainer}
                  style={{
                    backgroundImage: `url(${fotoPrincipal(imovel)})`,
                  }}
                >
                  <MarcaDaguaTeste variante="padrao" />
                  <div className={styles.overlayGradiente} />

                  <input
                    type="checkbox"
                    className={styles.checkboxCard}
                    checked={isSelecionado}
                    onChange={() => handleToggleItem(imovel.id)}
                    title="Selecionar imóvel"
                  />

                  <span className={styles.badgeNegociacao}>
                    {imovel.negociacao === 'venda' ? 'Venda' : 'Aluguel'}
                  </span>

                  <div className={styles.badgesTopoCard}>
                    <span
                      className={styles.badgeStatus}
                      style={{
                        background: isEmRevisao
                          ? 'rgba(217, 119, 6, 0.95)'
                          : isAtivo
                            ? 'rgba(5, 150, 105, 0.95)'
                            : isPausado
                              ? 'rgba(79, 70, 229, 0.95)'
                              : isRascunho
                                ? 'rgba(220, 38, 38, 0.95)'
                                : 'rgba(71, 85, 105, 0.95)',
                        color: '#ffffff',
                      }}
                    >
                      {isEmRevisao
                        ? '⏳ Em Revisão'
                        : isAtivo
                          ? '🟢 Ativo no Mapa'
                          : isPausado
                            ? '⏸️ Pausado'
                            : isVendido
                              ? '🏷️ Negociado'
                              : isRascunho
                                ? '📝 Recusado'
                                : status}
                    </span>
                  </div>

                  <div className={styles.badgePrecoCard}>
                    {formatarPreco(imovel.preco, imovel.negociacao)}
                  </div>

                  {imovel.modo_exibicao_preco === 'sob_consulta' && (
                    <div className={styles.badgeSobConsultaAdmin} title="Para o público e visitantes do portal, este imóvel aparece como 'Preço sob consulta'">
                      💬 Sob Consulta
                    </div>
                  )}

                  {imovel.fotos && imovel.fotos.length > 0 && (
                    <div className={styles.badgeQtdFotos}>
                      📷 {imovel.fotos.length}
                    </div>
                  )}
                </div>

                {/* ── CORPO DO CARD ── */}
                <div className={styles.cardCorpo}>
                  <div className={styles.cardHeaderInfo}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '6px' }}>
                      <span className={styles.cardTagTipo}>
                        {labelTipoImovel(imovel.tipo)}
                      </span>
                      {imovel.codigo && (
                        <span style={{ fontSize: '0.675rem', fontWeight: 800, color: '#334155', background: '#f1f5f9', border: '1px solid #cbd5e1', padding: '1px 6px', borderRadius: '4px', fontFamily: 'monospace' }}>
                          Ref: {imovel.codigo}
                        </span>
                      )}
                    </div>
                    <h3 className={styles.cardTitulo} title={imovel.titulo}>
                      {imovel.titulo}
                    </h3>
                    <div className={styles.cardLocalizacao}>
                      <span>📍</span>
                      <span>{imovel.cidade} {imovel.bairro ? `• ${imovel.bairro}` : ''}</span>
                    </div>
                    {imovel.modo_exibicao_preco === 'sob_consulta' && (
                      <div className={styles.avisoSobConsultaCard} title="Preço sob consulta para visitantes no portal público">
                        <span className={styles.avisoSobConsultaDot} />
                        <span>Preço sob consulta para o público</span>
                      </div>
                    )}
                  </div>

                  {/* Grade Limpa de 4 Atributos */}
                  <div className={styles.gradeAtributos}>
                    <div className={styles.gradeItem}>
                      <span className={styles.gradeItemIcone}>📐</span>
                      <span className={styles.gradeItemValor}>{imovel.area ? `${imovel.area}m²` : '—'}</span>
                    </div>
                    <div className={styles.gradeItem}>
                      <span className={styles.gradeItemIcone}>🛏️</span>
                      <span className={styles.gradeItemValor}>{imovel.quartos ? `${imovel.quartos} qts` : '—'}</span>
                    </div>
                    <div className={styles.gradeItem}>
                      <span className={styles.gradeItemIcone}>🚿</span>
                      <span className={styles.gradeItemValor}>{imovel.banheiros ? `${imovel.banheiros} ban` : '—'}</span>
                    </div>
                    <div className={styles.gradeItem}>
                      <span className={styles.gradeItemIcone}>🚗</span>
                      <span className={styles.gradeItemValor}>{imovel.vagas ? `${imovel.vagas} vg` : '—'}</span>
                    </div>
                  </div>

                  {/* Informações da Equipe & Leads */}
                  <div className={styles.cardMetaEquipe}>
                    {isImobiliaria ? (
                      <span className={styles.tagCorretor} title={`Responsável: ${nomeResponsavel}`}>
                        👔 {nomeResponsavel}
                      </span>
                    ) : <span />}

                    <span className={styles.tagLeads} title={`${qtdLeads} lead(s) gerado(s) por este imóvel`}>
                      👥 {qtdLeads} lead{qtdLeads === 1 ? '' : 's'}
                    </span>
                  </div>
                </div>

                {/* ── RODAPÉ DE AÇÕES PROFISSIONAIS ── */}
                <div className={styles.cardAcoes}>
                  {/* Linha 1: Botão de Ação Primária de Alta Prioridade */}
                  {isEmRevisao && isImobiliaria ? (
                    <div style={{ display: 'flex', gap: '6px', width: '100%' }}>
                      <button
                        type="button"
                        className={`${styles.btnAcaoPrincipal} ${styles.btnAcaoAprovar}`}
                        onClick={() => setImovelEmRevisao(imovel)}
                        title="Revisar dados, fotos e publicar no mapa"
                        style={{ flex: 1.25 }}
                      >
                        🔍 Revisar / Publicar
                      </button>
                      <button
                        type="button"
                        className={`${styles.btnAcaoPrincipal} ${(mensagensNaoLidasPorImovel[imovel.id] || 0) > 0 ? styles.btnChatComAlerta : ''}`}
                        onClick={() => abrirChatImovel(imovel)}
                        title={(mensagensNaoLidasPorImovel[imovel.id] || 0) > 0 ? `${mensagensNaoLidasPorImovel[imovel.id]} nova(s) mensagem(ns) no chat` : 'Abrir chat de moderação'}
                        style={{ flex: 0.75, background: '#f0fdf4', borderColor: '#86efac', color: '#15803d', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                      >
                        <span>💬 Chat</span>
                        {(mensagensNaoLidasPorImovel[imovel.id] || 0) > 0 && (
                          <span className={styles.badgeChatNaoLido}>{mensagensNaoLidasPorImovel[imovel.id]}</span>
                        )}
                      </button>
                    </div>
                  ) : isEmRevisao ? (
                    <div style={{ display: 'flex', gap: '6px', width: '100%' }}>
                      <button
                        type="button"
                        className={styles.btnAcaoPrincipal}
                        style={{ background: '#fffbeb', borderColor: '#f59e0b', color: '#b45309', flex: 1.25, fontWeight: 700 }}
                        onClick={() => setImovelIdParaEditar(imovel.id)}
                        title="Abrir para corrigir os dados e reenviar ao gestor"
                      >
                        ✏️ Corrigir Dados
                      </button>
                      <button
                        type="button"
                        className={`${styles.btnAcaoPrincipal} ${(mensagensNaoLidasPorImovel[imovel.id] || 0) > 0 ? styles.btnChatComAlerta : ''}`}
                        onClick={() => abrirChatImovel(imovel)}
                        title={(mensagensNaoLidasPorImovel[imovel.id] || 0) > 0 ? `${mensagensNaoLidasPorImovel[imovel.id]} nova(s) mensagem(ns) do gestor` : 'Abrir chat de moderação'}
                        style={{ flex: 0.75, background: '#f0fdf4', borderColor: '#86efac', color: '#15803d', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                      >
                        <span>💬 Chat</span>
                        {(mensagensNaoLidasPorImovel[imovel.id] || 0) > 0 && (
                          <span className={styles.badgeChatNaoLido}>{mensagensNaoLidasPorImovel[imovel.id]}</span>
                        )}
                      </button>
                    </div>
                  ) : isAtivo ? (
                    <div style={{ display: 'flex', gap: '4px', width: '100%' }}>
                      <button
                        type="button"
                        className={styles.btnAcaoPrincipal}
                        onClick={() => onAlterarStatus(imovel.id, 'pausado')}
                        title="Pausar anúncio no mapa"
                        style={{ flex: 1 }}
                      >
                        ⏸️ Pausar Anúncio
                      </button>
                      {isImobiliaria && (
                        <button
                          type="button"
                          className={styles.btnAcaoPrincipal}
                          style={{ flex: 1, color: '#b45309', borderColor: '#fde68a', background: '#fffbeb' }}
                          onClick={() => setImovelEmRevisao(imovel)}
                          title="Auditoria & Solicitar Revisão do Corretor"
                        >
                          ⚠️ Pedir Revisão
                        </button>
                      )}
                    </div>
                  ) : isPausado ? (
                    <div style={{ display: 'flex', gap: '4px', width: '100%' }}>
                      <button
                        type="button"
                        className={styles.btnAcaoPrincipal}
                        onClick={() => onAlterarStatus(imovel.id, 'ativo')}
                        title="Reativar anúncio no mapa"
                        style={{ flex: 1, color: '#059669', borderColor: '#a7f3d0', background: '#ecfdf5' }}
                      >
                        ▶️ Reativar no Mapa
                      </button>
                      {isImobiliaria && (
                        <button
                          type="button"
                          className={styles.btnAcaoPrincipal}
                          style={{ flex: 1, color: '#b45309', borderColor: '#fde68a', background: '#fffbeb' }}
                          onClick={() => setImovelEmRevisao(imovel)}
                          title="Auditoria & Solicitar Revisão do Corretor"
                        >
                          ⚠️ Pedir Revisão
                        </button>
                      )}
                    </div>
                  ) : null}

                  {/* Linha 2: Barra de Atalhos Rápidos com Ícones */}
                  <div className={styles.linhaBotoesAcoes}>
                    <div className={styles.grupoIconesAcoes}>
                      <Link
                        href={`/imovel/${imovel.id}`}
                        target="_blank"
                        className={styles.btnAcaoIcone}
                        title="Ver anúncio público"
                      >
                        👁️
                      </Link>

                      <button
                        type="button"
                        className={styles.btnAcaoIcone}
                        onClick={() => setImovelIdParaEditar(imovel.id)}
                        title="Editar dados e fotos"
                      >
                        ✏️
                      </button>

                      <button
                        type="button"
                        className={styles.btnAcaoIcone}
                        onClick={() => copiarLinkImovel(imovel.id)}
                        title="Copiar link do anúncio"
                      >
                        🔗
                      </button>

                      <button
                        type="button"
                        className={styles.btnAcaoIcone}
                        onClick={() => compartilharWhatsApp(imovel)}
                        title="Compartilhar no WhatsApp"
                        style={{ color: '#16a34a', borderColor: '#bbf7d0', background: '#f0fdf4' }}
                      >
                        <IconeWhatsApp size={16} />
                      </button>
                    </div>

                    <div className={styles.grupoIconesAcoes}>
                      {isImobiliaria && (
                        <button
                          type="button"
                          className={styles.btnAcaoIcone}
                          onClick={() => abrirModalReatribuir([imovel.id])}
                          title="Transferir corretor responsável"
                        >
                          👔
                        </button>
                      )}

                      {podeExcluir && (
                        <button
                          type="button"
                          className={styles.btnAcaoIcone}
                          onClick={() => onExcluirImovel(imovel.id, imovel.titulo)}
                          title="Excluir imóvel"
                          style={{ color: '#dc2626' }}
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        /* ── MODO TABELA (COMPACTO) ── */
        <div className={styles.tabelaWrapper}>
          <table className={styles.tabela}>
            <thead>
              <tr>
                <th style={{ width: '40px' }}>
                  <input
                    type="checkbox"
                    checked={todosFiltradosSelecionados}
                    onChange={handleToggleSelecionarTodos}
                    style={{ accentColor: '#2563eb', cursor: 'pointer' }}
                  />
                </th>
                <th style={{ width: '60px' }}>Foto</th>
                <th>Título / Detalhes</th>
                <th>Cidade / Bairro</th>
                <th>Preço</th>
                {isImobiliaria && <th>Responsável</th>}
                <th>Status</th>
                <th>Leads</th>
                <th style={{ textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {imoveisFiltrados.map((imovel) => {
                const isSelecionado = selecionados.includes(imovel.id)
                const status = imovel.status
                const isAtivo = status === 'publicado' || status === 'ativo'
                const isEmRevisao = status === 'em_analise' || status === 'rascunho'
                const isPausado = status === 'pausado'
                const isVendido = status === 'vendido' || status === 'alugado'
                const isRascunho = status === 'rascunho' && !isEmRevisao
                const qtdLeads = mapaLeadsPorImovel[imovel.id] || 0
                const nomeResponsavel = nomesAnunciantes[imovel.anunciante_id] || 'Imobiliária'

                return (
                  <tr
                    key={imovel.id}
                    className={isSelecionado ? styles.linhaSelecionada : ''}
                    style={{
                      background: isEmRevisao ? '#fffdfa' : undefined,
                      borderLeft: isEmRevisao ? '4px solid #f59e0b' : undefined,
                    }}
                  >
                    <td>
                      <input
                        type="checkbox"
                        checked={isSelecionado}
                        onChange={() => handleToggleItem(imovel.id)}
                        style={{ accentColor: '#2563eb', cursor: 'pointer' }}
                      />
                    </td>
                    <td>
                      <div
                        className={styles.colunaFotoMini}
                        style={{ backgroundImage: `url(${fotoPrincipal(imovel)})` }}
                      />
                    </td>
                    <td>
                      <strong style={{ color: '#0f172a', display: 'block', maxWidth: '280px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {imovel.titulo}
                      </strong>
                      <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                        {labelTipoImovel(imovel.tipo)} • {imovel.negociacao === 'venda' ? 'Venda' : 'Aluguel'}
                      </span>
                    </td>
                    <td>
                      <span style={{ color: '#334155' }}>{imovel.cidade}</span>
                      {imovel.bairro ? <span style={{ display: 'block', fontSize: '0.75rem', color: '#64748b' }}>{imovel.bairro}</span> : null}
                    </td>
                    <td>
                      <strong style={{ color: '#1d4ed8', display: 'block' }}>
                        {formatarPreco(imovel.preco, imovel.negociacao)}
                      </strong>
                      {imovel.modo_exibicao_preco === 'sob_consulta' ? (
                        <span className={styles.badgeTabelaSobConsulta} title="Para o público e visitantes do portal, este imóvel aparece como 'Preço sob consulta'">
                          💬 Sob Consulta (Público)
                        </span>
                      ) : (
                        <span style={{ display: 'block', fontSize: '0.685rem', color: '#16a34a', fontWeight: 600 }}>
                          💰 Preço Visível
                        </span>
                      )}
                    </td>
                    {isImobiliaria && (
                      <td>
                        <span className={styles.tagCorretor} style={{ fontSize: '0.75rem' }}>
                          👔 {nomeResponsavel}
                        </span>
                      </td>
                    )}
                    <td>
                      <span
                        className={styles.badgeStatus}
                        style={{
                          background: isEmRevisao
                            ? '#fef3c7'
                            : isAtivo
                              ? '#ecfdf5'
                              : isPausado
                                ? '#fffbeb'
                                : isRascunho
                                  ? '#fef2f2'
                                  : '#f1f5f9',
                          color: isEmRevisao
                            ? '#b45309'
                            : isAtivo
                              ? '#065f46'
                              : isPausado
                                ? '#b45309'
                                : isRascunho
                                  ? '#dc2626'
                                  : '#475569',
                          border: `1px solid ${isEmRevisao ? '#fde68a' : isAtivo ? '#a7f3d0' : isPausado ? '#fde68a' : '#cbd5e1'}`,
                          fontSize: '0.725rem',
                          fontWeight: 700,
                        }}
                      >
                        {isEmRevisao ? '⏳ Em Revisão' : isAtivo ? '🟢 Ativo' : isPausado ? '⏸️ Pausado' : isVendido ? '🏷️ Negociado' : isRascunho ? '📝 Recusado' : status}
                      </span>
                    </td>
                    <td>
                      <span className={styles.tagLeads} style={{ fontSize: '0.75rem' }}>
                        👥 {qtdLeads}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        {isEmRevisao && isImobiliaria ? (
                          <button
                            type="button"
                            className="btn btn-sm"
                            style={{ background: '#b45309', color: '#ffffff', fontWeight: 700, fontSize: '0.75rem', padding: '4px 8px' }}
                            onClick={() => setImovelEmRevisao(imovel)}
                            title="Revisar e Publicar"
                          >
                            🔍 Revisar
                          </button>
                        ) : null}

                        {isEmRevisao && (
                          <button
                            type="button"
                            className={styles.btnAcaoIcone}
                            onClick={() => abrirChatImovel(imovel)}
                            title={(mensagensNaoLidasPorImovel[imovel.id] || 0) > 0 ? `${mensagensNaoLidasPorImovel[imovel.id]} nova(s) mensagem(ns) no chat` : 'Chat de Moderação'}
                            style={{
                              color: '#15803d',
                              background: (mensagensNaoLidasPorImovel[imovel.id] || 0) > 0 ? '#fef2f2' : '#f0fdf4',
                              borderColor: (mensagensNaoLidasPorImovel[imovel.id] || 0) > 0 ? '#ef4444' : '#86efac',
                              position: 'relative',
                              fontWeight: 700,
                            }}
                          >
                            💬
                            {(mensagensNaoLidasPorImovel[imovel.id] || 0) > 0 && (
                              <span
                                style={{
                                  position: 'absolute',
                                  top: '-4px',
                                  right: '-4px',
                                  width: '8px',
                                  height: '8px',
                                  borderRadius: '50%',
                                  background: '#ef4444',
                                  boxShadow: '0 0 0 2px #ffffff',
                                }}
                              />
                            )}
                          </button>
                        )}

                        <Link
                          href={`/imovel/${imovel.id}`}
                          target="_blank"
                          className={styles.btnAcaoIcone}
                          title="Ver anúncio público"
                        >
                          👁️
                        </Link>
                        <button
                          type="button"
                          className={styles.btnAcaoIcone}
                          onClick={() => copiarLinkImovel(imovel.id)}
                          title="Copiar link"
                        >
                          🔗
                        </button>
                        <button
                          type="button"
                          className={styles.btnAcaoIcone}
                          onClick={() => compartilharWhatsApp(imovel)}
                          title="Compartilhar no WhatsApp"
                          style={{ color: '#16a34a', borderColor: '#bbf7d0', background: '#f0fdf4' }}
                        >
                          <IconeWhatsApp size={15} />
                        </button>
                        <button
                          type="button"
                          className={styles.btnAcaoIcone}
                          onClick={() => setImovelIdParaEditar(imovel.id)}
                          title="Editar"
                        >
                          ✏️
                        </button>
                        {isImobiliaria && (
                          <button
                            type="button"
                            className={styles.btnAcaoIcone}
                            onClick={() => abrirModalReatribuir([imovel.id])}
                            title="Transferir Corretor"
                          >
                            👔
                          </button>
                        )}
                        {isAtivo ? (
                          <button
                            type="button"
                            className={styles.btnAcaoIcone}
                            onClick={() => onAlterarStatus(imovel.id, 'pausado')}
                            title="Pausar"
                          >
                            ⏸️
                          </button>
                        ) : isPausado ? (
                          <button
                            type="button"
                            className={styles.btnAcaoIcone}
                            onClick={() => onAlterarStatus(imovel.id, 'ativo')}
                            title="Ativar"
                            style={{ color: '#059669' }}
                          >
                            ▶️
                          </button>
                        ) : null}
                        {podeExcluir && (
                          <button
                            type="button"
                            className={styles.btnAcaoIcone}
                            onClick={() => onExcluirImovel(imovel.id, imovel.titulo)}
                            title="Excluir"
                            style={{ color: '#dc2626' }}
                          >
                            🗑️
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── MODAL DE EDIÇÃO SOBREPOSTO COM BACKDROP BLUR ── */}
      <ModalEditarImovel
        isOpen={!!imovelIdParaEditar}
        imovelId={imovelIdParaEditar}
        onClose={() => setImovelIdParaEditar(null)}
        onImovelSalvo={async () => {
          setImovelIdParaEditar(null)
          await onRecarregarDados()
        }}
      />

      {/* ── MODAL DE REVISÃO E MODERAÇÃO PELO GESTOR ── */}
      <ModalRevisaoImovel
        aberto={!!imovelEmRevisao}
        onFechar={() => setImovelEmRevisao(null)}
        imovel={imovelEmRevisao}
        nomeCorretor={imovelEmRevisao ? (nomesAnunciantes[imovelEmRevisao.anunciante_id] || 'Corretor') : ''}
        gestorId={usuarioId}
        gestorNome={usuarioNome}
        usoPlano={usoPlano}
        onAbrirEdicao={(id) => setImovelIdParaEditar(id)}
        onSucesso={async () => {
          setImovelEmRevisao(null)
          await onRecarregarDados()
        }}
      />

      {/* ── MODAL DE REATRIBUIÇÃO DE CORRETOR RESPONSÁVEL ── */}
      <ModalReatribuirCorretor
        aberto={modalReatribuirAberto}
        onFechar={() => {
          setModalReatribuirAberto(false)
          setImoveisParaReatribuir([])
        }}
        imoveisIds={imoveisParaReatribuir}
        titulosImoveis={imoveis
          .filter((i) => imoveisParaReatribuir.includes(i.id))
          .map((i) => i.titulo)}
        responsavelAtualNome={
          imoveisParaReatribuir.length === 1
            ? (() => {
                const imovel = imoveis.find((i) => i.id === imoveisParaReatribuir[0])
                if (!imovel) return usuarioNome
                return nomesAnunciantes[imovel.anunciante_id] || (imovel.anunciante_id === usuarioId ? `${usuarioNome} (Imobiliária)` : 'Corretor')
              })()
            : undefined
        }
        imobiliariaId={usuarioId}
        imobiliariaNome={usuarioNome}
        corretores={listaCorretores}
        usuarioAtualId={usuarioId}
        onSucesso={async () => {
          setSelecionados([])
          await onRecarregarDados()
        }}
      />

      {/* ── MODAL CHAT DE MODERAÇÃO ESTILO WHATSAPP ── */}
      {imovelChatAberto && (
        <ModalChatModeracao
          imovel={imovelChatAberto}
          usuarioId={usuarioId}
          usuarioNome={usuarioNome}
          isImobiliaria={isImobiliaria}
          nomesAnunciantes={nomesAnunciantes}
          imobiliariaDona={imobiliariaDona}
          onClose={fecharChatImovel}
        />
      )}
    </div>
  )
}
