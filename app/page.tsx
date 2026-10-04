import Link from 'next/link'
import Image from 'next/image'
import Header from '@/components/layout/Header'
import Rodape from '@/components/layout/Rodape'
import HeroBusca from '@/components/home/HeroBusca'
import MapaVitrine from '@/components/home/MapaVitrine'
import CurvasDeNivel from '@/components/ui/CurvasDeNivel'
import { BotaoFixarDemo } from '@/components/ui/BotaoFixar'
import Icone, { type NomeIcone } from '@/components/ui/Icone'
import { criarClienteAdmin } from '@/lib/supabase/admin'
import styles from './page.module.css'

// A lista de cidades vem do banco; a página é regerada a cada hora.
export const revalidate = 3600

// Fotos ilustrativas (Unsplash)
const FOTO_SALA = 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=900&auto=format&fit=crop&q=80'
const FOTO_APTO = 'https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=300&auto=format&fit=crop&q=80'

async function buscarCidades(): Promise<string[]> {
  try {
    const supabase = criarClienteAdmin()
    const { data } = await supabase.from('imoveis').select('cidade').eq('status', 'ativo')
    const contagem = new Map<string, number>()
    for (const { cidade } of data ?? []) {
      if (cidade) contagem.set(cidade, (contagem.get(cidade) ?? 0) + 1)
    }
    return [...contagem.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c)
  } catch {
    return []
  }
}

function listarCidades(cidades: string[]) {
  if (cidades.length <= 1) return cidades.join('')
  return `${cidades.slice(0, -1).join(', ')} e ${cidades[cidades.length - 1]}`
}

const CONTRASTE: { antes: string; fixum: string }[] = [
  {
    antes: 'Uma lista de fotos e o bairro escrito no título.',
    fixum: 'Cada imóvel no mapa, com o preço no ponto e a região onde ele fica.',
  },
  {
    antes: 'A vizinhança você só conhece no dia da visita.',
    fixum: 'Mercado, escola, farmácia e ônibus por perto, com o tempo a pé.',
  },
  {
    antes: 'Dez abas abertas para comparar as opções.',
    fixum: 'Os imóveis fixados juntos no mapa, para comparar de uma vez.',
  },
  {
    antes: 'Formulário de contato e espera por um retorno.',
    fixum: 'Conversa direto com quem anuncia, no WhatsApp.',
  },
]

const ENTORNO: { icone: NomeIcone; nome: string; distancia: string; tempo: string }[] = [
  { icone: 'onibus', nome: 'Ponto de ônibus', distancia: '120 m', tempo: '2 min' },
  { icone: 'farmacia', nome: 'Farmácia', distancia: '220 m', tempo: '3 min' },
  { icone: 'carrinho', nome: 'Supermercado', distancia: '350 m', tempo: '4 min' },
  { icone: 'escola', nome: 'Escola estadual', distancia: '600 m', tempo: '8 min' },
]

const BENEFICIOS = [
  'Comece grátis, com um imóvel ativo',
  'Sem comissão sobre a venda ou o aluguel',
  'Os contatos chegam direto no seu WhatsApp',
  'Painel com visualizações, contatos e desempenho',
]

const PUBLICOS: { icone: NomeIcone; titulo: string; texto: string; href: string; acao: string }[] = [
  {
    icone: 'casa',
    titulo: 'Proprietário',
    texto: 'Venda ou alugue o seu imóvel sem pagar comissão para a plataforma.',
    href: '/cadastro?tipo=proprietario',
    acao: 'Anunciar meu imóvel',
  },
  {
    icone: 'maleta',
    titulo: 'Corretor',
    texto: 'Sua carteira no mapa, com os contatos chegando no seu WhatsApp.',
    href: '/cadastro?tipo=corretor',
    acao: 'Cadastrar como corretor',
  },
  {
    icone: 'predio',
    titulo: 'Imobiliária',
    texto: 'Equipe, carteira e contatos organizados num só painel.',
    href: '/para-imobiliarias',
    acao: 'Conhecer a solução',
  },
]

