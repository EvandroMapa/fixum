'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import Header from '@/components/layout/Header'
import CardImovel from '@/components/imovel/CardImovel'
import { type Imovel } from '@/lib/types'
import styles from './page.module.css'

const MapaImovel = dynamic(() => import('@/components/mapa/MapaImovel'), { ssr: false })

interface Corretor {
  id: string
  nome: string
  email?: string
  telefone?: string
  creci?: string
  foto_url?: string
}

interface Props {
  imobiliaria: {
    id: string
    nome: string
    tipo: string
    foto_url?: string
    telefone?: string
    whatsapp?: string
    creci?: string
    email?: string
    descricao?: string
    endereco?: string
    cidade?: string
    estado?: string
  }
  corretores: Corretor[]
  imoveis: Imovel[]
}

export default function PaginaImobiliariaCliente({ imobiliaria, corretores, imoveis }: Props) {
  const [filtroNegociacao, setFiltroNegociacao] = useState<'todos' | 'venda' | 'aluguel'>('todos')
  const [filtroTipo, setFiltroTipo] = useState<string>('todos')
  const [linkCopiado, setLinkCopiado] = useState(false)

  // Estatísticas da imobiliária
  const totalVenda = useMemo(() => imoveis.filter((i) => i.negociacao === 'venda').length, [imoveis])
  const totalAluguel = useMemo(() => imoveis.filter((i) => i.negociacao === 'aluguel').length, [imoveis])

  // Filtragem dos imóveis exibidos
  const imoveisFiltrados = useMemo(() => {
    return imoveis.filter((imovel) => {
      if (filtroNegociacao !== 'todos' && imovel.negociacao !== filtroNegociacao) {
        return false
      }
      if (filtroTipo !== 'todos' && imovel.tipo !== filtroTipo) {
        return false
      }
      return true
    })
  }, [imoveis, filtroNegociacao, filtroTipo])

  // Primeiro imóvel com coordenadas válidas para centrar o mapa
  const imovelReferencia = useMemo(() => {
    return imoveis.find((i) => i.latitude && i.longitude && (i.latitude !== 0 || i.longitude !== 0))
  }, [imoveis])

  // Link do WhatsApp da imobiliária
  const linkWhatsApp = useMemo(() => {
    const num = (imobiliaria.whatsapp || imobiliaria.telefone || '').replace(/\D/g, '')
    if (!num) return null
    const texto = encodeURIComponent(`Olá! Estou visualizando o perfil da ${imobiliaria.nome} no Fixum e gostaria de mais informações.`)
    return `https://wa.me/55${num}?text=${texto}`
  }, [imobiliaria])

  async function handleCompartilhar() {
    if (navigator.share) {
      try {
        await navigator.share({
          title: imobiliaria.nome,
          text: `Confira os imóveis de ${imobiliaria.nome} no Fixum`,
          url: window.location.href,
        })
        return
      } catch {}
    }

    try {
      await navigator.clipboard.writeText(window.location.href)
      setLinkCopiado(true)
      setTimeout(() => setLinkCopiado(false), 2500)
    } catch {}
  }

  return (
    <div className={styles.container}>
      <Header />

      {/* ═══════════════════════════════════════════════════════════════
          HERO BANNER DA IMOBILIÁRIA
          ═══════════════════════════════════════════════════════════════ */}
      <section className={styles.heroBanner}>
        <div className={styles.heroInner}>
          <div className={styles.heroInfoPrincipal}>
            <div className={styles.logoWrapper}>
              {imobiliaria.foto_url ? (
                <img src={imobiliaria.foto_url} alt={imobiliaria.nome} className={styles.logoImg} />
              ) : (
                <div className={styles.logoPlaceholder}>
                  {imobiliaria.nome?.slice(0, 2).toUpperCase() || 'IM'}
                </div>
              )}
            </div>

            <div className={styles.textosImobiliaria}>
              <span className={styles.badgeVerificado}>
                ✓ Imobiliária Verificada Fixum
              </span>
              <h1 className={styles.nomeImobiliaria}>{imobiliaria.nome}</h1>
              <div className={styles.detalhesImobiliaria}>
                {imobiliaria.creci && <span className={styles.creciBadge}>CRECI: {imobiliaria.creci}</span>}
                {imobiliaria.cidade && <span>📍 {imobiliaria.cidade}{imobiliaria.estado ? ` - ${imobiliaria.estado}` : ''}</span>}
              </div>
            </div>
          </div>

          <div className={styles.heroAcoes}>
            {linkWhatsApp && (
              <a
                href={linkWhatsApp}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.btnWhatsAppHero}
              >
                <span>💬</span> WhatsApp
              </a>
            )}

            {imobiliaria.telefone && (
              <a href={`tel:${imobiliaria.telefone}`} className={styles.btnTelefoneHero}>
                <span>📞</span> Ligar
              </a>
            )}

            <button
              type="button"
              className={styles.btnCompartilharHero}
              onClick={handleCompartilhar}
            >
              <span>{linkCopiado ? '✓ Copiado!' : '🔗 Compartilhar'}</span>
            </button>
          </div>
        </div>
      </section>

      <main className={styles.conteudoWrapper}>
        {/* ═══════════════════════════════════════════════════════════════
            CARDS DE ESTATÍSTICAS
            ═══════════════════════════════════════════════════════════════ */}
        <section className={styles.gridStats}>
          <div className={styles.cardStat}>
            <div className={styles.statIcone}>🏢</div>
            <div className={styles.statTextos}>
              <strong className={styles.statValor}>{imoveis.length}</strong>
              <span className={styles.statLabel}>Imóveis no Portfólio</span>
            </div>
          </div>

          <div className={styles.cardStat}>
            <div className={styles.statIcone}>🏷️</div>
            <div className={styles.statTextos}>
              <strong className={styles.statValor}>{totalVenda}</strong>
              <span className={styles.statLabel}>Para Venda</span>
            </div>
          </div>

          <div className={styles.cardStat}>
            <div className={styles.statIcone}>🔑</div>
            <div className={styles.statTextos}>
              <strong className={styles.statValor}>{totalAluguel}</strong>
              <span className={styles.statLabel}>Para Aluguel</span>
            </div>
          </div>

          <div className={styles.cardStat}>
            <div className={styles.statIcone}>👥</div>
            <div className={styles.statTextos}>
              <strong className={styles.statValor}>{corretores.length + 1}</strong>
              <span className={styles.statLabel}>Especialistas na Equipe</span>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════
            MAPA DE ATUAÇÃO DOS IMÓVEIS
            ═══════════════════════════════════════════════════════════════ */}
        {imoveis.length > 0 && imovelReferencia && (
          <section className={styles.secaoMapa}>
            <div className={styles.cabecalhoSecao}>
              <div>
                <h2 className={styles.tituloSecao}>📍 Região de Atuação & Mapa de Imóveis</h2>
                <p className={styles.subtituloSecao}>
                  Veja a localização de todas as oportunidades anunciadas por esta empresa
                </p>
              </div>

              <Link
                href={`/explorar?imobiliaria=${imobiliaria.id}&nome=${encodeURIComponent(imobiliaria.nome)}`}
                className={styles.btnAbrirMapaCompleto}
              >
                🗺️ Explorar Mapa em Tela Cheia ➔
              </Link>
            </div>

            <div className={styles.mapaWrapper}>
              <MapaImovel
                lat={imovelReferencia.latitude}
                lng={imovelReferencia.longitude}
                titulo={`Imóveis de ${imobiliaria.nome}`}
                publico={true}
              />
            </div>
          </section>
        )}

        {/* ═══════════════════════════════════════════════════════════════
            PORTFÓLIO COMPLETO COM FILTROS RÁPIDOS
            ═══════════════════════════════════════════════════════════════ */}
        <section className={styles.secaoImoveis}>
          <div className={styles.cabecalhoSecao}>
            <div>
              <h2 className={styles.tituloSecao}>🏠 Todos os Imóveis ({imoveisFiltrados.length})</h2>
              <p className={styles.subtituloSecao}>Encontre o imóvel ideal desta imobiliária</p>
            </div>
          </div>

          <div className={styles.filtrosPortfolio}>
            <button
              type="button"
              className={`${styles.btnFiltroRapido} ${filtroNegociacao === 'todos' ? styles.btnFiltroRapidoAtivo : ''}`}
              onClick={() => setFiltroNegociacao('todos')}
            >
              Todos ({imoveis.length})
            </button>
            <button
              type="button"
              className={`${styles.btnFiltroRapido} ${filtroNegociacao === 'venda' ? styles.btnFiltroRapidoAtivo : ''}`}
              onClick={() => setFiltroNegociacao('venda')}
            >
              Venda ({totalVenda})
            </button>
            <button
              type="button"
              className={`${styles.btnFiltroRapido} ${filtroNegociacao === 'aluguel' ? styles.btnFiltroRapidoAtivo : ''}`}
              onClick={() => setFiltroNegociacao('aluguel')}
            >
              Aluguel ({totalAluguel})
            </button>
          </div>

          {imoveisFiltrados.length > 0 ? (
            <div className={styles.gridImoveis}>
              {imoveisFiltrados.map((imovel) => (
                <CardImovel key={imovel.id} imovel={imovel} />
              ))}
            </div>
          ) : (
            <div className={styles.vazioPortfolio}>
              <div className={styles.vazioIcone}>🔍</div>
              <h3>Nenhum imóvel encontrado nesta categoria</h3>
              <p>Tente alterar os filtros acima para visualizar outras opções disponíveis.</p>
            </div>
          )}
        </section>

        {/* ═══════════════════════════════════════════════════════════════
            EQUIPE DE CORRETORES
            ═══════════════════════════════════════════════════════════════ */}
        {corretores.length > 0 && (
          <section className={styles.secaoEquipe}>
            <div className={styles.cabecalhoSecao}>
              <div>
                <h2 className={styles.tituloSecao}>👥 Equipe de Especialistas</h2>
                <p className={styles.subtituloSecao}>Corretores credenciados prontos para atender você</p>
              </div>
            </div>

            <div className={styles.gridCorretores}>
              {corretores.map((c) => (
                <div key={c.id} className={styles.cardCorretor}>
                  <div className={styles.avatarCorretor}>
                    {c.foto_url ? (
                      <img src={c.foto_url} alt={c.nome} className={styles.avatarCorretorImg} />
                    ) : (
                      <span>{c.nome.slice(0, 2).toUpperCase()}</span>
                    )}
                  </div>
                  <div className={styles.infoCorretor}>
                    <strong className={styles.nomeCorretor}>{c.nome}</strong>
                    {c.creci && <span className={styles.creciCorretor}>CRECI {c.creci}</span>}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  )
}
