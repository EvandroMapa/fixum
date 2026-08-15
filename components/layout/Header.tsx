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
          <svg className={styles.logoMarca} width="28" height="28" viewBox="0 0 28 28" fill="none">
            <path d="M14 2L3 11V26H10V17H18V26H25V11L14 2Z" fill="currentColor" opacity="0.9"/>
            <rect x="11" y="17" width="6" height="9" rx="1" fill="currentColor"/>
          </svg>
          <span className={styles.logoTexto}>FIXUM</span>
        </Link>

        {/* Nav Desktop */}
        <nav className={styles.nav}>
          <Link href="/explorar?negociacao=venda" className={styles.navLink}>Comprar</Link>
          <Link href="/explorar?negociacao=aluguel" className={styles.navLink}>Alugar</Link>
          <Link href="/explorar" className={styles.navLink}>Explorar</Link>
        </nav>

        {/* Acoes */}
        <div className={styles.acoes}>
          <Link href="/painel/novo-imovel" className={`btn btn-outline btn-sm ${styles.btnAnunciar}`}>Anunciar</Link>
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