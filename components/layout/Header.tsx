'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import styles from './Header.module.css'

export default function Header() {
  const [scrolled, setScrolled] = useState(false)
  const [menuAberto, setMenuAberto] = useState(false)
  const pathname = usePathname()

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

  return (
    <header className={`${styles.header} ${solido ? styles.solido : ''}`}>
      <div className={styles.inner}>
        {/* Logo */}
        <Link href="/" className={styles.logo}>
          <svg className={styles.logoMarca} width="26" height="26" viewBox="0 0 28 28" fill="none">
            <path d="M14 2L3 11V26H10V17H18V26H25V11L14 2Z" fill="currentColor"/>
          </svg>
          <span className={styles.logoTexto}>FIXUM</span>
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
          <Link href="/painel/novo-imovel" className={styles.btnAnunciar}>Anunciar</Link>
          <Link href="/login" className="btn btn-primario btn-sm">Entrar</Link>
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