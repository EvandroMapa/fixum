'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import Header from '@/components/layout/Header'
import { type Imovel } from '@/lib/types'
import { formatarPreco, formatarArea, labelTipoImovel } from '@/lib/utils'
import { useFavorito } from '@/hooks/useFavorito'
import { createClient } from '@/lib/supabase/client'
import styles from './page.module.css'

const MapaImovel = dynamic(() => import('@/components/mapa/MapaImovel'), { ssr: false })

const PONTOS_INTERESSE = [
  { icone: '🏫', label: 'Escolas e Creches' },
  { icone: '🏥', label: 'Hospitais e Clínicas' },
  { icone: '🛒', label: 'Supermercados' },
  { icone: '💊', label: 'Farmácias' },
  { icone: '🍽️', label: 'Restaurantes e Cafés' },
  { icone: '🏋️', label: 'Academias' },
  { icone: '🏦', label: 'Bancos e Caixas' },
  { icone: '🚌', label: 'Transporte Público' },
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
  salao_festas: '🎉',
  academia: '🏋️',
  playground: '🎠',
}

interface Props {
  imovel: Imovel & {
    fotos_imovel?: { id: string; url: string; principal: boolean; ordem: number }[]
    caracteristicas_imovel?: { caracteristica: string }[]
    perfis?: {
      id: string
      nome: string
      tipo: string
      foto_url?: string
      telefone?: string
      whatsapp?: string
      creci?: string
      imobiliaria_nome?: string
    }
  }
  historico: { preco_anterior: number; preco_novo: number; created_at: string }[]
}

