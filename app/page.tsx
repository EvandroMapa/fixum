'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Header from '@/components/layout/Header'
import styles from './page.module.css'

const TIPOS_IMOVEL = [
  { valor: '', label: 'Todos os tipos', icone: '🏘️' },
  { valor: 'casa', label: 'Casa', icone: '🏠' },
  { valor: 'apartamento', label: 'Apartamento', icone: '🏢' },
  { valor: 'terreno', label: 'Terreno', icone: '📐' },
  { valor: 'sala_comercial', label: 'Comercial', icone: '🏪' },
  { valor: 'sitio', label: 'Sítio / Chácara', icone: '🌿' },
]

const DESTAQUES_CIDADES = [
  { nome: 'São João del Rei', estado: 'MG', imóveis: 142 },
  { nome: 'Tiradentes', estado: 'MG', imóveis: 38 },
  { nome: 'Lavras', estado: 'MG', imóveis: 94 },
  { nome: 'Barbacena', estado: 'MG', imóveis: 67 },
]

const COMO_FUNCIONA = [
  {
    icone: '🗺️',
    titulo: 'Explore pelo Mapa',
    desc: 'Navegue por bairros e regiões visualmente. Veja os preços diretamente no mapa.',
  },
  {
    icone: '🔍',
    titulo: 'Filtre com Precisão',
    desc: 'Tipo, preço, quartos, características. Encontre exatamente o que você procura.',
  },
  {
    icone: '📍',
    titulo: 'Descubra a Região',
    desc: 'Veja o que tem perto: escolas, mercados, hospitais, restaurantes e muito mais.',
  },
  {
    icone: '💬',
    titulo: 'Fale com o Anunciante',
    desc: 'Contato direto pelo WhatsApp ou mensagem. Sem intermediários desnecessários.',
  },
]

