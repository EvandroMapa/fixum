import Link from 'next/link'
import Header from '@/components/layout/Header'
import Rodape from '@/components/layout/Rodape'
import HeroBusca from '@/components/home/HeroBusca'
import MapaVitrine from '@/components/home/MapaVitrine'
import CurvasDeNivel from '@/components/ui/CurvasDeNivel'
import Icone, { type NomeIcone } from '@/components/ui/Icone'
import styles from './page.module.css'

const PILARES: { num: string; icone: NomeIcone; titulo: string; texto: string }[] = [
  {
    num: '01',
    icone: 'mapa',
    titulo: 'Veja o bairro inteiro',
    texto: 'Os imóveis aparecem no mapa, com o preço em cada ponto. Você enxerga a região antes de olhar a planta.',
  },
  {
    num: '02',
    icone: 'alvo',
    titulo: 'Compare no território',
    texto: 'Arraste o mapa, aproxime uma rua e pesquise só naquela área. Filtre por preço, quartos e o que mais importar.',
  },
  {
    num: '03',
    icone: 'chat',
    titulo: 'Fale com quem anuncia',
    texto: 'Gostou? Fixe o imóvel para comparar depois ou chame o anunciante direto no WhatsApp.',
  },
]

const BENEFICIOS = [
  'Seu anúncio aparece para quem já está olhando a região',
  'Contatos chegam direto no seu WhatsApp',
  'Painel com visualizações, contatos e desempenho',
  'Comece grátis com um imóvel ativo',
]


export default function HomePage() {
  return (
    <>
      <Header />

      <main>
        {/* ── HERO ─────────────────────────────── */}
        <section className={styles.hero}>
          <CurvasDeNivel className={styles.heroCurvas} proporcao={0.62} />
          <div className={styles.heroGrade}>
            <div className={styles.heroTexto}>
              <span className="rotulo-mapa">Imóveis à venda e para alugar</span>
              <h1 className={styles.heroTitulo}>
                Onde você <span className={styles.heroTituloSerif}>quer morar?</span>
              </h1>
              <p className={styles.heroSubtitulo}>
                Veja os imóveis direto no mapa da cidade e conheça o bairro antes de marcar a visita.
              </p>
              <HeroBusca />
            </div>

            <div className={styles.heroMapa} aria-hidden="true">
              <div className={styles.mapaMoldura}>
                <MapaVitrine />
                <span className={styles.mapaAreaBtn}>
                  <Icone nome="alvo" tamanho={16} />
                  Pesquisar nesta área
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* ── PILARES ───────────────────────────── */}
        <section className={styles.secao}>
          <div className={styles.container}>
            <div className={styles.secaoTopo}>
              <span className="rotulo-mapa">Como funciona</span>
              <h2 className={styles.secaoTitulo}>Lugar antes de metragem.</h2>
              <p className={styles.secaoTexto}>
                Ninguém mora em 82 m². Mora numa rua, perto de alguém, a alguns minutos de algum lugar.
                A Fixum começa por aí.
              </p>
            </div>
            <ol className={styles.pilares}>
              {PILARES.map((p) => (
                <li key={p.num} className={styles.pilar}>
                  <div className={styles.pilarTopo}>
                    <span className={styles.pilarIcone}><Icone nome={p.icone} tamanho={22} /></span>
                    <span className={styles.pilarNum}>{p.num}</span>
                  </div>
                  <h3>{p.titulo}</h3>
                  <p>{p.texto}</p>
                </li>
              ))}
            </ol>
            <div className={styles.secaoAcao}>
              <Link href="/explorar" className="btn btn-primario btn-lg">
                <Icone nome="mapa" tamanho={18} /> Abrir o mapa
              </Link>
            </div>
          </div>
        </section>

        {/* ── ANUNCIANTES ───────────────────────── */}
        <section className={styles.anuncie}>
          <CurvasDeNivel
            className={styles.anuncieCurvas}
            picos={[{ x: 0.85, y: 0.3, aneis: 16, passo: 30, semente: 21 }]}
          />
          <div className={`${styles.container} ${styles.anuncieGrade}`}>
            <div className={styles.anuncieTexto}>
              <span className={styles.rotuloClaro}>Para quem anuncia</span>
              <h2>
                Seu imóvel no lugar certo. <span className={styles.serifClaro}>Literalmente.</span>
              </h2>
              <p>
                Proprietários, corretores e imobiliárias publicam em poucos minutos e aparecem no mapa
                para quem já está procurando naquela região.
              </p>
              <ul className={styles.beneficios}>
                {BENEFICIOS.map((b) => (
                  <li key={b}>
                    <Icone nome="check" tamanho={18} /> {b}
                  </li>
                ))}
              </ul>
              <div className={styles.anuncieBotoes}>
                <Link href="/cadastro" className="btn btn-acento btn-lg">Anunciar grátis</Link>
                <Link href="/planos" className={`btn btn-lg ${styles.btnClaro}`}>Ver planos</Link>
              </div>
            </div>

            <div className={styles.painelExemplo} aria-hidden="true">
              <div className={styles.painelTopo}>
                <span className={styles.painelRotulo}>Exemplo do seu painel</span>
                <span className={styles.painelPeriodo}>Últimos 7 dias</span>
              </div>
              <div className={styles.painelImovel}>
                <div className={styles.painelFoto} />
                <div>
                  <strong>Casa com quintal · Centro</strong>
                  <span>R$ 420.000 · 3 quartos · 145 m²</span>
                </div>
              </div>
              <div className={styles.painelNumeros}>
                <div><strong>248</strong><span>visualizações</span></div>
                <div><strong>12</strong><span>fixados</span></div>
                <div><strong>5</strong><span>contatos</span></div>
              </div>
              <div className={styles.painelGrafico}>
                {[30, 42, 38, 55, 48, 70, 64].map((h, i) => (
                  <span key={i} style={{ height: `${h}%` }} />
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>

      <Rodape />
    </>
  )
}
