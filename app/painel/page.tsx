'use client'

import { useEffect, useState, useMemo, useCallback, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { type Imovel, type Lead, type Assinatura, type Fatura, type Plano, type MetodoPagamento } from '@/lib/types'
import { formatarPreco, labelTipoImovel, fotoPrincipal, obterIniciaisUsuario, obterGradienteUsuario } from '@/lib/utils'
import { calcularUsoPlano, obterPlanoPorId, obterProximoPlano } from '@/lib/planos'
import { useConfirm } from '@/contexts/ModalConfirmacaoContext'
import Header from '@/components/layout/Header'
import { Logotipo } from '@/components/ui/Logo'
import AbaMeuPlano from '@/components/painel/AbaMeuPlano'
import AbaCorretores from '@/components/painel/AbaCorretores'
import AbaImoveis from '@/components/painel/AbaImoveis'
import AbaLeads from '@/components/painel/AbaLeads'
import AbaDesempenho from '@/components/painel/AbaDesempenho'
import ModalLimiteAtingido from '@/components/painel/ModalLimiteAtingido'
import ModalUpgradePlano from '@/components/painel/ModalUpgradePlano'
import ModalConfigSeguranca from '@/components/painel/ModalConfigSeguranca'
import ModalNovoImovel from '@/components/painel/ModalNovoImovel'
import ModalConfiguracoes from '@/components/painel/ModalConfiguracoes'
import MenuNotificacoes from '@/components/painel/MenuNotificacoes'
import MenuUsuarioTopbar from '@/components/painel/MenuUsuarioTopbar'
import styles from './page.module.css'
import Icone, { ehNomeIcone } from '@/components/ui/Icone'

type Aba = 'dashboard' | 'imoveis' | 'leads' | 'corretores' | 'desempenho' | 'plano'

function PainelConteudo() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const abaParam = searchParams.get('aba') as Aba | null

  const abaInicial: Aba = (abaParam && ['dashboard', 'imoveis', 'leads', 'corretores', 'desempenho', 'plano'].includes(abaParam))
    ? abaParam
    : 'dashboard'

  const [abaAtiva, setAbaAtiva] = useState<Aba>(abaInicial)
  const [imoveis, setImoveis] = useState<Imovel[]>([])
  const [leads, setLeads] = useState<Lead[]>([])
  const [assinatura, setAssinatura] = useState<Assinatura | null>(null)
  const [faturas, setFaturas] = useState<Fatura[]>([])
  const [carregando, setCarregando] = useState(true)
  const [usuarioNome, setUsuarioNome] = useState('')
  const [usuarioEmail, setUsuarioEmail] = useState('')
  const [usuarioId, setUsuarioId] = useState('')
  const [tipoAnunciante, setTipoAnunciante] = useState<'proprietario' | 'corretor' | 'imobiliaria'>('proprietario')
  const [usuarioCreci, setUsuarioCreci] = useState('')
  const [isImobiliaria, setIsImobiliaria] = useState(false)
  const [isCorretor, setIsCorretor] = useState(false)
  const [isGestor, setIsGestor] = useState(false)
  const [podeExcluir, setPodeExcluir] = useState(true)
  const [imobiliariaDona, setImobiliariaDona] = useState<{ id: string; nome: string } | null>(null)
  const { confirmar, alertar } = useConfirm()

  // Computed booleans para clareza em toda a tela
  const isCorretorEquipe = isCorretor && !!imobiliariaDona
  const isCorretorAutonomo = tipoAnunciante === 'corretor' && !imobiliariaDona
  const isProprietario = tipoAnunciante === 'proprietario' && !isImobiliaria && !isCorretorAutonomo && !isCorretorEquipe

  // Estados de Filtro de Corretores da Equipe
  const [filtroCorretor, setFiltroCorretor] = useState<string>('todos')
  const [nomesAnunciantes, setNomesAnunciantes] = useState<Record<string, string>>({})
  const [listaCorretoresFiltro, setListaCorretoresFiltro] = useState<{ id: string; nome: string }[]>([])

  // Estados de Modais
  const [modalNovoImovelAberto, setModalNovoImovelAberto] = useState(false)
  const [modalLimiteAberto, setModalLimiteAberto] = useState(false)
  const [modalUpgradeAberto, setModalUpgradeAberto] = useState(false)
  const [modalSegurancaAberto, setModalSegurancaAberto] = useState(false)
  const [modalConfiguracoesAberto, setModalConfiguracoesAberto] = useState(false)
  const [planoAlvoUpgrade, setPlanoAlvoUpgrade] = useState<Plano | null>(null)
  const [usuarioTelefone, setUsuarioTelefone] = useState('')
  const [ultimoEventoChat, setUltimoEventoChat] = useState<any>(null)

  // Estado da Sidebar Lateral (Fixa ou Recolhida)
  const [sidebarFixa, setSidebarFixa] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const salvo = localStorage.getItem('fixum_sidebar_fixa')
      return salvo !== null ? salvo === 'true' : true
    }
    return true
  })

  function alternarSidebar() {
    setSidebarFixa((prev) => {
      const proximo = !prev
      if (typeof window !== 'undefined') {
        localStorage.setItem('fixum_sidebar_fixa', String(proximo))
      }
      return proximo
    })
  }

  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    if (searchParams.get('novo') === '1') {
      setModalNovoImovelAberto(true)
    }
  }, [searchParams])

  useEffect(() => {
    if (abaParam && ['dashboard', 'imoveis', 'leads', 'corretores', 'desempenho', 'plano'].includes(abaParam)) {
      if (abaParam === 'plano' && isCorretor && imobiliariaDona) {
        setAbaAtiva('dashboard')
      } else {
        setAbaAtiva(abaParam)
      }
    }
  }, [abaParam, isCorretor, imobiliariaDona])

  function trocarAba(novaAba: Aba) {
    setAbaAtiva(novaAba)
    router.replace(`/painel?aba=${novaAba}`)
  }

  const [isAdminRedirecionando, setIsAdminRedirecionando] = useState(false)

  const carregarDados = useCallback(async (silencioso = false) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { window.location.href = '/login'; return }
    setUsuarioId(user.id)
    setUsuarioEmail(user.email ?? '')

    const { data: perfil } = await supabase
      .from('perfis')
      .select('id, nome, tipo, telefone, creci, plano_id, is_admin')
      .eq('id', user.id)
      .maybeSingle()

    const meta = user.user_metadata || {}
    const ehAdmin = perfil?.is_admin === true || perfil?.tipo === 'admin' || meta?.tipo === 'admin' || user.email === 'admin@fixum.com.br'

    // ── PROTEÇÃO DE ACESSO: Administrador Master não acessa painel de anúncios de imóveis ──
    if (ehAdmin) {
      setIsAdminRedirecionando(true)
      router.replace('/admin')
      return
    }

    const searchTipo = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('tipo') : null
    const metaTipo = perfil?.tipo || meta.tipo || searchTipo || 'proprietario'
    const imobId = meta.imobiliaria_id || null

    const nomeFinal = perfil?.nome || meta.full_name || meta.name || meta.nome || user.email?.split('@')[0] || 'Anunciante'
    setUsuarioNome(nomeFinal)
    setUsuarioCreci(perfil?.creci || meta?.creci || '')

    const tipoFinal = (perfil?.tipo || metaTipo || 'proprietario') as 'proprietario' | 'corretor' | 'imobiliaria'
    setTipoAnunciante(tipoFinal)

    if (!perfil || !perfil.tipo) {
      await supabase.from('perfis').upsert({
        id: user.id,
        nome: nomeFinal,
        email: user.email!,
        tipo: tipoFinal,
        telefone: meta.telefone || null,
        creci: meta.creci || null,
      })
    }

    setUsuarioTelefone(perfil?.telefone || meta?.telefone || '')

    const ehImob = tipoFinal === 'imobiliaria'
    const ehCorretorVinculado = !!imobId
    const ehCorretor = tipoFinal === 'corretor' || ehCorretorVinculado

    setIsImobiliaria(ehImob)
    setIsCorretor(ehCorretor)

    if (imobId) {
      const { data: imobData } = await supabase
        .from('perfis')
        .select('id, nome')
        .eq('id', imobId)
        .maybeSingle()
      if (imobData) {
        setImobiliariaDona(imobData)
      }
    }

    // ── CARREGAMENTO DE IMÓVEIS, LEADS E EQUIPE VIA API SEGURA ──
    try {
      const resPainel = await fetch(`/api/painel/imoveis?usuario_id=${user.id}`)
      const jsonPainel = await resPainel.json()
      if (jsonPainel?.imoveis) {
        setImoveis(jsonPainel.imoveis)
        setLeads(jsonPainel.leads || [])
        setNomesAnunciantes(jsonPainel.mapaNomes || {})
        setListaCorretoresFiltro(jsonPainel.listaCorretores || [])
        if (typeof jsonPainel.isGestor === 'boolean') setIsGestor(jsonPainel.isGestor)
        if (typeof jsonPainel.podeExcluir === 'boolean') setPodeExcluir(jsonPainel.podeExcluir)
      }
    } catch (err) {
      console.error('Erro ao buscar dados do painel:', err)
    }

    // ── CARREGAMENTO DE ASSINATURA E COTA VIA API SEGURA ──
    try {
      const resCota = await fetch(`/api/painel/cota?usuario_id=${user.id}`)
      const jsonCota = await resCota.json()
      if (jsonCota?.assinatura) {
        setAssinatura(jsonCota.assinatura)
      } else if (jsonCota?.plano?.id) {
        setAssinatura({
          id: 'cota_' + jsonCota.plano.id,
          usuario_id: imobId || user.id,
          plano_id: jsonCota.plano.id,
          status: 'ativo',
          data_inicio: new Date().toISOString(),
          metodo_pagamento: 'pix',
          created_at: new Date().toISOString(),
        })
      }
    } catch (e) {
      console.error('Erro ao buscar cota e assinatura:', e)
    }

    // ── CARREGAMENTO DE FATURAS (Imobiliárias e Corretores Autônomos Titulares) ──
    const ehTitularCobranca = ehImob || !imobId
    if (ehTitularCobranca) {
      try {
        const { data: faturasData } = await supabase
          .from('faturas')
          .select('*')
          .eq('usuario_id', user.id)
          .order('created_at', { ascending: false })
        if (faturasData) {
          setFaturas(faturasData as Fatura[])
        }
      } catch (err) {
        console.error('Erro ao buscar faturas:', err)
      }
    }

    if (!silencioso) setCarregando(false)
  }, [supabase])

  useEffect(() => {
    carregarDados()
  }, [carregarDados])

  // ── INSCRIÇÃO EM TEMPO REAL (SUPABASE REALTIME) ──
  useEffect(() => {
    if (!usuarioId) return

    const canalNome = `painel-realtime-global`
    const canalPainel = supabase
      .channel(canalNome)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'imoveis' },
        () => {
          carregarDados(true)
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'leads' },
        (payload: any) => {
          console.log('[REALTIME-PAINEL] Lead atualizado/inserido:', payload)
          carregarDados(true)
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'fotos_imovel' },
        () => {
          carregarDados(true)
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notificacoes' },
        () => {
          carregarDados(true)
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'historico_revisao_imoveis' },
        (payload: any) => {
          console.log('[REALTIME-PAINEL] Nova msg historico_revisao_imoveis:', payload)
          setUltimoEventoChat(payload.new)
        }
      )
      .subscribe((status: string) => {
        console.log('[REALTIME-PAINEL] Status do canal:', status)
      })

    return () => {
      supabase.removeChannel(canalPainel)
    }
  }, [usuarioId, supabase, carregarDados])

  const stats = {
    total: imoveis.length,
    publicados: imoveis.filter((i) => i.status === 'publicado' || i.status === 'ativo').length,
    pausados: imoveis.filter((i) => i.status === 'pausado').length,
    leadsNovos: leads.filter((l) => l.status === 'novo').length,
  }

  const usoPlano = calcularUsoPlano(
    assinatura?.plano_id || 'gratis',
    stats.publicados,
    stats.pausados,
    assinatura || undefined
  )

  const proximoPlano = obterProximoPlano(usoPlano.plano.id)

  async function alterarStatus(id: string, novoStatus: string) {
    // Se está tentando publicar/ativar, checa se atingiu o limite do plano
    if ((novoStatus === 'publicado' || novoStatus === 'ativo') && usoPlano.atingiuLimite) {
      if (isCorretor) {
        await alertar({
          titulo: 'Cota corporativa atingida',
          mensagem: `A cota de anúncios ativos da imobiliária ${imobiliariaDona?.nome ? `"${imobiliariaDona.nome}"` : 'vinculada'} atingiu o limite (${usoPlano.limiteMaximo} anúncios). Entre em contato com o administrador da sua imobiliária para solicitar novas vagas.`,
          icone: 'predio',
          tipo: 'aviso',
        })
        return
      }
      setModalLimiteAberto(true)
      return
    }

    const statusNormalizado = (novoStatus === 'publicado' || novoStatus === 'ativo') ? 'ativo' : (novoStatus === 'em_analise' || novoStatus === 'rascunho') ? 'rascunho' : novoStatus

    await supabase.from('imoveis').update({ status: statusNormalizado }).eq('id', id)
    setImoveis((prev) => prev.map((i) => i.id === id ? { ...i, status: statusNormalizado as Imovel['status'] } : i))
  }

  async function excluirImovel(id: string, titulo: string) {
    if (!podeExcluir) {
      await alertar({
        titulo: 'Ação não permitida',
        mensagem: 'Apenas gestores da imobiliária têm permissão para excluir anúncios. Se você não deseja mais divulgar este imóvel, solicite ao seu gestor ou pause o anúncio.',
        icone: 'cadeado',
        tipo: 'aviso',
      })
      return
    }

    const confirmou = await confirmar({
      titulo: 'Excluir anúncio?',
      mensagem: `Tem certeza que deseja excluir permanentemente o anúncio "${titulo}"? Esta ação não pode ser desfeita.`,
      icone: 'lixeira',
      textoBotaoConfirmar: 'Sim, Excluir Anúncio',
      tipo: 'perigo',
      destrutivo: true,
    })
    if (!confirmou) return

    try {
      const res = await fetch('/api/painel/imoveis/acoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          acao: 'excluir_lote',
          imoveisIds: [id],
          usuarioId,
        }),
      })

      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erro ao excluir imóvel.')

      setImoveis((prev) => prev.filter((i) => i.id !== id))
      await alertar({
        titulo: 'Imóvel excluído',
        mensagem: 'O anúncio foi removido com sucesso.',
        icone: 'lixeira',
        tipo: 'info',
      })
    } catch (err: any) {
      console.error('Erro ao excluir imóvel:', err)
      await alertar({
        titulo: 'Erro ao excluir',
        mensagem: err.message || 'Não foi possível excluir o anúncio. Tente novamente mais tarde.',
        tipo: 'perigo',
      })
    }
  }


  async function handleAtualizarAssinatura(novoPlano: Plano, metodo: MetodoPagamento) {
    if (!usuarioId) return

    try {
      // 1. Tenta atualizar ou criar no Supabase
      const { data: assData } = await supabase
        .from('assinaturas')
        .upsert(
          {
            usuario_id: usuarioId,
            plano_id: novoPlano.id,
            status: 'ativo',
            metodo_pagamento: metodo,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'usuario_id' }
        )
        .select()
        .single()

      if (assData) {
        setAssinatura(assData as Assinatura)
      } else {
        // Fallback local se tabela ainda não existir no Supabase
        setAssinatura({
          id: 'local_' + novoPlano.id,
          usuario_id: usuarioId,
          plano_id: novoPlano.id,
          status: 'ativo',
          data_inicio: new Date().toISOString(),
          metodo_pagamento: metodo,
          created_at: new Date().toISOString(),
        })
      }

      // 2. Se for plano pago, registrar fatura paga
      if (novoPlano.preco_mensal > 0) {
        const novaFatura: Partial<Fatura> = {
          usuario_id: usuarioId,
          valor: novoPlano.preco_mensal,
          status: 'pago',
          metodo_pagamento: metodo,
          data_vencimento: new Date().toISOString(),
          data_pagamento: new Date().toISOString(),
        }

        try {
          const { data: fatData } = await supabase.from('faturas').insert(novaFatura).select().single()
          if (fatData) {
            setFaturas((prev) => [fatData as Fatura, ...prev])
          } else {
            setFaturas((prev) => [{ ...novaFatura, id: 'fat_' + Date.now(), created_at: new Date().toISOString() } as Fatura, ...prev])
          }
        } catch {
          setFaturas((prev) => [{ ...novaFatura, id: 'fat_' + Date.now(), created_at: new Date().toISOString() } as Fatura, ...prev])
        }
      }
    } catch (err) {
      console.error('Erro na assinatura:', err)
      throw err
    }
  }

  function dispararUpgrade(plano?: Plano) {
    setPlanoAlvoUpgrade(plano || proximoPlano || usoPlano.plano)
    setModalUpgradeAberto(true)
  }


  async function handleSair() {
    const confirmou = await confirmar({
      titulo: 'Encerrar sessão?',
      mensagem: 'Deseja realmente sair da sua conta na Fixum?',
      icone: 'sair',
      textoBotaoConfirmar: 'Sim, Sair',
      tipo: 'aviso',
    })
    if (!confirmou) return
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  if (isAdminRedirecionando) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: '#16201C',
        color: '#ffffff',
        gap: '16px',
      }}>
        <div style={{ fontSize: '2.5rem' }}><Icone nome="escudo" tamanho={34} /></div>
        <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>Redirecionando para o painel executivo Fixum...</div>
        <div style={{ fontSize: '0.875rem', color: '#A39A8A' }}>Contas Master não utilizam o painel de anunciante</div>
      </div>
    )
  }

  if (carregando) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#16201C', color: '#ffffff' }}>
        <div>Carregando workspace...</div>
      </div>
    )
  }

  return (
    <div className={styles.workspaceWrapper}>
      {/* ── TOPBAR CORPORATIVO DO PAINEL ── */}
      <header className={styles.topbar}>
        <div className={styles.topbarEsquerda}>
          <Link
            href="/explorar"
            className={styles.logoPainel}
            title="Voltar ao mapa"
          >
            <Logotipo largura={76} />
            <span className={styles.badgePro}>Painel</span>
          </Link>

          <div className={styles.divisorVertical} />

          <div
            className={styles.usuarioPerfilTopbar}
            title={`${usuarioNome || 'Usuário'}${usuarioEmail ? ` • ${usuarioEmail}` : ''}`}
          >
            <div
              className={styles.usuarioAvatar}
              style={{ background: obterGradienteUsuario(usuarioId || usuarioEmail || usuarioNome) }}
            >
              {obterIniciaisUsuario(usuarioNome, usuarioEmail)}
            </div>
            <div className={styles.empresaInfo}>
              <span className={styles.empresaNome}>{usuarioNome || 'Usuário'}</span>
              <span className={styles.empresaTipo}>
                {isImobiliaria
                  ? 'Gestão imobiliária'
                  : isCorretorEquipe && imobiliariaDona
                    ? `Corretor Oficial — ${imobiliariaDona.nome}`
                    : isCorretorAutonomo
                      ? `Corretor Autônomo${usuarioCreci ? ` • CRECI ${usuarioCreci}` : ''}`
                      : 'Proprietário Direto'}
              </span>
            </div>
          </div>
        </div>

        <div className={styles.topbarDireita}>
          {/* Badge do Topbar Adaptativa */}
          {isCorretorEquipe && imobiliariaDona ? (
            <div
              className={styles.badgePlanoTopbar}
              style={{ cursor: 'default', background: '#FAF7F1', borderColor: '#E0D8CA', color: '#5A5449' }}
              title={`Vinculado à equipe de ${imobiliariaDona.nome}`}
            >
              <span>Equipe <strong>{imobiliariaDona.nome}</strong></span>
            </div>
          ) : isCorretorAutonomo ? (
            <button
              type="button"
              className={styles.badgePlanoTopbar}
              onClick={() => trocarAba('plano')}
              title="Gerenciar cota de imóveis do corretor"
              style={{ background: '#EEF5F0', borderColor: '#C3DACB', color: '#24563E' }}
            >
              <span className={styles.iconePlano}><Icone nome="maleta" tamanho={16} /></span>
              <span>Cota: <strong>{usoPlano.imoveisAtivos}/{usoPlano.limiteMaximo >= 99999 ? '∞' : usoPlano.limiteMaximo}</strong></span>
              <span className={styles.vagasPill} style={{ background: '#2E6B4E' }}>
                {usoPlano.plano.nome}
              </span>
            </button>
          ) : isImobiliaria ? (
            <button
              type="button"
              className={styles.badgePlanoTopbar}
              onClick={() => trocarAba('plano')}
              title="Gerenciar plano & faturas da imobiliária"
            >
              <span className={styles.iconePlano}><Icone nome="predio" tamanho={16} /></span>
              <span>Plano <strong>{usoPlano.plano.nome}</strong></span>
              <span className={styles.vagasPill}>
                {usoPlano.imoveisAtivos}/{usoPlano.limiteMaximo >= 99999 ? '∞' : usoPlano.limiteMaximo} vagas
              </span>
            </button>
          ) : (
            <div
              className={styles.badgePlanoTopbar}
              style={{ cursor: 'default', background: '#EEF5F0', borderColor: '#C3DACB', color: '#24563E' }}
              title="Proprietário direto com 1 anúncio gratuito ativo no mapa Fixum"
            >
              <span><Icone nome="etiqueta" tamanho={16} /> <strong>1 Anúncio Grátis</strong></span>
            </div>
          )}

          {/* Notificações Corporativas */}
          <MenuNotificacoes
            usuarioId={usuarioId}
            imobiliariaId={imobiliariaDona?.id || (isImobiliaria ? usuarioId : undefined)}
            onClicarNotificacao={(notif) => {
              if (notif.tipo === 'revisao_pendente' || notif.tipo === 'imovel_aprovado' || notif.tipo === 'imovel_recusado') {
                trocarAba('imoveis')
              }
            }}
          />

          {/* Botão Novo Imóvel */}
          <button
            type="button"
            onClick={() => setModalNovoImovelAberto(true)}
            className={styles.btnNovoImovelTopbar}
            title="Cadastrar novo imóvel"
          >
            <span>+</span>
            <span className={styles.textoNovoDesktop}>Novo imóvel</span>
            <span className={styles.textoNovoMobile}>Imóvel</span>
          </button>

          {/* Menu Dropdown no Avatar do Usuário */}
          <MenuUsuarioTopbar
            usuarioId={usuarioId}
            usuarioNome={usuarioNome}
            usuarioEmail={usuarioEmail}
            tipoAnunciante={tipoAnunciante}
            creci={usuarioCreci}
            isImobiliaria={isImobiliaria}
            isCorretor={isCorretor}
            imobiliariaDona={imobiliariaDona}
            onAbrirConfiguracoes={() => setModalConfiguracoesAberto(true)}
            onAbrirSeguranca={() => setModalSegurancaAberto(true)}
            onSair={handleSair}
          />
        </div>
      </header>

      <div className={`${styles.painel} ${!sidebarFixa ? styles.painelRecolhido : ''}`}>
        {/* Sidebar */}
        <aside className={`${styles.sidebar} ${!sidebarFixa ? styles.sidebarRecolhida : ''}`}>
          <nav className={styles.sidebarNav}>
            {[
              { id: 'dashboard', icone: 'grafico', label: 'Dashboard', labelMobile: 'Início', badge: 0 },
              { id: 'imoveis', icone: 'predio', label: 'Meus imóveis', labelMobile: 'Imóveis', badge: 0 },
              { id: 'leads', icone: 'pessoas', label: 'Leads & CRM', labelMobile: 'Leads', badge: stats.leadsNovos },
              ...(isImobiliaria ? [{ id: 'corretores', icone: 'maleta', label: 'Equipe de corretores', labelMobile: 'Equipe', badge: 0 }] : []),
              ...(!isProprietario ? [{ id: 'desempenho', icone: 'tendencia', label: 'Desempenho & ranking', labelMobile: 'Ranking', badge: 0 }] : []),
              ...(!isCorretorEquipe ? [{ id: 'plano', icone: 'cartao', label: isProprietario ? 'Meu Anúncio' : 'Meu Plano', labelMobile: isProprietario ? 'Anúncio' : 'Plano', badge: 0 }] : []),
            ].map((item) => (
              <button
                key={item.id}
                className={`${styles.sidebarItem} ${abaAtiva === item.id ? styles.sidebarItemAtivo : ''}`}
                onClick={() => trocarAba(item.id as Aba)}
                title={item.label}
              >
                <div className={styles.sidebarIconeWrapper}>
                  <span className={styles.sidebarIcone}>{ehNomeIcone(item.icone) && <Icone nome={item.icone} tamanho={18} />}</span>
                  {item.badge > 0 && (
                    <span className={styles.badgeMicroFlutuante} title={`${item.badge} lead(s) novos aguardando ação`}>
                      {item.badge > 99 ? '99+' : item.badge}
                    </span>
                  )}
                </div>
                <span className={styles.sidebarTextoDesktop}>{item.label}</span>
                <span className={styles.sidebarTextoMobile}>{item.labelMobile}</span>
                {item.badge > 0 && (
                  <span className={styles.badgeSidebarPill} title={`${item.badge} lead(s) novos aguardando atendimento`}>
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                )}
              </button>
            ))}
          </nav>

          {/* Botão de Fixar / Recolher Menu Lateral */}
          <div className={styles.sidebarRodapeFixar}>
            <button
              type="button"
              className={styles.btnFixarSidebar}
              onClick={alternarSidebar}
              title={sidebarFixa ? 'Recolher menu lateral (mais espaço para o CRM)' : 'Fixar menu lateral expandido'}
            >
              <span className={styles.iconeFixar}>{sidebarFixa ? '◀' : '▶'}</span>
              <span className={styles.textoFixar}>{sidebarFixa ? 'Recolher menu' : 'Fixar'}</span>
            </button>
          </div>
        </aside>

        {/* Conteúdo */}
        <main className={styles.conteudo}>

          {/* ── DASHBOARD ── */}
          {abaAtiva === 'dashboard' && (
            <div className={styles.secao}>
              <h1>Olá, {usuarioNome}! </h1>
              <p className={styles.subtitulo}>
                {isProprietario
                  ? 'Acompanhe o desempenho do seu anúncio particular'
                  : 'Aqui está o resumo e desempenho da sua carteira de anúncios'}
              </p>

              {/* Card Adaptativo: Proprietário vs Corretor Autônomo / Imobiliária */}
              {isProprietario ? (
                <div className={styles.cardProprietarioBoasVindas}>
                  <div className={styles.proprietarioInfo}>
                    <div className={styles.proprietarioTag}>
                      <span>Anúncio particular</span>
                      <span className={styles.proprietarioStatusBadge}>
                        {stats.publicados > 0 ? '1 Imóvel ativo no mapa' : 'Nenhum imóvel publicado'}
                      </span>
                    </div>
                    <p className={styles.proprietarioDescricao}>
                      {stats.publicados > 0
                        ? 'Seu imóvel está anunciado e visível para milhares de compradores e locatários no mapa Fixum.'
                        : 'Você tem direito a 1 anúncio 100% gratuito para divulgar seu imóvel direto com interessados.'}
                    </p>
                  </div>
                  <div className={styles.proprietarioAcoes}>
                    {stats.total === 0 ? (
                      <button
                        className={`btn btn-primario btn-sm ${styles.btnPlanoAcao}`}
                        onClick={() => setModalNovoImovelAberto(true)}
                      >
 Publicar imóvel Grátis
 </button>
                    ) : (
                      <button
                        className={`btn btn-primario btn-sm ${styles.btnPlanoAcao}`}
                        onClick={() => trocarAba('imoveis')}
                      >
 Gerenciar meu anúncio
 </button>
                    )}
                    {proximoPlano && stats.total > 0 && (
                      <button
                        className={`btn btn-outline btn-sm ${styles.btnPlanoAcao}`}
                        onClick={() => dispararUpgrade(proximoPlano)}
                        title="Deseja anunciar outro imóvel ou aumentar seu limite?"
                      >
 Anunciar outro imóvel
 </button>
                    )}
                  </div>
                </div>
              ) : !isCorretorEquipe && (
                <div className={styles.cardPlanoResumo}>
                  <div className={styles.planoResumoInfo}>
                    <div className={styles.planoResumoBadgeContainer}>
                      <span className={styles.planoResumoTag}>
                        Plano {usoPlano.plano.nome}
                      </span>
                      <span className={styles.planoResumoContador}>
                        • {usoPlano.imoveisAtivos} de {usoPlano.limiteMaximo >= 99999 ? '∞' : usoPlano.limiteMaximo} anúncios ativos
                      </span>
                    </div>
                    <div className={styles.planoResumoBarraTrilho}>
                      <div
                        className={styles.planoResumoBarraPreenchimento}
                        style={{
                          width: `${Math.min(100, Math.max(5, usoPlano.porcentagemUso))}%`,
                          backgroundColor: usoPlano.atingiuLimite ? '#D4401F' : '#16201C',
                        }}
                      />
                    </div>
                  </div>

                  <div className={styles.planoResumoAcoes}>
                    {proximoPlano && (
                      <button
                        className={`btn btn-primario btn-sm ${styles.btnPlanoAcao}`}
                        onClick={() => dispararUpgrade(proximoPlano)}
                      >
 Fazer upgrade
 </button>
                    )}
                    <button
                      className={`btn btn-outline btn-sm ${styles.btnPlanoAcao}`}
                      onClick={() => trocarAba('plano')}
                    >
                      Ver detalhes do plano
                    </button>
                  </div>
                </div>
              )}

              <div className={styles.gridStats}>
                {[
                  { label: 'Total de imóveis', valor: stats.total, icone: 'predio', cor: '#16201C' },
                  { label: 'Publicados', valor: stats.publicados, icone: 'check', cor: '#3F8A66' },
                  { label: 'Pausados', valor: stats.pausados, icone: 'pausa', cor: '#E3A72F' },
                  { label: 'Leads novos', valor: stats.leadsNovos, icone: 'pessoas', cor: '#D4401F' },
                ].map((s) => (
                  <div key={s.label} className={styles.statCard} style={{ borderTopColor: s.cor }}>
                    <span className={styles.statIcone}>{ehNomeIcone(s.icone) && <Icone nome={s.icone} tamanho={20} />}</span>
                    <strong className={styles.statValor}>{s.valor}</strong>
                    <span className={styles.statLabel}>{s.label}</span>
                  </div>
                ))}
              </div>

              {imoveis.length === 0 && (
                <div className={styles.vazio}>
                  <span><Icone nome="casa" tamanho={16} /></span>
                  <h3>Você ainda não tem imóveis cadastrados</h3>
                  <p>Comece anunciando seu primeiro imóvel. É rápido e gratuito!</p>
                  <button
                    type="button"
                    onClick={() => setModalNovoImovelAberto(true)}
                    className="btn btn-primario btn-lg"
                    style={{ cursor: 'pointer' }}
                  >
                    Anunciar meu primeiro imóvel
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── IMÓVEIS ── */}
          {abaAtiva === 'imoveis' && (
            <AbaImoveis
              imoveis={imoveis}
              leads={leads}
              usuarioId={usuarioId}
              usuarioNome={usuarioNome}
              isImobiliaria={isImobiliaria}
              isCorretor={isCorretor}
              podeExcluir={podeExcluir}
              imobiliariaDona={imobiliariaDona}
              nomesAnunciantes={nomesAnunciantes}
              listaCorretores={listaCorretoresFiltro}
              usoPlano={usoPlano}
              proximoPlano={proximoPlano}
              onAbrirModalNovo={() => setModalNovoImovelAberto(true)}
              onDispararUpgrade={(plano) => dispararUpgrade(plano)}
              onAlterarStatus={alterarStatus}
              onExcluirImovel={excluirImovel}
              onRecarregarDados={carregarDados}
              ultimoEventoChat={ultimoEventoChat}
            />
          )}

          {/* ── CRM DE LEADS & FUNIL DE VENDAS ── */}
          {abaAtiva === 'leads' && (
            <AbaLeads
              leads={leads}
              usuarioId={usuarioId}
              usuarioNome={usuarioNome}
              isGestor={isGestor}
              isImobiliaria={isImobiliaria}
              listaCorretores={listaCorretoresFiltro}
              onRecarregarDados={carregarDados}
              onAtualizarLeads={(novosLeads) => setLeads(novosLeads)}
            />
          )}

          {/* ── EQUIPE DE CORRETORES (APENAS GESTOR DA IMOBILIÁRIA) ── */}
          {abaAtiva === 'corretores' && isImobiliaria && (
            <AbaCorretores
              imobiliariaId={usuarioId}
              imobiliariaNome={usuarioNome}
            />
          )}

          {/* ── DESEMPENHO & RANKING (BI Fixum) ── */}
          {abaAtiva === 'desempenho' && (
            <AbaDesempenho
              leads={leads}
              imoveis={imoveis}
              usuarioId={usuarioId}
              usuarioNome={usuarioNome}
              isImobiliaria={isImobiliaria}
              isGestor={isGestor}
              isCorretor={isCorretor}
              isCorretorAutonomo={isCorretorAutonomo}
              isCorretorEquipe={isCorretorEquipe}
              listaCorretores={listaCorretoresFiltro}
              onNavegarAba={(aba) => trocarAba(aba as Aba)}
              onRecarregarDados={carregarDados}
            />
          )}

          {/* ── MEU PLANO (SEGREGAÇÃO DE PERMISSÕES) ── */}
          {abaAtiva === 'plano' && (
            isCorretor && imobiliariaDona ? (
              <div style={{
                background: '#ffffff',
                border: '1.5px solid #CFC6B6',
                borderRadius: '1rem',
                padding: '2.5rem 2rem',
                textAlign: 'center',
                maxWidth: '620px',
                margin: '2rem auto',
                boxShadow: '0 4px 20px rgba(22, 32, 28, 0.08)',
              }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}><Icone nome="maleta" tamanho={41} /></div>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#16201C', marginBottom: '0.5rem' }}>
                  Plano Corporativo — {imobiliariaDona.nome}
                </h2>
                <p style={{ color: '#7A7264', fontSize: '0.95rem', lineHeight: '1.5', marginBottom: '1.5rem' }}>
                  Sua conta de corretor está vinculada à cota corporativa oficial da <strong>{imobiliariaDona.nome}</strong>.
                  Todos os seus anúncios publicados utilizam as vagas contratadas pela empresa.
                </p>
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: '#EAE4D8',
                  border: '1.5px solid #A39A8A',
                  color: '#22302A',
                  padding: '10px 18px',
                  borderRadius: '10px',
                  fontWeight: 700,
                  fontSize: '0.95rem',
                }}>
 Cota da imobiliária: {usoPlano.imoveisAtivos} / {usoPlano.limiteMaximo >= 99999 ? '∞' : usoPlano.limiteMaximo} anúncios ativos
                </div>
                <p style={{ fontSize: '0.8rem', color: '#A39A8A', marginTop: '1.75rem' }}>
 Para solicitar ampliação de vagas ou alterações contratuais, consulte a administração da {imobiliariaDona.nome}.
                </p>
              </div>
            ) : (
              <AbaMeuPlano
                usoPlano={usoPlano}
                faturas={faturas}
                onAtualizarAssinatura={handleAtualizarAssinatura}
                usuarioId={usuarioId}
                usuarioNome={usuarioNome}
                usuarioEmail={usuarioEmail}
                usuarioTelefone={usuarioTelefone}
              />
            )
          )}
        </main>

        {/* Modal de Limite Atingido */}
        <ModalLimiteAtingido
          aberto={modalLimiteAberto}
          onFechar={() => setModalLimiteAberto(false)}
          planoAtual={usoPlano.plano}
          proximoPlano={proximoPlano}
          imoveisAtivos={usoPlano.imoveisAtivos}
          onFazerUpgrade={(plano) => dispararUpgrade(plano)}
          acaoTentada="reativar_imovel"
        />

        {/* Modal de Upgrade / Troca de Plano */}
        <ModalUpgradePlano
          aberto={modalUpgradeAberto}
          onFechar={() => setModalUpgradeAberto(false)}
          planoAtual={usoPlano.plano}
          planoSugerido={planoAlvoUpgrade}
          imoveisAtivos={usoPlano.imoveisAtivos}
          onConfirmarPlano={handleAtualizarAssinatura}
          usuarioId={usuarioId}
          usuarioNome={usuarioNome}
          usuarioEmail={usuarioEmail}
          usuarioTelefone={usuarioTelefone}
          dataInicioAssinatura={usoPlano.assinatura?.data_inicio}
          dataFimCiclo={usoPlano.assinatura?.data_fim_ciclo}
        />

        {/* Modal de Configurações de Segurança e 2FA */}
        <ModalConfigSeguranca
          aberto={modalSegurancaAberto}
          onFechar={() => setModalSegurancaAberto(false)}
          usuarioEmail={usuarioEmail}
        />

        {/* Modal de Configurações da Conta e Preferências de Códigos */}
        <ModalConfiguracoes
          aberto={modalConfiguracoesAberto}
          onFechar={() => setModalConfiguracoesAberto(false)}
          usuarioId={usuarioId}
          usuarioNome={usuarioNome}
          tipoAnuncianteAtual={tipoAnunciante}
          creciAtual={usuarioCreci}
          isImobiliaria={isImobiliaria}
          isCorretor={isCorretor}
          imobiliariaDona={imobiliariaDona}
          onRecarregarPerfil={() => carregarDados(true)}
        />

        {/* Modal de Cadastro de Novo Imóvel (com Workspace visível atrás) */}
        <ModalNovoImovel
          isOpen={modalNovoImovelAberto}
          onClose={() => setModalNovoImovelAberto(false)}
          onImovelCriado={() => carregarDados()}
        />
      </div>
    </div>
  )
}

export default function PainelPage() {
  return (
    <Suspense fallback={<div>Carregando painel...</div>}>
      <PainelConteudo />
    </Suspense>
  )
}