export default async function HomePage() {
  const cidades = await buscarCidades()

  const perguntas: { p: string; r: React.ReactNode }[] = [
    {
      p: 'Preciso pagar ou criar conta para procurar imóvel?',
      r: 'Não. Explorar o mapa, ver os imóveis e falar com os anunciantes é grátis, e não precisa de conta. A conta só serve para fixar imóveis e encontrá-los depois em qualquer aparelho.',
    },
    {
      p: 'Como eu falo com quem anuncia?',
      r: 'Pelo botão do WhatsApp na página do imóvel. A conversa já começa com o nome e o código do imóvel, então o anunciante sabe na hora do que você está falando.',
    },
    {
      p: 'A localização no mapa é exata?',
      r: 'Depende do anunciante. Alguns mostram o ponto exato; outros preferem mostrar uma região aproximada, por segurança. Nesse caso, o endereço completo é passado quando vocês combinam a visita.',
    },
    {
      p: 'Quanto custa anunciar?',
      r: (
        <>
          Um imóvel ativo é grátis. Para anunciar mais, os planos são pela quantidade de imóveis, sem
          comissão sobre a negociação. <Link href="/planos">Veja os planos</Link>.
        </>
      ),
    },
    ...(cidades.length
      ? [
          {
            p: 'Em quais cidades a Fixum já tem imóveis?',
            r: `Hoje há imóveis anunciados em ${listarCidades(cidades)}. A lista cresce conforme novos anúncios chegam.`,
          },
        ]
      : []),
  ]

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
                Escolha a rua. <span className={styles.heroTituloSerif}>Depois, a casa.</span>
              </h1>
              <p className={styles.heroSubtitulo}>
                Na Fixum, cada imóvel aparece no mapa com o preço no ponto e o que tem por perto a pé.
                Você conhece o bairro antes de marcar a visita.
              </p>
              <HeroBusca />
              <ul className={styles.garantias}>
                <li><Icone nome="check" tamanho={16} /> Grátis para quem procura</li>
                <li><Icone nome="check" tamanho={16} /> Sem cadastro para explorar</li>
                <li><Icone nome="check" tamanho={16} /> Contato direto no WhatsApp</li>
              </ul>
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

          {cidades.length > 0 && (
            <nav className={styles.cidades} aria-label="Cidades com imóveis">
              <span className={styles.cidadesRotulo}>Já no mapa</span>
              <ul>
                {cidades.map((c) => (
                  <li key={c}>
                    <Link href={`/explorar?cidade=${encodeURIComponent(c)}`}>
                      <Icone nome="local" tamanho={16} /> {c}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          )}
        </section>

        {/* ── CONTRASTE ─────────────────────────── */}
        <section className={styles.secao}>
          <div className={styles.container}>
            <div className={styles.secaoTopo}>
              <span className="rotulo-mapa">Por que no mapa</span>
              <h2 className={styles.secaoTitulo}>
                O endereço não pode ser a última coisa que você descobre.
              </h2>
              <p className={styles.secaoTexto}>
                Ninguém mora em 82 m². Mora numa rua, perto de alguém, a alguns minutos de algum lugar.
                Por isso a Fixum começa pelo lugar.
              </p>
            </div>

            <div className={styles.contraste}>
              <div className={styles.contrasteCab} aria-hidden="true">
                <span>Do jeito de sempre</span>
                <span>Na Fixum</span>
              </div>
              <ul>
                {CONTRASTE.map((c) => (
                  <li key={c.fixum} className={styles.contrasteLinha}>
                    <p className={styles.contrasteAntes}>
                      <span className={styles.somenteLeitor}>Do jeito de sempre: </span>
                      <Icone nome="menos" tamanho={16} /> {c.antes}
                    </p>
                    <p className={styles.contrasteFixum}>
                      <span className={styles.somenteLeitor}>Na Fixum: </span>
                      <Icone nome="check" tamanho={18} /> {c.fixum}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* ── RECURSOS ──────────────────────────── */}
        <section className={`${styles.secao} ${styles.secaoAlt}`}>
          <div className={styles.container}>
            <div className={styles.secaoTopo}>
              <span className="rotulo-mapa">Como a Fixum ajuda</span>
              <h2 className={styles.secaoTitulo}>Menos visita perdida, mais certeza.</h2>
            </div>

            {/* 01 — Entorno */}
            <article className={styles.recurso}>
              <div className={styles.recursoTexto}>
                <span className={styles.recursoNum}>01</span>
                <h3>Saiba o que tem a pé antes de sair de casa.</h3>
                <p>
                  Em cada imóvel, a Fixum mostra mercados, farmácias, escolas, academias, bancos e pontos de
                  ônibus por perto, com a distância e o tempo de caminhada.
                </p>
              </div>
              <div className={styles.recursoVisual} aria-hidden="true">
                <div className={styles.entorno}>
                  <div className={styles.entornoMapa}>
                    <Image src="/mapa-hero.webp" alt="" fill sizes="480px" className={styles.entornoImagem} />
                    <span className={styles.entornoLocal} />
                    <span className={`${styles.entornoPoi} ${styles.poi1}`}><Icone nome="onibus" tamanho={13} /></span>
                    <span className={`${styles.entornoPoi} ${styles.poi2}`}><Icone nome="farmacia" tamanho={13} /></span>
                    <span className={`${styles.entornoPoi} ${styles.poi3}`}><Icone nome="carrinho" tamanho={13} /></span>
                    <span className={`${styles.entornoPoi} ${styles.poi4}`}><Icone nome="escola" tamanho={13} /></span>
                  </div>
                  <div className={styles.entornoLista}>
                    <span className={styles.entornoTitulo}>Perto deste imóvel</span>
                    <ul>
                      {ENTORNO.map((e) => (
                        <li key={e.nome}>
                          <span className={styles.entornoIcone}><Icone nome={e.icone} tamanho={18} /></span>
                          <span className={styles.entornoNome}>{e.nome}<small>{e.distancia}</small></span>
                          <span className={styles.entornoTempo}><Icone nome="caminhada" tamanho={14} /> {e.tempo}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </article>

            {/* 02 — Fixar */}
            <article className={`${styles.recurso} ${styles.recursoInvertido}`}>
              <div className={styles.recursoTexto}>
                <span className={styles.recursoNum}>02</span>
                <h3>Fixe o que gostou. Compare com calma.</h3>
                <p>
                  Um toque no alfinete guarda o imóvel. Depois, veja todos os fixados juntos no mapa e descubra
                  qual combina mais com a sua rotina.
                </p>
              </div>
              <div className={styles.recursoVisual}>
                <div className={styles.demo}>
                  <div className={styles.demoCard}>
                    <div className={styles.demoFoto}>
                      <Image src={FOTO_SALA} alt="" fill sizes="360px" className={styles.demoImagem} />
                      <BotaoFixarDemo className={styles.demoBotao} />
                    </div>
                    <div className={styles.demoInfo}>
                      <strong>R$ 345 mil</strong>
                      <span>Apartamento · 2 quartos · 68 m²</span>
                      <span className={styles.demoLugar}><Icone nome="local" tamanho={14} /> Fonte Grande</span>
                    </div>
                  </div>
                  <p className={styles.demoDica}>
                    <Icone nome="fixar" tamanho={16} /> Experimente: toque no alfinete da foto.
                  </p>
                </div>
              </div>
            </article>

            {/* 03 — WhatsApp */}
            <article className={styles.recurso}>
              <div className={styles.recursoTexto}>
                <span className={styles.recursoNum}>03</span>
                <h3>Converse direto com quem anuncia.</h3>
                <p>
                  Sem formulário e sem esperar retorno. O botão do WhatsApp já abre a conversa com o nome e o
                  código do imóvel, e o anunciante sabe na hora do que você está falando.
                </p>
              </div>
              <div className={styles.recursoVisual} aria-hidden="true">
                <div className={styles.conversa}>
                  <div className={styles.conversaCab}>
                    <span className={styles.conversaAvatar}><Icone nome="usuario" tamanho={18} /></span>
                    <div>
                      <strong>Anunciante do imóvel</strong>
                      <span>via WhatsApp</span>
                    </div>
                  </div>
                  <div className={styles.conversaCorpo}>
                    <p className={styles.balaoEu}>
                      Olá! Tenho interesse no imóvel: Casa com quintal (Cód: CL-0048) em Conselheiro Lafaiete.
                      Vi no Fixum.
                      <small>14:02</small>
                    </p>
                    <p className={styles.balaoOutro}>
                      Oi! Ela está disponível, sim. Quer visitar amanhã à tarde?
                      <small>14:05</small>
                    </p>
                  </div>
                </div>
              </div>
            </article>

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
          <div className={styles.container}>
            <div className={styles.anuncieGrade}>
              <div className={styles.anuncieTexto}>
                <span className={styles.rotuloClaro}>Para quem anuncia</span>
                <h2>
                  Seu imóvel no lugar certo. <span className={styles.serifClaro}>Literalmente.</span>
                </h2>
                <p>
                  Na Fixum, o seu anúncio aparece no mapa para quem já está procurando naquela região. Publique
                  em poucos minutos e receba os contatos no WhatsApp.
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
                  <div className={styles.painelFoto}>
                    <Image src={FOTO_APTO} alt="" fill sizes="56px" className={styles.demoImagem} />
                  </div>
                  <div>
                    <strong>Apartamento com varanda · Centro</strong>
                    <span>R$ 520.000 · 3 quartos · 96 m²</span>
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

            <ul className={styles.publicos}>
              {PUBLICOS.map((p) => (
                <li key={p.titulo}>
                  <Link href={p.href} className={styles.publico}>
                    <span className={styles.publicoIcone}><Icone nome={p.icone} tamanho={22} /></span>
                    <strong>{p.titulo}</strong>
                    <span className={styles.publicoTexto}>{p.texto}</span>
                    <span className={styles.publicoAcao}>
                      {p.acao} <Icone nome="seta" tamanho={16} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ── PERGUNTAS ─────────────────────────── */}
        <section className={styles.secao}>
          <div className={`${styles.container} ${styles.perguntasGrade}`}>
            <div className={styles.secaoTopo}>
              <span className="rotulo-mapa">Perguntas frequentes</span>
              <h2 className={styles.secaoTitulo}>Antes de você perguntar.</h2>
            </div>
            <div className={styles.perguntas}>
              {perguntas.map((q) => (
                <details key={q.p} className={styles.pergunta}>
                  <summary>
                    {q.p}
                    <Icone nome="mais" tamanho={20} />
                  </summary>
                  <p>{q.r}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ── CHAMADA FINAL ─────────────────────── */}
        <section className={styles.final}>
          <CurvasDeNivel
            className={styles.finalCurvas}
            picos={[{ x: 0.5, y: 1.05, aneis: 18, passo: 34, semente: 7 }]}
          />
          <div className={`${styles.container} ${styles.finalConteudo}`}>
            <h2>
              A sua próxima casa está em algum ponto <span className={styles.heroTituloSerif}>deste mapa.</span>
            </h2>
            <div className={styles.finalBotoes}>
              <Link href="/explorar" className="btn btn-acento btn-lg">
                <Icone nome="mapa" tamanho={18} /> Explorar no mapa
              </Link>
              <Link href="/cadastro" className="btn btn-outline btn-lg">Anunciar um imóvel</Link>
            </div>
          </div>
        </section>
      </main>

      <Rodape />
    </>
  )
}
