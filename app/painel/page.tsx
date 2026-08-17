'use client'

import { useEffect, useState, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { type Imovel, type Lead } from '@/lib/types'
import { formatarPreco, labelTipoImovel, fotoPrincipal } from '@/lib/utils'
import Header from '@/components/layout/Header'
import LogoGota from '@/components/ui/LogoGota'
import styles from './page.module.css'

type Aba = 'dashboard' | 'imoveis' | 'leads'

function PainelConteudo() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const abaParam = searchParams.get('aba') as Aba | null

  const abaInicial: Aba = (abaParam && ['dashboard', 'imoveis', 'leads'].includes(abaParam))
    ? abaParam
    : (typeof window !== 'undefined' && (localStorage.getItem('fixum_painel_aba') as Aba)) || 'imoveis'

  const [abaAtiva, setAbaAtiva] = useState<Aba>(abaInicial)
  const [imoveis, setImoveis] = useState<Imovel[]>([])
  const [leads, setLeads] = useState<Lead[]>([])
  const [carregando, setCarregando] = useState(true)
  const [usuarioNome, setUsuarioNome] = useState('')

  const supabase = createClient()

  useEffect(() => {
    if (abaParam && ['dashboard', 'imoveis', 'leads'].includes(abaParam)) {
      setAbaAtiva(abaParam)
    }
  }, [abaParam])

  function trocarAba(novaAba: Aba) {
    setAbaAtiva(novaAba)
    localStorage.setItem('fixum_painel_aba', novaAba)
    router.replace(`/painel?aba=${novaAba}`)
  }

  useEffect(() => {
    async function carregar() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/login'; return }

      const { data: perfil } = await supabase.from('perfis').select('nome, tipo').eq('id', user.id).single()

      if (!perfil || !perfil.tipo) {
        window.location.href = '/completar-perfil'
        return
      }
      setUsuarioNome(perfil?.nome ?? 'Usuário')

      const { data: imoveisData } = await supabase
        .from('imoveis')
        .select('*, fotos_imovel(id, url, principal, ordem)')
        .eq('anunciante_id', user.id)
        .order('created_at', { ascending: false })

      setImoveis((imoveisData ?? []).map((i: Record<string, unknown>) => ({
        ...i,
        fotos: (i.fotos_imovel as Record<string, unknown>[]) ?? [],
      })) as unknown as Imovel[])

      const imoveisIds = (imoveisData ?? []).map((i: Record<string, unknown>) => i.id as string)
      if (imoveisIds.length > 0) {
        const { data: leadsData } = await supabase
          .from('leads')
          .select('*, imoveis(titulo)')
          .in('imovel_id', imoveisIds)
          .order('created_at', { ascending: false })
        setLeads((leadsData ?? []) as Lead[])
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

  async function alterarStatus(id: string, status: string) {
    await supabase.from('imoveis').update({ status }).eq('id', id)
    setImoveis((prev) => prev.map((i) => i.id === id ? { ...i, status: status as Imovel['status'] } : i))
  }

  async function alterarStatusLead(id: string, status: string) {
    await supabase.from('leads').update({ status }).eq('id', id)
    setLeads((prev) => prev.map((l) => l.id === id ? { ...l, status: status as Lead['status'] } : l))
  }

  if (carregando) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div>Carregando painel...</div>
      </div>
    )
  }

  return (
    <>
      <Header />
      <div className={styles.painel}>
      {/* Sidebar */}
      <aside className={styles.sidebar}>
        <Link href="/" className={styles.sidebarLogo}>
          <LogoGota size={36} />
          <span>FIXUM</span>
        </Link>

        <nav className={styles.sidebarNav}>
          {[
            { id: 'dashboard', icone: '📊', label: 'Dashboard' },
            { id: 'imoveis', icone: '🏢', label: 'Meus Imóveis' },
            { id: 'leads', icone: '👥', label: `Leads ${stats.leadsNovos > 0 ? `(${stats.leadsNovos})` : ''}` },
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
        </nav>
      </aside>

      {/* Conteúdo */}
      <main className={styles.conteudo}>

        {/* ── DASHBOARD ── */}
        {abaAtiva === 'dashboard' && (
          <div className={styles.secao}>
            <h1>Olá, {usuarioNome}! 👋</h1>
            <p className={styles.subtitulo}>Aqui está o resumo dos seus anúncios</p>

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
              <h1>Meus Imóveis</h1>
              <Link href="/painel/novo-imovel" className="btn btn-primario">
                + Novo imóvel
              </Link>
            </div>

            {imoveis.length === 0 ? (
              <div className={styles.vazio}>
                <span>🏢</span>
                <h3>Nenhum imóvel cadastrado</h3>
                <Link href="/painel/novo-imovel" className="btn btn-primario btn-lg">Cadastrar imóvel</Link>
              </div>
            ) : (
              <div className={styles.listaImoveis}>
                {imoveis.map((imovel) => (
                  <div key={imovel.id} className={styles.imovelRow}>
                    <div
                      className={styles.imovelFoto}
                      style={{ backgroundImage: `url(${fotoPrincipal(imovel)})` }}
                    >
                      {!imovel.fotos?.length && <span>🏠</span>}
                    </div>
                    <div className={styles.imovelInfo}>
                      <strong>{imovel.titulo}</strong>
                      <span>{labelTipoImovel(imovel.tipo)} • {imovel.cidade}</span>
                      <span className={styles.imovelPreco}>{formatarPreco(imovel.preco, imovel.negociacao)}</span>
                    </div>
                    <div className={styles.imovelStatus}>
                      <span className={`${styles.statusBadge} ${styles[`status_${imovel.status}`]}`}>
                        {imovel.status}
                      </span>
                    </div>
                    <div className={styles.imovelAcoes}>
                      <Link href={`/imovel/${imovel.id}`} className="btn btn-ghost btn-sm">Ver</Link>
                      <Link href={`/painel/editar-imovel/${imovel.id}`} className="btn btn-outline btn-sm">Editar</Link>
                      {imovel.status === 'publicado' || imovel.status === 'ativo' ? (
                        <button className="btn btn-outline btn-sm" onClick={() => alterarStatus(imovel.id, 'pausado')}>Pausar</button>
                      ) : imovel.status === 'pausado' ? (
                        <button className="btn btn-primario btn-sm" onClick={() => alterarStatus(imovel.id, 'publicado')}>Publicar</button>
                      ) : null}
                    </div>
                  </div>
                ))}
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
                        {['novo','em_contato','visita_agendada','proposta','negociacao','fechado','perdido'].map((s) => (
                          <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                        ))}
                      </select>
                      {lead.telefone && (
                        <a
                          href={`https://wa.me/55${lead.telefone.replace(/\D/g,'')}`}
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
      </main>
    </div>
    </>
  )
}

export default function PainelPage() {
  return (
    <Suspense fallback={<div>Carregando painel...</div>}>
      <PainelConteudo />
    </Suspense>
  )
}
