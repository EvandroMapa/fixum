'use client'

import Link from 'next/link'
import { useState, useEffect, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'
import LogoGota from '@/components/ui/LogoGota'
import styles from './Header.module.css'

export default function Header() {
  const [scrolled, setScrolled] = useState(false)
  const [menuAberto, setMenuAberto] = useState(false)
  const [dropdownAberto, setDropdownAberto] = useState(false)
  const [usuario, setUsuario] = useState<User | null>(null)
  const pathname = usePathname()
  const router = useRouter()
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Na home page: header transparente ate rolar
  // Em outras paginas: sempre solido
  const naHome = pathname === '/'
  const noExplorar = pathname === '/explorar' || pathname.startsWith('/explorar?') || pathname.startsWith('/explorar/')
  const solido = !naHome || scrolled
  const ocultarNav = noExplorar

  useEffect(() => {
    if (!naHome) return
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [naHome])

  // Carregar usuário logado
  useEffect(() => {
    const sb = createClient()
    sb.auth.getSession().then(({ data: { session } }) => setUsuario(session?.user ?? null))
    const { data: { subscription } } = sb.auth.onAuthStateChange((_e, session) => {
      setUsuario(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
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
    await sb.auth.signOut()
    setDropdownAberto(false)
    router.push('/')
  }

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
            <Link href="/explorar?negociacao=venda" className={styles.navLink}>Comprar</Link>
            <Link href="/explorar?negociacao=aluguel" className={styles.navLink}>Alugar</Link>
            <Link href="/explorar" className={styles.navLink}>Explorar</Link>
          </nav>
        )}

        {/* Acoes */}
        <div className={styles.acoes}>
          <Link
            href={usuario ? '/painel/novo-imovel' : '/login?next=/painel/novo-imovel'}
            className={styles.btnAnunciar}
          >
            Anunciar
          </Link>

          {usuario ? (
            // Avatar + Dropdown do usuário logado
            <div className={styles.avatarWrap} ref={dropdownRef}>
              <button
                className={styles.avatar}
                onClick={() => setDropdownAberto(!dropdownAberto)}
                aria-label="Menu do usuário"
                title={usuario.email ?? 'Usuário'}
              >
                {(usuario.user_metadata?.nome || usuario.email || 'U')[0].toUpperCase()}
              </button>
              {dropdownAberto && (
                <div className={styles.dropdown}>
                  <div className={styles.dropdownEmail}>{usuario.email}</div>
                  <Link href="/painel" className={styles.dropdownItem} onClick={() => setDropdownAberto(false)}>
                    🏠 Meu Painel
                  </Link>
                  <Link href="/painel/favoritos" className={styles.dropdownItem} onClick={() => setDropdownAberto(false)}>
                    ❤️ Favoritos
                  </Link>
                  <hr className={styles.dropdownDivider} />
                  <button className={styles.dropdownSair} onClick={handleSair}>
                    Sair
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link href="/login" className="btn btn-primario btn-sm">Entrar</Link>
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
          <Link href="/painel/novo-imovel" onClick={() => setMenuAberto(false)}>Anunciar Imovel</Link>
          <Link href="/login" onClick={() => setMenuAberto(false)}>Entrar</Link>
          <Link href="/cadastro" onClick={() => setMenuAberto(false)}>Criar Conta</Link>
        </div>
      )}
    </header>
  )
}