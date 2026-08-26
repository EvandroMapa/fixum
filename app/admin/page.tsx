'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { PLANOS_OFICIAIS, formatarMoeda } from '@/lib/planos'
import { CONFIG_PADRAO } from '@/lib/constants'
import {
  isSessaoAdminValida,
  encerrarSessaoAdmin,
  isSessaoBloqueadaPorInatividade,
  bloquearTelaAdmin,
  registrarAtividadeAdmin,
} from '@/lib/admin-auth'
import {
  ClienteAdmin360,
  FaturaAdmin,
  CancelamentoAdmin,
  DevolucaoAdmin,
  ContestacaoAdmin,
  LogAuditoriaAdmin,
  CorretorEquipeItem,
  PeriodoAnalytics,
  calcularMetricasBI,
} from '@/lib/admin-service'
import { useConfirm } from '@/contexts/ModalConfirmacaoContext'

// Componentes Administrativos
import AbaAnalyticsRegional from '@/components/admin/AbaAnalyticsRegional'
import ModalDetalhesCliente from '@/components/admin/ModalDetalhesCliente'
import ModalEstornoFatura from '@/components/admin/ModalEstornoFatura'
import ModalBloqueioInatividade from '@/components/admin/ModalBloqueioInatividade'

import styles from './page.module.css'

type AbaAdmin = 'analytics' | 'clientes' | 'faturas' | 'operacoes' | 'imoveis' | 'auditoria' | 'configuracoes'
type SubAbaOperacoes = 'cancelamentos' | 'devolucoes' | 'contestacoes'

