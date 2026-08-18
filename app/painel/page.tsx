'use client'

import { useEffect, useState, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { type Imovel, type Lead, type Assinatura, type Fatura, type Plano, type MetodoPagamento } from '@/lib/types'
import { formatarPreco, labelTipoImovel, fotoPrincipal } from '@/lib/utils'
import { calcularUsoPlano, obterPlanoPorId, obterProximoPlano } from '@/lib/planos'
import Header from '@/components/layout/Header'
import LogoGota from '@/components/ui/LogoGota'
import AbaMeuPlano from '@/components/painel/AbaMeuPlano'
import AbaCorretores from '@/components/painel/AbaCorretores'
import ModalLimiteAtingido from '@/components/painel/ModalLimiteAtingido'
import ModalUpgradePlano from '@/components/painel/ModalUpgradePlano'
import ModalConfigSeguranca from '@/components/painel/ModalConfigSeguranca'
import styles from './page.module.css'

type Aba = 'dashboard' | 'imoveis' | 'leads' | 'corretores' | 'plano'

function PainelConteudo() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const abaParam = searchParams.get('aba') as Aba | null

  const abaInicial: Aba = (abaParam && ['dashboard', 'imoveis', 'leads', 'corretores', 'plano'].includes(abaParam))
    ? abaParam
    : (typeof window !== 'undefined' && (localStorage.getItem('fixum_painel_aba') as Aba)) || 'imoveis'

  const [abaAtiva, setAbaAtiva] = useState<Aba>(abaInicial)
  const [imoveis, setImoveis] = useState<Imovel[]>([])
  const [leads, setLeads] = useState<Lead[]>([])
  const [assinatura, setAssinatura] = useState<Assinatura | null>(null)
  const [faturas, setFaturas] = useState<Fatura[]>([])
  const [carregando, setCarregando] = useState(true)
  const [usuarioNome, setUsuarioNome] = useState('')
  const [usuarioEmail, setUsuarioEmail] = useState('')
  const [usuarioId, setUsuarioId] = useState('')
  const [isImobiliaria, setIsImobiliaria] = useState(false)
  const [isCorretor, setIsCorretor] = useState(false)
  const [imobiliariaDona, setImobiliariaDona] = useState<{ id: string; nome: string } | null>(null)

  // Estados de Filtro de Corretores da Equipe
  const [filtroCorretor, setFiltroCorretor] = useState<string>('todos')
  const [nomesAnunciantes, setNomesAnunciantes] = useState<Record<string, string>>({})
  const [listaCorretoresFiltro, setListaCorretoresFiltro] = useState<{ id: string; nome: string }[]>([])

  // Estados de Modais
  const [modalLimiteAberto, setModalLimiteAberto] = useState(false)
  const [modalUpgradeAberto, setModalUpgradeAberto] = useState(false)
  const [modalSegurancaAberto, setModalSegurancaAberto] = useState(false)
  const [planoAlvoUpgrade, setPlanoAlvoUpgrade] = useState<Plano | null>(null)

  const supabase = createClient()

  useEffect(() => {
    if (abaParam && ['dashboard', 'imoveis', 'leads', 'corretores', 'plano'].includes(abaParam)) {
      if (abaParam === 'plano' && isCorretor && imobiliariaDona) {
        setAbaAtiva('dashboard')
      } else {
        setAbaAtiva(abaParam)
      }
    }
  }, [abaParam, isCorretor, imobiliariaDona])

  function trocarAba(novaAba: Aba) {
    setAbaAtiva(novaAba)
    localStorage.setItem('fixum_painel_aba', novaAba)
    router.replace(`/painel?aba=${novaAba}`)
  }

  useEffect(() => {
    async function carregar() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/login'; return }
      setUsuarioId(user.id)
      setUsuarioEmail(user.email ?? '')

      const { data: perfil } = await supabase
        .from('perfis')
        .select('id, nome, tipo, telefone, creci')
        .eq('id', user.id)
        .maybeSingle()

      const searchTipo = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('tipo') : null
      const meta = user.user_metadata || {}
      const metaTipo = perfil?.tipo || meta.tipo || meta.tipo_anunciante || searchTipo
      const imobId = meta.imobiliaria_id || null

      if ((!perfil || !perfil.tipo) && metaTipo) {
        const nomeFinal = perfil?.nome || meta.full_name || meta.name || meta.nome || user.email?.split('@')[0] || 'Imobiliária'
        await supabase.from('perfis').upsert({
          id: user.id,
          nome: nomeFinal,
          email: user.email!,
          tipo: metaTipo,
          telefone: meta.telefone || null,
        })
        setUsuarioNome(nomeFinal)
        setIsImobiliaria(metaTipo === 'imobiliaria')
        setIsCorretor(metaTipo === 'corretor' || !!imobId)
      } else if (!perfil || !perfil.tipo) {
        window.location.href = '/completar-perfil'
        return
      } else {
        setUsuarioNome(perfil?.nome ?? 'Usuário')
      }

      const tipoFinal = perfil?.tipo || meta.tipo || meta.tipo_anunciante || searchTipo
      const ehImob = tipoFinal === 'imobiliaria'
      const ehCorretor = tipoFinal === 'corretor' || !!imobId

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
        }
      } catch (err) {
        console.error('Erro ao buscar dados do painel:', err)
      }

      // ── CARREGAMENTO DE ASSINATURA (Do próprio usuário ou da imobiliária dona) ──
      const idUsuarioAssinatura = imobId || user.id
      try {
        const { data: assData } = await supabase
          .from('assinaturas')
          .select('*')
          .eq('usuario_id', idUsuarioAssinatura)
          .maybeSingle()

        if (assData) {
          setAssinatura(assData as Assinatura)
        } else {
          setAssinatura({
            id: isCorretor && imobId ? 'imob_' + imobId : 'local_gratis',
            usuario_id: idUsuarioAssinatura,
            plano_id: ehImob || isCorretor ? 'imobiliaria' : 'gratis',
            status: 'ativo',
            data_inicio: new Date().toISOString(),
            metodo_pagamento: 'gratis',
            created_at: new Date().toISOString(),
          })
        }
      } catch (e) {
        console.error('Erro ao buscar assinatura:', e)
      }

      // ── CARREGAMENTO DE FATURAS (Apenas para Imobiliária / Dono da conta) ──
      if (ehImob) {
        try {
          const { data: faturasData } = await supabase
            .from('faturas')
            .select('*')
            .eq('usuario_id', user.id)
            .order('created_at', { ascending: false })
          if (faturasData) {
            setFaturas(faturasData as Fatura[])
          }
        } catch (e) {
          console.error('Erro ao buscar faturas:', e)
        }
      }

      setCarregando(false)
    }
    carregar()
  }, [supabase])

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
        alert(
          `⚠️ Cota Corporativa Atingida\n\nA cota de anúncios ativos da imobiliária ${imobiliariaDona?.nome ? `"${imobiliariaDona.nome}"` : 'vinculada'} atingiu o limite (${usoPlano.limiteMaximo} anúncios).\n\nEntre em contato com o administrador da sua imobiliária para solicitar novas vagas.`
        )
        return
      }
      setModalLimiteAberto(true)
      return
    }

    await supabase.from('imoveis').update({ status: novoStatus }).eq('id', id)
    setImoveis((prev) => prev.map((i) => i.id === id ? { ...i, status: novoStatus as Imovel['status'] } : i))
  }

  async function excluirImovel(id: string, titulo: string) {
    if (!confirm(`Tem certeza que deseja excluir permanentemente o anúncio "${titulo}"? Esta ação não pode ser desfeita.`)) return

    try {
      await supabase.from('fotos_imovel').delete().eq('imovel_id', id)
      await supabase.from('leads').delete().eq('imovel_id', id)
      const { error } = await supabase.from('imoveis').delete().eq('id', id)
      if (error) throw error

      setImoveis((prev) => prev.filter((i) => i.id !== id))
      alert('Imóvel excluído com sucesso!')
    } catch (err: any) {
      console.error('Erro ao excluir imóvel:', err)
      alert('Não foi possível excluir o imóvel.')
    }
  }

  async function alterarStatusLead(id: string, status: string) {
    await supabase.from('leads').update({ status }).eq('id', id)
    setLeads((prev) => prev.map((l) => l.id === id ? { ...l, status: status as Lead['status'] } : l))
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
    if (!confirm('Deseja realmente sair da sua conta?')) return
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  if (carregando) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0f172a', color: '#ffffff' }}>
        <div>Carregando Workspace...</div>
      </div>
    )
  }

  return (
    <div className={styles.workspaceWrapper}>
      {/* ── TOPBAR CORPORATIVO DO PAINEL ── */}
      <header className={styles.topbar}>
        <div className={styles.topbarEsquerda}>
          <button
            type="button"
            className={styles.logoPainel}
            onClick={() => trocarAba('dashboard')}
            title="Ir para o Dashboard"
          >
            <LogoGota size={30} />
            <span className={styles.logoTexto}>FIXUM</span>
            <span className={styles.badgePro}>WORKSPACE</span>
          </button>

          <div className={styles.divisorVertical} />

          <div className={styles.empresaInfo}>
            <span className={styles.empresaNome}>{usuarioNome}</span>
            <span className={styles.empresaTipo}>
              {isImobiliaria
                ? '🏢 Gestão Imobiliária'
                : isCorretor && imobiliariaDona
                  ? `👔 Corretor Oficial — ${imobiliariaDona.nome}`
                  : '👤 Painel de Anúncios'}
            </span>
          </div>
        </div>

        <div className={styles.topbarDireita}>
          {/* Badge do Topbar (Apenas para gestor imobiliária ou tag estática de equipe para corretores) */}
          {isCorretor ? (
            imobiliariaDona ? (
              <div
                className={styles.badgePlanoTopbar}
                style={{ cursor: 'default', background: '#f8fafc', borderColor: '#e2e8f0', color: '#475569' }}
                title={`Vinculado à equipe de ${imobiliariaDona.nome}`}
              >
                <span>🏢 Equipe <strong>{imobiliariaDona.nome}</strong></span>
              </div>
            ) : null
          ) : isImobiliaria ? (
            <button
              type="button"
              className={styles.badgePlanoTopbar}
              onClick={() => trocarAba('plano')}
              title="Gerenciar Plano & Faturas da Imobiliária"
            >
              <span className={styles.iconePlano}>💳</span>
              <span>Plano <strong>{usoPlano.plano.nome}</strong></span>
              <span className={styles.vagasPill}>
                {usoPlano.imoveisAtivos}/{usoPlano.limiteMaximo >= 99999 ? '∞' : usoPlano.limiteMaximo} vagas
              </span>
            </button>
          ) : null}

          {/* Ver Portal no Mapa em Nova Aba */}
          <a
            href="/explorar"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.btnVerPortal}
            title="Visualizar mapa público em nova aba"
          >
            <span>🌐 Ver Mapa Público</span>
            <span style={{ fontSize: '0.75rem' }}>↗</span>
          </a>

          {/* Botão Novo Imóvel */}
          <Link href="/painel/novo-imovel" className="btn btn-primario btn-sm" style={{ fontWeight: 700 }}>
            + Novo Imóvel
          </Link>

          {/* Botão Sair */}
          <button
            type="button"
            className={styles.btnSairTopbar}
            onClick={handleSair}
            title="Encerrar sessão"
          >
            🚪 Sair
          </button>
        </div>
      </header>

      <div className={styles.painel}>
        {/* Sidebar */}
        <aside className={styles.sidebar}>
          <nav className={styles.sidebarNav}>
            {[
              { id: 'dashboard', icone: '📊', label: 'Dashboard' },
              { id: 'imoveis', icone: '🏢', label: 'Meus Imóveis' },
              { id: 'leads', icone: '👥', label: `Leads ${stats.leadsNovos > 0 ? `(${stats.leadsNovos})` : ''}` },
              ...(isImobiliaria ? [{ id: 'corretores', icone: '👔', label: 'Equipe de Corretores' }] : []),
              ...(!isCorretor ? [{ id: 'plano', icone: '💳', label: 'Meu Plano' }] : []),
            ].map((item) => (
              <button
                key={item.id}
                className={`${styles.sidebarItem} ${abaAtiva === item.id ? styles.sidebarItemAtivo : ''}`}
                onClick={() => trocarAba(item.id as Aba)}
              >
                <span>{item.icone}</span>
                <span>{item.label}</span>
              </button>
            ))}

            <div style={{ marginTop: 'auto', paddingTop: '1.25rem', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <button
                type="button"
                className={styles.sidebarItem}
                onClick={() => setModalSegurancaAberto(true)}
                title="Segurança & 2FA"
              >
                <span>🛡️</span>
                <span>Segurança & 2FA</span>
              </button>

              <a
                href="/explorar"
                target="_blank"
                rel="noopener noreferrer"
                className={styles.sidebarItem}
                style={{ color: '#94a3b8' }}
              >
                <span>🌐</span>
                <span>Portal no Mapa ↗</span>
              </a>

              <button
                type="button"
                className={styles.sidebarItem}
                onClick={handleSair}
                style={{ color: '#f87171' }}
              >
                <span>🚪</span>
                <span>Sair da Conta</span>
              </button>
            </div>
          </nav>
        </aside>

        {/* Conteúdo */}
        <main className={styles.conteudo}>

          {/* ── DASHBOARD ── */}
          {abaAtiva === 'dashboard' && (
            <div className={styles.secao}>
              <h1>Olá, {usuarioNome}! 👋</h1>
              <p className={styles.subtitulo}>Aqui está o resumo dos seus anúncios</p>

              {/* Banner de Plano e Capacidade (Apenas para gestor imobiliária / anunciante dono) */}
              {!isCorretor && (
                <div style={{
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '1rem',
                  padding: '1.25rem',
                  marginBottom: '1.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '1rem',
                  flexWrap: 'wrap'
                }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#0f4c81', background: '#eff6ff', padding: '2px 8px', borderRadius: '999px' }}>
                        Plano {usoPlano.plano.nome}
                      </span>
                      <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
                        • {usoPlano.imoveisAtivos} de {usoPlano.limiteMaximo >= 99999 ? '∞' : usoPlano.limiteMaximo} anúncios ativos
                      </span>
                    </div>
                    <div style={{ width: '220px', height: '6px', background: '#e2e8f0', borderRadius: '999px', overflow: 'hidden' }}>
                      <div style={{
                        width: `${Math.min(100, Math.max(5, usoPlano.porcentagemUso))}%`,
                        height: '100%',
                        backgroundColor: usoPlano.atingiuLimite ? '#ef4444' : '#0f4c81',
                        borderRadius: '999px'
                      }} />
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      className="btn btn-outline btn-sm"
                      onClick={() => trocarAba('plano')}
                    >
                      Ver Detalhes do Plano
                    </button>
                    {proximoPlano && (
                      <button
                        className="btn btn-primario btn-sm"
                        onClick={() => dispararUpgrade(proximoPlano)}
                      >
                        ⚡ Fazer Upgrade
                      </button>
                    )}
                  </div>
                </div>
              )}

              <div className={styles.gridStats}>
                {[
                  { label: 'Total de imóveis', valor: stats.total, icone: '🏢', cor: '#0f4c81' },
                  { label: 'Publicados', valor: stats.publicados, icone: '✅', cor: '#22c55e' },
                  { label: 'Pausados', valor: stats.pausados, icone: '⏸️', cor: '#f59e0b' },
                  { label: 'Leads novos', valor: stats.leadsNovos, icone: '👥', cor: '#ef4444' },
                ].map((s) => (
                  <div key={s.label} className={styles.statCard} style={{ borderTopColor: s.cor }}>
                    <span className={styles.statIcone}>{s.icone}</span>
                    <strong className={styles.statValor}>{s.valor}</strong>
                    <span className={styles.statLabel}>{s.label}</span>
                  </div>
                ))}
              </div>

              {imoveis.length === 0 && (
                <div className={styles.vazio}>
                  <span>🏡</span>
                  <h3>Você ainda não tem imóveis cadastrados</h3>
                  <p>Comece anunciando seu primeiro imóvel. É rápido e gratuito!</p>
                  <Link href="/painel/novo-imovel" className="btn btn-primario btn-lg">
                    Anunciar meu primeiro imóvel
                  </Link>
                </div>
              )}
            </div>
          )}

          {/* ── IMÓVEIS ── */}
          {abaAtiva === 'imoveis' && (
            <div className={styles.secao}>
              <div className={styles.secaoHeader}>
                <div>
                  <h1>Meus Imóveis</h1>
                  <p style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.2rem' }}>
                    {isCorretor
                      ? 'Gerencie seus anúncios publicados'
                      : isImobiliaria
                        ? `${usoPlano.imoveisAtivos}/${usoPlano.limiteMaximo >= 99999 ? '∞' : usoPlano.limiteMaximo} imóveis ativos na cota corporativa`
                        : `${usoPlano.imoveisAtivos}/${usoPlano.limiteMaximo >= 99999 ? '∞' : usoPlano.limiteMaximo} imóveis ativos`}
                  </p>
                </div>

                {/* Filtro por Corretor para a Imobiliária Gestora */}
                {isImobiliaria && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569' }}>Filtrar por:</span>
                    <select
                      value={filtroCorretor}
                      onChange={(e) => setFiltroCorretor(e.target.value)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '8px',
                        border: '1.5px solid #cbd5e1',
                        background: '#ffffff',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        color: '#0f172a',
                        cursor: 'pointer',
                      }}
                    >
                      <option value="todos">👥 Toda a Equipe ({imoveis.length})</option>
                      <option value={usuarioId}>🏢 Meus Diretos ({imoveis.filter((i) => i.anunciante_id === usuarioId).length})</option>
                      {listaCorretoresFiltro.map((c) => (
                        <option key={c.id} value={c.id}>
                          👤 {c.nome} ({imoveis.filter((i) => i.anunciante_id === c.id).length})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {usoPlano.atingiuLimite && (
                <div style={{
                  background: '#fef2f2',
                  border: '1px solid #fee2e2',
                  borderRadius: '0.75rem',
                  padding: '0.85rem 1.25rem',
                  marginBottom: '1.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '1rem',
                  flexWrap: 'wrap'
                }}>
                  <span style={{ fontSize: '0.85rem', color: '#991b1b' }}>
                    {isCorretor
                      ? '⚠️ A cota corporativa atingiu o limite de anúncios ativos. Contate a administração da imobiliária para solicitar novas vagas.'
                      : `⚠️ Você atingiu o limite de ${usoPlano.limiteMaximo} imóvel(is) ativo(s) do seu plano ${usoPlano.plano.nome}.`}
                  </span>
                  {!isCorretor && proximoPlano && (
                    <button
                      className="btn btn-primario btn-sm"
                      onClick={() => dispararUpgrade(proximoPlano)}
                    >
                      Fazer Upgrade para {proximoPlano.nome}
                    </button>
                  )}
                </div>
              )}

              {imoveis.length === 0 ? (
                <div className={styles.vazio}>
                  <span>🏢</span>
                  <h3>Nenhum imóvel cadastrado</h3>
                  <p style={{ color: '#64748b', marginBottom: '1.25rem', fontSize: '0.9rem' }}>
                    Comece anunciando seu primeiro imóvel para exibi-lo no mapa.
                  </p>
                  <Link href="/painel/novo-imovel" className="btn btn-primario btn-lg">
                    Cadastrar primeiro imóvel
                  </Link>
                </div>
              ) : (
                <div className={styles.listaImoveis}>
                  {imoveis
                    .filter((i) => filtroCorretor === 'todos' || i.anunciante_id === filtroCorretor)
                    .map((imovel) => {
                      const status = imovel.status
                      const isAtivo = status === 'publicado' || status === 'ativo'
                      const isPausado = status === 'pausado'
                      const isVendido = status === 'vendido' || status === 'alugado'

                      return (
                        <div key={imovel.id} className={styles.imovelRow}>
                          <div
                            className={styles.imovelFoto}
                            style={{ backgroundImage: `url(${fotoPrincipal(imovel)})` }}
                          >
                            {!imovel.fotos?.length && <span>🏠</span>}
                          </div>
                          <div className={styles.imovelInfo}>
                            <strong>{imovel.titulo}</strong>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '2px' }}>
                              <span>{labelTipoImovel(imovel.tipo)} • {imovel.cidade}</span>
                              {isImobiliaria && nomesAnunciantes[imovel.anunciante_id] && (
                                <span style={{
                                  fontSize: '0.75rem',
                                  fontWeight: 700,
                                  color: '#1d4ed8',
                                  background: '#eff6ff',
                                  border: '1px solid #bfdbfe',
                                  padding: '2px 8px',
                                  borderRadius: '12px',
                                }}>
                                  👤 {nomesAnunciantes[imovel.anunciante_id]}
                                </span>
                              )}
                            </div>
                            <span className={styles.imovelPreco}>{formatarPreco(imovel.preco, imovel.negociacao)}</span>
                          </div>

                          <div className={styles.imovelStatus}>
                            <span
                              className={styles.statusBadge}
                              style={{
                                background: isAtivo ? '#ecfdf5' : isPausado ? '#fffbeb' : '#f1f5f9',
                                color: isAtivo ? '#065f46' : isPausado ? '#b45309' : '#475569',
                                border: `1px solid ${isAtivo ? '#a7f3d0' : isPausado ? '#fde68a' : '#cbd5e1'}`,
                                fontWeight: 700,
                                textTransform: 'capitalize',
                              }}
                            >
                              {isAtivo ? '🟢 Ativo' : isPausado ? '⏸️ Pausado' : isVendido ? '🏷️ Vendido' : status}
                            </span>
                          </div>

                          <div className={styles.imovelAcoes}>
                            <Link href={`/imovel/${imovel.id}`} target="_blank" className="btn btn-ghost btn-sm" title="Ver anúncio público">
                              Ver
                            </Link>
                            <Link href={`/painel/editar-imovel/${imovel.id}`} className="btn btn-outline btn-sm" title="Editar dados e fotos">
                              ✏️ Editar
                            </Link>

                            {/* Ação de Pausar / Publicar */}
                            {isAtivo && (
                              <button
                                type="button"
                                className="btn btn-outline btn-sm"
                                onClick={() => alterarStatus(imovel.id, 'pausado')}
                                title="Pausar anúncio (não consome vaga de imóvel ativo)"
                              >
                                ⏸️ Pausar
                              </button>
                            )}

                            {isPausado && (
                              <button
                                type="button"
                                className="btn btn-primario btn-sm"
                                onClick={() => alterarStatus(imovel.id, 'publicado')}
                                title="Publicar anúncio no mapa"
                              >
                                ▶️ Ativar
                              </button>
                            )}

                            {/* Ação de Marcar como Vendido */}
                            {!isVendido && (
                              <button
                                type="button"
                                className="btn btn-outline btn-sm"
                                onClick={() => {
                                  if (confirm(`Marcar o imóvel "${imovel.titulo}" como VENDIDO / NEGOCIADO?`)) {
                                    alterarStatus(imovel.id, 'vendido')
                                  }
                                }}
                                title="Marcar como vendido"
                                style={{ color: '#059669' }}
                              >
                                🏷️ Vendido
                              </button>
                            )}

                            {isVendido && (
                              <button
                                type="button"
                                className="btn btn-outline btn-sm"
                                onClick={() => alterarStatus(imovel.id, 'publicado')}
                                title="Reativar anúncio no mapa"
                              >
                                🔄 Reativar
                              </button>
                            )}

                            {/* Ação de Excluir */}
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              onClick={() => excluirImovel(imovel.id, imovel.titulo)}
                              title="Excluir imóvel permanentemente"
                              style={{ color: '#dc2626' }}
                            >
                              🗑️
                            </button>
                          </div>
                        </div>
                      )
                    })}
                </div>
              )}
            </div>
          )}

          {/* ── LEADS ── */}
          {abaAtiva === 'leads' && (
            <div className={styles.secao}>
              <h1>Leads</h1>
              <p className={styles.subtitulo}>Pessoas interessadas nos seus imóveis</p>

              {leads.length === 0 ? (
                <div className={styles.vazio}>
                  <span>👥</span>
                  <h3>Nenhum lead ainda</h3>
                  <p>Quando alguém entrar em contato pelos seus imóveis, aparecerá aqui</p>
                </div>
              ) : (
                <div className={styles.listaLeads}>
                  {leads.map((lead) => (
                    <div key={lead.id} className={styles.leadCard}>
                      <div className={styles.leadAvatar}>
                        {lead.nome.charAt(0).toUpperCase()}
                      </div>
                      <div className={styles.leadInfo}>
                        <strong>{lead.nome}</strong>
                        {lead.email && <span>📧 {lead.email}</span>}
                        {lead.telefone && <span>📱 {lead.telefone}</span>}
                        {lead.mensagem && <p className={styles.leadMensagem}>{lead.mensagem}</p>}
                        <span className={styles.leadData}>
                          {new Date(lead.created_at).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                      <div className={styles.leadAcoes}>
                        <select
                          className="campo"
                          value={lead.status}
                          onChange={(e) => alterarStatusLead(lead.id, e.target.value)}
                          style={{ fontSize: '0.75rem', padding: '6px 10px' }}
                        >
                          {['novo', 'em_contato', 'visita_agendada', 'proposta', 'negociacao', 'fechado', 'perdido'].map((s) => (
                            <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                          ))}
                        </select>
                        {lead.telefone && (
                          <a
                            href={`https://wa.me/55${lead.telefone.replace(/\D/g, '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-primario btn-sm"
                          >
                            💬 WhatsApp
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── EQUIPE DE CORRETORES (APENAS GESTOR DA IMOBILIÁRIA) ── */}
          {abaAtiva === 'corretores' && isImobiliaria && (
            <AbaCorretores
              imobiliariaId={usuarioId}
              imobiliariaNome={usuarioNome}
            />
          )}

          {/* ── MEU PLANO (SEGREGAÇÃO DE PERMISSÕES) ── */}
          {abaAtiva === 'plano' && (
            isCorretor && imobiliariaDona ? (
              <div style={{
                background: '#ffffff',
                border: '1.5px solid #bfdbfe',
                borderRadius: '1rem',
                padding: '2.5rem 2rem',
                textAlign: 'center',
                maxWidth: '620px',
                margin: '2rem auto',
                boxShadow: '0 4px 20px rgba(37, 99, 235, 0.08)',
              }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>👔</div>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.5rem' }}>
                  Plano Corporativo — {imobiliariaDona.nome}
                </h2>
                <p style={{ color: '#64748b', fontSize: '0.95rem', lineHeight: '1.5', marginBottom: '1.5rem' }}>
                  Sua conta de corretor está vinculada à cota corporativa oficial da <strong>{imobiliariaDona.nome}</strong>.
                  Todos os seus anúncios publicados utilizam as vagas contratadas pela empresa.
                </p>
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: '#eff6ff',
                  border: '1.5px solid #93c5fd',
                  color: '#1d4ed8',
                  padding: '10px 18px',
                  borderRadius: '10px',
                  fontWeight: 700,
                  fontSize: '0.95rem',
                }}>
                  ⚡ Cota da Imobiliária: {usoPlano.imoveisAtivos} / {usoPlano.limiteMaximo >= 99999 ? '∞' : usoPlano.limiteMaximo} anúncios ativos
                </div>
                <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '1.75rem' }}>
                  ℹ️ Para solicitar ampliação de vagas ou alterações contratuais, consulte a administração da {imobiliariaDona.nome}.
                </p>
              </div>
            ) : (
              <AbaMeuPlano
                usoPlano={usoPlano}
                faturas={faturas}
                onAtualizarAssinatura={handleAtualizarAssinatura}
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
        />

        {/* Modal de Configurações de Segurança e 2FA */}
        <ModalConfigSeguranca
          aberto={modalSegurancaAberto}
          onFechar={() => setModalSegurancaAberto(false)}
          usuarioEmail={usuarioEmail}
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
