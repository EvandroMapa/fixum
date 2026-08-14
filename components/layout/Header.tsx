'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import styles from './Header.module.css'

export default function Header() {
  const [scrolled, setScrolled] = useState(false)
  const [menuAberto, setMenuAberto] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header className={`${styles.header} ${scrolled ? styles.scrolled : ''}`}>
      <div className={styles.inner}>
        {/* Logo */}
        <Link href="/" className={styles.logo}>
          <span className={styles.logoIcone}>🏠</span>
          <span className={styles.logoTexto}>
            <strong>FIXUM</strong>
          </span>
        </Link>

        {/* Nav Desktop */}
        <nav className={styles.nav}>
          <Link href="/explorar?negociacao=venda" className={styles.navLink}>
            Comprar
          </Link>
          <Link href="/explorar?negociacao=aluguel" className={styles.navLink}>
            Alugar
          </Link>
          <Link href="/explorar" className={styles.navLink}>
            Explorar
          </Link>
        </nav>

        {/* Ações */}
        <div className={styles.acoes}>
          <Link href="/painel/novo-imovel" className="btn btn-outline btn-sm">
            Anunciar
          </Link>
          <Link href="/login" className="btn btn-primario btn-sm">
            Entrar
          </Link>
          <button
            className={styles.menuBurger}
            onClick={() => setMenuAberto(!menuAberto)}
            aria-label="Menu"
          >
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
          <Link href="/painel/novo-imovel" onClick={() => setMenuAberto(false)}>Anunciar Imóvel</Link>
          <Link href="/login" onClick={() => setMenuAberto(false)}>Entrar</Link>
          <Link href="/cadastro" onClick={() => setMenuAberto(false)}>Criar Conta</Link>
        </div>
      )}
    </header>
  )
}
