'use client'

import Link from 'next/link'
import { useState, useEffect, useRef, Suspense } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'
import { obterIniciaisUsuario, obterGradienteUsuario } from '@/lib/utils'
import { encerrarSessaoAdmin } from '@/lib/admin-auth'
import { Logotipo } from '@/components/ui/Logo'
import Icone from '@/components/ui/Icone'
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
        const ehAdmin = data?.is_admin === true || data?.tipo === 'admin' || user.user_metadata?.tipo === 'admin'
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

  const linkAtivo = (neg: string | null) =>
    pathname.startsWith('/explorar') && !isFavoritosAtivo && (negociacaoAtual ?? null) === neg

  return (
    <header className={`${styles.header} ${solido ? styles.solido : ''}`}>
      <div className={styles.inner}>
        <Link href="/" className={styles.logo} aria-label="Fixum — página inicial">
          <Logotipo largura={86} />
        </Link>

        {/* Nav desktop — oculto no explorar (os filtros já têm Comprar/Alugar) e na página do imóvel */}
        {!ocultarNav && (
          <nav className={styles.nav} aria-label="Principal">
            <Link href="/explorar?negociacao=venda" className={`${styles.navLink} ${linkAtivo('venda') ? styles.navLinkAtivo : ''}`}>Comprar</Link>
            <Link href="/explorar?negociacao=aluguel" className={`${styles.navLink} ${linkAtivo('aluguel') ? styles.navLinkAtivo : ''}`}>Alugar</Link>
            <Link href="/planos" className={`${styles.navLink} ${pathname.startsWith('/planos') ? styles.navLinkAtivo : ''}`}>Planos</Link>
            <Link href="/para-imobiliarias" className={`${styles.navLink} ${pathname.startsWith('/para-imobiliarias') ? styles.navLinkAtivo : ''}`}>Para imobiliárias</Link>
          </nav>
        )}

        <div className={styles.acoes}>
          {isAdmin ? (
            <Link href="/admin" className={styles.btnAnunciar} title="Painel executivo da Fixum">
              <Icone nome="escudo" tamanho={18} />
              <span>Painel executivo</span>
            </Link>
          ) : (
            <Link
              href={usuario ? '/painel/novo-imovel' : '/login?next=/painel/novo-imovel'}
              className={styles.btnAnunciar}
            >
              <Icone nome="mais" tamanho={18} />
              <span>Anunciar</span>
            </Link>
          )}

          {/* Favoritos — só para usuário logado e fora da página do imóvel */}
          {usuario && !naPaginaImovel && (() => {
            const hrefFavoritos = isFavoritosAtivo
              ? (negociacaoAtual ? `/explorar?negociacao=${negociacaoAtual}` : '/explorar')
              : (negociacaoAtual ? `/explorar?favoritos=true&negociacao=${negociacaoAtual}` : '/explorar?favoritos=true')

            return (
              <Link
                href={hrefFavoritos}
                className={`${styles.btnFavoritos} ${isFavoritosAtivo ? styles.btnFavoritosAtivo : ''}`}
                title={
                  isFavoritosAtivo
                    ? 'Mostrando só os favoritos. Clique para ver todos.'
                    : totalFavoritos > 0
                    ? `${totalFavoritos} ${totalFavoritos === 1 ? 'imóvel favorito' : 'imóveis favoritos'}`
                    : 'Seus favoritos aparecem aqui'
                }
                aria-label="Favoritos"
              >
                <Icone nome="coracao" tamanho={20} preenchido={isFavoritosAtivo} />
                {totalFavoritos > 0 && <span className={styles.badgeFavoritos}>{totalFavoritos}</span>}
              </Link>
            )
          })()}

          {usuario ? (
            <div className={styles.avatarWrap} ref={dropdownRef}>
              <button
                className={styles.avatar}
                onClick={() => setDropdownAberto(!dropdownAberto)}
                aria-label="Menu da conta"
                aria-expanded={dropdownAberto}
                title={nomeUsuario || usuario.email || 'Minha conta'}
                style={{ background: isAdmin ? '#16201C' : gradienteAvatar }}
              >
                {isAdmin ? <Icone nome="escudo" tamanho={18} /> : inicialAvatar}
              </button>
              {dropdownAberto && (
                <div className={styles.dropdown}>
                  <div className={styles.dropdownUsuario}>
                    <div className={styles.dropdownNome}>
                      {nomeUsuario || (isAdmin ? 'Administrador' : 'Minha conta')}
                      {isAdmin && <span className={styles.badgeAdminMaster}>Master</span>}
                    </div>
                    <div className={styles.dropdownEmail}>{usuario.email}</div>
                  </div>

                  {isAdmin ? (
                    <Link href="/admin" className={styles.dropdownItem} onClick={() => setDropdownAberto(false)}>
                      <Icone nome="escudo" tamanho={18} /> Painel executivo
                    </Link>
                  ) : (
                    <>
                      <Link href="/painel" className={styles.dropdownItem} onClick={() => setDropdownAberto(false)}>
                        <Icone nome="painel" tamanho={18} /> Meu painel
                      </Link>
                      <Link href="/explorar?favoritos=true" className={styles.dropdownItem} onClick={() => setDropdownAberto(false)}>
                        <Icone nome="coracao" tamanho={18} /> Favoritos
                      </Link>
                      <Link href="/painel?aba=plano" className={styles.dropdownItem} onClick={() => setDropdownAberto(false)}>
                        <Icone nome="cartao" tamanho={18} /> Meu plano
                      </Link>
                    </>
                  )}

                  <hr className={styles.dropdownDivider} />
                  <button className={styles.dropdownSair} onClick={handleSair}>
                    <Icone nome="sair" tamanho={18} /> {isAdmin ? 'Encerrar sessão' : 'Sair'}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link href="/login" className={styles.btnEntrar}>
              Entrar
            </Link>
          )}

          <button
            className={styles.menuBurger}
            onClick={() => setMenuAberto(!menuAberto)}
            aria-label={menuAberto ? 'Fechar menu' : 'Abrir menu'}
            aria-expanded={menuAberto}
          >
            <Icone nome={menuAberto ? 'fechar' : 'menu'} tamanho={22} />
          </button>
        </div>
      </div>

      {/* Menu mobile */}
      {menuAberto && (
        <div className={styles.menuMobile}>
          <nav className={styles.menuMobileGrupo} aria-label="Menu">
            <Link href="/explorar?negociacao=venda" onClick={() => setMenuAberto(false)}><Icone nome="casa" /> Comprar</Link>
            <Link href="/explorar?negociacao=aluguel" onClick={() => setMenuAberto(false)}><Icone nome="chave" /> Alugar</Link>
            <Link href="/explorar" onClick={() => setMenuAberto(false)}><Icone nome="mapa" /> Explorar o mapa</Link>
            {usuario && !isAdmin && (
              <Link href="/explorar?favoritos=true" onClick={() => setMenuAberto(false)}><Icone nome="coracao" /> Favoritos</Link>
            )}
          </nav>
          <div className={styles.menuMobileGrupo}>
            <span className={styles.menuMobileRotulo}>Para quem anuncia</span>
            <Link href={usuario ? '/painel/novo-imovel' : '/login?next=/painel/novo-imovel'} onClick={() => setMenuAberto(false)}><Icone nome="mais" /> Anunciar imóvel</Link>
            <Link href="/planos" onClick={() => setMenuAberto(false)}><Icone nome="cartao" /> Planos</Link>
            <Link href="/para-imobiliarias" onClick={() => setMenuAberto(false)}><Icone nome="predio" /> Para imobiliárias</Link>
          </div>
          <div className={styles.menuMobileGrupo}>
            {isAdmin ? (
              <>
                <Link href="/admin" onClick={() => setMenuAberto(false)}><Icone nome="escudo" /> Painel executivo</Link>
                <button onClick={handleSair} className={styles.menuMobileSair}><Icone nome="sair" /> Encerrar sessão</button>
              </>
            ) : usuario ? (
              <>
                <Link href="/painel" onClick={() => setMenuAberto(false)}><Icone nome="painel" /> Meu painel</Link>
                <button onClick={handleSair} className={styles.menuMobileSair}><Icone nome="sair" /> Sair da conta</button>
              </>
            ) : (
              <div className={styles.menuMobileBotoes}>
                <Link href="/login" onClick={() => setMenuAberto(false)} className="btn btn-primario">Entrar</Link>
                <Link href="/cadastro" onClick={() => setMenuAberto(false)} className="btn btn-outline">Criar conta</Link>
              </div>
            )}
          </div>
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