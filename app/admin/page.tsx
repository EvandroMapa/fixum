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

type AbaAdmin = 'analytics' | 'clientes' | 'faturas' | 'operacoes' | 'imoveis' | 'auditoria' | 'configuracoes' | 'planos'
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
  const [planosAdmin, setPlanosAdmin] = useState<any[]>([])
  const [descontoTrimestral, setDescontoTrimestral] = useState(10)
  const [descontoSemestral, setDescontoSemestral] = useState(15)
  const [descontoAnual, setDescontoAnual] = useState(20)
  const [salvandoPlanos, setSalvandoPlanos] = useState(false)
  const [msgPlanos, setMsgPlanos] = useState<{ tipo: 'sucesso' | 'erro'; texto: string } | null>(null)

  // ── ESTADOS DE BUSCA E FILTROS EM LISTAS ──
  const [busca, setBusca] = useState('')
  const [filtroTipoCliente, setFiltroTipoCliente] = useState<string>('comerciais')
  const [filtroStatusCliente, setFiltroStatusCliente] = useState<string>('todos')
  const [filtroStatusFatura, setFiltroStatusFatura] = useState<string>('todos')
  const [abaMobilePocket, setAbaMobilePocket] = useState<'resumo' | 'faturas' | 'imoveis' | 'clientes'>('resumo')

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
  const [configsSalvas, setConfigsSalvas] = useState<{
    whatsComercial: string
    whatsSuporte: string
    emailContato: string
    asaasApiKey: string
    asaasWebhookToken: string
    asaasModo: 'producao' | 'sandbox'
  }>({
    whatsComercial: CONFIG_PADRAO.WHATSAPP_COMERCIAL,
    whatsSuporte: CONFIG_PADRAO.WHATSAPP_SUPORTE,
    emailContato: CONFIG_PADRAO.EMAIL_CONTATO,
    asaasApiKey: '',
    asaasWebhookToken: '',
    asaasModo: 'producao',
  })
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
      setPlanosAdmin(data.planos && data.planos.length > 0 ? data.planos : PLANOS_OFICIAIS)

      if (data.configs) {
        const objConfigs = {
          whatsComercial: CONFIG_PADRAO.WHATSAPP_COMERCIAL,
          whatsSuporte: CONFIG_PADRAO.WHATSAPP_SUPORTE,
          emailContato: CONFIG_PADRAO.EMAIL_CONTATO,
          asaasApiKey: '',
          asaasWebhookToken: '',
          asaasModo: 'producao' as 'producao' | 'sandbox',
        }
        data.configs.forEach((c: any) => {
          if (c.chave === 'whatsapp_comercial') { setWhatsComercial(c.valor); objConfigs.whatsComercial = c.valor }
          if (c.chave === 'whatsapp_suporte') { setWhatsSuporte(c.valor); objConfigs.whatsSuporte = c.valor }
          if (c.chave === 'email_contato') { setEmailContato(c.valor); objConfigs.emailContato = c.valor }
          if (c.chave === 'asaas_api_key') { setAsaasApiKey(c.valor); objConfigs.asaasApiKey = c.valor }
          if (c.chave === 'asaas_webhook_token') { setAsaasWebhookToken(c.valor); objConfigs.asaasWebhookToken = c.valor }
          if (c.chave === 'asaas_modo') { setAsaasModo(c.valor as 'producao' | 'sandbox'); objConfigs.asaasModo = c.valor as 'producao' | 'sandbox' }
          if (c.chave === 'desconto_trimestral_pct') setDescontoTrimestral(Number(c.valor) || 10)
          if (c.chave === 'desconto_semestral_pct') setDescontoSemestral(Number(c.valor) || 15)
          if (c.chave === 'desconto_anual_pct') setDescontoAnual(Number(c.valor) || 20)
        })
        setConfigsSalvas(objConfigs)
      }
    } catch (err) {
      console.error('[ADMIN-LOAD-ERROR]:', err)
    } finally {
      setCarregando(false)
    }
  }, [router])

  // Função para editar campos de um plano localmente antes de salvar
  function handleAlterarCampoPlano(id: string, campo: string, valor: any) {
    setPlanosAdmin((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p
        const atualizado = { ...p, [campo]: valor }
        if (campo === 'preco_mensal' || campo === 'limite_imoveis_max') {
          const preco = campo === 'preco_mensal' ? Number(valor) : Number(p.preco_mensal)
          const max = campo === 'limite_imoveis_max' ? Number(valor) : Number(p.limite_imoveis_max)
          atualizado.custo_unitario_max = max > 0 && preco > 0 ? Number((preco / max).toFixed(2)) : 0
        }
        return atualizado
      })
    )
  }

  // Salvar toda a precificação no banco Supabase com auditoria
  async function handleSalvarPlanos() {
    const confirmou = await confirmar({
      titulo: 'Salvar Alterações de Precificação?',
      mensagem: 'Os novos preços, faixas e descontos promocionais passarão a valer imediatamente para novos clientes e novos ciclos contratados.',
      icone: '🏷️',
      tipo: 'primario',
    })
    if (!confirmou) return

    setSalvandoPlanos(true)
    setMsgPlanos(null)

    try {
      const res = await fetch('/api/admin/planos', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planos: planosAdmin,
          descontos: {
            trimestral: Number(descontoTrimestral) || 0,
            semestral: Number(descontoSemestral) || 0,
            anual: Number(descontoAnual) || 0,
          },
          adminEmail: usuarioAtual?.email || 'admin@fixum.com.br',
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao salvar planos.')
      }

      setMsgPlanos({ tipo: 'sucesso', texto: data.mensagem || 'Planos atualizados com sucesso!' })
      await alertar({
        titulo: 'Precificação Atualizada!',
        mensagem: 'Todos os preços e limites foram gravados com sucesso na plataforma.',
        icone: '🎉',
        tipo: 'sucesso',
      })
      carregarDadosAdmin()
    } catch (err: any) {
      setMsgPlanos({ tipo: 'erro', texto: err.message || 'Erro ao salvar planos.' })
    } finally {
      setSalvandoPlanos(false)
    }
  }

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

  // Totalizadores Financeiros para Resumos Rápidos
  const totalRecebidoFaturas = useMemo(() => {
    return faturas.filter((f) => f.status === 'pago').reduce((acc, f) => acc + (f.valor || 0), 0)
  }, [faturas])

  const totalPendenteFaturas = useMemo(() => {
    return faturas.filter((f) => f.status === 'pendente').reduce((acc, f) => acc + (f.valor || 0), 0)
  }, [faturas])

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

  // Testar Conexão com o Asaas (Sem recarregar a tela inteira)
  async function handleTestarAsaas() {
    if (!asaasApiKey.trim()) {
      setStatusAsaas({ ok: false, msg: 'Informe a Chave de API do Asaas para testar.' })
      await alertar({
        titulo: 'Chave Não Informada',
        mensagem: 'Por favor, preencha o campo da Chave de API do Asaas antes de realizar o teste.',
        icone: '⚠️',
        tipo: 'aviso',
      })
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
        const msgErro = data.error || 'Falha ao autenticar no Asaas. Verifique a chave e o ambiente selecionado.'
        setStatusAsaas({ ok: false, msg: msgErro })
        await alertar({
          titulo: 'Falha na Conexão',
          mensagem: msgErro,
          icone: '❌',
          tipo: 'perigo',
        })
      } else {
        const msgSucesso = data.mensagem || 'Conexão com o Asaas validada com sucesso! A chave está ativa.'
        setStatusAsaas({ ok: true, msg: msgSucesso })
        await alertar({
          titulo: 'Conexão Validada com Sucesso!',
          mensagem: msgSucesso,
          icone: '⚡',
          tipo: 'sucesso',
        })
      }
    } catch (err: any) {
      const erroStr = err?.message || 'Erro ao conectar ao Asaas.'
      setStatusAsaas({ ok: false, msg: erroStr })
      await alertar({
        titulo: 'Erro no Teste',
        mensagem: erroStr,
        icone: '❌',
        tipo: 'perigo',
      })
    } finally {
      setTestandoAsaas(false)
    }
  }

  // Salvar Configurações Globais com Alerta Inteligente
  async function handleSalvarConfig(e: React.FormEvent) {
    e.preventDefault()

    const alterouCredenciais =
      asaasApiKey.trim() !== configsSalvas.asaasApiKey.trim() ||
      asaasWebhookToken.trim() !== configsSalvas.asaasWebhookToken.trim() ||
      asaasModo !== configsSalvas.asaasModo

    const alterouContatos =
      whatsComercial.trim() !== configsSalvas.whatsComercial.trim() ||
      whatsSuporte.trim() !== configsSalvas.whatsSuporte.trim() ||
      emailContato.trim() !== configsSalvas.emailContato.trim()

    // 1. Se NÃO houve nenhuma alteração
    if (!alterouCredenciais && !alterouContatos) {
      await alertar({
        titulo: 'Nenhuma Alteração Detectada',
        mensagem: 'As configurações atuais não foram modificadas e já correspondem às salvas no sistema.',
        icone: 'ℹ️',
        tipo: 'sucesso',
      })
      return
    }

    // 2. Se alterou Chave de API, Token ou Modo (Risco Crítico de Recebimento)
    if (alterouCredenciais) {
      const confirmou = await confirmar({
        titulo: '⚠️ Confirmar Alteração de Credenciais?',
        mensagem:
          'Você modificou a Chave de API, Token do Webhook ou Ambiente do Asaas.\n\nSe alguma dessas credenciais estiver incorreta, novas cobranças não serão geradas e confirmações de pagamento não serão recebidas. Deseja realmente aplicar essa alteração?',
        icone: '⚠️',
        tipo: 'aviso',
        textoBotaoConfirmar: 'Sim, Salvar Credenciais',
        textoBotaoCancelar: 'Cancelar e Revisar',
      })
      if (!confirmou) return
    } else if (alterouContatos) {
      // 3. Se alterou apenas contatos
      const confirmou = await confirmar({
        titulo: 'Salvar Novos Contatos?',
        mensagem: 'Deseja atualizar os números de WhatsApp e e-mail de atendimento da Fixum?',
        icone: '📞',
        tipo: 'primario',
        textoBotaoConfirmar: 'Salvar Contatos',
        textoBotaoCancelar: 'Cancelar',
      })
      if (!confirmou) return
    }

    setSalvandoConfig(true)
    setMsgConfig(null)

    try {
      const supabase = createClient()
      const { error } = await supabase.from('configuracoes_sistema').upsert([
        { chave: 'whatsapp_comercial', valor: whatsComercial, descricao: 'WhatsApp comercial Fixum' },
        { chave: 'whatsapp_suporte', valor: whatsSuporte, descricao: 'WhatsApp suporte Fixum' },
        { chave: 'email_contato', valor: emailContato, descricao: 'E-mail de contato Fixum' },
        { chave: 'asaas_api_key', valor: asaasApiKey.trim(), descricao: 'Chave de API do Asaas' },
        { chave: 'asaas_webhook_token', valor: asaasWebhookToken.trim(), descricao: 'Token de autenticação do Webhook Asaas' },
        { chave: 'asaas_modo', valor: asaasModo, descricao: 'Ambiente do Asaas (producao/sandbox)' },
      ], { onConflict: 'chave' })

      if (error) {
        throw new Error(error.message || 'Erro ao gravar configurações no banco.')
      }

      setConfigsSalvas({
        whatsComercial,
        whatsSuporte,
        emailContato,
        asaasApiKey: asaasApiKey.trim(),
        asaasWebhookToken: asaasWebhookToken.trim(),
        asaasModo,
      })

      // Registro de Auditoria
      await supabase.from('logs_auditoria_admin').insert({
        admin_email: usuarioAtual?.email || 'admin@fixum.com.br',
        tipo_acao: 'ALTERAR_CONFIGURACOES_GLOBAIS',
        entidade: 'configuracoes_sistema',
        entidade_id: 'global',
        justificativa: alterouCredenciais
          ? `Atualização de credenciais Asaas (Ambiente: ${asaasModo.toUpperCase()})`
          : 'Atualização de dados de contato e suporte',
        dados_novos: {
          whatsapp_comercial: whatsComercial,
          whatsapp_suporte: whatsSuporte,
          email_contato: emailContato,
          asaas_modo: asaasModo,
          has_api_key: Boolean(asaasApiKey.trim()),
          has_webhook_token: Boolean(asaasWebhookToken.trim()),
        },
      })

      setMsgConfig('✅ Configurações salvas e auditadas com sucesso!')
      await alertar({
        titulo: 'Configurações Salvas!',
        mensagem: 'As configurações foram salvas com sucesso no banco de dados e já estão ativas na plataforma.',
        icone: '🛡️',
        tipo: 'sucesso',
      })
    } catch (err: any) {
      setMsgConfig(`❌ Erro ao salvar: ${err?.message || 'Falha na gravação.'}`)
      await alertar({
        titulo: 'Erro ao Salvar',
        mensagem: err?.message || 'Ocorreu um erro ao salvar as configurações.',
        icone: '❌',
        tipo: 'perigo',
      })
    } finally {
      setSalvandoConfig(false)
    }
  }

  // Restaurar configurações para os valores originais do banco
  function handleRestaurarConfigsOriginais() {
    setWhatsComercial(configsSalvas.whatsComercial)
    setWhatsSuporte(configsSalvas.whatsSuporte)
    setEmailContato(configsSalvas.emailContato)
    setAsaasApiKey(configsSalvas.asaasApiKey)
    setAsaasWebhookToken(configsSalvas.asaasWebhookToken)
    setAsaasModo(configsSalvas.asaasModo)
    setMsgConfig(null)
    alertar({
      titulo: 'Valores Originais Restaurados',
      mensagem: 'Todos os campos voltaram aos valores atualmente ativos e salvos no sistema.',
      icone: '↺',
      tipo: 'sucesso',
    })
  }

  async function handleLogoutAdmin() {
    encerrarSessaoAdmin()
    try {
      const supabase = createClient()
      await supabase.auth.signOut()
    } catch (err) {
      console.error('Erro ao deslogar do Supabase:', err)
    }
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

      {/* ── VISÃO EXECUTIVA POCKET PARA CELULAR (INFORMATIVA) ── */}
      <div className={styles.adminPocketMobile}>
        {/* TOPBAR POCKET */}
        <header className={styles.pocketTopbar}>
          <Link href="/" className={styles.pocketLogoBox}>
            <span style={{ fontSize: '1.25rem' }}>📍</span>
            <strong className={styles.pocketLogoTexto}>FIXUM</strong>
            <span className={styles.pocketBadge}>Admin</span>
          </Link>

          <div className={styles.pocketTopbarAcoes}>
            <button
              type="button"
              onClick={() => {
                bloquearTelaAdmin()
                setTelaBloqueada(true)
              }}
              className={styles.pocketBtnIcone}
              title="Bloquear painel com PIN Master"
            >
              🔒
            </button>
            <button
              type="button"
              onClick={handleLogoutAdmin}
              className={styles.pocketBtnSair}
            >
              Sair
            </button>
          </div>
        </header>

        {/* NAVEGAÇÃO POCKET (4 ABAS FIXAS SEM ROLAGEM) */}
        <div className={styles.pocketNavPills}>
          <button
            type="button"
            className={`${styles.pocketNavPill} ${abaMobilePocket === 'resumo' ? styles.pocketNavPillAtivo : ''}`}
            onClick={() => setAbaMobilePocket('resumo')}
          >
            📊 Geral
          </button>
          <button
            type="button"
            className={`${styles.pocketNavPill} ${abaMobilePocket === 'faturas' ? styles.pocketNavPillAtivo : ''}`}
            onClick={() => setAbaMobilePocket('faturas')}
          >
            💳 Faturas
          </button>
          <button
            type="button"
            className={`${styles.pocketNavPill} ${abaMobilePocket === 'imoveis' ? styles.pocketNavPillAtivo : ''}`}
            onClick={() => setAbaMobilePocket('imoveis')}
          >
            🏢 Imóveis
          </button>
          <button
            type="button"
            className={`${styles.pocketNavPill} ${abaMobilePocket === 'clientes' ? styles.pocketNavPillAtivo : ''}`}
            onClick={() => setAbaMobilePocket('clientes')}
          >
            👥 Clientes
          </button>
        </div>

        {/* CONTEÚDO POCKET */}
        <div className={styles.pocketCorpo}>
          {carregando ? (
            <div className={styles.carregando}>
              <div className={styles.spinner} />
              <span>Carregando visão executiva...</span>
            </div>
          ) : (
            <>
              {/* ABA 1: RESUMO GERAL & BI (ESPELHO DO DESKTOP) */}
              {abaMobilePocket === 'resumo' && (
                <>
                  {/* SELETOR DE PERÍODO SEGMENTADO */}
                  <div className={styles.pocketFiltroPeriodo}>
                    {(['7d', '30d', 'mes', 'ano', 'tudo'] as PeriodoAnalytics[]).map((p) => {
                      const labelMap: Record<PeriodoAnalytics, string> = {
                        '7d': '7 Dias',
                        '30d': '30 Dias',
                        'mes': 'Este Mês',
                        'ano': 'Ano',
                        'tudo': 'Total',
                      }
                      return (
                        <button
                          key={p}
                          type="button"
                          className={`${styles.pocketBtnPeriodo} ${periodoAnalytics === p ? styles.pocketBtnPeriodoAtivo : ''}`}
                          onClick={() => setPeriodoAnalytics(p)}
                        >
                          {labelMap[p]}
                        </button>
                      )
                    })}
                  </div>

                  {/* GRID 2x2 DE KPIS EXECUTIVOS */}
                  <div className={styles.pocketGridKpis}>
                    {/* MRR */}
                    <div className={styles.pocketCardKpiMini} style={{ borderLeft: '3px solid #10b981' }}>
                      <span className={styles.pocketKpiMiniLabel}>💰 MRR (Recorrente)</span>
                      <div className={styles.pocketKpiMiniValor}>{formatarMoeda(metricasBI.mrr)}</div>
                      <span className={styles.pocketKpiMiniSub}>Mensalidade ativa</span>
                    </div>

                    {/* FATURAMENTO NO PERÍODO */}
                    <div className={styles.pocketCardKpiMini} style={{ borderLeft: '3px solid #8b5cf6' }}>
                      <span className={styles.pocketKpiMiniLabel}>💳 Faturamento</span>
                      <div className={styles.pocketKpiMiniValor}>{formatarMoeda(metricasBI.faturamentoPeriodo)}</div>
                      <span className={styles.pocketKpiMiniSub}>{metricasBI.totalVendasPeriodo} fatura(s) paga(s)</span>
                    </div>

                    {/* ARR PROJETADO */}
                    <div className={styles.pocketCardKpiMini} style={{ borderLeft: '3px solid #0284c7' }}>
                      <span className={styles.pocketKpiMiniLabel}>📈 ARR Projetado</span>
                      <div className={styles.pocketKpiMiniValor}>{formatarMoeda(metricasBI.arr)}</div>
                      <span className={styles.pocketKpiMiniSub}>MRR × 12 meses</span>
                    </div>

                    {/* TICKET MÉDIO */}
                    <div className={styles.pocketCardKpiMini} style={{ borderLeft: '3px solid #f59e0b' }}>
                      <span className={styles.pocketKpiMiniLabel}>🏷️ Ticket Médio</span>
                      <div className={styles.pocketKpiMiniValor}>{formatarMoeda(metricasBI.ticketMedio)}</div>
                      <span className={styles.pocketKpiMiniSub}>Média por venda</span>
                    </div>
                  </div>

                  {/* CARD DE CRESCIMENTO & RETENÇÃO (NET GROWTH) */}
                  <div className={styles.pocketCardGrowth}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ fontSize: '0.85rem', color: '#ffffff' }}>🚀 Contratações & Net Growth</strong>
                      <span style={{ fontSize: '0.72rem', color: '#38bdf8', fontWeight: 600 }}>
                        Retenção {metricasBI.taxaRetencao}%
                      </span>
                    </div>

                    <div className={styles.pocketGrowthGrid}>
                      <div className={styles.pocketGrowthItem}>
                        <span className={styles.pocketGrowthLabel}>Novas Vendas</span>
                        <strong className={styles.pocketGrowthNumPositivo}>+{metricasBI.contratacoesPeriodo}</strong>
                      </div>
                      <div className={styles.pocketGrowthItem}>
                        <span className={styles.pocketGrowthLabel}>Cancelamentos</span>
                        <strong className={styles.pocketGrowthNumNegativo}>-{metricasBI.cancelamentosPeriodo}</strong>
                      </div>
                      <div className={styles.pocketGrowthItem}>
                        <span className={styles.pocketGrowthLabel}>Net Growth</span>
                        <strong className={metricasBI.netGrowth >= 0 ? styles.pocketGrowthNumPositivo : styles.pocketGrowthNumNegativo}>
                          {metricasBI.netGrowth >= 0 ? `+${metricasBI.netGrowth}` : metricasBI.netGrowth}
                        </strong>
                      </div>
                    </div>
                  </div>

                  {/* RESUMO DE PLANOS (DISTRIBUIÇÃO DE VENDAS) */}
                  <div className={styles.pocketCardPlanos}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ fontSize: '0.85rem', color: '#ffffff' }}>📦 Distribuição de Planos</strong>
                      <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                        {metricasBI.vendasPorPlano.reduce((acc, p) => acc + p.quantidade, 0)} assinaturas
                      </span>
                    </div>

                    <div className={styles.pocketPlanosLista}>
                      {metricasBI.vendasPorPlano.length === 0 ? (
                        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Nenhuma venda no período selecionado.</span>
                      ) : (
                        metricasBI.vendasPorPlano.map((p) => {
                          const maxValor = Math.max(...metricasBI.vendasPorPlano.map((x) => x.totalValor), 1)
                          const pct = Math.round((p.totalValor / maxValor) * 100)
                          return (
                            <div key={p.planoId} className={styles.pocketPlanoItem}>
                              <div className={styles.pocketPlanoItemTopo}>
                                <span className={styles.pocketPlanoNome}>{p.nome}</span>
                                <span className={styles.pocketPlanoValores}>
                                  <strong>{formatarMoeda(p.totalValor)}</strong> ({p.quantidade} un)
                                </span>
                              </div>
                              <div className={styles.pocketPlanoFundo}>
                                <div className={styles.pocketPlanoBarra} style={{ width: `${Math.max(pct, 6)}%` }} />
                              </div>
                            </div>
                          )
                        })
                      )}
                    </div>
                  </div>

                  {/* CARDS DE ACERVO E BASE (GRID 2 COLUNAS) */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div className={styles.pocketCardKpi} style={{ padding: '12px' }}>
                      <span className={styles.pocketKpiLabel}>🏢 Imóveis no Ar</span>
                      <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ffffff' }}>
                        {imoveis.length}
                      </div>
                      <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                        {imoveis.filter(i => i.destaque).length} com destaque ⭐
                      </span>
                    </div>

                    <div className={styles.pocketCardKpi} style={{ padding: '12px' }}>
                      <span className={styles.pocketKpiLabel}>👥 Anunciantes</span>
                      <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ffffff' }}>
                        {clientes.filter(c => !c.is_corretor_vinculado).length}
                      </div>
                      <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                        {clientes.filter(c => c.tipo_anunciante === 'imobiliaria').length} imobiliárias
                      </span>
                    </div>
                  </div>

                  {/* ALERTAS OPERACIONAIS */}
                  {contestacoes.length > 0 || cancelamentos.length > 0 ? (
                    <div style={{
                      background: 'rgba(239, 68, 68, 0.1)',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      borderRadius: '10px',
                      padding: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                    }}>
                      <span style={{ fontSize: '1.3rem' }}>⚠️</span>
                      <div style={{ fontSize: '0.8rem', color: '#fca5a5' }}>
                        <strong>Atenção Operacional:</strong> Há {contestacoes.length} contestação(ões) e {cancelamentos.length} cancelamento(s) no gateway.
                      </div>
                    </div>
                  ) : (
                    <div style={{
                      background: 'rgba(16, 185, 129, 0.08)',
                      border: '1px solid rgba(16, 185, 129, 0.25)',
                      borderRadius: '10px',
                      padding: '10px 14px',
                      fontSize: '0.78rem',
                      color: '#34d399',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}>
                      <span>✅</span>
                      <span>Nenhuma contestação ou estorno pendente.</span>
                    </div>
                  )}

                  {/* FEED DE ÚLTIMAS FATURAS */}
                  <div style={{ marginTop: '4px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <strong style={{ fontSize: '0.88rem', color: '#ffffff' }}>Últimas Cobranças</strong>
                      <button
                        type="button"
                        onClick={() => setAbaMobilePocket('faturas')}
                        style={{ background: 'none', border: 'none', color: '#38bdf8', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}
                      >
                        Ver todas →
                      </button>
                    </div>

                    <div className={styles.pocketListaCards}>
                      {faturas.slice(0, 4).map((f) => (
                        <div key={f.id} className={styles.pocketItemCard}>
                          <div className={styles.pocketItemTopo}>
                            <span className={styles.pocketItemNome}>{f.usuario_nome || 'Cliente'}</span>
                            <span className={`${styles.pocketBadgeStatus} ${
                              f.status === 'pago' ? styles.pocketBadgePago : f.status === 'pendente' ? styles.pocketBadgePendente : styles.pocketBadgeAtrasado
                            }`}>
                              {f.status}
                            </span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem', color: '#94a3b8' }}>
                            <span>{f.plano_nome || 'Assinatura'} • {f.metodo_pagamento?.toUpperCase() || 'PIX'}</span>
                            <strong style={{ color: '#34d399', fontSize: '0.9rem' }}>{formatarMoeda(f.valor)}</strong>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* ABA 2: FATURAS COMPLETAS */}
              {abaMobilePocket === 'faturas' && (
                <div className={styles.pocketListaCards}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ fontSize: '0.95rem', color: '#ffffff' }}>💳 Histórico de Cobranças</strong>
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{faturas.length} faturas</span>
                  </div>

                  {faturas.map((f) => (
                    <div key={f.id} className={styles.pocketItemCard}>
                      <div className={styles.pocketItemTopo}>
                        <div>
                          <strong className={styles.pocketItemNome}>{f.usuario_nome || 'Cliente'}</strong>
                          <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{f.usuario_email}</div>
                        </div>
                        <span className={`${styles.pocketBadgeStatus} ${
                          f.status === 'pago' ? styles.pocketBadgePago : f.status === 'pendente' ? styles.pocketBadgePendente : styles.pocketBadgeAtrasado
                        }`}>
                          {f.status}
                        </span>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem', borderTop: '1px solid #334155', paddingTop: '6px' }}>
                        <span style={{ color: '#94a3b8' }}>
                          {f.metodo_pagamento?.toUpperCase()} • {new Date(f.created_at).toLocaleDateString('pt-BR')}
                        </span>
                        <strong style={{ color: f.status === 'pago' ? '#34d399' : '#fbbf24', fontSize: '0.95rem' }}>
                          {formatarMoeda(f.valor)}
                        </strong>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* ABA 3: IMÓVEIS */}
              {abaMobilePocket === 'imoveis' && (
                <div className={styles.pocketListaCards}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ fontSize: '0.95rem', color: '#ffffff' }}>🏢 Anúncios Publicados</strong>
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{imoveis.length} imóveis</span>
                  </div>

                  {imoveis.map((im) => (
                    <div key={im.id} className={styles.pocketItemCard}>
                      <div className={styles.pocketItemTopo}>
                        <strong className={styles.pocketItemNome} style={{ fontSize: '0.85rem' }}>
                          {im.titulo}
                        </strong>
                        {im.destaque && (
                          <span style={{ background: '#fef08a', color: '#854d0e', fontSize: '0.65rem', fontWeight: 800, padding: '1px 5px', borderRadius: '4px' }}>
                            ⭐ Destaque
                          </span>
                        )}
                      </div>

                      <div style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'flex', justifyContent: 'space-between' }}>
                        <span>📍 {im.bairro ? `${im.bairro}, ` : ''}{im.cidade || 'MG'}</span>
                        <strong style={{ color: '#38bdf8' }}>{formatarMoeda(im.preco)}</strong>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #334155', paddingTop: '6px' }}>
                        <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                          {im.imobiliaria_nome || im.usuario_nome || 'Anunciante'}
                        </span>
                        <Link
                          href={`/imovel/${im.id}`}
                          target="_blank"
                          style={{
                            fontSize: '0.75rem',
                            color: '#38bdf8',
                            textDecoration: 'none',
                            fontWeight: 600,
                          }}
                        >
                          Ver Anúncio ↗
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* ABA 4: CLIENTES */}
              {abaMobilePocket === 'clientes' && (
                <div className={styles.pocketListaCards}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ fontSize: '0.95rem', color: '#ffffff' }}>👥 Diretório de Clientes</strong>
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{clientes.filter(c => !c.is_corretor_vinculado).length} contas</span>
                  </div>

                  {clientes.filter(c => !c.is_corretor_vinculado).map((cli) => (
                    <div key={cli.id} className={styles.pocketItemCard}>
                      <div className={styles.pocketItemTopo}>
                        <div>
                          <strong className={styles.pocketItemNome}>{cli.nome}</strong>
                          <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{cli.email}</div>
                        </div>
                        <span style={{
                          background: cli.status_conta === 'ativo' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                          color: cli.status_conta === 'ativo' ? '#34d399' : '#f87171',
                          fontSize: '0.65rem',
                          fontWeight: 700,
                          padding: '2px 6px',
                          borderRadius: '4px',
                        }}>
                          {cli.status_conta}
                        </span>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', borderTop: '1px solid #334155', paddingTop: '6px' }}>
                        <span style={{ color: '#38bdf8', fontWeight: 600 }}>Plano: {cli.plano_nome || 'Grátis'}</span>
                        <span style={{ color: '#cbd5e1' }}>{cli.imoveis_ativos || 0} imóveis ativos</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* AVISO DESKTOP NO RODAPÉ */}
              <div className={styles.pocketAvisoDesktop}>
                💻 <strong>Acesso Master Desktop</strong><br />
                Para editar planos, alterar credenciais de API/Webhook e realizar estornos com PIN master, utilize o computador.
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── SIDEBAR EXECUTIVA BLINDADA (DESKTOP) ── */}
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
            className={`${styles.navItem} ${abaAtiva === 'planos' ? styles.navItemAtivo : ''}`}
            onClick={() => { setAbaAtiva('planos'); setBusca('') }}
          >
            <span className={styles.navIcone}>🏷️</span>
            <span>Planos & Precificação</span>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.88rem' }}>
            <span style={{ color: '#64748b', fontWeight: 500 }}>Painel Master</span>
            <span style={{ color: '#334155' }}>/</span>
            <strong style={{ color: '#e2e8f0', fontWeight: 600 }}>
              {abaAtiva === 'analytics' && 'Analytics & BI'}
              {abaAtiva === 'clientes' && 'Clientes & Anunciantes'}
              {abaAtiva === 'faturas' && 'Faturas & Receitas'}
              {abaAtiva === 'operacoes' && 'Cancelamentos & Disputas'}
              {abaAtiva === 'imoveis' && 'Moderação de Imóveis'}
              {abaAtiva === 'auditoria' && 'Trilha de Auditoria'}
              {abaAtiva === 'planos' && 'Planos & Precificação'}
              {abaAtiva === 'configuracoes' && 'Configurações Globais'}
            </strong>
          </div>

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

                      {/* BANNER DE ALERTA DE SEGURANÇA CRÍTICA */}
                      <div style={{
                        marginTop: '14px',
                        background: 'rgba(234, 179, 8, 0.08)',
                        border: '1px solid rgba(234, 179, 8, 0.3)',
                        borderRadius: '10px',
                        padding: '12px 16px',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '12px',
                      }}>
                        <span style={{ fontSize: '1.5rem', lineHeight: '1' }}>⚠️</span>
                        <div>
                          <strong style={{ color: '#facc15', fontSize: '0.85rem' }}>
                            Atenção de Segurança: Proteção do Fluxo de Recebimento
                          </strong>
                          <p style={{ margin: '4px 0 0', color: '#cbd5e1', fontSize: '0.8rem', lineHeight: '1.4' }}>
                            A <strong>Chave de API</strong> e o <strong>Token do Webhook</strong> são a espinha dorsal de cobranças da plataforma. Alterações incorretas impedem que novos anunciantes paguem ou que pagamentos confirmados no banco liberem cotas de anúncios. Sempre clique em <strong>&quot;⚡ Testar Conexão com o Asaas Agora&quot;</strong> antes de salvar.
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

                      <div style={{ marginTop: '6px' }}>
                        <button
                          type="button"
                          disabled={testandoAsaas}
                          onClick={handleTestarAsaas}
                          className={styles.btnAcaoTabelaVerde}
                          style={{ padding: '8px 16px', fontSize: '0.85rem' }}
                        >
                          {testandoAsaas ? '⏳ Testando Conexão...' : '⚡ Testar Conexão com o Asaas Agora'}
                        </button>
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
                      <div className={msgConfig.includes('⚠️') || msgConfig.includes('❌') ? styles.alertaAmarelo : styles.alertaVerde} style={{ marginTop: '16px' }}>
                        {msgConfig}
                      </div>
                    )}

                    <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <button
                          type="submit"
                          disabled={salvandoConfig}
                          className={styles.btnSalvarConfig}
                          style={{ flex: '1', minWidth: '240px' }}
                        >
                          {salvandoConfig ? 'Gravando e Validando...' : '💾 Salvar Todas as Configurações & Credenciais'}
                        </button>

                        {(asaasApiKey.trim() !== configsSalvas.asaasApiKey.trim() ||
                          asaasWebhookToken.trim() !== configsSalvas.asaasWebhookToken.trim() ||
                          asaasModo !== configsSalvas.asaasModo ||
                          whatsComercial.trim() !== configsSalvas.whatsComercial.trim() ||
                          whatsSuporte.trim() !== configsSalvas.whatsSuporte.trim() ||
                          emailContato.trim() !== configsSalvas.emailContato.trim()) && (
                          <button
                            type="button"
                            onClick={handleRestaurarConfigsOriginais}
                            style={{
                              background: 'rgba(239, 68, 68, 0.12)',
                              border: '1px solid rgba(239, 68, 68, 0.35)',
                              color: '#f87171',
                              padding: '10px 18px',
                              borderRadius: '8px',
                              fontSize: '0.85rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              transition: 'all 0.15s ease',
                            }}
                          >
                            ↺ Descartar Alterações
                          </button>
                        )}
                      </div>

                      <span style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        🛡️ <em>Blindagem ativa: alterações de credenciais financeiras exigem confirmação explícita e são gravadas na Trilha de Auditoria.</em>
                      </span>
                    </div>
                  </form>
                </div>
              )}

              {/* ── ABA 8: GESTÃO DE PLANOS & PRECIFICAÇÃO ── */}
              {abaAtiva === 'planos' && (
                <div className={styles.painelBox}>
                  <div className={styles.painelHeader}>
                    <div className={styles.painelHeaderTitulos}>
                      <h2 className={styles.painelTitulo}>🏷️ Gestão de Planos & Precificação Oficial</h2>
                      <span className={styles.painelSub}>
                        Calibre as faixas de imóveis, preços mensais, destaques inclusos e ative/pause planos com sincronização instantânea em todo o portal Fixum.
                      </span>
                    </div>

                    <button
                      type="button"
                      disabled={salvandoPlanos}
                      onClick={handleSalvarPlanos}
                      className={styles.btnSalvarConfig}
                      style={{ padding: '10px 24px', fontSize: '0.95rem' }}
                    >
                      {salvandoPlanos ? 'Gravando Preços...' : '💾 Salvar Alterações de Precificação'}
                    </button>
                  </div>

                  {msgPlanos && (
                    <div className={msgPlanos.tipo === 'erro' ? styles.alertaAmarelo : styles.alertaVerde} style={{ marginTop: '16px', marginBottom: '16px' }}>
                      {msgPlanos.tipo === 'sucesso' ? '✅ ' : '❌ '} {msgPlanos.texto}
                    </div>
                  )}

                  <div className={styles.tabelaContainer} style={{ marginTop: '20px' }}>
                    <table className={styles.tabela}>
                      <thead>
                        <tr>
                          <th style={{ width: '60px' }}>Ordem</th>
                          <th>Plano & Descrição Comercial</th>
                          <th style={{ width: '160px' }}>Faixa de Imóveis</th>
                          <th style={{ width: '160px' }}>Mensalidade (R$)</th>
                          <th style={{ width: '150px' }}>Custo / Imóvel</th>
                          <th style={{ width: '130px', textAlign: 'center' }}>Destaque Mapa</th>
                          <th style={{ width: '110px', textAlign: 'center' }}>Disponível</th>
                        </tr>
                      </thead>
                      <tbody>
                        {planosAdmin.map((plano, idx) => {
                          const preco = Number(plano.preco_mensal) || 0
                          const max = Number(plano.limite_imoveis_max) || 1
                          const custoCalc = max >= 99999 ? '—' : preco === 0 ? 'Grátis' : `R$ ${(preco / max).toFixed(2)} / imóvel / mês`

                          return (
                            <tr key={plano.id}>
                              <td style={{ textAlign: 'center' }}>
                                <span style={{
                                  background: '#1e293b',
                                  color: '#38bdf8',
                                  padding: '4px 8px',
                                  borderRadius: '6px',
                                  fontSize: '0.8rem',
                                  fontWeight: 700,
                                }}>
                                  #{idx + 1}
                                </span>
                              </td>
                              <td>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <input
                                      type="text"
                                      value={plano.nome || ''}
                                      onChange={(e) => handleAlterarCampoPlano(plano.id, 'nome', e.target.value)}
                                      style={{
                                        background: '#0f172a',
                                        border: '1px solid #334155',
                                        borderRadius: '6px',
                                        color: '#ffffff',
                                        padding: '4px 8px',
                                        fontSize: '0.9rem',
                                        fontWeight: 700,
                                        width: '160px',
                                      }}
                                    />
                                    <code style={{ fontSize: '0.75rem', color: '#64748b' }}>({plano.id})</code>
                                  </div>

                                  <input
                                    type="text"
                                    value={plano.descricao || ''}
                                    onChange={(e) => handleAlterarCampoPlano(plano.id, 'descricao', e.target.value)}
                                    placeholder="Descrição comercial para o anunciante..."
                                    style={{
                                      background: '#0f172a',
                                      border: '1px solid #334155',
                                      borderRadius: '6px',
                                      color: '#94a3b8',
                                      padding: '4px 8px',
                                      fontSize: '0.8rem',
                                      width: '100%',
                                    }}
                                  />
                                </div>
                              </td>

                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <input
                                    type="number"
                                    min="1"
                                    value={plano.limite_imoveis_min || 1}
                                    onChange={(e) => handleAlterarCampoPlano(plano.id, 'limite_imoveis_min', e.target.value)}
                                    style={{
                                      background: '#0f172a',
                                      border: '1px solid #334155',
                                      borderRadius: '6px',
                                      color: '#ffffff',
                                      padding: '4px 8px',
                                      fontSize: '0.85rem',
                                      width: '55px',
                                      textAlign: 'center',
                                    }}
                                  />
                                  <span style={{ color: '#64748b' }}>a</span>
                                  <input
                                    type="number"
                                    min="1"
                                    value={plano.limite_imoveis_max >= 99999 ? 99999 : plano.limite_imoveis_max}
                                    onChange={(e) => handleAlterarCampoPlano(plano.id, 'limite_imoveis_max', e.target.value)}
                                    style={{
                                      background: '#0f172a',
                                      border: '1px solid #334155',
                                      borderRadius: '6px',
                                      color: '#ffffff',
                                      padding: '4px 8px',
                                      fontSize: '0.85rem',
                                      width: '65px',
                                      textAlign: 'center',
                                    }}
                                  />
                                </div>
                                <span style={{ fontSize: '0.7rem', color: '#64748b' }}>imóveis ativos</span>
                              </td>

                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <span style={{ color: '#38bdf8', fontWeight: 600, fontSize: '0.85rem' }}>R$</span>
                                  <input
                                    type="number"
                                    step="0.10"
                                    min="0"
                                    value={plano.preco_mensal !== undefined ? plano.preco_mensal : 0}
                                    onChange={(e) => handleAlterarCampoPlano(plano.id, 'preco_mensal', e.target.value)}
                                    style={{
                                      background: '#0f172a',
                                      border: '1px solid #334155',
                                      borderRadius: '6px',
                                      color: '#34d399',
                                      padding: '4px 8px',
                                      fontSize: '0.95rem',
                                      fontWeight: 700,
                                      width: '90px',
                                    }}
                                  />
                                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>/mês</span>
                                </div>
                              </td>

                              <td>
                                <span style={{
                                  background: 'rgba(56, 189, 248, 0.1)',
                                  color: '#38bdf8',
                                  padding: '3px 8px',
                                  borderRadius: '6px',
                                  fontSize: '0.8rem',
                                  fontWeight: 600,
                                }}>
                                  {custoCalc}
                                </span>
                              </td>

                              <td style={{ textAlign: 'center' }}>
                                <label style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}>
                                  <input
                                    type="checkbox"
                                    checked={!!plano.destaque_incluso}
                                    onChange={(e) => handleAlterarCampoPlano(plano.id, 'destaque_incluso', e.target.checked)}
                                    style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#38bdf8' }}
                                  />
                                </label>
                              </td>

                              <td style={{ textAlign: 'center' }}>
                                <label style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}>
                                  <input
                                    type="checkbox"
                                    checked={plano.ativo !== false}
                                    onChange={(e) => handleAlterarCampoPlano(plano.id, 'ativo', e.target.checked)}
                                    style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#22c55e' }}
                                  />
                                </label>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* ── CARD: DESCONTOS PROMOCIONAIS POR CICLO ── */}
                  <div className={styles.secaoConfigCard} style={{ marginTop: '24px' }}>
                    <div className={styles.secaoConfigHeader}>
                      <span style={{ fontSize: '1.4rem' }}>🎁</span>
                      <div>
                        <h3 style={{ margin: 0, color: '#ffffff', fontSize: '1.05rem', fontWeight: 700 }}>
                          Descontos Promocionais por Ciclo Contratual (Multi-Meses)
                        </h3>
                        <p style={{ margin: '2px 0 0 0', color: '#94a3b8', fontSize: '0.8rem' }}>
                          Defina o percentual de desconto concedido automaticamente ao cliente ao optar por ciclos de pagamento mais longos.
                        </p>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginTop: '16px' }}>
                      <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '10px', padding: '14px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <strong style={{ color: '#38bdf8', fontSize: '0.85rem' }}>🥉 Trimestral (3 Meses)</strong>
                          <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Renovação a cada 90 dias</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px' }}>
                          <input
                            type="number"
                            min="0"
                            max="90"
                            value={descontoTrimestral}
                            onChange={(e) => setDescontoTrimestral(Number(e.target.value))}
                            style={{
                              background: '#020617',
                              border: '1px solid #334155',
                              borderRadius: '6px',
                              color: '#34d399',
                              padding: '6px 10px',
                              fontSize: '1rem',
                              fontWeight: 700,
                              width: '75px',
                              textAlign: 'center',
                            }}
                          />
                          <span style={{ color: '#ffffff', fontWeight: 700, fontSize: '0.9rem' }}>% de desconto</span>
                        </div>
                      </div>

                      <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '10px', padding: '14px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <strong style={{ color: '#38bdf8', fontSize: '0.85rem' }}>🥈 Semestral (6 Meses)</strong>
                          <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Renovação a cada 180 dias</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px' }}>
                          <input
                            type="number"
                            min="0"
                            max="90"
                            value={descontoSemestral}
                            onChange={(e) => setDescontoSemestral(Number(e.target.value))}
                            style={{
                              background: '#020617',
                              border: '1px solid #334155',
                              borderRadius: '6px',
                              color: '#34d399',
                              padding: '6px 10px',
                              fontSize: '1rem',
                              fontWeight: 700,
                              width: '75px',
                              textAlign: 'center',
                            }}
                          />
                          <span style={{ color: '#ffffff', fontWeight: 700, fontSize: '0.9rem' }}>% de desconto</span>
                        </div>
                      </div>

                      <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '10px', padding: '14px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <strong style={{ color: '#eab308', fontSize: '0.85rem' }}>🥇 Anual (12 Meses) 🔥</strong>
                          <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Renovação a cada 365 dias</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px' }}>
                          <input
                            type="number"
                            min="0"
                            max="90"
                            value={descontoAnual}
                            onChange={(e) => setDescontoAnual(Number(e.target.value))}
                            style={{
                              background: '#020617',
                              border: '1px solid #334155',
                              borderRadius: '6px',
                              color: '#34d399',
                              padding: '6px 10px',
                              fontSize: '1rem',
                              fontWeight: 700,
                              width: '75px',
                              textAlign: 'center',
                            }}
                          />
                          <span style={{ color: '#ffffff', fontWeight: 700, fontSize: '0.9rem' }}>% de desconto</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ── CARD: BLINDAGEM CONTRATUAL E IMUTABILIDADE DE PREÇO ── */}
                  <div style={{
                    marginTop: '20px',
                    background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)',
                    border: '1px solid rgba(99, 102, 241, 0.3)',
                    borderRadius: '12px',
                    padding: '18px 22px',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '16px',
                  }}>
                    <span style={{ fontSize: '2rem' }}>⚖️</span>
                    <div>
                      <strong style={{ color: '#a5b4fc', fontSize: '0.95rem' }}>
                        🛡️ Blindagem Contratual de Preço Ativo (Garantia de Não Reajuste Durante a Vigência)
                      </strong>
                      <p style={{ margin: '6px 0 0 0', color: '#cbd5e1', fontSize: '0.82rem', lineHeight: '1.5' }}>
                        A Fixum assegura total segurança jurídica aos clientes: <strong>qualquer reajuste realizado nesta tabela NÃO altera as cobranças de clientes que já possuem assinatura ativa</strong> durante o ciclo contratado (seja mensal, trimestral, semestral ou anual). Os novos valores valem exclusivamente para <strong>novas adesões</strong> ou em caso de <strong>alteração voluntária (upgrade/downgrade)</strong> solicitada pelo próprio anunciante.
                      </p>
                    </div>
                  </div>

                  {/* CARD DE INSTRUÇÕES E AUDITORIA */}
                  <div style={{
                    marginTop: '16px',
                    background: '#0f172a',
                    border: '1px solid #1e293b',
                    borderRadius: '12px',
                    padding: '16px 20px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                  }}>
                    <span style={{ fontSize: '1.8rem' }}>📜</span>
                    <div>
                      <strong style={{ color: '#ffffff', fontSize: '0.9rem' }}>Sincronização & Trilha de Auditoria Automática</strong>
                      <p style={{ margin: '4px 0 0 0', color: '#94a3b8', fontSize: '0.8rem', lineHeight: '1.4' }}>
                        Qualquer alteração de preços, faixas ou descontos é gravada com carimbo de data/hora e e-mail do administrador na <strong>Trilha de Auditoria</strong>.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  )
}
