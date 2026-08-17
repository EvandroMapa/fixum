import Link from 'next/link'
import Image from 'next/image'
import Header from '@/components/layout/Header'
import LogoGota from '@/components/ui/LogoGota'
import styles from './page.module.css'

const COMO_FUNCIONA = [
  { num: '01', titulo: 'Explore pelo mapa', desc: 'Navegue pelo mapa interativo e veja imoveis disponíveis em tempo real na região que você escolher.' },
  { num: '02', titulo: 'Filtre o que importa', desc: 'Preco, tipo, quartos, pet-friendly — filtre exatamente o que faz sentido para o seu estilo de vida.' },
  { num: '03', titulo: 'Entre em contato', desc: 'Clique no imovel, veja fotos, detalhes e fale diretamente com o anunciante pelo WhatsApp.' },
]

const STATS = [
  { valor: '9+', label: 'Imóveis ativos' },
  { valor: '100%', label: 'Gratuito para buscar' },
  { valor: '5min', label: 'Para anunciar' },
  { valor: '24h', label: 'Suporte online' },
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
            Explore imóveis à venda e para alugar onde você quiser.
            Visualize tudo no mapa, filtre pelo que importa e fale direto com o anunciante.
          </p>
          <div className={styles.heroBotoes}>
            <Link href="/explorar" className={`btn btn-acento btn-lg ${styles.btnHeroPrincipal}`}>
              Explorar no mapa
            </Link>
            <Link href="/explorar?negociacao=venda" className={`btn btn-lg ${styles.btnHeroSecundario}`}>
              Ver imóveis à venda
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
              <p>Abra o mapa, navegue pelos bairros da sua cidade e encontre imóveis com tudo que você precisa.</p>
              <div className={styles.ctaBotoes}>
                <Link href="/explorar" className="btn btn-acento btn-lg">Ver imoveis no mapa</Link>
                <Link href="/explorar?negociacao=aluguel" className={`btn btn-lg ${styles.btnCtaOutline}`}>Quero alugar</Link>
              </div>
            </div>
            <div className={styles.ctaVisual}>
              <div className={styles.mapaMockup}>
                {/* Mapa estático real do Mapbox — Conselheiro Lafaiete */}
                <Image
                  src={`https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/-43.7867,-20.6603,14,0/640x400?access_token=${process.env.NEXT_PUBLIC_MAPBOX_TOKEN}`}
                  alt="Mapa interativo de imóveis"
                  width={640}
                  height={400}
                  className={styles.mapaStaticImg}
                  unoptimized
                />
                {/* Marcadores de preço sobrepostos */}
                <div className={styles.mapaPin} style={{top:'35%',left:'38%'}}>
                  <div className={styles.mapaPinLabel}>R$ 420.000</div>
                </div>
                <div className={styles.mapaPin} style={{top:'55%',left:'58%'}}>
                  <div className={styles.mapaPinLabel}>R$ 850/mês</div>
                </div>
                <div className={styles.mapaPin} style={{top:'22%',left:'62%'}}>
                  <div className={styles.mapaPinLabel}>R$ 280.000</div>
                </div>
                {/* Overlay gradiente nas bordas para blend suave */}
                <div className={styles.mapaOverlay} />
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
                  <strong>Casa residencial — 3 quartos</strong>
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
              <Link href="/" className={styles.footerLogoLink}>
                <LogoGota size={32} />
                <span className={styles.footerLogo}>FIXUM</span>
              </Link>
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