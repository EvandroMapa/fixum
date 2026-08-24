'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import Header from '@/components/layout/Header'
import CardImovel from '@/components/imovel/CardImovel'
import { type Imovel } from '@/lib/types'
import styles from './page.module.css'

interface Corretor {
  id: string
  nome: string
  email?: string
  telefone?: string
  whatsapp?: string
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

function precoFormatado(preco: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(preco)
}

export default function PaginaImobiliariaCliente({ imobiliaria, corretores, imoveis }: Props) {
  const [filtroNegociacao, setFiltroNegociacao] = useState<'todos' | 'venda' | 'aluguel'>('todos')
  const [filtroTipo, setFiltroTipo] = useState<string>('todos')
  const [ordenacao, setOrdenacao] = useState<'recente' | 'preco_asc' | 'preco_desc'>('recente')
  const [linkCopiado, setLinkCopiado] = useState(false)

  // Estatísticas da imobiliária
  const totalVenda = useMemo(() => imoveis.filter((i) => i.negociacao === 'venda').length, [imoveis])
  const totalAluguel = useMemo(() => imoveis.filter((i) => i.negociacao === 'aluguel').length, [imoveis])

  // Cidades em que a imobiliária possui imóveis
  const cidadesAtendidas = useMemo(() => {
    const cidades = Array.from(new Set(imoveis.map((i) => i.cidade).filter(Boolean)))
    return cidades.join(', ') || 'Minas Gerais'
  }, [imoveis])

  // Faixa de preço dos imóveis
  const faixaPreco = useMemo(() => {
    const precos = imoveis.map((i) => i.preco || 0).filter((p) => p > 0)
    if (precos.length === 0) return null
    const min = Math.min(...precos)
    const max = Math.max(...precos)
    return { min: precoFormatado(min), max: precoFormatado(max) }
  }, [imoveis])

  // Imóveis filtrados pela modalidade ativa (Todos / Venda / Aluguel)
  const imoveisPorModalidade = useMemo(() => {
    if (filtroNegociacao === 'todos') return imoveis
    return imoveis.filter((i) => i.negociacao === filtroNegociacao)
  }, [imoveis, filtroNegociacao])

  // Tipos únicos presentes na modalidade ativa com contagem sincronizada
  const tiposDisponiveis = useMemo(() => {
    const tipos = Array.from(new Set(imoveisPorModalidade.map((i) => i.tipo).filter(Boolean)))
    return tipos
  }, [imoveisPorModalidade])

  // Alternar modalidade e resetar tipo caso ele não exista na nova modalidade
  const handleTrocarNegociacao = (novaNegociacao: 'todos' | 'venda' | 'aluguel') => {
    setFiltroNegociacao(novaNegociacao)
    if (filtroTipo !== 'todos') {
      const listaNova = novaNegociacao === 'todos' ? imoveis : imoveis.filter((i) => i.negociacao === novaNegociacao)
      const temTipo = listaNova.some((i) => i.tipo === filtroTipo)
      if (!temTipo) {
        setFiltroTipo('todos')
      }
    }
  }

  // Filtragem e ordenação dos imóveis exibidos
  const imoveisFiltrados = useMemo(() => {
    let list = imoveisPorModalidade.filter((imovel) => {
      if (filtroTipo !== 'todos' && imovel.tipo !== filtroTipo) {
        return false
      }
      return true
    })

    if (ordenacao === 'preco_asc') {
      list = [...list].sort((a, b) => (a.preco || 0) - (b.preco || 0))
    } else if (ordenacao === 'preco_desc') {
      list = [...list].sort((a, b) => (b.preco || 0) - (a.preco || 0))
    }

    return list
  }, [imoveisPorModalidade, filtroTipo, ordenacao])

  // Link do WhatsApp da imobiliária
  const linkWhatsApp = useMemo(() => {
    const num = (imobiliaria.whatsapp || imobiliaria.telefone || '').replace(/\D/g, '')
    if (!num) return null
    const texto = encodeURIComponent(`Olá! Estou visualizando o perfil da ${imobiliaria.nome} no Fixum e gostaria de mais informações.`)
    return `https://wa.me/55${num}?text=${texto}`
  }, [imobiliaria])

  // URL e texto inteligente de compartilhamento (respeita os filtros ativos)
  const textoCompartilhamento = useMemo(() => {
    const contagem = imoveisFiltrados.length
    let detalhe = `${contagem} ${contagem === 1 ? 'imóvel disponível' : 'imóveis disponíveis'}`
    if (filtroNegociacao === 'venda') detalhe = `${contagem} opções à venda`
    if (filtroNegociacao === 'aluguel') detalhe = `${contagem} opções para alugar`
    return `Confira o portfólio de ${imobiliaria.nome} no Fixum (${detalhe} em ${cidadesAtendidas})`
  }, [imobiliaria.nome, imoveisFiltrados.length, filtroNegociacao, cidadesAtendidas])

  async function handleCompartilhar() {
    const urlAtual = typeof window !== 'undefined' ? window.location.href : ''
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${imobiliaria.nome} — Fixum Imóveis`,
          text: textoCompartilhamento,
          url: urlAtual,
        })
        return
      } catch {}
    }

    try {
      await navigator.clipboard.writeText(urlAtual)
      setLinkCopiado(true)
      setTimeout(() => setLinkCopiado(false), 2500)
    } catch {}
  }

  const linkCompartilharWhats = useMemo(() => {
    const urlAtual = typeof window !== 'undefined' ? window.location.href : ''
    const msg = encodeURIComponent(`${textoCompartilhamento}\n${urlAtual}`)
    return `https://api.whatsapp.com/send?text=${msg}`
  }, [textoCompartilhamento])

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
                {imobiliaria.email && <span>✉️ {imobiliaria.email}</span>}
                {imobiliaria.telefone && <span>📞 {imobiliaria.telefone}</span>}
                <span>📍 Atuação: {cidadesAtendidas}</span>
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
                <span>💬</span> WhatsApp Oficial
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
              title="Copiar link ou compartilhar"
            >
              <span>{linkCopiado ? '✓ Link Copiado!' : '🔗 Compartilhar Portfólio'}</span>
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
              <span className={styles.statLabel}>Oportunidades de Venda</span>
            </div>
          </div>

