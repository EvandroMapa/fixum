'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import Header from '@/components/layout/Header'
import { type Imovel } from '@/lib/types'
import { formatarPreco, formatarArea, labelTipoImovel } from '@/lib/utils'
import { useFavorito } from '@/hooks/useFavorito'
import styles from './page.module.css'

const MapaImovel = dynamic(() => import('@/components/mapa/MapaImovel'), { ssr: false })

const PONTOS_INTERESSE = [
  { icone: '🏫', label: 'Escolas' },
  { icone: '🏥', label: 'Hospitais' },
  { icone: '🛒', label: 'Supermercados' },
  { icone: '💊', label: 'Farmácias' },
  { icone: '🍽️', label: 'Restaurantes' },
  { icone: '🏋️', label: 'Academias' },
  { icone: '🏦', label: 'Bancos' },
  { icone: '🚌', label: 'Transporte' },
]

const CARACTERISTICAS_ICONES: Record<string, string> = {
  suite: '🛏️',
  piscina: '🏊',
  churrasqueira: '🔥',
  gourmet: '🍖',
  quintal: '🌿',
  varanda: '🌅',
  elevador: '🛗',
  condominio_fechado: '🔒',
  mobiliado: '🛋️',
  ar_condicionado: '❄️',
  portao_eletronico: '🚗',
  armarios_planejados: '🪟',
}

interface Props {
  imovel: Imovel & {
    fotos_imovel?: { id: string; url: string; principal: boolean; ordem: number }[]
    caracteristicas_imovel?: { caracteristica: string }[]
    perfis?: { id: string; nome: string; tipo: string; foto_url?: string; telefone?: string; whatsapp?: string }
  }
  historico: { preco_anterior: number; preco_novo: number; created_at: string }[]
}

