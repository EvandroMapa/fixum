import Link from 'next/link'
import Header from '@/components/layout/Header'
import styles from './page.module.css'

const COMO_FUNCIONA = [
  { num: '01', titulo: 'Explore pelo mapa', desc: 'Navegue pelo mapa interativo e veja imoveis disponíveis em tempo real na região que você escolher.' },
  { num: '02', titulo: 'Filtre o que importa', desc: 'Preco, tipo, quartos, pet-friendly — filtre exatamente o que faz sentido para o seu estilo de vida.' },
  { num: '03', titulo: 'Entre em contato', desc: 'Clique no imovel, veja fotos, detalhes e fale diretamente com o anunciante pelo WhatsApp.' },
]

const STATS = [
  { valor: '9+', label: 'Imoveis ativos' },
  { valor: '3', label: 'Bairros cobertos' },
  { valor: '100%', label: 'Gratuito para buscar' },
  { valor: '5min', label: 'Para anunciar' },
]

export default function HomePage() {
  return (
    <>
      <Header />

      {/* HERO */}
      <section className={styles.hero}>
        <div className={styles.heroFundo} />
        <div className={styles.heroGlow} />
        <div className={styles.heroConteudo}>
          <div className={styles.heroBadge}>
            <span className={styles.heroBadgePonto} />
            Plataforma imobiliaria com mapa interativo
          </div>
          <h1 className={styles.heroTitulo}>
            Encontre o imovel<br />
            <span className={styles.heroDestaque}>perfeito para voce</span>
          </h1>
          <p className={styles.heroSubtitulo}>
            Explore imoveis a venda e para alugar em Conselheiro Lafaiete e regiao.
            Visualize tudo no mapa, filtre pelo que importa e fale direto com o anunciante.
          </p>
          <div className={styles.heroBotoes}>
            <Link href="/explorar" className={`btn btn-acento btn-lg ${styles.btnHeroPrincipal}`}>
              Explorar no mapa
            </Link>
            <Link href="/explorar?negociacao=venda" className={`btn btn-lg ${styles.btnHeroSecundario}`}>
              Ver imoveis a venda
            </Link>
          </div>
          <div className={styles.heroStats}>
            {STATS.map((s) => (
              <div key={s.label} className={styles.heroStat}>
                <strong>{s.valor}</strong>
                <span>{s.label}</span>
              </div>
            ))}
          </div>
        </div>
        <div className={styles.heroOndas}>
          <svg viewBox="0 0 1440 100" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M0,50 C480,100 960,0 1440,60 L1440,100 L0,100 Z" fill="white"/>
          </svg>
        </div>
      </section>

      {/* COMO FUNCIONA */}
      <section className={styles.secao}>
        <div className="container">
          <div className={styles.secaoTopo}>
            <div className={styles.badge}>Como funciona</div>
            <h2 className={styles.secaoTitulo}>Simples do comeco ao fim</h2>
            <p className={styles.secaoDesc}>Em 3 passos voce sai do mapa para a chave na mao.</p>
          </div>
          <div className={styles.gridPassos}>
            {COMO_FUNCIONA.map((item) => (
              <div key={item.num} className={styles.passo}>
                <div className={styles.passoNum}>{item.num}</div>
                <h3 className={styles.passoTitulo}>{item.titulo}</h3>
                <p className={styles.passoDesc}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA MAPA */}
      <section className={styles.secaoCta}>
        <div className={styles.ctaFundo} />
        <div className="container">
          <div className={styles.ctaConteudo}>
            <div className={styles.ctaTexto}>
              <h2>Pronto para explorar?</h2>
              <p>Abra o mapa, navegue pelos bairros de Conselheiro Lafaiete e encontre imoveis com tudo que voce precisa.</p>
              <div className={styles.ctaBotoes}>
                <Link href="/explorar" className="btn btn-acento btn-lg">Ver imoveis no mapa</Link>
                <Link href="/explorar?negociacao=aluguel" className={`btn btn-lg ${styles.btnCtaOutline}`}>Quero alugar</Link>
              </div>
            </div>
            <div className={styles.ctaVisual}>
              <div className={styles.mapaMockup}>
                <div className={styles.mapaMockupFundo} />
                <div className={styles.mapaPin} style={{top:'35%',left:'42%'}}>
                  <div className={styles.mapaPinLabel}>R$ 420.000</div>
                </div>
                <div className={styles.mapaPin} style={{top:'55%',left:'60%'}}>
                  <div className={styles.mapaPinLabel}>R$ 850/mes</div>
                </div>
                <div className={styles.mapaPin} style={{top:'28%',left:'68%'}}>
                  <div className={styles.mapaPinLabel}>R$ 280.000</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ANUNCIE */}
      <section className={styles.secaoAnuncie}>
        <div className="container">
          <div className={styles.anuncieConteudo}>
            <div className={styles.anuncieTexto}>
              <div className={styles.badge}>Para anunciantes</div>
              <h2>Quer anunciar seu imovel?</h2>
              <p>Proprietarios, corretores e imobiliarias cadastram imoveis de forma simples e gratuita. Apareca no mapa e receba leads direto no WhatsApp.</p>
              <ul className={styles.beneficios}>
                <li>Anuncio 100% gratuito para proprietarios</li>
                <li>Cadastro em menos de 5 minutos</li>
                <li>Leads direto no WhatsApp</li>
                <li>Painel completo com estatisticas</li>
              </ul>
              <div className={styles.anuncieBotoes}>
                <Link href="/cadastro" className="btn btn-primario btn-lg">Criar conta gratis</Link>
                <Link href="/painel/novo-imovel" className="btn btn-outline btn-lg">Anunciar agora</Link>
              </div>
            </div>
            <div className={styles.anuncieCard}>
              <div className={styles.anuncieCardHeader}>
                <div className={styles.anuncieCardFoto} />
                <div>
                  <strong>Casa em Conselheiro Lafaiete</strong>
                  <span>R$ 420.000 - 3 quartos - 145 m2</span>
                </div>
              </div>
              <div className={styles.anuncieCardStats}>
                <div><strong>248</strong><span>visualizacoes</span></div>
                <div><strong>12</strong><span>favoritos</span></div>
                <div><strong>5</strong><span>leads</span></div>
              </div>
              <div className={styles.anuncieCardBarra}>
                <span>Desempenho esta semana</span>
                <div className={styles.barra}><div className={styles.barraFill} style={{width:'68%'}} /></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className={styles.footer}>
        <div className="container">
          <div className={styles.footerGrid}>
            <div className={styles.footerMarca}>
              <span className={styles.footerLogo}>FIXUM</span>
              <p>A plataforma imobiliaria centrada no mapa. Explore onde voce quer viver.</p>
            </div>
            <div className={styles.footerCol}>
              <strong>Buscar</strong>
              <Link href="/explorar?negociacao=venda">Imoveis a venda</Link>
              <Link href="/explorar?negociacao=aluguel">Para alugar</Link>
              <Link href="/explorar">Explorar pelo mapa</Link>
            </div>
            <div className={styles.footerCol}>
              <strong>Anunciar</strong>
              <Link href="/cadastro?tipo=proprietario">Sou proprietario</Link>
              <Link href="/cadastro?tipo=corretor">Sou corretor</Link>
              <Link href="/cadastro?tipo=imobiliaria">Sou imobiliaria</Link>
            </div>
            <div className={styles.footerCol}>
              <strong>Conta</strong>
              <Link href="/login">Entrar</Link>
              <Link href="/cadastro">Criar conta</Link>
              <Link href="/painel">Meu painel</Link>
            </div>
          </div>
          <div className={styles.footerRodape}>
            <span>2025 FIXUM. Todos os direitos reservados.</span>
          </div>
        </div>
      </footer>
    </>
  )
}