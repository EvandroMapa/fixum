import Link from 'next/link'
import { Logotipo } from '@/components/ui/Logo'
import styles from './Rodape.module.css'

export default function Rodape() {
  const ano = new Date().getFullYear()
  return (
    <footer className={styles.rodape}>
      <div className={styles.inner}>
        <div className={styles.grade}>
          <div className={styles.marca}>
            <Link href="/" aria-label="Fixum — página inicial" className={styles.logo}>
              <Logotipo largura={104} />
            </Link>
            <p className={styles.assinatura}>Explore onde você quer viver.</p>
          </div>

          <nav className={styles.coluna} aria-label="Procurar">
            <strong>Procurar</strong>
            <Link href="/explorar?negociacao=venda">Imóveis à venda</Link>
            <Link href="/explorar?negociacao=aluguel">Imóveis para alugar</Link>
            <Link href="/explorar">Explorar o mapa</Link>
          </nav>

          <nav className={styles.coluna} aria-label="Anunciar">
            <strong>Anunciar</strong>
            <Link href="/cadastro?tipo=proprietario">Sou proprietário</Link>
            <Link href="/cadastro?tipo=corretor">Sou corretor</Link>
            <Link href="/para-imobiliarias">Sou imobiliária</Link>
            <Link href="/planos">Planos</Link>
          </nav>

          <nav className={styles.coluna} aria-label="Conta">
            <strong>Conta</strong>
            <Link href="/login">Entrar</Link>
            <Link href="/cadastro">Criar conta</Link>
            <Link href="/painel">Meu painel</Link>
          </nav>
        </div>

        <div className={styles.base}>
          <span>© {ano} Fixum</span>
          <span className={styles.coordenada}>Feito em Minas Gerais</span>
        </div>
      </div>
    </footer>
  )
}