export default function HomePage() {
  const router = useRouter()
  const [negociacao, setNegociacao] = useState<'venda' | 'aluguel'>('venda')
  const [tipo, setTipo] = useState('')
  const [busca, setBusca] = useState('')

  function handleBuscar(e: React.FormEvent) {
    e.preventDefault()
    const params = new URLSearchParams()
    params.set('negociacao', negociacao)
    if (tipo) params.set('tipo', tipo)
    if (busca) params.set('q', busca)
    router.push(`/explorar?${params.toString()}`)
  }

  return (
    <>
      <Header />

      {/* ── HERO ──────────────────────────────────── */}
      <section className={styles.hero}>
        <div className={styles.heroFundo} />
        <div className={styles.heroParticulas} aria-hidden="true">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className={styles.particula} style={{ '--i': i } as React.CSSProperties} />
          ))}
        </div>

        <div className={styles.heroConteudo}>
          <div className={styles.heroBadge}>
            <span>🗺️</span> O mapa é o centro da experiência
          </div>

          <h1 className={styles.heroTitulo}>
            Explore onde você<br />
            <span className={styles.heroDestaque}>quer viver</span>
          </h1>

          <p className={styles.heroSubtitulo}>
            Não procure apenas um imóvel. Navegue pelo mapa, descubra bairros,
            conheça a vizinhança e encontre o lugar perfeito para chamar de lar.
          </p>

          {/* Formulário de Busca */}
          <form onSubmit={handleBuscar} className={styles.formBusca}>
            {/* Tabs Comprar/Alugar */}
            <div className={styles.tabsNegociacao}>
              <button
                type="button"
                className={`${styles.tabNeg} ${negociacao === 'venda' ? styles.tabAtiva : ''}`}
                onClick={() => setNegociacao('venda')}
              >
                Comprar
              </button>
              <button
                type="button"
                className={`${styles.tabNeg} ${negociacao === 'aluguel' ? styles.tabAtiva : ''}`}
                onClick={() => setNegociacao('aluguel')}
              >
                Alugar
              </button>
            </div>

            <div className={styles.campoBuscaWrapper}>
              {/* Campo principal */}
              <div className={styles.campoBuscaGrupo}>
                <span className={styles.campoBuscaIcone}>📍</span>
                <input
                  type="text"
                  className={styles.campoBusca}
                  placeholder="Cidade, bairro, endereço ou região..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                />
              </div>

              {/* Tipo */}
              <div className={styles.separador} />
              <div className={styles.campoBuscaGrupo}>
                <span className={styles.campoBuscaIcone}>🏠</span>
                <select
                  className={styles.campoBusca}
                  value={tipo}
                  onChange={(e) => setTipo(e.target.value)}
                >
                  {TIPOS_IMOVEL.map((t) => (
                    <option key={t.valor} value={t.valor}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Botão */}
              <button type="submit" className={styles.btnBuscar}>
                <span>🔍</span>
                Buscar
              </button>
            </div>
          </form>

          {/* Link para o mapa */}
          <Link href="/explorar" className={styles.linkMapa}>
            <span>🗺️</span> Ou explore diretamente pelo mapa
          </Link>

          {/* Sugestões */}
          <div className={styles.sugestoes}>
            <span className={styles.sugestaoLabel}>Populares:</span>
            {['São João del Rei', 'Tiradentes', 'Lavras', 'Centro', 'Bairro Tejuco'].map((s) => (
              <button
                key={s}
                type="button"
                className={styles.sugestaoChip}
                onClick={() => {
                  setBusca(s)
                }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Métricas flutuantes */}
        <div className={styles.metricasHero}>
          <div className={styles.metrica}>
            <strong>2.400+</strong>
            <span>Imóveis</span>
          </div>
          <div className={styles.metricaDivisor} />
          <div className={styles.metrica}>
            <strong>180+</strong>
            <span>Cidades</span>
          </div>
          <div className={styles.metricaDivisor} />
          <div className={styles.metrica}>
            <strong>850+</strong>
            <span>Corretores</span>
          </div>
        </div>
      </section>

      {/* ── COMO FUNCIONA ─────────────────────────── */}
      <section className={styles.secao}>
        <div className="container">
          <div className={styles.secaoHeader}>
            <div className="badge badge-primario">Como funciona</div>
            <h2>Uma nova forma de encontrar imóveis</h2>
            <p>
              Combinamos o melhor do Airbnb, Google Maps e portais imobiliários
              em uma única experiência centrada no mapa.
            </p>
          </div>

          <div className={styles.gridComoFunciona}>
            {COMO_FUNCIONA.map((item, i) => (
              <div key={i} className={styles.passoCard}>
                <div className={styles.passoIcone}>{item.icone}</div>
                <h3>{item.titulo}</h3>
                <p>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── EXPLORE POR CIDADE ────────────────────── */}
      <section className={`${styles.secao} ${styles.secaoAlt}`}>
        <div className="container">
          <div className={styles.secaoHeader}>
            <div className="badge badge-acento">Regiões em destaque</div>
            <h2>Explore por cidade</h2>
            <p>Descubra os imóveis disponíveis nas principais cidades da região</p>
          </div>

          <div className={styles.gridCidades}>
            {DESTAQUES_CIDADES.map((cidade) => (
              <Link
                key={cidade.nome}
                href={`/explorar?q=${cidade.nome}`}
                className={styles.cidadeCard}
              >
                <div className={styles.cidadeMapaPreview}>
                  <span>🗺️</span>
                </div>
                <div className={styles.cidadeInfo}>
                  <strong>{cidade.nome}</strong>
                  <span>{cidade.estado}</span>
                </div>
                <div className={styles.cidadeCount}>
                  {cidade.imóveis} imóveis
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── ANUNCIE ───────────────────────────────── */}
      <section className={styles.secaoAnuncie}>
        <div className="container">
          <div className={styles.anuncieConteudo}>
            <div className={styles.anuncieTexto}>
              <h2>Quer anunciar seu imóvel?</h2>
              <p>
                Proprietários, corretores e imobiliárias podem cadastrar imóveis
                de forma simples e rápida. Alcance compradores e inquilinos que
                exploram o mapa da sua região.
              </p>
              <div className={styles.anuncieBeneficios}>
                <div className={styles.beneficio}><span>✅</span> Anúncio gratuito para proprietários</div>
                <div className={styles.beneficio}><span>✅</span> Cadastro em menos de 5 minutos</div>
                <div className={styles.beneficio}><span>✅</span> Receba leads diretamente no WhatsApp</div>
                <div className={styles.beneficio}><span>✅</span> Acompanhe visualizações e favoritos</div>
              </div>
              <div className={styles.anuncieBotoes}>
                <Link href="/cadastro?tipo=proprietario" className="btn btn-acento btn-lg">
                  Anunciar meu imóvel
                </Link>
                <Link href="/cadastro?tipo=imobiliaria" className="btn btn-outline btn-lg">
                  Sou imobiliária
                </Link>
              </div>
            </div>
            <div className={styles.anuncieVisual}>
              <div className={styles.anuncieCard}>
                <div className={styles.anuncieCardFoto}>🏠</div>
                <div className={styles.anuncieCardInfo}>
                  <strong>Casa em São João del Rei</strong>
                  <span>R$ 420.000 · 3 quartos · 120 m²</span>
                </div>
                <div className={styles.anuncieCardStats}>
                  <div><strong>248</strong> <span>visualizações</span></div>
                  <div><strong>12</strong> <span>favoritos</span></div>
                  <div><strong>5</strong> <span>leads</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ────────────────────────────────── */}
      <footer className={styles.footer}>
        <div className="container">
          <div className={styles.footerGrid}>
            <div className={styles.footerMarca}>
              <span className={styles.footerLogo}>🏠 FIXUM</span>
              <p>Explore onde você quer viver. A plataforma imobiliária centrada no mapa.</p>
            </div>
            <div className={styles.footerCol}>
              <strong>Buscar</strong>
              <Link href="/explorar?negociacao=venda">Imóveis à venda</Link>
              <Link href="/explorar?negociacao=aluguel">Imóveis para alugar</Link>
              <Link href="/explorar">Explorar pelo mapa</Link>
            </div>
            <div className={styles.footerCol}>
              <strong>Anunciar</strong>
              <Link href="/cadastro?tipo=proprietario">Sou proprietário</Link>
              <Link href="/cadastro?tipo=corretor">Sou corretor</Link>
              <Link href="/cadastro?tipo=imobiliaria">Sou imobiliária</Link>
            </div>
            <div className={styles.footerCol}>
              <strong>Conta</strong>
              <Link href="/login">Entrar</Link>
              <Link href="/cadastro">Criar conta</Link>
              <Link href="/painel">Meu painel</Link>
            </div>
          </div>
          <div className={styles.footerRodape}>
            <span>© 2025 FIXUM. Todos os direitos reservados.</span>
          </div>
        </div>
      </footer>
    </>
  )
}
