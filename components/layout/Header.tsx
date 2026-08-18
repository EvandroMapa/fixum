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
            <Link href="/explorar?negociacao=venda" className={styles.navLink}>🏠 Comprar</Link>
            <Link href="/explorar?negociacao=aluguel" className={styles.navLink}>🔑 Alugar</Link>
            <Link href="/explorar" className={styles.navLink}>🗺️ Explorar</Link>
            <Link href="/planos" className={styles.navLink}>💳 Planos</Link>
          </nav>
        )}

        {/* Acoes */}
        <div className={styles.acoes}>
          <Link
            href="/para-imobiliarias"
            className={styles.btnImobiliaria}
            title="Conheça nossos planos corporativos para imobiliárias e redes"
          >
            <span>🏢</span>
            <span>Para Imobiliárias</span>
          </Link>

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
                  <Link href="/painel?aba=plano" className={styles.dropdownItem} onClick={() => setDropdownAberto(false)}>
                    💳 Meu Plano
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
            /* Dropdown de Entrada Rápida */
            <div className={styles.avatarWrap} ref={dropdownRef}>
              <button
                type="button"
                className="btn btn-primario btn-sm"
                onClick={() => setDropdownAberto(!dropdownAberto)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <span>Entrar</span>
                <span style={{ fontSize: '0.65rem' }}>▼</span>
              </button>
              {dropdownAberto && (
                <div className={styles.dropdown} style={{ minWidth: '240px' }}>
                  <Link
                    href="/login?tipo=usuario"
                    className={styles.dropdownItem}
                    onClick={() => setDropdownAberto(false)}
                  >
                    <span>👤</span>
                    <div>
                      <div style={{ fontWeight: 700, color: '#0f172a' }}>Minha Conta</div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Buscar imóveis e favoritos</div>
                    </div>
                  </Link>
                  <Link
                    href="/login?tipo=imobiliaria"
                    className={styles.dropdownItem}
                    onClick={() => setDropdownAberto(false)}
                    style={{ background: '#f8fafc', marginTop: '4px', borderRadius: '8px' }}
                  >
                    <span>🏢</span>
                    <div>
                      <div style={{ fontWeight: 700, color: '#1d4ed8' }}>Painel Imobiliário</div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Imobiliárias & Corretores</div>
                    </div>
                  </Link>
                </div>
              )}
            </div>
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
          <Link href="/painel/novo-imovel" onClick={() => setMenuAberto(false)}>Anunciar Imóvel</Link>
          <hr style={{ margin: '8px 0', borderColor: '#f1f5f9' }} />
          <Link href="/login?tipo=usuario" onClick={() => setMenuAberto(false)}>👤 Entrar como Usuário</Link>
          <Link href="/login?tipo=imobiliaria" onClick={() => setMenuAberto(false)} style={{ color: '#1d4ed8', fontWeight: 700 }}>
            🏢 Painel da Imobiliária
          </Link>
          <Link href="/cadastro" onClick={() => setMenuAberto(false)}>Criar Conta</Link>
        </div>
      )}
    </header>
  )
}