export default function AdminPage() {
  const router = useRouter()
  const { confirmar, alertar } = useConfirm()

  // ── ESTADOS DE NAVEGAÇÃO E SESSÃO ──
  const [abaAtiva, setAbaAtiva] = useState<AbaAdmin>('analytics')
  const [subAbaOperacoes, setSubAbaOperacoes] = useState<SubAbaOperacoes>('cancelamentos')
  const [carregando, setCarregando] = useState(true)
  const [usuarioAtual, setUsuarioAtual] = useState<any>(null)
  const [telaBloqueada, setTelaBloqueada] = useState(false)

  // ── ESTADOS DE FILTRO ANALYTICS / BI ──
  const [periodoAnalytics, setPeriodoAnalytics] = useState<PeriodoAnalytics>('30d')
  const [regiaoAnalytics, setRegiaoAnalytics] = useState<string>('todas')

  // ── ESTADOS DE DADOS ──
  const [clientes, setClientes] = useState<ClienteAdmin360[]>([])
  const [faturas, setFaturas] = useState<FaturaAdmin[]>([])
  const [cancelamentos, setCancelamentos] = useState<CancelamentoAdmin[]>([])
  const [devolucoes, setDevolucoes] = useState<DevolucaoAdmin[]>([])
  const [contestacoes, setContestacoes] = useState<ContestacaoAdmin[]>([])
  const [imoveis, setImoveis] = useState<any[]>([])
  const [logsAuditoria, setLogsAuditoria] = useState<LogAuditoriaAdmin[]>([])

  // ── ESTADOS DE BUSCA E FILTROS EM LISTAS ──
  const [busca, setBusca] = useState('')
  const [filtroTipoCliente, setFiltroTipoCliente] = useState<string>('comerciais')
  const [filtroStatusCliente, setFiltroStatusCliente] = useState<string>('todos')
  const [filtroStatusFatura, setFiltroStatusFatura] = useState<string>('todos')

  // ── MODAIS ──
  const [clienteSelecionado360, setClienteSelecionado360] = useState<ClienteAdmin360 | null>(null)
  const [faturaParaEstorno, setFaturaParaEstorno] = useState<FaturaAdmin | null>(null)

  // ── CONFIGURAÇÕES GLOBAIS ──
  const [whatsComercial, setWhatsComercial] = useState(CONFIG_PADRAO.WHATSAPP_COMERCIAL)
  const [whatsSuporte, setWhatsSuporte] = useState(CONFIG_PADRAO.WHATSAPP_SUPORTE)
  const [emailContato, setEmailContato] = useState(CONFIG_PADRAO.EMAIL_CONTATO)
  const [asaasApiKey, setAsaasApiKey] = useState('')
  const [asaasWebhookToken, setAsaasWebhookToken] = useState('')
  const [asaasModo, setAsaasModo] = useState<'producao' | 'sandbox'>('producao')
  const [mostrarApiKey, setMostrarApiKey] = useState(false)
  const [mostrarWebhookToken, setMostrarWebhookToken] = useState(false)
  const [testandoAsaas, setTestandoAsaas] = useState(false)
  const [statusAsaas, setStatusAsaas] = useState<{ ok: boolean; msg: string } | null>(null)
  const [salvandoConfig, setSalvandoConfig] = useState(false)
  const [msgConfig, setMsgConfig] = useState<string | null>(null)

  // ── MONITORAMENTO DE INATIVIDADE ──
  useEffect(() => {
    function registrarEvento() {
      registrarAtividadeAdmin()
    }
    window.addEventListener('mousemove', registrarEvento)
    window.addEventListener('keydown', registrarEvento)
    window.addEventListener('click', registrarEvento)

    const intervaloVerificacao = setInterval(() => {
      if (isSessaoBloqueadaPorInatividade()) {
        setTelaBloqueada(true)
      }
    }, 15000)

    return () => {
      window.removeEventListener('mousemove', registrarEvento)
      window.removeEventListener('keydown', registrarEvento)
      window.removeEventListener('click', registrarEvento)
      clearInterval(intervaloVerificacao)
    }
  }, [])

  // ── CARREGAMENTO GERAL DE DADOS VIA API SINCRONIZADA ──
  const carregarDadosAdmin = useCallback(async () => {
    if (!isSessaoAdminValida()) {
      router.push('/admin/login')
      return
    }

    setCarregando(true)
    const supabase = createClient()

    // 1. Validar usuário logado
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      encerrarSessaoAdmin()
      router.push('/admin/login')
      return
    }
    setUsuarioAtual(user)

    try {
      const res = await fetch('/api/admin/dados')
      if (!res.ok) {
        throw new Error('Falha ao carregar dados do admin')
      }

      const data = await res.json()

      setClientes(data.clientes || [])
      setFaturas(data.faturas || [])
      setCancelamentos(data.cancelamentos || [])
      setDevolucoes(data.devolucoes || [])
      setContestacoes(data.contestacoes || [])
      setImoveis(data.imoveis || [])
      setLogsAuditoria(data.logsAuditoria || [])

      if (data.configs) {
        data.configs.forEach((c: any) => {
          if (c.chave === 'whatsapp_comercial') setWhatsComercial(c.valor)
          if (c.chave === 'whatsapp_suporte') setWhatsSuporte(c.valor)
          if (c.chave === 'email_contato') setEmailContato(c.valor)
          if (c.chave === 'asaas_api_key') setAsaasApiKey(c.valor)
          if (c.chave === 'asaas_webhook_token') setAsaasWebhookToken(c.valor)
          if (c.chave === 'asaas_modo') setAsaasModo(c.valor as 'producao' | 'sandbox')
        })
      }
    } catch (err) {
      console.error('[ADMIN-LOAD-ERROR]:', err)
    } finally {
      setCarregando(false)
    }
  }, [router])

  useEffect(() => {
    carregarDadosAdmin()
  }, [carregarDadosAdmin])

  // Cidades Únicas Disponíveis para Filtro Regional (baseadas em Clientes Comerciais)
  const cidadesDisponiveis = useMemo(() => {
    const setCidades = new Set<string>()
    clientes.filter((c) => !c.is_corretor_vinculado).forEach((c) => {
      if (c.cidade && c.cidade.trim().length > 2) setCidades.add(c.cidade.trim())
    })
    imoveis.forEach((im) => {
      if (im.cidade && im.cidade.trim().length > 2) setCidades.add(im.cidade.trim())
    })
    return Array.from(setCidades).sort()
  }, [clientes, imoveis])

  // Métricas de BI e Analytics Calculadas
  const metricasBI = useMemo(() => {
    return calcularMetricasBI({
      clientes,
      faturas,
      cancelamentos,
      imoveis,
      regiaoSelecionada: regiaoAnalytics,
      periodoSelecionado: periodoAnalytics,
    })
  }, [clientes, faturas, cancelamentos, imoveis, regiaoAnalytics, periodoAnalytics])

  // ── AÇÕES ADMINISTRATIVAS (AUDITADAS) ──
  async function handleAtualizarPlanoCliente(clienteId: string, novoPlanoId: string, justificativa: string) {
    try {
      const res = await fetch('/api/admin/acao-auditada', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipoAcao: 'ALTERAR_PLANO_MANUAL',
          entidade: 'perfis',
          entidadeId: clienteId,
          dadosNovos: { plano_id: novoPlanoId },
          justificativa,
          adminPin: process.env.NEXT_PUBLIC_ADMIN_PIN || 'FIXUM-MASTER-2026',
          adminEmail: usuarioAtual?.email,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Falha ao alterar plano.')
      }

      await alertar({
        titulo: 'Plano Atualizado com Sucesso!',
        mensagem: `O plano da conta gestora foi alterado para "${PLANOS_OFICIAIS.find((p) => p.id === novoPlanoId)?.nome}" e o log de auditoria foi gravado.`,
        icone: '👑',
        tipo: 'sucesso',
      })

      setClienteSelecionado360(null)
      carregarDadosAdmin()
    } catch (err: any) {
      await alertar({
        titulo: 'Erro ao Atualizar Plano',
        mensagem: err?.message || 'Não foi possível alterar o plano.',
        icone: '⚠️',
        tipo: 'aviso',
      })
    }
  }

  async function handleAlterarStatusConta(clienteId: string, novoStatus: 'ativo' | 'suspenso', justificativa: string) {
    try {
      const res = await fetch('/api/admin/acao-auditada', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipoAcao: novoStatus === 'suspenso' ? 'SUSPENDER_CONTA' : 'REATIVAR_CONTA',
          entidade: 'perfis',
          entidadeId: clienteId,
          justificativa,
          adminPin: process.env.NEXT_PUBLIC_ADMIN_PIN || 'FIXUM-MASTER-2026',
          adminEmail: usuarioAtual?.email,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Falha ao alterar status da conta.')
      }

      await alertar({
        titulo: novoStatus === 'suspenso' ? 'Conta Suspensa' : 'Conta Reativada',
        mensagem: `Status da conta atualizado para "${novoStatus}". Operação registrada com sucesso.`,
        icone: novoStatus === 'suspenso' ? '🚫' : '✅',
        tipo: novoStatus === 'suspenso' ? 'aviso' : 'sucesso',
      })

      setClienteSelecionado360(null)
      carregarDadosAdmin()
    } catch (err: any) {
      await alertar({
        titulo: 'Erro na Operação',
        mensagem: err?.message || 'Falha ao processar.',
        icone: '⚠️',
        tipo: 'aviso',
      })
    }
  }

  async function handleSalvarNotasInternas(clienteId: string, notas: string) {
    await fetch('/api/admin/acao-auditada', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tipoAcao: 'SALVAR_NOTAS_CLIENTE',
        entidade: 'perfis',
        entidadeId: clienteId,
        dadosNovos: { notas_admin: notas },
        justificativa: 'Atualização de notas internas da equipe',
        adminPin: process.env.NEXT_PUBLIC_ADMIN_PIN || 'FIXUM-MASTER-2026',
        adminEmail: usuarioAtual?.email,
      }),
    })
    carregarDadosAdmin()
  }

  async function handleExecutarEstorno(dados: {
    faturaId: string
    usuarioId: string
    valor: number
    motivo: string
    tipoReembolso: string
    justificativa: string
    adminPin: string
  }) {
    const res = await fetch('/api/admin/estorno', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...dados,
        adminEmail: usuarioAtual?.email,
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      throw new Error(data.error || 'Falha ao processar estorno.')
    }

    await alertar({
      titulo: 'Devolução / Estorno Concluído!',
      mensagem: `O reembolso de ${formatarMoeda(dados.valor)} foi registrado com sucesso na fatura e na trilha de auditoria.`,
      icone: '↩️',
      tipo: 'sucesso',
    })

    setFaturaParaEstorno(null)
    carregarDadosAdmin()
  }

  // Ação de Marcar Pagamento Manual
  async function handleMarcarPagoManual(fatura: FaturaAdmin) {
    const confirmou = await confirmar({
      titulo: 'Marcar Fatura como Paga Manualmente?',
      mensagem: `Confirma que recebeu o pagamento de ${formatarMoeda(fatura.valor)} referente a ${fatura.usuario_nome}? Esta operação ativará o plano do cliente e será registrada nos logs de auditoria.`,
      icone: '💰',
      textoBotaoConfirmar: 'Sim, Marcar como Paga',
      tipo: 'primario',
    })

    if (!confirmou) return

    const supabase = createClient()
    await supabase.from('faturas').update({
      status: 'pago',
      data_pagamento: new Date().toISOString(),
    }).eq('id', fatura.id)

    // Ativar assinatura
    if (fatura.plano_id) {
      await supabase.from('assinaturas').upsert(
        {
          usuario_id: fatura.usuario_id,
          plano_id: fatura.plano_id,
          status: 'ativo',
          metodo_pagamento: fatura.metodo_pagamento,
          data_inicio: new Date().toISOString(),
        },
        { onConflict: 'usuario_id' }
      )
      await supabase.from('perfis').update({ plano_id: fatura.plano_id }).eq('id', fatura.usuario_id)
    }

    await alertar({
      titulo: 'Fatura Quitada!',
      mensagem: 'A fatura foi confirmada como paga e o plano do anunciante foi ativado.',
      icone: '✅',
      tipo: 'sucesso',
    })

    carregarDadosAdmin()
  }

  // Moderação de Imóveis: Alternar Destaque
  async function handleToggleDestaque(id: string, destaqueAtual: boolean) {
    const supabase = createClient()
    const novoDestaque = !destaqueAtual

    setImoveis((prev) =>
      prev.map((i) => (i.id === id ? { ...i, destaque: novoDestaque } : i))
    )

    await supabase.from('imoveis').update({ destaque: novoDestaque }).eq('id', id)
  }

  // Moderação de Imóveis: Pausar/Ativar
  async function handleToggleStatusImovel(id: string, statusAtual: string) {
    const supabase = createClient()
    const novoStatus = statusAtual === 'ativo' ? 'pausado' : 'ativo'

    setImoveis((prev) =>
      prev.map((i) => (i.id === id ? { ...i, status: novoStatus } : i))
    )

    await supabase.from('imoveis').update({ status: novoStatus }).eq('id', id)
  }

  // Moderação de Imóveis: Excluir Anúncio
  async function handleExcluirImovel(id: string, titulo: string) {
    const confirmou = await confirmar({
      titulo: 'Remover Anúncio da Plataforma?',
      mensagem: `Tem certeza que deseja remover o anúncio "${titulo}" como Administrador?`,
      icone: '🗑️',
      textoBotaoConfirmar: 'Sim, Remover',
      tipo: 'perigo',
      destrutivo: true,
    })
    if (!confirmou) return

    const supabase = createClient()
    setImoveis((prev) => prev.filter((i) => i.id !== id))
    await supabase.from('imoveis').delete().eq('id', id)
  }

  // Testar Conexão com o Asaas
  async function handleTestarAsaas() {
    if (!asaasApiKey.trim()) {
      setStatusAsaas({ ok: false, msg: 'Informe a Chave de API do Asaas para testar.' })
      return
    }

    setTestandoAsaas(true)
    setStatusAsaas(null)

    try {
      const res = await fetch('/api/admin/asaas/testar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: asaasApiKey.trim(),
          modo: asaasModo,
        }),
      })

      const data = await res.json()

      if (!res.ok || !data.sucesso) {
        setStatusAsaas({ ok: false, msg: data.error || 'Falha ao autenticar no Asaas.' })
      } else {
        setStatusAsaas({ ok: true, msg: data.mensagem || 'Conexão com o Asaas validada com sucesso!' })
        carregarDadosAdmin()
      }
    } catch (err: any) {
      setStatusAsaas({ ok: false, msg: err?.message || 'Erro ao conectar ao Asaas.' })
    } finally {
      setTestandoAsaas(false)
    }
  }

  // Salvar Configurações Globais
  async function handleSalvarConfig(e: React.FormEvent) {
    e.preventDefault()
    setSalvandoConfig(true)
    setMsgConfig(null)

    const supabase = createClient()
    const { error } = await supabase.from('configuracoes_sistema').upsert([
      { chave: 'whatsapp_comercial', valor: whatsComercial, descricao: 'WhatsApp comercial Fixum' },
      { chave: 'whatsapp_suporte', valor: whatsSuporte, descricao: 'WhatsApp suporte Fixum' },
      { chave: 'email_contato', valor: emailContato, descricao: 'E-mail de contato Fixum' },
      { chave: 'asaas_api_key', valor: asaasApiKey.trim(), descricao: 'Chave de API do Asaas' },
      { chave: 'asaas_webhook_token', valor: asaasWebhookToken.trim(), descricao: 'Token de autenticação do Webhook Asaas' },
      { chave: 'asaas_modo', valor: asaasModo, descricao: 'Ambiente do Asaas (producao/sandbox)' },
    ], { onConflict: 'chave' })

    setSalvandoConfig(false)
    if (error) {
      setMsgConfig('⚠️ As configurações foram salvas em memória.')
    } else {
      setMsgConfig('✅ Configurações, Chave de API e Token do Webhook salvos com sucesso no banco de dados!')
    }
  }

  function handleLogoutAdmin() {
    encerrarSessaoAdmin()
    router.push('/admin/login')
  }

  // ── FILTRAGEM DE CLIENTES (COM FOCO EM CLIENTES COMERCIAIS) ──
  const clientesFiltrados = useMemo(() => {
    return clientes.filter((c) => {
      const matchBusca =
        c.nome.toLowerCase().includes(busca.toLowerCase()) ||
        c.email.toLowerCase().includes(busca.toLowerCase()) ||
        (c.cpf_cnpj || '').includes(busca) ||
        (c.creci || '').toLowerCase().includes(busca.toLowerCase()) ||
        (c.cidade || '').toLowerCase().includes(busca.toLowerCase()) ||
        (c.imobiliaria_nome || '').toLowerCase().includes(busca.toLowerCase())

      let matchTipo = true
      if (filtroTipoCliente === 'comerciais') {
        // Padrão: Apenas quem tem relação comercial direta (Imobiliárias, Autônomos e Proprietários)
        matchTipo = !c.is_corretor_vinculado
      } else if (filtroTipoCliente === 'imobiliarias') {
        matchTipo = c.tipo_anunciante === 'imobiliaria'
      } else if (filtroTipoCliente === 'autonomos') {
        matchTipo = c.tipo_anunciante === 'corretor' && !c.is_corretor_vinculado
      } else if (filtroTipoCliente === 'proprietarios') {
        matchTipo = c.tipo_anunciante === 'proprietario'
      } else if (filtroTipoCliente === 'equipe_interna') {
        matchTipo = c.is_corretor_vinculado
      } else if (filtroTipoCliente === 'todos') {
        matchTipo = true
      }

      const matchStatus = filtroStatusCliente === 'todos' || c.status_conta === filtroStatusCliente

      return matchBusca && matchTipo && matchStatus
    })
  }, [clientes, busca, filtroTipoCliente, filtroStatusCliente])

  // ── FILTRAGEM DE FATURAS ──
  const faturasFiltradas = useMemo(() => {
    return faturas.filter((f) => {
      const matchBusca =
        f.usuario_nome.toLowerCase().includes(busca.toLowerCase()) ||
        f.usuario_email.toLowerCase().includes(busca.toLowerCase()) ||
        (f.asaas_payment_id || '').toLowerCase().includes(busca.toLowerCase()) ||
        f.id.includes(busca)

      const matchStatus = filtroStatusFatura === 'todos' || f.status === filtroStatusFatura

      return matchBusca && matchStatus
    })
  }, [faturas, busca, filtroStatusFatura])

  // ── FILTRAGEM DE IMÓVEIS ──
  const imoveisFiltrados = useMemo(() => {
    return imoveis.filter((i) => {
      return (
        i.titulo.toLowerCase().includes(busca.toLowerCase()) ||
        i.cidade.toLowerCase().includes(busca.toLowerCase()) ||
        i.bairro.toLowerCase().includes(busca.toLowerCase()) ||
        i.anunciante_nome.toLowerCase().includes(busca.toLowerCase()) ||
        (i.cadastrado_por_nome || '').toLowerCase().includes(busca.toLowerCase())
      )
    })
  }, [imoveis, busca])

  // Exportar Faturas em CSV
  function handleExportarFaturasCSV() {
    const cabecalho = 'ID,Cliente,Email,Plano,Valor,Metodo,Status,Vencimento,Pagamento\n'
    const linhas = faturasFiltradas.map((f) =>
      `"${f.id}","${f.usuario_nome}","${f.usuario_email}","${f.plano_nome}",${f.valor},"${f.metodo_pagamento}","${f.status}","${f.data_vencimento || ''}","${f.data_pagamento || ''}"`
    ).join('\n')

    const blob = new Blob([cabecalho + linhas], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', `fixum_faturas_${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className={styles.adminLayout}>
      {/* ── MODAL DE BLOQUEIO POR INATIVIDADE (LOCK SCREEN) ── */}
      {telaBloqueada && (
        <ModalBloqueioInatividade
          onDesbloqueado={() => setTelaBloqueada(false)}
          onEncerrarSessao={handleLogoutAdmin}
        />
      )}

      {/* ── MODAL DETALHES 360° DO CLIENTE ── */}
      {clienteSelecionado360 && (
        <ModalDetalhesCliente
          cliente={clienteSelecionado360}
          onFechar={() => setClienteSelecionado360(null)}
          onAtualizarPlano={handleAtualizarPlanoCliente}
          onAlterarStatusConta={handleAlterarStatusConta}
          onSalvarNotas={handleSalvarNotasInternas}
          onVerImoveis={(cid) => {
            setAbaAtiva('imoveis')
            const cli = clientes.find((c) => c.id === cid)
            if (cli) setBusca(cli.nome)
          }}
          onSelecionarOutroCliente={(outroId) => {
            const outroCli = clientes.find((c) => c.id === outroId)
            if (outroCli) setClienteSelecionado360(outroCli)
          }}
        />
      )}

      {/* ── MODAL DE ESTORNO / DEVOLUÇÃO ── */}
      {faturaParaEstorno && (
        <ModalEstornoFatura
          fatura={faturaParaEstorno}
          onFechar={() => setFaturaParaEstorno(null)}
          onConfirmarEstorno={handleExecutarEstorno}
        />
      )}

      {/* ── SIDEBAR EXECUTIVA BLINDADA ── */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <Link href="/" className={styles.logoAdmin}>
            <span style={{ fontSize: '1.4rem' }}>📍</span>
            <strong style={{ fontSize: '1.25rem', color: '#ffffff', letterSpacing: '-0.02em' }}>FIXUM</strong>
          </Link>
          <span className={styles.badgeAdmin}>Super Admin</span>
        </div>

        <nav className={styles.nav}>
          <button
            type="button"
            className={`${styles.navItem} ${abaAtiva === 'analytics' ? styles.navItemAtivo : ''}`}
            onClick={() => { setAbaAtiva('analytics'); setBusca('') }}
          >
            <span className={styles.navIcone}>📊</span>
            <span>Analytics & BI Regional</span>
          </button>

          <button
            type="button"
            className={`${styles.navItem} ${abaAtiva === 'clientes' ? styles.navItemAtivo : ''}`}
            onClick={() => { setAbaAtiva('clientes'); setBusca('') }}
          >
            <span className={styles.navIcone}>👥</span>
            <span>Clientes & Anunciantes ({clientes.filter(c => !c.is_corretor_vinculado).length})</span>
          </button>

          <button
            type="button"
            className={`${styles.navItem} ${abaAtiva === 'faturas' ? styles.navItemAtivo : ''}`}
            onClick={() => { setAbaAtiva('faturas'); setBusca('') }}
          >
            <span className={styles.navIcone}>💳</span>
            <span>Faturas & Cobranças ({faturas.length})</span>
          </button>

          <button
            type="button"
            className={`${styles.navItem} ${abaAtiva === 'operacoes' ? styles.navItemAtivo : ''}`}
            onClick={() => { setAbaAtiva('operacoes'); setBusca('') }}
          >
            <span className={styles.navIcone}>🔄</span>
            <span>Cancelamentos & Disputas</span>
            {contestacoes.length > 0 && <span className={styles.badgeAlertaNav}>{contestacoes.length}</span>}
          </button>

          <button
            type="button"
            className={`${styles.navItem} ${abaAtiva === 'imoveis' ? styles.navItemAtivo : ''}`}
            onClick={() => { setAbaAtiva('imoveis'); setBusca('') }}
          >
            <span className={styles.navIcone}>🏢</span>
            <span>Moderação de Imóveis ({imoveis.length})</span>
          </button>

          <button
            type="button"
            className={`${styles.navItem} ${abaAtiva === 'auditoria' ? styles.navItemAtivo : ''}`}
            onClick={() => { setAbaAtiva('auditoria'); setBusca('') }}
          >
            <span className={styles.navIcone}>📜</span>
            <span>Trilha de Auditoria</span>
          </button>

          <button
            type="button"
            className={`${styles.navItem} ${abaAtiva === 'configuracoes' ? styles.navItemAtivo : ''}`}
            onClick={() => { setAbaAtiva('configuracoes'); setBusca('') }}
          >
            <span className={styles.navIcone}>⚙️</span>
            <span>Configurações Globais</span>
          </button>
        </nav>

        <div className={styles.sidebarFooter}>
          <div className={styles.userPerfil}>
            <div className={styles.avatarMini}>🛡️</div>
            <div className={styles.userDados}>
              <span className={styles.userNome}>{usuarioAtual?.email || 'Administrador Master'}</span>
              <span className={styles.userRole}>Sessão Autenticada</span>
            </div>
          </div>
        </div>
      </aside>

      {/* ── CONTEÚDO PRINCIPAL ── */}
      <main className={styles.conteudoPrincipal}>
        {/* TOPBAR */}
        <header className={styles.topbar}>
          <h1 className={styles.topbarTitulo}>
            {abaAtiva === 'analytics' && '📊 Inteligência de Negócios & Analytics Regional'}
            {abaAtiva === 'clientes' && '👥 Gestão 360° de Clientes & Contas Comerciais'}
            {abaAtiva === 'faturas' && '💳 Faturas, Assinaturas & Receitas'}
            {abaAtiva === 'operacoes' && '🔄 Cancelamentos, Devoluções & Contestações (Chargebacks)'}
            {abaAtiva === 'imoveis' && '🏢 Moderação Global de Anúncios'}
            {abaAtiva === 'auditoria' && '📜 Trilha de Auditoria Imutável (Logs de Segurança)'}
            {abaAtiva === 'configuracoes' && '⚙️ Configurações & Parâmetros Fixum'}
          </h1>

          <div className={styles.topbarAcoes}>
            <button
              type="button"
              onClick={() => {
                bloquearTelaAdmin()
                setTelaBloqueada(true)
              }}
              className={styles.btnBloquearTela}
              title="Bloquear a tela com PIN Master"
            >
              🔒 Bloquear Tela
            </button>

            <Link href="/" className={styles.btnVoltarSite} target="_blank">
              🌐 Ver Portal
            </Link>

            <button
              type="button"
              onClick={handleLogoutAdmin}
              className={styles.btnSairAdmin}
            >
              Encerrar Sessão
            </button>
          </div>
        </header>

        <div className={styles.corpo}>
          {carregando ? (
            <div className={styles.carregando}>
              <div className={styles.spinner} />
              <span>Carregando dados executivos e inteligência da plataforma...</span>
            </div>
          ) : (
            <>
              {/* ── ABA 1: ANALYTICS & BI REGIONAL ── */}
              {abaAtiva === 'analytics' && (
                <AbaAnalyticsRegional
                  metricas={metricasBI}
                  periodo={periodoAnalytics}
                  setPeriodo={setPeriodoAnalytics}
                  regiao={regiaoAnalytics}
                  setRegiao={setRegiaoAnalytics}
                  cidadesDisponiveis={cidadesDisponiveis}
                />
              )}

              {/* ── ABA 2: GESTÃO 360° DE CLIENTES ── */}
              {abaAtiva === 'clientes' && (
                <div className={styles.painelBox}>
                  <div className={styles.painelHeader}>
                    <div className={styles.painelHeaderTitulos}>
                      <h2 className={styles.painelTitulo}>
                        👥 Base de Clientes ({clientesFiltrados.length})
                      </h2>
                      <span className={styles.painelSub}>
                        {filtroTipoCliente === 'comerciais'
                          ? 'Mostrando apenas clientes com relação comercial direta (Imobiliárias, Autônomos e Proprietários)'
                          : 'Visualização da carteira conforme o filtro selecionado'}
                      </span>
                    </div>

                    <div className={styles.linhaFiltrosTabela}>
                      <input
                        type="text"
                        placeholder="Buscar por nome, imobiliária, e-mail, CRECI, documento, cidade..."
                        value={busca}
                        onChange={(e) => setBusca(e.target.value)}
                        className={styles.campoBusca}
                      />

                      <select
                        value={filtroTipoCliente}
                        onChange={(e) => setFiltroTipoCliente(e.target.value)}
                        className={styles.selectFiltro}
                      >
                        <option value="comerciais">💼 Clientes Comerciais (Pagadores)</option>
                        <option value="imobiliarias">🏢 Apenas Imobiliárias (Gestoras)</option>
                        <option value="autonomos">👔 Apenas Corretores Autônomos</option>
                        <option value="proprietarios">👤 Apenas Proprietários</option>
                        <option value="equipe_interna">👥 Membros de Equipe (Corretores Vinculados)</option>
                        <option value="todos">🌐 Todos os Usuários Cadastrados</option>
                      </select>

                      <select
                        value={filtroStatusCliente}
                        onChange={(e) => setFiltroStatusCliente(e.target.value)}
                        className={styles.selectFiltro}
                      >
                        <option value="todos">Todos os Status</option>
                        <option value="ativo">Contas Ativas</option>
                        <option value="suspenso">Contas Suspensas</option>
                      </select>
                    </div>
                  </div>

                  <div className={styles.tabelaWrapper}>
                    <table className={styles.tabela}>
                      <thead>
                        <tr>
                          <th>Cliente / Razão Social</th>
                          <th>Contato</th>
                          <th>Região</th>
                          <th>Perfil / Relação Comercial</th>
                          <th>Plano Contratado</th>
                          <th>Total de Imóveis (Consolidado)</th>
                          <th>Total Pago</th>
                          <th>Status</th>
                          <th>Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {clientesFiltrados.map((cli) => (
                          <tr key={cli.id} className={styles.linhaClicavel} onClick={() => setClienteSelecionado360(cli)}>
                            <td>
                              <div>
                                <strong>{cli.nome}</strong>
                                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{cli.email}</div>
                              </div>
                            </td>
                            <td>{cli.telefone || cli.whatsapp || '—'}</td>
                            <td>{cli.cidade || '—'}</td>
                            <td>
                              {cli.tipo_anunciante === 'imobiliaria' ? (
                                <div>
                                  <span className={`${styles.badge} ${styles.badgeImobiliaria}`}>
                                    🏢 Imobiliária (Cliente Gestora)
                                  </span>
                                  <div style={{ fontSize: '0.72rem', color: '#38bdf8', marginTop: '2px' }}>
                                    {cli.corretores_equipe?.length || 0} corretor(es) na equipe
                                  </div>
                                </div>
                              ) : cli.is_corretor_vinculado ? (
                                <div>
                                  <span className={`${styles.badge} ${styles.badgeCorretor}`}>
                                    👔 Corretor de Equipe
                                  </span>
                                  <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '2px' }}>
                                    🏢 Equipe: {cli.imobiliaria_nome}
                                  </div>
                                </div>
                              ) : cli.tipo_anunciante === 'corretor' ? (
                                <span className={`${styles.badge} ${styles.badgeCorretor}`}>
                                  👔 Corretor Autônomo (Cliente Direto)
                                </span>
                              ) : (
                                <span className={`${styles.badge} ${styles.badgeProprietario}`}>
                                  👤 Proprietário
                                </span>
                              )}
                            </td>
                            <td>
                              <div>
                                <span className={styles.badgePlano}>
                                  {cli.plano_nome}
                                </span>
                                <div style={{ fontSize: '0.72rem', color: cli.is_corretor_vinculado ? '#38bdf8' : '#34d399', marginTop: '2px' }}>
                                  {cli.is_corretor_vinculado ? '🏢 Cota da Imobiliária' : `${formatarMoeda(cli.plano_preco)}/mês`}
                                </div>
                              </div>
                            </td>
                            <td>
                              <div>
                                <strong>{cli.total_imoveis}</strong> ({cli.imoveis_ativos} ativos)
                                {cli.tipo_anunciante === 'imobiliaria' && cli.imoveis_equipe > 0 && (
                                  <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '2px' }}>
                                    {cli.imoveis_diretos} diretos + {cli.imoveis_equipe} equipe
                                  </div>
                                )}
                              </div>
                            </td>
                            <td>
                              {cli.is_corretor_vinculado ? (
                                <span style={{ color: '#64748b', fontSize: '0.8rem' }}>— (Via Imobiliária)</span>
                              ) : (
                                <strong>{formatarMoeda(cli.valor_total_gasto)}</strong>
                              )}
                            </td>
                            <td>
                              <span className={`${styles.badge} ${cli.status_conta === 'ativo' ? styles.badgeAtivo : styles.badgeInativo}`}>
                                {cli.status_conta === 'ativo' ? 'Ativo' : 'Suspenso'}
                              </span>
                            </td>
                            <td>
                              <button
                                type="button"
                                className={styles.btnAcaoTabela}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setClienteSelecionado360(cli)
                                }}
                              >
                                Visão 360° →
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ── ABA 3: FATURAS & COBRANÇAS ── */}
              {abaAtiva === 'faturas' && (
                <div className={styles.painelBox}>
                  <div className={styles.painelHeader}>
                    <div className={styles.painelHeaderTitulos}>
                      <h2 className={styles.painelTitulo}>💳 Faturas & Cobranças ({faturasFiltradas.length})</h2>
                      <span className={styles.painelSub}>Acompanhamento de faturas PIX e Cartão de Crédito emitidas para os Clientes Comerciais</span>
                    </div>

                    <div className={styles.linhaFiltrosTabela}>
                      <input
                        type="text"
                        placeholder="Buscar por cliente, e-mail, ID ou Asaas..."
                        value={busca}
                        onChange={(e) => setBusca(e.target.value)}
                        className={styles.campoBusca}
                      />

                      <select
                        value={filtroStatusFatura}
                        onChange={(e) => setFiltroStatusFatura(e.target.value)}
                        className={styles.selectFiltro}
                      >
                        <option value="todos">Todos os Status</option>
                        <option value="pago">Pagas</option>
                        <option value="pendente">Pendentes</option>
                        <option value="atrasado">Atrasadas</option>
                        <option value="reembolsado">Reembolsadas / Estornadas</option>
                        <option value="em_disputa">Em Disputa (Chargeback)</option>
                      </select>

                      <button
                        type="button"
                        className={styles.btnExportarCSV}
                        onClick={handleExportarFaturasCSV}
                      >
                        📥 Exportar CSV
                      </button>
                    </div>
                  </div>

                  <div className={styles.tabelaWrapper}>
                    <table className={styles.tabela}>
                      <thead>
                        <tr>
                          <th>Cliente Responsável</th>
                          <th>Plano</th>
                          <th>Valor</th>
                          <th>Método</th>
                          <th>Vencimento / Pagamento</th>
                          <th>Status</th>
                          <th>Gateway Asaas</th>
                          <th>Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {faturasFiltradas.map((fat) => (
                          <tr key={fat.id}>
                            <td>
                              <div>
                                <strong>{fat.usuario_nome}</strong>
                                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{fat.usuario_email}</div>
                              </div>
                            </td>
                            <td>{fat.plano_nome}</td>
                            <td><strong className={styles.valorDestaqueVerde}>{formatarMoeda(fat.valor)}</strong></td>
                            <td>
                              <span className={fat.metodo_pagamento === 'pix' ? styles.tagPix : styles.tagCartao}>
                                {fat.metodo_pagamento === 'pix' ? '⚡ PIX' : '💳 Cartão'}
                              </span>
                            </td>
                            <td>
                              <div>
                                <div>Venc: {fat.data_vencimento ? new Date(fat.data_vencimento).toLocaleDateString('pt-BR') : '—'}</div>
                                {fat.data_pagamento && (
                                  <div style={{ fontSize: '0.75rem', color: '#34d399' }}>
                                    Pago: {new Date(fat.data_pagamento).toLocaleDateString('pt-BR')}
                                  </div>
                                )}
                              </div>
                            </td>
                            <td>
                              <span className={`${styles.badge} ${
                                fat.status === 'pago' ? styles.badgeAtivo :
                                fat.status === 'reembolsado' ? styles.badgeEstorno :
                                fat.status === 'em_disputa' ? styles.badgeDisputa :
                                fat.status === 'atrasado' ? styles.badgeInativo : styles.badgePendente
                              }`}>
                                {fat.status === 'pago' && 'Pago'}
                                {fat.status === 'pendente' && 'Aguardando'}
                                {fat.status === 'atrasado' && 'Atrasada'}
                                {fat.status === 'reembolsado' && '↩️ Reembolsado'}
                                {fat.status === 'em_disputa' && '⚠️ Disputa'}
                              </span>
                            </td>
                            <td>
                              {fat.asaas_invoice_url ? (
                                <a
                                  href={fat.asaas_invoice_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={styles.linkAsaas}
                                >
                                  Ver Fatura Asaas ↗
                                </a>
                              ) : (
                                <span style={{ color: '#64748b', fontSize: '0.75rem' }}>Manual / Interno</span>
                              )}
                            </td>
                            <td>
                              <div style={{ display: 'flex', gap: '6px' }}>
                                {fat.status === 'pendente' && (
                                  <button
                                    type="button"
                                    className={styles.btnAcaoTabelaVerde}
                                    onClick={() => handleMarcarPagoManual(fat)}
                                  >
                                    Confirmar Pgto
                                  </button>
                                )}
                                {fat.status === 'pago' && (
                                  <button
                                    type="button"
                                    className={styles.btnAcaoTabelaVermelho}
                                    onClick={() => setFaturaParaEstorno(fat)}
                                  >
                                    ↩️ Estornar
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ── ABA 4: CANCELAMENTOS, DEVOLUÇÕES & CONTESTAÇÕES ── */}
              {abaAtiva === 'operacoes' && (
                <div className={styles.painelBox}>
                  {/* Seletor de Sub-Abas */}
                  <div className={styles.subAbasNav}>
                    <button
                      type="button"
                      className={`${styles.subAbaBtn} ${subAbaOperacoes === 'cancelamentos' ? styles.subAbaAtiva : ''}`}
                      onClick={() => setSubAbaOperacoes('cancelamentos')}
                    >
                      🚪 Cancelamentos de Assinatura ({cancelamentos.length})
                    </button>
                    <button
                      type="button"
                      className={`${styles.subAbaBtn} ${subAbaOperacoes === 'devolucoes' ? styles.subAbaAtiva : ''}`}
                      onClick={() => setSubAbaOperacoes('devolucoes')}
                    >
                      ↩️ Devoluções & Estornos ({devolucoes.length})
                    </button>
                    <button
                      type="button"
                      className={`${styles.subAbaBtn} ${subAbaOperacoes === 'contestacoes' ? styles.subAbaAtiva : ''}`}
                      onClick={() => setSubAbaOperacoes('contestacoes')}
                    >
                      ⚠️ Contestações & Chargebacks ({contestacoes.length})
                    </button>
                  </div>

                  {/* Sub-Aba 1: Cancelamentos */}
                  {subAbaOperacoes === 'cancelamentos' && (
                    <div>
                      <div className={styles.painelHeader}>
                        <h3 className={styles.painelTitulo}>Histórico de Assinaturas Rescindidas</h3>
                      </div>
                      <div className={styles.tabelaWrapper}>
                        <table className={styles.tabela}>
                          <thead>
                            <tr>
                              <th>Cliente Responsável</th>
                              <th>Plano Rescindido</th>
                              <th>Valor Mensal</th>
                              <th>Motivo Declarado</th>
                              <th>Data do Cancelamento</th>
                            </tr>
                          </thead>
                          <tbody>
                            {cancelamentos.map((c) => (
                              <tr key={c.id}>
                                <td>
                                  <strong>{c.usuario_nome}</strong>
                                  <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{c.usuario_email}</div>
                                </td>
                                <td>{c.plano_nome}</td>
                                <td>{formatarMoeda(c.valor_plano)}/mês</td>
                                <td><span className={styles.tagMotivo}>{c.motivo_cancelamento}</span></td>
                                <td>{c.cancelado_em ? new Date(c.cancelado_em).toLocaleDateString('pt-BR') : '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Sub-Aba 2: Devoluções */}
                  {subAbaOperacoes === 'devolucoes' && (
                    <div>
                      <div className={styles.painelHeader}>
                        <h3 className={styles.painelTitulo}>Histórico de Reembolsos e Estornos Concluídos</h3>
                      </div>
                      <div className={styles.tabelaWrapper}>
                        <table className={styles.tabela}>
                          <thead>
                            <tr>
                              <th>Cliente</th>
                              <th>Valor Devolvido</th>
                              <th>Motivo</th>
                              <th>Canal</th>
                              <th>Data da Devolução</th>
                            </tr>
                          </thead>
                          <tbody>
                            {devolucoes.map((d) => (
                              <tr key={d.id}>
                                <td>
                                  <strong>{d.usuario_nome}</strong>
                                  <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{d.usuario_email}</div>
                                </td>
                                <td><strong className={styles.valorDestaqueVermelho}>{formatarMoeda(d.valor)}</strong></td>
                                <td>{d.motivo}</td>
                                <td><span className={styles.tagCanal}>{d.tipo_reembolso}</span></td>
                                <td>{new Date(d.created_at).toLocaleDateString('pt-BR')}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Sub-Aba 3: Contestações / Chargebacks */}
                  {subAbaOperacoes === 'contestacoes' && (
                    <div>
                      <div className={styles.painelHeader}>
                        <h3 className={styles.painelTitulo}>🚨 Painel de Disputas & Chargebacks Bancários</h3>
                      </div>
                      {contestacoes.length === 0 ? (
                        <div className={styles.boxSucessoZeroDisputas}>
                          <span>🛡️</span>
                          <div>
                            <strong>Nenhuma contestação ou chargeback em aberto!</strong>
                            <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#94a3b8' }}>
                              A sua operação na Fixum está 100% regularizada e sem disputas de bandeiras de cartão.
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className={styles.tabelaWrapper}>
                          <table className={styles.tabela}>
                            <thead>
                              <tr>
                                <th>Cliente</th>
                                <th>Valor em Disputa</th>
                                <th>Motivo da Bandeira</th>
                                <th>Prazo de Defesa</th>
                                <th>Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {contestacoes.map((ct) => (
                                <tr key={ct.id}>
                                  <td>
                                    <strong>{ct.usuario_nome}</strong>
                                    <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{ct.usuario_email}</div>
                                  </td>
                                  <td><strong className={styles.valorDestaqueVermelho}>{formatarMoeda(ct.valor)}</strong></td>
                                  <td>{ct.motivo_bandeira}</td>
                                  <td>
                                    <span style={{ color: '#f87171', fontWeight: 700 }}>
                                      {ct.data_limite_defesa ? new Date(ct.data_limite_defesa).toLocaleDateString('pt-BR') : 'Urgente'}
                                    </span>
                                  </td>
                                  <td>
                                    <span className={`${styles.badge} ${styles.badgeDisputa}`}>
                                      {ct.status_disputa.toUpperCase()}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ── ABA 5: MODERAÇÃO DE IMÓVEIS ── */}
              {abaAtiva === 'imoveis' && (
                <div className={styles.painelBox}>
                  <div className={styles.painelHeader}>
                    <h2 className={styles.painelTitulo}>🏢 Moderação de Imóveis ({imoveisFiltrados.length})</h2>
                    <input
                      type="text"
                      placeholder="Buscar por título, cidade, bairro, anunciante..."
                      value={busca}
                      onChange={(e) => setBusca(e.target.value)}
                      className={styles.campoBusca}
                    />
                  </div>

                  <div className={styles.tabelaWrapper}>
                    <table className={styles.tabela}>
                      <thead>
                        <tr>
                          <th>Imóvel</th>
                          <th>Localização</th>
                          <th>Valor</th>
                          <th>Titular Comercial / Anunciante</th>
                          <th>Destaque</th>
                          <th>Status</th>
                          <th>Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {imoveisFiltrados.map((im) => (
                          <tr key={im.id}>
                            <td>
                              <div>
                                <strong>{im.titulo}</strong>
                                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                                  Tipo: {im.tipo} • {im.negociacao}
                                </div>
                              </div>
                            </td>
                            <td>{im.cidade} — {im.bairro}</td>
                            <td><strong>{formatarMoeda(im.preco)}</strong></td>
                            <td>
                              <div>
                                <strong>{im.anunciante_nome}</strong>
                                {im.cadastrado_por_nome && (
                                  <div style={{ fontSize: '0.72rem', color: '#38bdf8', marginTop: '2px' }}>
                                    👤 Operador: {im.cadastrado_por_nome}
                                  </div>
                                )}
                              </div>
                            </td>
                            <td>
                              <button
                                type="button"
                                className={styles.btnAcao}
                                style={{ color: im.destaque ? '#f59e0b' : '#64748b' }}
                                onClick={() => handleToggleDestaque(im.id, im.destaque)}
                              >
                                {im.destaque ? '⭐ Destaque' : '☆ Normal'}
                              </button>
                            </td>
                            <td>
                              <span className={`${styles.badge} ${im.status === 'ativo' ? styles.badgeAtivo : styles.badgePendente}`}>
                                {im.status === 'ativo' ? 'Ativo' : 'Pausado'}
                              </span>
                            </td>
                            <td>
                              <div style={{ display: 'flex', gap: '6px' }}>
                                <button
                                  type="button"
                                  className={styles.btnAcao}
                                  onClick={() => handleToggleStatusImovel(im.id, im.status)}
                                >
                                  {im.status === 'ativo' ? 'Pausar' : 'Reativar'}
                                </button>
                                <button
                                  type="button"
                                  className={`${styles.btnAcao} ${styles.btnAcaoPerigo}`}
                                  onClick={() => handleExcluirImovel(im.id, im.titulo)}
                                >
                                  Excluir
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ── ABA 6: TRILHA DE AUDITORIA & LOGS ── */}
              {abaAtiva === 'auditoria' && (
                <div className={styles.painelBox}>
                  <div className={styles.painelHeader}>
                    <div className={styles.painelHeaderTitulos}>
                      <h2 className={styles.painelTitulo}>📜 Trilha de Auditoria Imutável (Logs de Segurança)</h2>
                      <span className={styles.painelSub}>Registro histórico de todas as alterações sensíveis e financeiras</span>
                    </div>
                  </div>

                  <div className={styles.tabelaWrapper}>
                    <table className={styles.tabela}>
                      <thead>
                        <tr>
                          <th>Data / Hora</th>
                          <th>Administrador</th>
                          <th>Ação Executada</th>
                          <th>Entidade</th>
                          <th>Justificativa Obrigatória</th>
                        </tr>
                      </thead>
                      <tbody>
                        {logsAuditoria.map((log) => (
                          <tr key={log.id}>
                            <td>{new Date(log.created_at).toLocaleString('pt-BR')}</td>
                            <td><strong>{log.admin_email}</strong></td>
                            <td>
                              <span className={styles.badgeLogAcao}>
                                {log.tipo_acao}
                              </span>
                            </td>
                            <td>{log.entidade}</td>
                            <td><em>{log.justificativa}</em></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ── ABA 7: CONFIGURAÇÕES GLOBAIS & GATEWAY ASAAS ── */}
              {abaAtiva === 'configuracoes' && (
                <div className={styles.painelBox}>
                  <div className={styles.painelHeader}>
                    <div className={styles.painelHeaderTitulos}>
                      <h2 className={styles.painelTitulo}>⚙️ Configurações Globais & Gateway de Pagamento</h2>
                      <span className={styles.painelSub}>Gerencie as credenciais do Asaas, Webhook de pagamentos e contatos da Fixum</span>
                    </div>
                  </div>

                  <form onSubmit={handleSalvarConfig} className={styles.formConfig}>
                    {/* SEÇÃO 1: GATEWAY ASAAS */}
                    <div className={styles.secaoConfigCard}>
                      <div className={styles.secaoConfigHeader}>
                        <span style={{ fontSize: '1.4rem' }}>💳</span>
                        <div>
                          <h3 style={{ margin: 0, color: '#ffffff', fontSize: '1.05rem', fontWeight: 700 }}>
                            Gateway Oficial de Pagamentos (Asaas)
                          </h3>
                          <p style={{ margin: '2px 0 0 0', color: '#94a3b8', fontSize: '0.8rem' }}>
                            O dinheiro das assinaturas PIX e Cartão cai diretamente na sua conta cadastrada no Asaas.
                          </p>
                        </div>
                      </div>

                      <div className={styles.grupoInput} style={{ marginTop: '14px' }}>
                        <label className={styles.labelForm}>
                          <span>Ambiente do Asaas:</span>
                          <span style={{ color: asaasModo === 'producao' ? '#34d399' : '#f59e0b', fontSize: '0.75rem', fontWeight: 700 }}>
                            {asaasModo === 'producao' ? '● MODO PRODUÇÃO ATIVO (DINHEIRO REAL)' : '○ MODO SANDBOX (TESTES)'}
                          </span>
                        </label>
                        <select
                          value={asaasModo}
                          onChange={(e) => setAsaasModo(e.target.value as 'producao' | 'sandbox')}
                          className={styles.selectForm}
                        >
                          <option value="producao">🚀 Produção (Cobranças Reais no Cartão e PIX com QR Code do Banco Central)</option>
                          <option value="sandbox">🧪 Sandbox (Ambiente de Testes / Simulação)</option>
                        </select>
                      </div>

                      <div className={styles.grupoInput}>
                        <label className={styles.labelForm}>
                          <span>Chave de API do Asaas (API Key):</span>
                          <button
                            type="button"
                            onClick={() => setMostrarApiKey(!mostrarApiKey)}
                            style={{ background: 'none', border: 'none', color: '#38bdf8', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 600 }}
                          >
                            {mostrarApiKey ? '🙈 Ocultar Chave' : '👁️ Mostrar Chave'}
                          </button>
                        </label>
                        <input
                          type={mostrarApiKey ? 'text' : 'password'}
                          value={asaasApiKey}
                          onChange={(e) => setAsaasApiKey(e.target.value)}
                          placeholder="Cole sua chave que começa com $aact_..."
                          className={styles.inputForm}
                          required
                        />
                      </div>

                      <div className={styles.grupoInput}>
                        <label className={styles.labelForm}>
                          <span>Token de Segurança do Webhook (Webhook Token):</span>
                          <button
                            type="button"
                            onClick={() => setMostrarWebhookToken(!mostrarWebhookToken)}
                            style={{ background: 'none', border: 'none', color: '#38bdf8', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 600 }}
                          >
                            {mostrarWebhookToken ? '🙈 Ocultar Token' : '👁️ Mostrar Token'}
                          </button>
                        </label>
                        <input
                          type={mostrarWebhookToken ? 'text' : 'password'}
                          value={asaasWebhookToken}
                          onChange={(e) => setAsaasWebhookToken(e.target.value)}
                          placeholder="Cole o token do webhook que começa com whsec_..."
                          className={styles.inputForm}
                        />
                      </div>

                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', marginTop: '6px' }}>
                        <button
                          type="button"
                          disabled={testandoAsaas}
                          onClick={handleTestarAsaas}
                          className={styles.btnAcaoTabelaVerde}
                          style={{ padding: '8px 16px', fontSize: '0.85rem' }}
                        >
                          {testandoAsaas ? '⏳ Testando Conexão...' : '⚡ Testar Conexão com o Asaas Agora'}
                        </button>

                        {statusAsaas && (
                          <div style={{
                            padding: '6px 12px',
                            borderRadius: '8px',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            background: statusAsaas.ok ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                            color: statusAsaas.ok ? '#34d399' : '#f87171',
                            border: `1px solid ${statusAsaas.ok ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                          }}>
                            {statusAsaas.ok ? '✅ ' : '❌ '} {statusAsaas.msg}
                          </div>
                        )}
                      </div>

                      {/* CARD DO WEBHOOK */}
                      <div style={{
                        marginTop: '16px',
                        background: '#0f172a',
                        border: '1px dashed #334155',
                        borderRadius: '10px',
                        padding: '14px 16px',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                          <strong style={{ color: '#38bdf8', fontSize: '0.85rem' }}>
                            🔗 URL do Webhook para colar no painel do Asaas:
                          </strong>
                          <button
                            type="button"
                            onClick={() => {
                              const url = typeof window !== 'undefined'
                                ? `${window.location.origin}/api/pagamentos/webhook`
                                : 'https://www.fixum.com.br/api/pagamentos/webhook'
                              navigator.clipboard.writeText(url)
                              alertar({
                                titulo: 'URL Copiada!',
                                mensagem: `A URL "${url}" foi copiada para a área de transferência. Cole-a no painel do Asaas em Configurações > Integrações > Webhooks.`,
                                icone: '📋',
                                tipo: 'sucesso',
                              })
                            }}
                            style={{
                              background: '#1e293b',
                              border: '1px solid #334155',
                              color: '#ffffff',
                              padding: '4px 10px',
                              borderRadius: '6px',
                              fontSize: '0.75rem',
                              cursor: 'pointer',
                            }}
                          >
                            📋 Copiar URL do Webhook
                          </button>
                        </div>
                        <code style={{
                          display: 'block',
                          margin: '8px 0 0 0',
                          padding: '8px 12px',
                          background: '#020617',
                          color: '#34d399',
                          borderRadius: '6px',
                          fontSize: '0.8rem',
                          fontFamily: 'monospace',
                          wordBreak: 'break-all',
                        }}>
                          {typeof window !== 'undefined' ? `${window.location.origin}/api/pagamentos/webhook` : 'https://www.fixum.com.br/api/pagamentos/webhook'}
                        </code>
                        <p style={{ margin: '8px 0 0 0', color: '#64748b', fontSize: '0.75rem', lineHeight: '1.4' }}>
                          ℹ️ No painel do Asaas (<em>Configurações &gt; Integrações &gt; Webhooks</em>), crie um webhook com esta URL e marque os eventos: <strong>Pagamento Recebido, Confirmado, Vencido, Estornado e Chargeback</strong>.
                        </p>
                      </div>
                    </div>

                    {/* SEÇÃO 2: CONTATOS DA PLATAFORMA */}
                    <div className={styles.secaoConfigCard} style={{ marginTop: '16px' }}>
                      <div className={styles.secaoConfigHeader}>
                        <span style={{ fontSize: '1.4rem' }}>📞</span>
                        <div>
                          <h3 style={{ margin: 0, color: '#ffffff', fontSize: '1.05rem', fontWeight: 700 }}>
                            Canais Oficiais de Atendimento & Suporte Fixum
                          </h3>
                          <p style={{ margin: '2px 0 0 0', color: '#94a3b8', fontSize: '0.8rem' }}>
                            Esses números e e-mails são exibidos nos botões de contato e rodapé do portal.
                          </p>
                        </div>
                      </div>

                      <div className={styles.grupoInput} style={{ marginTop: '14px' }}>
                        <label className={styles.labelForm}>
                          WhatsApp Comercial (Consultor de Vendas / Atendimento Fixum)
                        </label>
                        <input
                          type="text"
                          value={whatsComercial}
                          onChange={(e) => setWhatsComercial(e.target.value)}
                          placeholder="Ex: 5531988027152"
                          className={styles.inputForm}
                          required
                        />
                      </div>

                      <div className={styles.grupoInput}>
                        <label className={styles.labelForm}>
                          WhatsApp de Suporte Técnico
                        </label>
                        <input
                          type="text"
                          value={whatsSuporte}
                          onChange={(e) => setWhatsSuporte(e.target.value)}
                          placeholder="Ex: 5531988027152"
                          className={styles.inputForm}
                        />
                      </div>

                      <div className={styles.grupoInput}>
                        <label className={styles.labelForm}>
                          E-mail Oficial de Contato
                        </label>
                        <input
                          type="email"
                          value={emailContato}
                          onChange={(e) => setEmailContato(e.target.value)}
                          placeholder="contato@fixum.com.br"
                          className={styles.inputForm}
                        />
                      </div>
                    </div>

                    {msgConfig && (
                      <div className={msgConfig.includes('⚠️') ? styles.alertaAmarelo : styles.alertaVerde} style={{ marginTop: '16px' }}>
                        {msgConfig}
                      </div>
                    )}

                    <div style={{ marginTop: '20px' }}>
                      <button
                        type="submit"
                        disabled={salvandoConfig}
                        className={styles.btnSalvarConfig}
                      >
                        {salvandoConfig ? 'Salvando Configurações...' : '💾 Salvar Todas as Configurações & Credenciais'}
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  )
}
