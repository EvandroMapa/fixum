'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { PLANOS_OFICIAIS, formatarMoeda } from '@/lib/planos'
import { CONFIG_PADRAO } from '@/lib/constants'
import { isSessaoAdminValida, encerrarSessaoAdmin } from '@/lib/admin-auth'
import styles from './page.module.css'

type AbaAdmin = 'metricas' | 'anunciantes' | 'imoveis' | 'financeiro' | 'configuracoes'

interface Estatisticas {
  totalImoveis: number
  imoveisAtivos: number
  totalUsuarios: number
  totalImobiliarias: number
  totalCorretores: number
  totalProprietarios: number
  mrrEstimado: number
}

interface UsuarioAdmin {
  id: string
  nome: string
  email: string
  telefone?: string
  tipo_anunciante?: string
  plano_id?: string
  created_at: string
  is_admin?: boolean
  total_imoveis?: number
}

interface ImovelAdmin {
  id: string
  titulo: string
  cidade: string
  bairro: string
  tipo: string
  negociacao: string
  preco: number
  status: string
  destaque: boolean
  created_at: string
  anunciante_id: string
  anunciante_nome?: string
}

export default function AdminPage() {
  const router = useRouter()
  const [abaAtiva, setAbaAtiva] = useState<AbaAdmin>('metricas')
  const [carregando, setCarregando] = useState(true)
  const [usuarioAtual, setUsuarioAtual] = useState<any>(null)
  const [stats, setStats] = useState<Estatisticas>({
    totalImoveis: 0,
    imoveisAtivos: 0,
    totalUsuarios: 0,
    totalImobiliarias: 0,
    totalCorretores: 0,
    totalProprietarios: 0,
    mrrEstimado: 0,
  })

  // Dados das listas
  const [usuarios, setUsuarios] = useState<UsuarioAdmin[]>([])
  const [imoveis, setImoveis] = useState<ImovelAdmin[]>([])
  const [busca, setBusca] = useState('')

  // Configurações
  const [whatsComercial, setWhatsComercial] = useState(CONFIG_PADRAO.WHATSAPP_COMERCIAL)
  const [whatsSuporte, setWhatsSuporte] = useState(CONFIG_PADRAO.WHATSAPP_SUPORTE)
  const [emailContato, setEmailContato] = useState(CONFIG_PADRAO.EMAIL_CONTATO)
  const [salvandoConfig, setSalvandoConfig] = useState(false)
  const [msgConfig, setMsgConfig] = useState<string | null>(null)

  useEffect(() => {
    carregarDadosAdmin()
  }, [])

  async function carregarDadosAdmin() {
    // 0. Validar se a sessão administrativa master está ativa
    if (!isSessaoAdminValida()) {
      router.push('/admin/login')
      return
    }

    setCarregando(true)
    const supabase = createClient()

    // 1. Obter usuário logado
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      encerrarSessaoAdmin()
      router.push('/admin/login')
      return
    }
    setUsuarioAtual(user)

    // 2. Carregar Imóveis
    const { data: listaImoveis } = await supabase
      .from('imoveis')
      .select('*')
      .order('created_at', { ascending: false })

    // 3. Carregar Usuários / Perfis
    const { data: listaUsuarios } = await supabase
      .from('perfis')
      .select('*')
      .order('created_at', { ascending: false })

    // 4. Carregar Configurações Globais
    const { data: configs } = await supabase
      .from('configuracoes_sistema')
      .select('*')

    if (configs) {
      configs.forEach((c: any) => {
        if (c.chave === 'whatsapp_comercial') setWhatsComercial(c.valor)
        if (c.chave === 'whatsapp_suporte') setWhatsSuporte(c.valor)
        if (c.chave === 'email_contato') setEmailContato(c.valor)
      })
    }

    const imoveisData = listaImoveis || []
    const usuariosData = listaUsuarios || []

    // Mapear total de imóveis por usuário
    const contagemPorUsuario: Record<string, number> = {}
    imoveisData.forEach((im: any) => {
      contagemPorUsuario[im.anunciante_id] = (contagemPorUsuario[im.anunciante_id] || 0) + 1
    })

    const usuariosFormatados: UsuarioAdmin[] = usuariosData.map((u: any) => ({
      id: u.id,
      nome: u.nome || u.nome_fantasia || 'Sem nome',
      email: u.email || '',
      telefone: u.telefone || u.whatsapp,
      tipo_anunciante: u.tipo_anunciante || 'proprietario',
      plano_id: u.plano_id || 'gratis',
      created_at: u.created_at,
      is_admin: u.is_admin,
      total_imoveis: contagemPorUsuario[u.id] || 0,
    }))

    // Mapear nome do anunciante nos imóveis
    const mapaUsuarios: Record<string, string> = {}
    usuariosFormatados.forEach((u) => {
      mapaUsuarios[u.id] = u.nome
    })

    const imoveisFormatados: ImovelAdmin[] = imoveisData.map((im: any) => ({
      id: im.id,
      titulo: im.titulo,
      cidade: im.cidade,
      bairro: im.bairro,
      tipo: im.tipo,
      negociacao: im.negociacao,
      preco: im.preco,
      status: im.status || 'ativo',
      destaque: im.destaque || false,
      created_at: im.created_at,
      anunciante_id: im.anunciante_id,
      anunciante_nome: mapaUsuarios[im.anunciante_id] || 'Anunciante Fixum',
    }))

    setUsuarios(usuariosFormatados)
    setImoveis(imoveisFormatados)

    // Calcular KPIs
    const imoveisAtivos = imoveisFormatados.filter((i) => i.status === 'ativo').length
    const imobiliarias = usuariosFormatados.filter((u) => u.tipo_anunciante === 'imobiliaria').length
    const corretores = usuariosFormatados.filter((u) => u.tipo_anunciante === 'corretor').length
    const proprietarios = usuariosFormatados.filter((u) => u.tipo_anunciante !== 'imobiliaria' && u.tipo_anunciante !== 'corretor').length

    // MRR Estimado (simulação com base nos planos dos anunciantes)
    let mrrTotal = 0
    usuariosFormatados.forEach((u) => {
      const plano = PLANOS_OFICIAIS.find((p) => p.id === u.plano_id)
      if (plano) mrrTotal += plano.preco_mensal
    })

    setStats({
      totalImoveis: imoveisFormatados.length,
      imoveisAtivos,
      totalUsuarios: usuariosFormatados.length,
      totalImobiliarias: imobiliarias,
      totalCorretores: corretores,
      totalProprietarios: proprietarios,
      mrrEstimado: mrrTotal,
    })

    setCarregando(false)
  }

  // Alternar Destaque do Imóvel
  async function handleToggleDestaque(id: string, destaqueAtual: boolean) {
    const supabase = createClient()
    const novoDestaque = !destaqueAtual

    setImoveis((prev) =>
      prev.map((i) => (i.id === id ? { ...i, destaque: novoDestaque } : i))
    )

    await supabase.from('imoveis').update({ destaque: novoDestaque }).eq('id', id)
  }

  // Alternar Status do Imóvel (Ativo / Pausado)
  async function handleToggleStatusImovel(id: string, statusAtual: string) {
    const supabase = createClient()
    const novoStatus = statusAtual === 'ativo' ? 'pausado' : 'ativo'

    setImoveis((prev) =>
      prev.map((i) => (i.id === id ? { ...i, status: novoStatus } : i))
    )

    await supabase.from('imoveis').update({ status: novoStatus }).eq('id', id)
  }

  // Excluir Imóvel como Admin
  async function handleExcluirImovel(id: string, titulo: string) {
    if (!confirm(`Tem certeza que deseja remover o anúncio "${titulo}" da plataforma?`)) return
    const supabase = createClient()

    setImoveis((prev) => prev.filter((i) => i.id !== id))
    await supabase.from('imoveis').delete().eq('id', id)
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
      { chave: 'email_contato', valor: emailContato, descricao: 'E-mail de contato' },
    ], { onConflict: 'chave' })

    setSalvandoConfig(false)
    if (error) {
      setMsgConfig('⚠️ As configurações foram salvas em memória (execute scripts/admin-e-configuracoes.sql para persistência no banco).')
    } else {
      setMsgConfig('✅ Configurações atualizadas com sucesso em toda a plataforma!')
    }
  }

  function handleLogoutAdmin() {
    encerrarSessaoAdmin()
    router.push('/admin/login')
  }

  // Filtros de busca
  const anunciantesFiltrados = usuarios.filter((u) =>
    u.nome.toLowerCase().includes(busca.toLowerCase()) ||
    u.email.toLowerCase().includes(busca.toLowerCase()) ||
    u.tipo_anunciante?.toLowerCase().includes(busca.toLowerCase())
  )

  const imoveisFiltrados = imoveis.filter((i) =>
    i.titulo.toLowerCase().includes(busca.toLowerCase()) ||
    i.cidade.toLowerCase().includes(busca.toLowerCase()) ||
    i.bairro.toLowerCase().includes(busca.toLowerCase()) ||
    i.anunciante_nome?.toLowerCase().includes(busca.toLowerCase())
  )

  return (
    <div className={styles.adminLayout}>
      {/* ── SIDEBAR EXECUTIVA ── */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <Link href="/" className={styles.logoAdmin}>
            <span style={{ fontSize: '1.4rem' }}>📍</span>
            <strong style={{ fontSize: '1.2rem', color: '#ffffff', letterSpacing: '-0.02em' }}>FIXUM</strong>
          </Link>
          <span className={styles.badgeAdmin}>Admin</span>
        </div>

        <nav className={styles.nav}>
          <button
            type="button"
            className={`${styles.navItem} ${abaAtiva === 'metricas' ? styles.navItemAtivo : ''}`}
            onClick={() => { setAbaAtiva('metricas'); setBusca('') }}
          >
            <span className={styles.navIcone}>📊</span>
            Dashboard Executivo
          </button>

          <button
            type="button"
            className={`${styles.navItem} ${abaAtiva === 'anunciantes' ? styles.navItemAtivo : ''}`}
            onClick={() => { setAbaAtiva('anunciantes'); setBusca('') }}
          >
            <span className={styles.navIcone}>👥</span>
            Anunciantes ({usuarios.length})
          </button>

          <button
            type="button"
            className={`${styles.navItem} ${abaAtiva === 'imoveis' ? styles.navItemAtivo : ''}`}
            onClick={() => { setAbaAtiva('imoveis'); setBusca('') }}
          >
            <span className={styles.navIcone}>🏢</span>
            Imóveis & Moderação ({imoveis.length})
          </button>

          <button
            type="button"
            className={`${styles.navItem} ${abaAtiva === 'financeiro' ? styles.navItemAtivo : ''}`}
            onClick={() => { setAbaAtiva('financeiro'); setBusca('') }}
          >
            <span className={styles.navIcone}>💳</span>
            Financeiro & Planos
          </button>

          <button
            type="button"
            className={`${styles.navItem} ${abaAtiva === 'configuracoes' ? styles.navItemAtivo : ''}`}
            onClick={() => { setAbaAtiva('configuracoes'); setBusca('') }}
          >
            <span className={styles.navIcone}>⚙️</span>
            Configurações Fixum
          </button>
        </nav>

        <div className={styles.sidebarFooter}>
          <div className={styles.userPerfil}>
            <div className={styles.avatar}>A</div>
            <div className={styles.userDados}>
              <span className={styles.userNome}>{usuarioAtual?.email || 'Administrador'}</span>
              <span className={styles.userRole}>Super Administrador</span>
            </div>
          </div>
        </div>
      </aside>

      {/* ── CONTEÚDO PRINCIPAL ── */}
      <main className={styles.conteudoPrincipal}>
        {/* Topbar */}
        <header className={styles.topbar}>
          <h1 className={styles.topbarTitulo}>
            {abaAtiva === 'metricas' && '📊 Visão Geral & Métricas da Plataforma'}
            {abaAtiva === 'anunciantes' && '👥 Gestão de Anunciantes e Imobiliárias'}
            {abaAtiva === 'imoveis' && '🏢 Moderação Global de Imóveis'}
            {abaAtiva === 'financeiro' && '💳 Gestão de Faturas & Assinaturas'}
            {abaAtiva === 'configuracoes' && '⚙️ Configurações Gerais da Fixum'}
          </h1>

          <div className={styles.topbarAcoes}>
            <Link href="/" className={styles.btnVoltarSite} target="_blank">
              🌐 Ver Portal
            </Link>
            <button
              type="button"
              onClick={handleLogoutAdmin}
              className={styles.btnVoltarSite}
              style={{ borderColor: 'rgba(239, 68, 68, 0.4)', color: '#f87171' }}
            >
              🔒 Sair do Admin
            </button>
          </div>
        </header>

        <div className={styles.corpo}>
          {carregando ? (
            <div style={{ padding: '60px', textAlign: 'center', color: '#94a3b8' }}>
              Carregando dados da plataforma...
            </div>
          ) : (
            <>
              {/* ── ABA 1: MÉTRICAS / DASHBOARD ── */}
              {abaAtiva === 'metricas' && (
                <>
                  <div className={styles.gridKpis}>
                    <div className={styles.cardKpi}>
                      <div>
                        <div className={styles.kpiLabel}>MRR Recorrente</div>
                        <div className={styles.kpiValor}>{formatarMoeda(stats.mrrEstimado)}</div>
                        <div className={styles.kpiSub}>Em assinaturas ativas</div>
                      </div>
                      <div className={`${styles.kpiIconeBox} ${styles.boxVerde}`}>💰</div>
                    </div>

                    <div className={styles.cardKpi}>
                      <div>
                        <div className={styles.kpiLabel}>Total de Imóveis</div>
                        <div className={styles.kpiValor}>{stats.totalImoveis}</div>
                        <div className={styles.kpiSub}>{stats.imoveisAtivos} ativos no mapa</div>
                      </div>
                      <div className={`${styles.kpiIconeBox} ${styles.boxAzul}`}>🏢</div>
                    </div>

                    <div className={styles.cardKpi}>
                      <div>
                        <div className={styles.kpiLabel}>Anunciantes</div>
                        <div className={styles.kpiValor}>{stats.totalUsuarios}</div>
                        <div className={styles.kpiSub}>{stats.totalImobiliarias} imobiliárias cadastradas</div>
                      </div>
                      <div className={`${styles.kpiIconeBox} ${styles.boxRoxo}`}>👥</div>
                    </div>

                    <div className={styles.cardKpi}>
                      <div>
                        <div className={styles.kpiLabel}>WhatsApp Comercial</div>
                        <div className={styles.kpiValor} style={{ fontSize: '1.25rem' }}>{whatsComercial}</div>
                        <div className={styles.kpiSub}>Canal de captação ativo</div>
                      </div>
                      <div className={`${styles.kpiIconeBox} ${styles.boxLaranja}`}>💬</div>
                    </div>
                  </div>

                  {/* Resumo Rápido */}
                  <div className={styles.painelBox}>
                    <div className={styles.painelHeader}>
                      <h2 className={styles.painelTitulo}>📍 Imóveis Recentes na Plataforma</h2>
                      <button
                        type="button"
                        className={styles.btnAcao}
                        onClick={() => setAbaAtiva('imoveis')}
                      >
                        Ver todos ({imoveis.length}) →
                      </button>
                    </div>
                    <div className={styles.tabelaWrapper}>
                      <table className={styles.tabela}>
                        <thead>
                          <tr>
                            <th>Título</th>
                            <th>Cidade / Bairro</th>
                            <th>Valor</th>
                            <th>Anunciante</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {imoveis.slice(0, 5).map((im) => (
                            <tr key={im.id}>
                              <td><strong>{im.titulo}</strong></td>
                              <td>{im.cidade} — {im.bairro}</td>
                              <td>{formatarMoeda(im.preco)}</td>
                              <td>{im.anunciante_nome}</td>
                              <td>
                                <span className={`${styles.badge} ${im.status === 'ativo' ? styles.badgeAtivo : styles.badgePendente}`}>
                                  {im.status === 'ativo' ? 'Publicado' : 'Pausado'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}

              {/* ── ABA 2: ANUNCIANTES ── */}
              {abaAtiva === 'anunciantes' && (
                <div className={styles.painelBox}>
                  <div className={styles.painelHeader}>
                    <h2 className={styles.painelTitulo}>👥 Base de Anunciantes Cadastrados</h2>
                    <input
                      type="text"
                      placeholder="Buscar por nome, e-mail ou tipo..."
                      value={busca}
                      onChange={(e) => setBusca(e.target.value)}
                      className={styles.campoBusca}
                    />
                  </div>

                  <div className={styles.tabelaWrapper}>
                    <table className={styles.tabela}>
                      <thead>
                        <tr>
                          <th>Nome / Fantasia</th>
                          <th>E-mail</th>
                          <th>Telefone</th>
                          <th>Perfil</th>
                          <th>Plano Atual</th>
                          <th>Imóveis</th>
                        </tr>
                      </thead>
                      <tbody>
                        {anunciantesFiltrados.map((u) => (
                          <tr key={u.id}>
                            <td><strong>{u.nome}</strong></td>
                            <td>{u.email}</td>
                            <td>{u.telefone || '—'}</td>
                            <td>
                              <span className={`${styles.badge} ${
                                u.tipo_anunciante === 'imobiliaria' ? styles.badgeImobiliaria :
                                u.tipo_anunciante === 'corretor' ? styles.badgeCorretor : styles.badgeProprietario
                              }`}>
                                {u.tipo_anunciante === 'imobiliaria' ? '🏢 Imobiliária' :
                                 u.tipo_anunciante === 'corretor' ? '👔 Corretor' : '👤 Proprietário'}
                              </span>
                            </td>
                            <td>
                              <span style={{ textTransform: 'capitalize', fontWeight: 600, color: '#38bdf8' }}>
                                {u.plano_id || 'gratis'}
                              </span>
                            </td>
                            <td>
                              <strong>{u.total_imoveis}</strong> cadastrado(s)
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ── ABA 3: IMÓVEIS (MODERAÇÃO) ── */}
              {abaAtiva === 'imoveis' && (
                <div className={styles.painelBox}>
                  <div className={styles.painelHeader}>
                    <h2 className={styles.painelTitulo}>🏢 Moderação de Imóveis ({imoveisFiltrados.length})</h2>
                    <input
                      type="text"
                      placeholder="Buscar por título, cidade, anunciante..."
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
                          <th>Anunciante</th>
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
                            <td>{im.anunciante_nome}</td>
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

              {/* ── ABA 4: FINANCEIRO & PLANOS ── */}
              {abaAtiva === 'financeiro' && (
                <div className={styles.painelBox}>
                  <div className={styles.painelHeader}>
                    <h2 className={styles.painelTitulo}>💳 Tabela de Planos e Assinaturas</h2>
                  </div>

                  <div className={styles.gridKpis} style={{ marginBottom: '24px' }}>
                    {PLANOS_OFICIAIS.map((plano) => (
                      <div key={plano.id} className={styles.cardKpi}>
                        <div>
                          <div className={styles.kpiLabel}>{plano.nome}</div>
                          <div className={styles.kpiValor}>{formatarMoeda(plano.preco_mensal)}<span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>/mês</span></div>
                          <div className={styles.kpiSub}>Até {plano.limite_imoveis_max} imóveis</div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <p style={{ fontSize: '0.875rem', color: '#94a3b8' }}>
                    💡 No módulo financeiro, as assinaturas e faturas geradas pelos clientes via Pix/Cartão de Crédito são registradas automaticamente.
                  </p>
                </div>
              )}

              {/* ── ABA 5: CONFIGURAÇÕES DA PLATAFORMA ── */}
              {abaAtiva === 'configuracoes' && (
                <div className={styles.painelBox}>
                  <div className={styles.painelHeader}>
                    <h2 className={styles.painelTitulo}>⚙️ Configurações Globais da Fixum</h2>
                  </div>

                  <form onSubmit={handleSalvarConfig} className={styles.formConfig}>
                    <div className={styles.grupoInput}>
                      <label className={styles.labelForm}>
                        WhatsApp Comercial (Consultor / Atendimento Fixum)
                      </label>
                      <input
                        type="text"
                        value={whatsComercial}
                        onChange={(e) => setWhatsComercial(e.target.value)}
                        placeholder="Ex: 5531988027152"
                        className={styles.inputForm}
                        required
                      />
                      <span className={styles.dicaForm}>
                        Este número é utilizado em todos os botões &quot;Falar com Consultor&quot;, &quot;WhatsApp Comercial&quot; e na captação de imobiliárias.
                      </span>
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

                    {msgConfig && (
                      <div style={{
                        padding: '12px 16px',
                        borderRadius: '8px',
                        background: msgConfig.includes('⚠️') ? 'rgba(234, 179, 8, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                        color: msgConfig.includes('⚠️') ? '#facc15' : '#34d399',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                      }}>
                        {msgConfig}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={salvandoConfig}
                      className={styles.btnSalvarConfig}
                    >
                      {salvandoConfig ? 'Salvando...' : '💾 Salvar Configurações'}
                    </button>
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
