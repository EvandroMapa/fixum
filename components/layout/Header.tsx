'use client'

import Link from 'next/link'
import { useState, useEffect, useRef, Suspense } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'
import { obterIniciaisUsuario, obterGradienteUsuario } from '@/lib/utils'
import { encerrarSessaoAdmin } from '@/lib/admin-auth'
import LogoGota from '@/components/ui/LogoGota'
import styles from './Header.module.css'

function HeaderConteudo() {
  const [scrolled, setScrolled] = useState(false)
  const [menuAberto, setMenuAberto] = useState(false)
  const [dropdownAberto, setDropdownAberto] = useState(false)
  const [usuario, setUsuario] = useState<User | null>(null)
  const [nomeUsuario, setNomeUsuario] = useState<string>('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [favoritosLista, setFavoritosLista] = useState<{ id: string; negociacao: string }[]>([])
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const router = useRouter()
  const dropdownRef = useRef<HTMLDivElement>(null)

  const isFavoritosAtivo = pathname.startsWith('/explorar') && searchParams?.get('favoritos') === 'true'
  const negociacaoAtual = searchParams?.get('negociacao')

  // Calcular contagem de favoritos da modalidade atual
  const totalFavoritos = (() => {
    if (negociacaoAtual === 'aluguel') {
      return favoritosLista.filter((f) => f.negociacao === 'aluguel').length
    }
    if (negociacaoAtual === 'venda') {
      return favoritosLista.filter((f) => f.negociacao === 'venda').length
    }
    if (pathname.startsWith('/explorar')) {
      return favoritosLista.filter((f) => f.negociacao === 'venda').length
    }
    return favoritosLista.length
  })()

  // Na home page: header transparente ate rolar
  // Em outras paginas: sempre solido
  const naHome = pathname === '/'
  const noExplorar = pathname === '/explorar' || pathname.startsWith('/explorar?') || pathname.startsWith('/explorar/')
  const naPaginaImovel = pathname.startsWith('/imovel/')
  const solido = !naHome || scrolled
  const ocultarNav = noExplorar || naPaginaImovel

  useEffect(() => {
    if (!naHome) return
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [naHome])

  // Carregar usuário logado, nome de perfil e lista detalhada de favoritos
  useEffect(() => {
    const sb = createClient()

    async function carregarDadosUsuario(user: User | null) {
      setUsuario(user)
      if (!user) {
        setNomeUsuario('')
        setIsAdmin(false)
        setFavoritosLista([])
        return
      }
      const nomeMeta = user.user_metadata?.nome || user.user_metadata?.full_name
      if (nomeMeta) setNomeUsuario(nomeMeta)

      try {
        const { data } = await sb.from('perfis').select('nome, is_admin, tipo').eq('id', user.id).maybeSingle()
        const ehAdmin = data?.is_admin === true || data?.tipo === 'admin' || user.user_metadata?.tipo === 'admin' || user.email === 'admin@fixum.com.br'
        setIsAdmin(ehAdmin)

        if (data?.nome) {
          setNomeUsuario(data.nome)
        } else if (!nomeMeta) {
          setNomeUsuario(user.email?.split('@')[0] || 'Usuário')
        }

        // Buscar lista de favoritos com a modalidade (venda/aluguel) do imóvel
        const { data: favs } = await sb
          .from('favoritos')
          .select('id, imoveis!inner(negociacao)')
          .eq('usuario_id', user.id)

        const lista = (favs ?? []).map((f: any) => ({
          id: f.id,
          negociacao: f.imoveis?.negociacao || 'venda',
        }))
        setFavoritosLista(lista)
      } catch {
        if (!nomeMeta) setNomeUsuario(user.email?.split('@')[0] || 'Usuário')
      }
    }

    sb.auth.getSession().then(({ data }: any) => carregarDadosUsuario(data?.session?.user ?? null))
    const { data: { subscription } } = sb.auth.onAuthStateChange((_e: any, session: any) => {
      carregarDadosUsuario(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  // Atualizar contador em tempo real quando o usuário favoritar/desfavoritar no mapa ou cards
  useEffect(() => {
    const sb = createClient()
    async function recarregarFavoritos() {
      const { data: { session } } = await sb.auth.getSession()
      if (!session?.user) return
      const { data: favs } = await sb
        .from('favoritos')
        .select('id, imoveis!inner(negociacao)')
        .eq('usuario_id', session.user.id)

      const lista = (favs ?? []).map((f: any) => ({
        id: f.id,
        negociacao: f.imoveis?.negociacao || 'venda',
      }))
      setFavoritosLista(lista)
    }

    function handleFavoritoAtualizado() {
      recarregarFavoritos()
    }

    window.addEventListener('fixum:favoritoAtualizado', handleFavoritoAtualizado)
    return () => window.removeEventListener('fixum:favoritoAtualizado', handleFavoritoAtualizado)
  }, [])

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownAberto(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function handleSair() {
    const sb = createClient()
    encerrarSessaoAdmin()
    await sb.auth.signOut()
    setDropdownAberto(false)
    router.push('/')
  }

  const inicialAvatar = obterIniciaisUsuario(nomeUsuario || usuario?.user_metadata?.nome, usuario?.email)
  const gradienteAvatar = obterGradienteUsuario(usuario?.id || usuario?.email || nomeUsuario)

  return (
    <header className={`${styles.header} ${solido ? styles.solido : ''}`}>
      <div className={styles.inner}>
        {/* Logo */}
        <Link href="/" className={styles.logo}>
          <LogoGota size={32} className={styles.logoMarca} />
          <div className={styles.logoTextos}>
            <span className={styles.logoTexto}>FIXUM</span>
            <span className={styles.logoSlogan}>Encontre seu lugar.</span>
          </div>
        </Link>

        {/* Nav Desktop - oculto no explorar pois os filtros ja tem Comprar/Alugar */}
        {!ocultarNav && (
          <nav className={styles.nav}>
            <Link href="/explorar?negociacao=venda" className={styles.navLink}>🏠 Comprar</Link>
            <Link href="/explorar?negociacao=aluguel" className={styles.navLink}>🔑 Alugar</Link>
            <Link href="/explorar" className={styles.navLink}>🗺️ Explorar</Link>
            <Link href="/planos" className={styles.navLink}>💳 Planos</Link>
          </nav>
        )}

        {/* Acoes */}
        <div className={styles.acoes}>
          {!naPaginaImovel && (
            <Link
              href="/para-imobiliarias"
              className={styles.btnImobiliaria}
              title="Conheça nossos planos corporativos para imobiliárias e redes"
            >
              <span>🏢</span>
              <span>Para Imobiliárias</span>
            </Link>
          )}

          {isAdmin ? (
            <Link
              href="/admin"
              className={styles.btnAdminHeader}
              title="Acessar o Painel Executivo / BI Fixum"
            >
              <span>🛡️</span>
              <span>Painel Executivo</span>
            </Link>
          ) : (
            <Link
              href={usuario ? '/painel/novo-imovel' : '/login?next=/painel/novo-imovel'}
              className={styles.btnAnunciar}
            >
              Anunciar
            </Link>
          )}

          {/* Botão de Favoritos com Toggle e Badge — exibido apenas para usuário logado e fora da página de detalhes do imóvel */}
          {usuario && !pathname.startsWith('/imovel/') && (() => {
            const negociacaoAtual = searchParams?.get('negociacao')
            const hrefFavoritos = isFavoritosAtivo
              ? (negociacaoAtual ? `/explorar?negociacao=${negociacaoAtual}` : '/explorar')
              : (negociacaoAtual ? `/explorar?favoritos=true&negociacao=${negociacaoAtual}` : '/explorar?favoritos=true')

            return (
              <Link
                href={hrefFavoritos}
                className={`${styles.btnFavoritos} ${isFavoritosAtivo ? styles.btnFavoritosAtivo : ''}`}
                title={
                  isFavoritosAtivo
                    ? '❤️ Favoritos ativos. Clique para ver todos os imóveis.'
                    : totalFavoritos > 0
                    ? `${totalFavoritos} imóvel(is) nos favoritos. Clique para filtrar.`
                    : 'Meus Imóveis Favoritos'
                }
                aria-label="Imóveis Favoritos"
              >
                <span className={styles.iconeFavorito}>❤️</span>
                {totalFavoritos > 0 && <span className={styles.badgeFavoritos}>{totalFavoritos}</span>}
              </Link>
            )
          })()}

          {usuario ? (
            // Avatar + Dropdown do usuário logado
            <div className={styles.avatarWrap} ref={dropdownRef}>
              <button
                className={styles.avatar}
                onClick={() => setDropdownAberto(!dropdownAberto)}
                aria-label="Menu do usuário"
                title={nomeUsuario || usuario.email || 'Minha Conta'}
                style={{ background: isAdmin ? 'linear-gradient(135deg, #0f172a, #1e293b)' : gradienteAvatar }}
              >
                {isAdmin ? '🛡️' : inicialAvatar}
              </button>
              {dropdownAberto && (
                <div className={styles.dropdown}>
                  <div className={styles.dropdownUsuario}>
                    <div className={styles.dropdownNome}>
                      {nomeUsuario || (isAdmin ? 'Administrador Master' : 'Minha Conta')}
                      {isAdmin && <span className={styles.badgeAdminMaster}>Master</span>}
                    </div>
                    <div className={styles.dropdownEmail}>{usuario.email}</div>
                  </div>

                  {isAdmin ? (
                    <>
                      <Link href="/admin" className={styles.dropdownItemAdmin} onClick={() => setDropdownAberto(false)}>
                        🛡️ Painel Executivo Fixum
                      </Link>
                    </>
                  ) : (
                    <>
                      <Link href="/painel" className={styles.dropdownItem} onClick={() => setDropdownAberto(false)}>
                        🏠 Meu Painel
                      </Link>
                      <Link href="/painel?aba=plano" className={styles.dropdownItem} onClick={() => setDropdownAberto(false)}>
                        💳 Meu Plano
                      </Link>
                    </>
                  )}

                  <hr className={styles.dropdownDivider} />
                  <button className={styles.dropdownSair} onClick={handleSair}>
                    {isAdmin ? 'Encerrar Sessão' : 'Sair'}
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* Botão de Entrada Direto e Infalível */
            <Link
              href="/login"
              className="btn btn-primario btn-sm"
              style={{ fontWeight: 700, textDecoration: 'none' }}
            >
              Entrar
            </Link>
          )}

          <button className={styles.menuBurger} onClick={() => setMenuAberto(!menuAberto)} aria-label="Menu">
            <span className={`${styles.burger} ${menuAberto ? styles.burgerAberto : ''}`} />
          </button>
        </div>
      </div>

      {/* Menu Mobile */}
      {menuAberto && (
        <div className={styles.menuMobile}>
          <Link href="/explorar?negociacao=venda" onClick={() => setMenuAberto(false)}>Comprar</Link>
          <Link href="/explorar?negociacao=aluguel" onClick={() => setMenuAberto(false)}>Alugar</Link>
          <Link href="/explorar" onClick={() => setMenuAberto(false)}>Explorar pelo Mapa</Link>
          <Link href="/planos" onClick={() => setMenuAberto(false)}>Planos Individuais</Link>
          <Link href="/para-imobiliarias" onClick={() => setMenuAberto(false)} style={{ color: '#0f4c81', fontWeight: 700 }}>
            🏢 Para Imobiliárias & Redes
          </Link>
          {isAdmin ? (
            <>
              <Link href="/admin" onClick={() => setMenuAberto(false)} style={{ color: '#1d4ed8', fontWeight: 700 }}>
                🛡️ Painel Executivo Admin
              </Link>
              <hr style={{ margin: '8px 0', borderColor: '#f1f5f9' }} />
              <button
                onClick={handleSair}
                style={{
                  background: 'none', border: 'none', textAlign: 'left',
                  padding: '10px 14px', color: '#ef4444', fontWeight: 600,
                  fontSize: '0.9375rem', cursor: 'pointer', width: '100%'
                }}
              >
                Encerrar Sessão
              </button>
            </>
          ) : (
            <>
              <Link href="/painel/novo-imovel" onClick={() => setMenuAberto(false)}>Anunciar Imóvel</Link>
              <hr style={{ margin: '8px 0', borderColor: '#f1f5f9' }} />
              {usuario ? (
                <>
                  <Link href="/painel" onClick={() => setMenuAberto(false)}>Meu Painel</Link>
                  <button
                    onClick={handleSair}
                    style={{
                      background: 'none', border: 'none', textAlign: 'left',
                      padding: '10px 14px', color: '#ef4444', fontWeight: 600,
                      fontSize: '0.9375rem', cursor: 'pointer', width: '100%'
                    }}
                  >
                    Sair da Conta
                  </button>
                </>
              ) : (
                <>
                  <Link href="/login" onClick={() => setMenuAberto(false)} style={{ color: '#1d4ed8', fontWeight: 700 }}>
                    🔑 Entrar na Conta
                  </Link>
                  <Link href="/cadastro" onClick={() => setMenuAberto(false)}>Criar Conta</Link>
                </>
              )}
            </>
          )}
        </div>
      )}
    </header>
  )
}

export default function Header() {
  return (
    <Suspense fallback={<header className={styles.header} />}>
      <HeaderConteudo />
    </Suspense>
  )
}