          <div className={styles.cardStat}>
            <div className={styles.statIcone}>🔑</div>
            <div className={styles.statTextos}>
              <strong className={styles.statValor}>{totalAluguel}</strong>
              <span className={styles.statLabel}>Opções para Aluguel</span>
            </div>
          </div>

          <div className={styles.cardStat}>
            <div className={styles.statIcone}>👥</div>
            <div className={styles.statTextos}>
              <strong className={styles.statValor}>{corretores.length > 0 ? corretores.length : 1}</strong>
              <span className={styles.statLabel}>Especialistas na Equipe</span>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════
            BANNER DE ACESSO AO MAPA INTERATIVO
            ═══════════════════════════════════════════════════════════════ */}
        {imoveis.length > 0 && (
          <section className={styles.bannerMapaAtalho}>
            <div className={styles.bannerMapaInfo}>
              <div className={styles.bannerMapaIcone}>🗺️</div>
              <div>
                <h3 className={styles.bannerMapaTitulo}>Explorar portfólio no mapa interativo</h3>
                <p className={styles.bannerMapaSubtitulo}>
                  Veja a distribuição geográfica das {imoveis.length} oportunidades de {imobiliaria.nome} em tela cheia no mapa Fixum.
                </p>
              </div>
            </div>
            <Link
              href={`/explorar?imobiliaria=${imobiliaria.id}&nome=${encodeURIComponent(imobiliaria.nome)}`}
              className={styles.btnAbrirMapaCompleto}
            >
              Abrir no Mapa ➔
            </Link>
          </section>
        )}

        {/* ═══════════════════════════════════════════════════════════════
            PORTFÓLIO COMPLETO COM FILTROS ORGANIZADOS
            ═══════════════════════════════════════════════════════════════ */}
        <section className={styles.secaoImoveis}>
          <div className={styles.cabecalhoPortfolio}>
            <div>
              <h2 className={styles.tituloPortfolio}>🏠 Portfólio de Imóveis</h2>
              <p className={styles.subtituloPortfolio}>
                Exibindo <strong>{imoveisFiltrados.length}</strong> {imoveisFiltrados.length === 1 ? 'imóvel disponível' : 'imóveis disponíveis'}
              </p>
            </div>

            <div className={styles.controleOrdenacao}>
              <label htmlFor="ordenacaoSelect" className={styles.labelOrdenacao}>Ordenar:</label>
              <select
                id="ordenacaoSelect"
                className={styles.selectOrdenacao}
                value={ordenacao}
                onChange={(e) => setOrdenacao(e.target.value as any)}
              >
                <option value="recente">Mais Recentes</option>
                <option value="preco_asc">Menor Preço</option>
                <option value="preco_desc">Maior Preço</option>
              </select>
            </div>
          </div>

          <div className={styles.barraFiltros}>
            {/* Filtros por Modalidade (Segmented Control) */}
            <div className={styles.segmentedNegociacao}>
              <button
                type="button"
                className={`${styles.btnSegmented} ${filtroNegociacao === 'todos' ? styles.btnSegmentedAtivo : ''}`}
                onClick={() => handleTrocarNegociacao('todos')}
              >
                Todos ({imoveis.length})
              </button>
              <button
                type="button"
                className={`${styles.btnSegmented} ${filtroNegociacao === 'venda' ? styles.btnSegmentedAtivo : ''}`}
                onClick={() => handleTrocarNegociacao('venda')}
              >
                Venda ({totalVenda})
              </button>
              <button
                type="button"
                className={`${styles.btnSegmented} ${filtroNegociacao === 'aluguel' ? styles.btnSegmentedAtivo : ''}`}
                onClick={() => handleTrocarNegociacao('aluguel')}
              >
                Aluguel ({totalAluguel})
              </button>
            </div>

            {/* Filtros por Tipo de Imóvel (Sincronizados com a Modalidade) */}
            {tiposDisponiveis.length > 1 && (
              <div className={styles.chipsTiposWrapper}>
                <button
                  type="button"
                  className={`${styles.chipTipo} ${filtroTipo === 'todos' ? styles.chipTipoAtivo : ''}`}
                  onClick={() => setFiltroTipo('todos')}
                >
                  Todos os Tipos ({imoveisPorModalidade.length})
                </button>
                {tiposDisponiveis.map((tipo) => {
                  const qtdTipo = imoveisPorModalidade.filter((i) => i.tipo === tipo).length
                  return (
                    <button
                      key={tipo}
                      type="button"
                      className={`${styles.chipTipo} ${filtroTipo === tipo ? styles.chipTipoAtivo : ''}`}
                      onClick={() => setFiltroTipo(tipo)}
                    >
                      {tipo.charAt(0).toUpperCase() + tipo.slice(1)} ({qtdTipo})
                    </button>
                  )
                })}
              </div>
            )}
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
              <h3>Nenhum imóvel encontrado com os filtros selecionados</h3>
              <p>Tente selecionar outros tipos ou modalidades para visualizar o portfólio completo.</p>
              <button
                type="button"
                className="btn btn-outline btn-md"
                onClick={() => {
                  setFiltroNegociacao('todos')
                  setFiltroTipo('todos')
                }}
              >
                Limpar Filtros
              </button>
            </div>
          )}
        </section>

        {/* ═══════════════════════════════════════════════════════════════
            EQUIPE DE CORRETORES & ATENDIMENTO
            ═══════════════════════════════════════════════════════════════ */}
        {corretores.length > 0 && (
          <section className={styles.secaoEquipe}>
            <div className={styles.cabecalhoSecao}>
              <div>
                <h2 className={styles.tituloSecao}>👥 Equipe de Especialistas</h2>
                <p className={styles.subtituloSecao}>Corretores credenciados prontos para atender você com agilidade</p>
              </div>
            </div>

            <div className={styles.gridCorretores}>
              {corretores.map((c) => {
                const telLimpo = (c.whatsapp || c.telefone || '').replace(/\D/g, '')
                const whatsCorretor = telLimpo
                  ? `https://wa.me/55${telLimpo}?text=${encodeURIComponent(`Olá ${c.nome}! Gostaria de atendimento sobre os imóveis da ${imobiliaria.nome}.`)}`
                  : null

                return (
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
                      {c.creci && <span className={styles.creciCorretor}>CRECI: {c.creci}</span>}
                      {c.email && <span className={styles.emailCorretor}>{c.email}</span>}
                    </div>

                    {whatsCorretor && (
                      <a
                        href={whatsCorretor}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.btnWhatsCorretor}
                        title={`Conversar com ${c.nome}`}
                      >
                        <span>💬</span> Falar com o Corretor
                      </a>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* ═══════════════════════════════════════════════════════════════
            INFORMAÇÕES INSTITUCIONAIS & SEGURANÇA
            ═══════════════════════════════════════════════════════════════ */}
        <section className={styles.secaoInstitucional}>
          <div className={styles.boxInstitucional}>
            <div className={styles.boxInstIcone}>🛡️</div>
            <div>
              <h3>Negociação Segura com {imobiliaria.nome}</h3>
              <p>
                Todos os imóveis anunciados são cadastrados e atualizados diretamente pela equipe de corretores credenciados. Suas mensagens e dados de contato são enviados diretamente aos responsáveis para um atendimento exclusivo e personalizado.
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