export default function PaginaImovelCliente({ imovel, historico }: Props) {
  const [fotoAtiva, setFotoAtiva] = useState(0)
  const { favoritado, toggleFavorito, carregando } = useFavorito(imovel.id)
  const [modalFoto, setModalFoto] = useState(false)
  const [linkCopiado, setLinkCopiado] = useState(false)

  // Formulário de Lead / Contato
  const [formNome, setFormNome] = useState('')
  const [formTelefone, setFormTelefone] = useState('')
  const [formMensagem, setFormMensagem] = useState(
    `Olá! Tenho interesse no imóvel "${imovel.titulo}" (Cód: ${imovel.id.slice(0, 8).toUpperCase()}). Poderia me passar mais informações?`
  )
  const [enviandoLead, setEnviandoLead] = useState(false)
  const [leadEnviado, setLeadEnviado] = useState(false)

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

  // Gestos de swipe no carrossel mobile
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

  // Teclado no lightbox
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!modalFoto) return
      if (e.key === 'ArrowRight') irProxima()
      if (e.key === 'ArrowLeft') irAnterior()
      if (e.key === 'Escape') setModalFoto(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [modalFoto, irAnterior, irProxima])

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
    const msg = encodeURIComponent(
      `Olá! Tenho interesse no imóvel: ${imovel.titulo} (Cód: ${imovel.id.slice(0, 8).toUpperCase()}) em ${imovel.cidade}. Vi no FIXUM.`
    )
    const tel = anunciante?.whatsapp ?? anunciante?.telefone ?? '31988027152'
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

  async function handleEnviarLead(e: React.FormEvent) {
    e.preventDefault()
    if (!formNome.trim() || !formTelefone.trim()) return

    setEnviandoLead(true)
    try {
      const supabase = createClient()
      await supabase.from('leads').insert({
        imovel_id: imovel.id,
        nome: formNome,
        telefone: formTelefone,
        mensagem: formMensagem,
        status: 'novo',
      })
      setLeadEnviado(true)
    } catch (err) {
      console.error('Erro ao enviar mensagem:', err)
    } finally {
      setEnviandoLead(false)
    }
  }

  // Cálculos financeiros
  const precoNum = imovel.preco || 0
  const condNum = imovel.condominio || 0
  const iptuNum = imovel.iptu || 0
  const custoTotalMensal = precoNum + condNum + (imovel.negociacao === 'aluguel' ? Math.round(iptuNum / 12) : 0)

  return (
    <>
      <Header />

      <div className={styles.pagina}>
        {/* Barra superior de navegação / Ações */}
        <div className={styles.barraTopoImovel}>
          <Link href="/explorar" className={styles.btnVoltar}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6"/>
            </svg>
            <span>Voltar ao Mapa</span>
          </Link>

          {/* Breadcrumb visível apenas no desktop */}
          <div className={styles.breadcrumbDesktop}>
            <Link href="/">Início</Link>
            <span>›</span>
            <Link href="/explorar">Explorar</Link>
            <span>›</span>
            <span style={{ color: '#475569' }}>{imovel.cidade}</span>
            <span>›</span>
            <span className={styles.breadcrumbTitulo}>{imovel.titulo}</span>
          </div>

          {/* Ações de topo rápidas (Favoritar / Compartilhar) */}
          <div className={styles.acoesTopoRapidas}>
            <button
              type="button"
              className={`${styles.btnAcaoTopo} ${favoritado ? styles.favoritado : ''}`}
              onClick={toggleFavorito}
              disabled={carregando}
              title={favoritado ? 'Remover dos favoritos' : 'Salvar nos favoritos'}
            >
              {favoritado ? '❤️' : '🤍'}
              <span className={styles.txtAcao}>{favoritado ? 'Salvo' : 'Favoritar'}</span>
            </button>
            <button
              type="button"
              className={styles.btnAcaoTopo}
              onClick={handleCompartilhar}
              title="Compartilhar link do imóvel"
            >
              🔗
              <span className={styles.txtAcao}>{linkCopiado ? 'Link Copiado!' : 'Compartilhar'}</span>
            </button>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            GALERIA DE FOTOS (MOSAICO AIRBNB / QUINTOANDAR NO DESKTOP)
            ═══════════════════════════════════════════════════════════════ */}
        <div className={styles.secaoGaleriaWrapper}>
          {fotos.length >= 3 ? (
            <div className={styles.mosaicoFotos} onClick={() => setModalFoto(true)}>
              {/* Foto Principal (Esquerda) */}
              <div
                className={styles.mosaicoFotoPrincipal}
                style={{ backgroundImage: `url(${fotos[0].url})` }}
              >
                <div className={styles.overlayHoverFoto} />
              </div>

              {/* Stack de Fotos Laterais (Direita) */}
              <div className={styles.mosaicoFotosLaterais}>
                <div
                  className={styles.mosaicoFotoItem}
                  style={{ backgroundImage: `url(${fotos[1].url})` }}
                >
                  <div className={styles.overlayHoverFoto} />
                </div>
                <div
                  className={styles.mosaicoFotoItem}
                  style={{ backgroundImage: `url(${fotos[2].url})` }}
                >
                  <div className={styles.overlayHoverFoto} />
                </div>
              </div>

              {/* Botão Flutuante de Ver Todas as Fotos */}
              <button
                type="button"
                className={styles.btnVerTodasFotosFlutuante}
                onClick={(e) => {
                  e.stopPropagation()
                  setModalFoto(true)
                }}
              >
                📷 Ver todas as {fotos.length} fotos
              </button>
            </div>
          ) : (
            /* Carrossel clássico quando houver 1 ou 2 fotos */
            <div className={styles.galeriaSimples}>
              <div
                className={styles.fotoGrande}
                style={{ backgroundImage: `url(${fotoAtual})` }}
                onClick={() => setModalFoto(true)}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
              >
                {fotos.length === 0 && <div className={styles.semFoto}>🏠</div>}

                {fotos.length > 0 && (
                  <div className={styles.badgeQtdFotos}>
                    📷 {fotoAtiva + 1} / {fotos.length}
                  </div>
                )}

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
                    📷 Ver fotos em tela cheia ({fotos.length || 1})
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            LAYOUT SPLIT: CONTEÚDO PRINCIPAL (ESQ) + STICKY CONTATO (DIR)
            ═══════════════════════════════════════════════════════════════ */}
        <div className={styles.layout}>
          {/* COLUNA PRINCIPAL */}
          <div className={styles.colunaPrincipal}>
            {/* Título, Badges e Preço */}
            <div className={styles.cabecalhoInfo}>
              <div className={styles.selos}>
                <span className={`${styles.tagBadge} ${imovel.negociacao === 'venda' ? styles.tagVenda : styles.tagAluguel}`}>
                  {imovel.negociacao === 'venda' ? '🏷️ Venda' : '🔑 Aluguel'}
                </span>
                <span className={`${styles.tagBadge} styles.tagTipo`}>
                  {labelTipoImovel(imovel.tipo)}
                </span>
                {imovel.aceita_pets && (
                  <span className={`${styles.tagBadge} styles.tagPet`}>
                    🐾 Aceita Pets
                  </span>
                )}
                {imovel.mobiliado && (
                  <span className={`${styles.tagBadge} styles.tagMobiliado`}>
                    🛋️ Mobiliado
                  </span>
                )}
                {imovel.destaque && (
                  <span className={`${styles.tagBadge} styles.tagDestaque`}>
                    ⭐ Destaque
                  </span>
                )}
              </div>

              <h1 className={styles.titulo}>{imovel.titulo}</h1>

              <p className={styles.endereco}>
                <span>📍</span> {imovel.bairro ? `${imovel.bairro}, ` : ''}{imovel.cidade} - {imovel.estado || 'MG'}
              </p>

              {/* Bloco de Preço & Custos */}
              <div className={styles.blocoPrecoCard}>
                <div className={styles.linhaPrecoPrincipal}>
                  <span className={styles.precoValorDestaque}>
                    {formatarPreco(imovel.preco, imovel.negociacao)}
                  </span>
                  {imovel.negociacao === 'aluguel' && (
                    <span className={styles.precoSufixo}>/ mês</span>
                  )}
                </div>

                {(imovel.condominio || imovel.iptu) && (
                  <div className={styles.detalhamentoCustos}>
                    {imovel.condominio && (
                      <div className={styles.itemCusto}>
                        <span className={styles.itemCustoLabel}>Condomínio:</span>
                        <strong className={styles.itemCustoValor}>R$ {imovel.condominio.toLocaleString('pt-BR')}</strong>
                      </div>
                    )}
                    {imovel.iptu && (
                      <div className={styles.itemCusto}>
                        <span className={styles.itemCustoLabel}>IPTU:</span>
                        <strong className={styles.itemCustoValor}>R$ {imovel.iptu.toLocaleString('pt-BR')}</strong>
                      </div>
                    )}
                    {imovel.negociacao === 'aluguel' && (
                      <div className={styles.itemCustoTotal}>
                        <span className={styles.itemCustoLabel}>Total Mensal Estimado:</span>
                        <strong className={styles.itemCustoValorTotal}>R$ {custoTotalMensal.toLocaleString('pt-BR')}</strong>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {historico.length > 0 && (
                <div className={styles.historicoPreco}>
                  📉 Preço reduzido! Era {formatarPreco(historico[0].preco_anterior)}
                </div>
              )}
            </div>

            {/* ESPECIFICAÇÕES PRINCIPAIS (GRID MODERNO) */}
            <div className={styles.especificacoesGrid}>
              <div className={styles.especificacaoCard}>
                <span className={styles.especificacaoIcone}>📐</span>
                <div className={styles.especificacaoInfo}>
                  <strong>{formatarArea((imovel.area || imovel.area_construida)!)}</strong>
                  <span>Área Útil</span>
                </div>
              </div>

              {imovel.banheiros != null && imovel.banheiros > 0 && (
                <div className={styles.especificacaoCard}>
                  <span className={styles.especificacaoIcone}>🚿</span>
                  <div className={styles.especificacaoInfo}>
                    <strong>{imovel.banheiros}</strong>
                    <span>{imovel.banheiros === 1 ? 'Banheiro' : 'Banheiros'}</span>
                  </div>
                </div>
              )}

              {imovel.vagas != null && imovel.vagas > 0 && (
                <div className={styles.especificacaoCard}>
                  <span className={styles.especificacaoIcone}>🚗</span>
                  <div className={styles.especificacaoInfo}>
                    <strong>{imovel.vagas}</strong>
                    <span>{imovel.vagas === 1 ? 'Vaga' : 'Vagas'}</span>
                  </div>
                </div>
              )}

              {imovel.quartos != null && imovel.quartos > 0 ? (
                <div className={styles.especificacaoCard}>
                  <span className={styles.especificacaoIcone}>🛏️</span>
                  <div className={styles.especificacaoInfo}>
                    <strong>{imovel.quartos}</strong>
                    <span>{imovel.quartos === 1 ? 'Quarto' : 'Quartos'}</span>
                  </div>
                </div>
              ) : (
                <div className={styles.especificacaoCard}>
                  <span className={styles.especificacaoIcone}>🏢</span>
                  <div className={styles.especificacaoInfo}>
                    <strong>Vão Livre</strong>
                    <span>Espaço Amplo</span>
                  </div>
                </div>
              )}
            </div>

            {/* Descrição do Imóvel */}
            {imovel.descricao && (
              <div className={styles.secaoDetalhe}>
                <h2 className={styles.secaoSubtitulo}>Sobre o Imóvel</h2>
                <p className={styles.descricaoTexto}>{imovel.descricao}</p>
              </div>
            )}

            {/* Características e Comodidades */}
            {caracteristicas.length > 0 && (
              <div className={styles.secaoDetalhe}>
                <h2 className={styles.secaoSubtitulo}>Comodidades & Características</h2>
                <div className={styles.gridCaracteristicas}>
                  {caracteristicas.map((c) => (
                    <div key={c} className={styles.caracteristicaItem}>
                      <span className={styles.caracteristicaIcone}>{CARACTERISTICAS_ICONES[c] ?? '✨'}</span>
                      <span className={styles.caracteristicaNome}>{c.replace(/_/g, ' ')}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Localização & Mapa Interativo */}
            <div className={styles.secaoDetalhe}>
              <h2 className={styles.secaoSubtitulo}>📍 Localização no Mapa</h2>
              <p className={styles.enderecoCompleto}>
                {imovel.bairro ? `${imovel.bairro}, ` : ''}{imovel.cidade} - {imovel.estado || 'MG'}
              </p>
              <div className={styles.mapaImovelWrapper}>
                <MapaImovel
                  lat={imovel.latitude}
                  lng={imovel.longitude}
                  titulo={imovel.titulo}
                  publico={true}
                />
              </div>
            </div>

            {/* O Que Tem no Entorno */}
            <div className={styles.secaoDetalhe}>
              <h2 className={styles.secaoSubtitulo}>🏘️ O que tem no entorno?</h2>
              <div className={styles.gridPontos}>
                {PONTOS_INTERESSE.map((p) => (
                  <div key={p.label} className={styles.pontoCard}>
                    <span className={styles.pontoIcone}>{p.icone}</span>
                    <span className={styles.pontoLabel}>{p.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════════════
              COLUNA LATERAL — CARD DE CONTATO & PROPOSTA (STICKY)
              ═══════════════════════════════════════════════════════════════ */}
          <div className={styles.colunaLateral}>
            <div className={styles.cardContatoSticky}>
              {/* Identificação do Anunciante */}
              <div className={styles.boxAnuncianteInfo}>
                <div className={styles.anuncianteAvatarWrapper}>
                  {anunciante?.foto_url ? (
                    <img src={anunciante.foto_url} alt={anunciante.nome} className={styles.anuncianteAvatarImg} />
                  ) : (
                    <div className={styles.anuncianteAvatarPlaceholder}>
                      {anunciante?.nome?.slice(0, 2).toUpperCase() || 'IM'}
                    </div>
                  )}
                </div>
                <div className={styles.anuncianteTextos}>
                  <div className={styles.anuncianteNome}>{anunciante?.nome || 'Gestão Imobiliária'}</div>
                  <div className={styles.anuncianteImobiliariaBadge}>
                    <span>🏢</span>
                    <strong>{anunciante?.imobiliaria_nome || 'M2 Imóveis & Aço'}</strong>
                  </div>
                  {anunciante?.creci && (
                    <div className={styles.anuncianteCreci}>CRECI: {anunciante.creci}</div>
                  )}
                </div>
              </div>

              {/* Botões de Ação Imediata */}
              <div className={styles.botoesContatoDireto}>
                <button
                  type="button"
                  className={styles.btnWhatsAppDestaque}
                  onClick={handleWhatsApp}
                >
                  <span>💬</span> Conversar no WhatsApp
                </button>

                {anunciante?.telefone && (
                  <a
                    href={`tel:${anunciante.telefone}`}
                    className={styles.btnLigarDestaque}
                  >
                    <span>📞</span> Ligar para o Corretor
                  </a>
                )}
              </div>

              {/* Formulário de Envio de Mensagem / Lead */}
              <div className={styles.divisorContato} />

              {leadEnviado ? (
                <div className={styles.sucessoLeadCard}>
                  <div style={{ fontSize: '2rem', marginBottom: '4px' }}>🎉</div>
                  <strong>Mensagem Enviada!</strong>
                  <p>O corretor responsável entrará em contato em instantes pelo WhatsApp.</p>
                </div>
              ) : (
                <form onSubmit={handleEnviarLead} className={styles.formLead}>
                  <p className={styles.formLeadTitulo}>Envie uma mensagem rápida</p>

                  <div className={styles.campoGrupo}>
                    <input
                      type="text"
                      required
                      className={styles.inputLead}
                      placeholder="Seu nome completo"
                      value={formNome}
                      onChange={(e) => setFormNome(e.target.value)}
                    />
                  </div>

                  <div className={styles.campoGrupo}>
                    <input
                      type="tel"
                      required
                      className={styles.inputLead}
                      placeholder="Seu WhatsApp (com DDD)"
                      value={formTelefone}
                      onChange={(e) => setFormTelefone(e.target.value)}
                    />
                  </div>

                  <div className={styles.campoGrupo}>
                    <textarea
                      rows={2}
                      className={styles.textareaLead}
                      value={formMensagem}
                      onChange={(e) => setFormMensagem(e.target.value)}
                    />
                  </div>

                  <button
                    type="submit"
                    className={styles.btnEnviarLead}
                    disabled={enviandoLead}
                  >
                    {enviandoLead ? 'Enviando...' : '✉️ Enviar Proposta'}
                  </button>
                </form>
              )}

              {/* Código do Imóvel & Segurança */}
              <div className={styles.rodapeSegurancaCard}>
                <div className={styles.codigoImovelPill}>
                  Código: <strong>{imovel.id.slice(0, 8).toUpperCase()}</strong>
                </div>
                <p className={styles.avisoSeguro}>
                  🔒 Seus dados são protegidos e enviados com exclusividade para a equipe autorizada.
                </p>
              </div>
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
          <button
            type="button"
            className={styles.btnWhatsAppMobile}
            onClick={handleWhatsApp}
          >
            <span>💬</span> WhatsApp
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

            <div className={styles.lightboxCorpo}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
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