export default function PaginaImovelCliente({ imovel, historico }: Props) {
  const [fotoAtiva, setFotoAtiva] = useState(0)
  const { favoritado, toggleFavorito, carregando } = useFavorito(imovel.id)
  const [modalFoto, setModalFoto] = useState(false)
  const [linkCopiado, setLinkCopiado] = useState(false)

  const touchStartX = useRef<number | null>(null)
  const touchEndX = useRef<number | null>(null)
  const modalTouchStartX = useRef<number | null>(null)
  const modalTouchEndX = useRef<number | null>(null)

  const fotos = imovel.fotos_imovel ?? []
  const caracteristicas = imovel.caracteristicas_imovel?.map((c) => c.caracteristica) ?? []
  const anunciante = imovel.perfis

  const fotoAtual = fotos[fotoAtiva]?.url ?? '/placeholder-imovel.jpg'

  const irAnterior = useCallback(() => {
    if (fotos.length <= 1) return
    setFotoAtiva((i) => (i - 1 + fotos.length) % fotos.length)
  }, [fotos.length])

  const irProxima = useCallback(() => {
    if (fotos.length <= 1) return
    setFotoAtiva((i) => (i + 1) % fotos.length)
  }, [fotos.length])

  // Gestos de swipe no carrossel principal
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.targetTouches[0].clientX
    touchEndX.current = null
  }
  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.targetTouches[0].clientX
  }
  const handleTouchEnd = () => {
    if (touchStartX.current === null || touchEndX.current === null) return
    const diff = touchStartX.current - touchEndX.current
    if (diff > 40) irProxima()
    else if (diff < -40) irAnterior()
    touchStartX.current = null
    touchEndX.current = null
  }

  // Gestos de swipe no modal de fotos
  const handleModalTouchStart = (e: React.TouchEvent) => {
    modalTouchStartX.current = e.targetTouches[0].clientX
    modalTouchEndX.current = null
  }
  const handleModalTouchMove = (e: React.TouchEvent) => {
    modalTouchEndX.current = e.targetTouches[0].clientX
  }
  const handleModalTouchEnd = () => {
    if (modalTouchStartX.current === null || modalTouchEndX.current === null) return
    const diff = modalTouchStartX.current - modalTouchEndX.current
    if (diff > 40) irProxima()
    else if (diff < -40) irAnterior()
    modalTouchStartX.current = null
    modalTouchEndX.current = null
  }

  // Trava scroll quando o modal de fotos estiver aberto
  useEffect(() => {
    if (modalFoto) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [modalFoto])

  function handleWhatsApp() {
    const msg = encodeURIComponent(`Olá! Tenho interesse no imóvel: ${imovel.titulo}. Vi no FIXUM.`)
    const tel = anunciante?.whatsapp ?? anunciante?.telefone ?? ''
    window.open(`https://wa.me/55${tel.replace(/\D/g, '')}?text=${msg}`, '_blank')
  }

  async function handleCompartilhar() {
    if (typeof window !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: imovel.titulo,
          text: `Confira este imóvel no FIXUM: ${imovel.titulo}`,
          url: window.location.href,
        })
      } catch {
        /* cancelado */
      }
    } else if (typeof window !== 'undefined') {
      await navigator.clipboard.writeText(window.location.href)
      setLinkCopiado(true)
      setTimeout(() => setLinkCopiado(false), 2500)
    }
  }

  return (
    <>
      <Header />

      <div className={styles.pagina}>
        {/* Breadcrumb / Botão Voltar */}
        <div className={styles.barraNavegacao}>
          <Link href="/explorar" className={styles.btnVoltarMobile}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6"/>
            </svg>
            <span>Voltar ao Explorar</span>
          </Link>

          <div className={styles.breadcrumb}>
            <Link href="/">Início</Link>
            <span>›</span>
            <Link href="/explorar">Explorar</Link>
            <span>›</span>
            <span className={styles.breadcrumbTitulo}>{imovel.titulo}</span>
          </div>
        </div>

        <div className={styles.layout}>
          {/* COLUNA PRINCIPAL */}
          <div className={styles.colunaPrincipal}>

            {/* Galeria */}
            <div className={styles.galeria}>
              <div
                className={styles.fotoGrande}
                style={{ backgroundImage: `url(${fotoAtual})` }}
                onClick={() => setModalFoto(true)}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
              >
                {fotos.length === 0 && (
                  <div className={styles.semFoto}>🏠</div>
                )}

                {/* Badge de contador de fotos */}
                {fotos.length > 0 && (
                  <div className={styles.badgeQtdFotos}>
                    📷 {fotoAtiva + 1} / {fotos.length}
                  </div>
                )}

                {/* Setas de navegação no desktop */}
                {fotos.length > 1 && (
                  <>
                    <button
                      type="button"
                      className={`${styles.setaGaleria} ${styles.setaGaleriaEsq}`}
                      onClick={(e) => { e.stopPropagation(); irAnterior() }}
                      aria-label="Foto anterior"
                    >
                      ‹
                    </button>
                    <button
                      type="button"
                      className={`${styles.setaGaleria} ${styles.setaGaleriaDir}`}
                      onClick={(e) => { e.stopPropagation(); irProxima() }}
                      aria-label="Próxima foto"
                    >
                      ›
                    </button>
                  </>
                )}

                <div className={styles.galeriaOverlay}>
                  <button type="button" className={styles.btnVerFotos}>
                    📷 Ver todas as fotos ({fotos.length || 1})
                  </button>
                </div>
              </div>

              {fotos.length > 1 && (
                <div className={styles.miniaturas}>
                  {fotos.slice(0, 6).map((foto, i) => (
                    <div
                      key={foto.id}
                      className={`${styles.miniatura} ${i === fotoAtiva ? styles.miniaturaAtiva : ''}`}
                      style={{ backgroundImage: `url(${foto.url})` }}
                      onClick={() => setFotoAtiva(i)}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Título e preço */}
            <div className={styles.cabecalho}>
              <div className={styles.cabecalhoTop}>
                <div>
                  <div className={styles.selos}>
                    <span className={`badge ${imovel.negociacao === 'venda' ? 'badge-primario' : 'badge-acento'}`}>
                      {imovel.negociacao === 'venda' ? '🏷️ Venda' : '🔑 Aluguel'}
                    </span>
                    <span className="badge badge-primario">{labelTipoImovel(imovel.tipo)}</span>
                    {imovel.destaque && <span className="badge badge-destaque">⭐ Destaque</span>}
                  </div>
                  <h1 className={styles.titulo}>{imovel.titulo}</h1>
                  <p className={styles.endereco}>
                    📍 {imovel.bairro ? `${imovel.bairro}, ` : ''}{imovel.cidade}
                  </p>
                </div>

                <div className={styles.acoesTopo}>
                  <button
                    type="button"
                    className={`${styles.btnAcao} ${favoritado ? styles.favoritado : ''}`}
                    onClick={toggleFavorito}
                    disabled={carregando}
                  >
                    {favoritado ? '❤️' : '🤍'} <span>{favoritado ? 'Salvo' : 'Favoritar'}</span>
                  </button>
                  <button
                    type="button"
                    className={styles.btnAcao}
                    onClick={handleCompartilhar}
                  >
                    🔗 <span>{linkCopiado ? 'Link Copiado!' : 'Compartilhar'}</span>
                  </button>
                </div>
              </div>

              <div className={styles.precoGrande}>
                {formatarPreco(imovel.preco, imovel.negociacao)}
                {imovel.condominio && (
                  <span className={styles.condominio}>
                    + R$ {imovel.condominio.toLocaleString('pt-BR')} cond./mês
                  </span>
                )}
              </div>

              {historico.length > 0 && (
                <div className={styles.historicoPreco}>
                  📉 Preço reduzido! Era {formatarPreco(historico[0].preco_anterior)}
                </div>
              )}
            </div>

            {/* Dados principais */}
            <div className={styles.dadosPrincipais}>
              {imovel.quartos != null && imovel.quartos > 0 && (
                <div className={styles.dado}>
                  <span className={styles.dadoIcone}>🛏️</span>
                  <strong>{imovel.quartos}</strong>
                  <span>{imovel.quartos === 1 ? 'Quarto' : 'Quartos'}</span>
                </div>
              )}
              {imovel.suites != null && imovel.suites > 0 && (
                <div className={styles.dado}>
                  <span className={styles.dadoIcone}>🛁</span>
                  <strong>{imovel.suites}</strong>
                  <span>{imovel.suites === 1 ? 'Suíte' : 'Suítes'}</span>
                </div>
              )}
              {imovel.banheiros != null && imovel.banheiros > 0 && (
                <div className={styles.dado}>
                  <span className={styles.dadoIcone}>🚿</span>
                  <strong>{imovel.banheiros}</strong>
                  <span>{imovel.banheiros === 1 ? 'Banheiro' : 'Banheiros'}</span>
                </div>
              )}
              {imovel.vagas != null && imovel.vagas > 0 && (
                <div className={styles.dado}>
                  <span className={styles.dadoIcone}>🚗</span>
                  <strong>{imovel.vagas}</strong>
                  <span>{imovel.vagas === 1 ? 'Vaga' : 'Vagas'}</span>
                </div>
              )}
              {imovel.area_construida && (
                <div className={styles.dado}>
                  <span className={styles.dadoIcone}>📐</span>
                  <strong>{formatarArea(imovel.area_construida)}</strong>
                  <span>Área útil</span>
                </div>
              )}
              {imovel.area_terreno && (
                <div className={styles.dado}>
                  <span className={styles.dadoIcone}>🌍</span>
                  <strong>{formatarArea(imovel.area_terreno)}</strong>
                  <span>Terreno</span>
                </div>
              )}
            </div>

            {/* Descrição */}
            {imovel.descricao && (
              <div className={styles.secao}>
                <h2>Sobre este imóvel</h2>
                <p className={styles.descricao}>{imovel.descricao}</p>
              </div>
            )}

            {/* Características */}
            {caracteristicas.length > 0 && (
              <div className={styles.secao}>
                <h2>Características</h2>
                <div className={styles.gridCaracteristicas}>
                  {caracteristicas.map((c) => (
                    <div key={c} className={styles.caracteristica}>
                      <span>{CARACTERISTICAS_ICONES[c] ?? '✅'}</span>
                      <span>{c.replace(/_/g, ' ')}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Localização */}
            <div className={styles.secao}>
              <h2>📍 Localização</h2>
              <p className={styles.enderecoCompleto}>
                {imovel.endereco_publico ? imovel.endereco : `${imovel.bairro ?? ''}, ${imovel.cidade}`}
              </p>
              <div className={styles.mapaImovelWrapper}>
                <MapaImovel
                  lat={imovel.latitude}
                  lng={imovel.longitude}
                  titulo={imovel.titulo}
                  publico={imovel.endereco_publico}
                />
              </div>
            </div>

            {/* O que tem perto */}
            <div className={styles.secao}>
              <h2>🏘️ O que tem perto?</h2>
              <div className={styles.gridPontos}>
                {PONTOS_INTERESSE.map((p) => (
                  <div key={p.label} className={styles.ponto}>
                    <span className={styles.pontoIcone}>{p.icone}</span>
                    <span>{p.label}</span>
                  </div>
                ))}
              </div>
              <p className={styles.pontoNota}>
                * Pontos de interesse são aproximados com base na localização do imóvel
              </p>
            </div>

            {/* Dados financeiros */}
            {(imovel.condominio || imovel.iptu) && (
              <div className={styles.secao}>
                <h2>Custos adicionais</h2>
                <div className={styles.custos}>
                  {imovel.condominio && (
                    <div className={styles.custo}>
                      <span>Condomínio</span>
                      <strong>R$ {imovel.condominio.toLocaleString('pt-BR')}/mês</strong>
                    </div>
                  )}
                  {imovel.iptu && (
                    <div className={styles.custo}>
                      <span>IPTU</span>
                      <strong>R$ {imovel.iptu.toLocaleString('pt-BR')}/ano</strong>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* COLUNA LATERAL — Contato Desktop */}
          <div className={styles.colunaLateral}>
            <div className={styles.cardContato}>
              {/* Anunciante */}
              {anunciante && (
                <div className={styles.anunciante}>
                  <div className={styles.anuncianteAvatar}>
                    {anunciante.foto_url ? (
                      <img src={anunciante.foto_url} alt={anunciante.nome} />
                    ) : (
                      <span>👤</span>
                    )}
                  </div>
                  <div>
                    <strong>{anunciante.nome}</strong>
                    <span className={`badge badge-primario`}>
                      {anunciante.tipo === 'proprietario' ? 'Proprietário' :
                       anunciante.tipo === 'corretor' ? 'Corretor' : 'Imobiliária'}
                    </span>
                  </div>
                </div>
              )}

              <div className={styles.precoCard}>
                {formatarPreco(imovel.preco, imovel.negociacao)}
              </div>

              {/* Botões de contato */}
              <div className={styles.botoesContato}>
                <button
                  type="button"
                  className={`btn btn-sucesso btn-lg ${styles.btnWhatsApp}`}
                  onClick={handleWhatsApp}
                >
                  <span>💬</span> WhatsApp
                </button>

                {anunciante?.telefone && (
                  <a
                    href={`tel:${anunciante.telefone}`}
                    className={`btn btn-outline btn-lg ${styles.btnTelefone}`}
                  >
                    <span>📞</span> Ligar
                  </a>
                )}
              </div>

              {/* Formulário de mensagem */}
              <div className={styles.formMensagem}>
                <p className={styles.formLabel}>Enviar mensagem</p>
                <textarea
                  className={`campo ${styles.textarea}`}
                  placeholder="Tenho interesse neste imóvel. Podem me enviar mais informações?"
                  rows={3}
                />
                <input
                  type="text"
                  className="campo"
                  placeholder="Seu nome"
                  style={{ marginTop: '8px' }}
                />
                <input
                  type="tel"
                  className="campo"
                  placeholder="Seu WhatsApp"
                  style={{ marginTop: '8px' }}
                />
                <button type="button" className="btn btn-primario btn-lg" style={{ marginTop: '12px', width: '100%' }}>
                  Enviar mensagem
                </button>
              </div>

              <p className={styles.aviso}>
                🔒 Seus dados são protegidos. Não compartilhamos com terceiros.
              </p>
            </div>

            {/* Card de referência do imóvel */}
            <div className={styles.cardRef}>
              <span>Código do imóvel</span>
              <strong>{imovel.id.slice(0, 8).toUpperCase()}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* ── BARRA FIXA DE CONTATO MOBILE (BOTTOM BAR) ── */}
      <div className={styles.barraContatoMobile}>
        <div className={styles.precoMobileInfo}>
          <span className={styles.precoMobileValor}>
            {formatarPreco(imovel.preco, imovel.negociacao)}
          </span>
          {imovel.condominio && (
            <span className={styles.condominioMobile}>
              + R$ {imovel.condominio.toLocaleString('pt-BR')} cond.
            </span>
          )}
        </div>

        <div className={styles.botoesMobileAcao}>
          {anunciante?.telefone && (
            <a
              href={`tel:${anunciante.telefone}`}
              className={styles.btnTelefoneMobile}
              title="Ligar"
            >
              📞
            </a>
          )}
          <button
            type="button"
            className={styles.btnWhatsAppMobile}
            onClick={handleWhatsApp}
          >
            <span>💬</span> Conversar no WhatsApp
          </button>
        </div>
      </div>

      {/* ── MODAL / LIGHTBOX DE FOTOS EM TELA CHEIA ── */}
      {modalFoto && (
        <div className={styles.lightboxOverlay} onClick={() => setModalFoto(false)}>
          <div className={styles.lightboxContainer} onClick={(e) => e.stopPropagation()}>
            <div className={styles.lightboxHeader}>
              <span className={styles.lightboxContador}>
                Foto {fotoAtiva + 1} de {fotos.length || 1}
              </span>
              <button
                type="button"
                className={styles.lightboxBtnFechar}
                onClick={() => setModalFoto(false)}
                aria-label="Fechar galeria"
              >
                ✕
              </button>
            </div>

            <div
              className={styles.lightboxCorpo}
              onTouchStart={handleModalTouchStart}
              onTouchMove={handleModalTouchMove}
              onTouchEnd={handleModalTouchEnd}
            >
              <img
                src={fotoAtual}
                alt={imovel.titulo}
                className={styles.lightboxImg}
              />

              {fotos.length > 1 && (
                <>
                  <button
                    type="button"
                    className={`${styles.lightboxSeta} ${styles.lightboxSetaEsq}`}
                    onClick={irAnterior}
                    aria-label="Foto anterior"
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    className={`${styles.lightboxSeta} ${styles.lightboxSetaDir}`}
                    onClick={irProxima}
                    aria-label="Próxima foto"
                  >
                    ›
                  </button>
                </>
              )}
            </div>

            {fotos.length > 1 && (
              <div className={styles.lightboxMiniaturas}>
                {fotos.map((f, i) => (
                  <button
                    key={f.id}
                    type="button"
                    className={`${styles.lightboxThumb} ${i === fotoAtiva ? styles.lightboxThumbAtiva : ''}`}
                    onClick={() => setFotoAtiva(i)}
                    style={{ backgroundImage: `url(${f.url})` }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
