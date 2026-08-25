'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import Header from '@/components/layout/Header'
import CardImovel from '@/components/imovel/CardImovel'
import SecaoEntorno from '@/components/imovel/SecaoEntorno'
import { type Imovel, type PontoInteresse } from '@/lib/types'
import { formatarPreco, formatarArea, labelTipoImovel } from '@/lib/utils'
import { useFavorito } from '@/hooks/useFavorito'
import { createClient } from '@/lib/supabase/client'
import styles from './page.module.css'

const MapaImovel = dynamic(() => import('@/components/mapa/MapaImovel'), { ssr: false })

function IconeWhatsApp({ size = 15 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'inline-block', verticalAlign: 'middle' }}
    >
      <path d="M12.031 2c-5.508 0-9.984 4.477-9.984 9.984 0 1.761.458 3.479 1.328 4.996L2 22l5.166-1.355a9.945 9.945 0 004.865 1.258h.004c5.508 0 9.984-4.477 9.984-9.984 0-2.668-1.039-5.176-2.926-7.063A9.927 9.927 0 0012.031 2zm0 18.293h-.003a8.272 8.272 0 01-4.221-1.151l-.303-.18-3.136.822.837-3.056-.197-.314a8.27 8.27 0 01-1.268-4.43c0-4.57 3.719-8.289 8.292-8.289 2.215 0 4.297.863 5.863 2.43 1.566 1.566 2.428 3.649 2.428 5.864 0 4.571-3.719 8.29-8.291 8.29zm4.542-6.205c-.249-.125-1.472-.726-1.7-.809-.228-.083-.394-.125-.56.125-.166.249-.643.809-.788.975-.145.166-.29.187-.539.062-.249-.125-1.052-.388-2.003-1.236-.74-.66-1.24-1.476-1.385-1.725-.145-.249-.015-.384.11-.508.112-.111.249-.29.373-.435.125-.145.166-.249.249-.415.083-.166.042-.311-.021-.435-.062-.125-.56-1.349-.768-1.847-.202-.486-.407-.42-.56-.428l-.477-.008c-.166 0-.435.062-.663.311-.228.249-.871.851-.871 2.075 0 1.224.892 2.407 1.016 2.573.125.166 1.756 2.681 4.254 3.759.594.257 1.059.41 1.421.525.598.19 1.142.163 1.572.099.479-.071 1.472-.602 1.68-1.183.208-.581.208-1.079.145-1.183-.062-.104-.228-.166-.477-.291z" />
    </svg>
  )
}

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
      imobiliaria_id?: string
      imobiliaria_nome?: string
      total_imoveis?: number
    }
  }
  historico: { preco_anterior: number; preco_novo: number; created_at: string }[]
  outrosImoveis?: any[]
}

export default function PaginaImovelCliente({ imovel, historico, outrosImoveis = [] }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const origemParam = searchParams.get('origem')

  const [fotoAtiva, setFotoAtiva] = useState(0)
  const { favoritado, toggleFavorito, carregando } = useFavorito(imovel.id)
  const [modalFoto, setModalFoto] = useState(false)
  const [linkCopiado, setLinkCopiado] = useState(false)
  const [codigoCopiado, setCodigoCopiado] = useState(false)

  const codigoExibicao = imovel.codigo || null

  // Formulário de Lead / Contato
  const [formNome, setFormNome] = useState('')
  const [formTelefone, setFormTelefone] = useState('')
  const [formMensagem, setFormMensagem] = useState(
    `Olá! Tenho interesse no imóvel "${imovel.titulo}"${codigoExibicao ? ` (Cód: ${codigoExibicao})` : ''}. Poderia me passar mais informações?`
  )
  const [enviandoLead, setEnviandoLead] = useState(false)
  const [leadEnviado, setLeadEnviado] = useState(false)

  // Conveniências do Entorno & Mapa
  const [poisEntorno, setPoisEntorno] = useState<PontoInteresse[]>([])
  const [poiSelecionadoId, setPoiSelecionadoId] = useState<string | null>(null)

  const touchStartX = useRef<number | null>(null)
  const touchEndX = useRef<number | null>(null)
  const modalTouchStartX = useRef<number | null>(null)
  const modalTouchEndX = useRef<number | null>(null)

  const fotos = imovel.fotos_imovel ?? []
  const caracteristicas = imovel.caracteristicas_imovel?.map((c) => c.caracteristica) ?? []
  const anunciante = imovel.perfis
  const imobiliariaId = anunciante?.imobiliaria_id || anunciante?.id
  const nomeImobiliaria = anunciante?.imobiliaria_nome || anunciante?.nome || 'Imobiliária'
  const totalImoveisEmpresa = anunciante?.total_imoveis || (outrosImoveis?.length ? outrosImoveis.length + 1 : 1)

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
    const cod = imovel.codigo || imovel.id.slice(0, 8).toUpperCase()
    const msg = encodeURIComponent(
      `Olá! Tenho interesse no imóvel: ${imovel.titulo} (Cód: ${cod}) em ${imovel.cidade}. Vi no FIXUM.`
    )
    const tel = anunciante?.whatsapp ?? anunciante?.telefone ?? '31988027152'
    window.open(`https://wa.me/55${tel.replace(/\D/g, '')}?text=${msg}`, '_blank')
  }

  function handleCompartilharWhatsApp() {
    const localTxt = `${imovel.cidade}${imovel.bairro ? ` - ${imovel.bairro}` : ''}`
    const precoTxt = formatarPreco(imovel.preco, imovel.negociacao)
    const url = typeof window !== 'undefined' ? window.location.href : `https://fixum.com.br/imovel/${imovel.id}`
    const refTexto = imovel.codigo ? `\nRef: ${imovel.codigo}` : ''
    const texto = encodeURIComponent(
      `*FIXUM Imóveis*\n\n*${imovel.titulo}*${refTexto}\n${localTxt}\n${precoTxt}\n\nConfira as fotos e detalhes no FIXUM:\n${url}`
    )
    window.open(`https://wa.me/?text=${texto}`, '_blank')
  }

  async function handleCopiarLink() {
    const url = typeof window !== 'undefined' ? window.location.href : `https://fixum.com.br/imovel/${imovel.id}`
    if (typeof window !== 'undefined') {
      try {
        await navigator.clipboard.writeText(url)
      } catch {
        const input = document.createElement('input')
        input.value = url
        document.body.appendChild(input)
        input.select()
        document.execCommand('copy')
        document.body.removeChild(input)
      }
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
          <button
            type="button"
            onClick={() => {
              if (typeof window !== 'undefined') {
                if (origemParam === 'mapa') {
                  sessionStorage.setItem('fixum_vista_ativa', 'mapa')
                }
              }
              if (typeof window !== 'undefined' && window.history.length > 1) {
                router.back()
              } else {
                router.push(origemParam === 'mapa' ? '/explorar?vista=mapa' : '/explorar')
              }
            }}
            className={styles.btnVoltar}
            title={origemParam === 'mapa' ? 'Voltar para a busca no mapa' : 'Voltar para a lista de imóveis'}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6"/>
            </svg>
            <span>{origemParam === 'mapa' ? 'Voltar ao Mapa' : 'Voltar aos Imóveis'}</span>
          </button>

          {/* Breadcrumb visível apenas no desktop */}
          <div className={styles.breadcrumbDesktop}>
            <Link href="/">Início</Link>
            <span>›</span>
            <Link href={origemParam === 'mapa' ? '/explorar?vista=mapa' : '/explorar'}>Explorar</Link>
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
              onClick={handleCompartilharWhatsApp}
              title="Compartilhar este imóvel no WhatsApp"
              style={{ color: '#16a34a', borderColor: '#bbf7d0', background: '#f0fdf4' }}
            >
              <IconeWhatsApp size={14} />
              <span className={styles.txtAcao}>WhatsApp</span>
            </button>
            <button
              type="button"
              className={styles.btnAcaoTopo}
              onClick={handleCopiarLink}
              title="Copiar link do imóvel"
            >
              🔗
              <span className={styles.txtAcao}>{linkCopiado ? '✓ Copiado!' : 'Copiar Link'}</span>
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
                {codigoExibicao && (
                  <div className={styles.badgeCodigoImovel} title="Código do imóvel para referência">
                    <span>🏷️ Cód. <strong>{codigoExibicao}</strong></span>
                    <button
                      type="button"
                      className={styles.btnCopiarCodigo}
                      onClick={() => {
                        if (typeof navigator !== 'undefined' && navigator.clipboard) {
                          navigator.clipboard.writeText(codigoExibicao)
                          setCodigoCopiado(true)
                          setTimeout(() => setCodigoCopiado(false), 2000)
                        }
                      }}
                      title="Copiar código do anúncio"
                    >
                      {codigoCopiado ? '✓ Copiado' : 'Copiar'}
                    </button>
                  </div>
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
              <p style={{ fontSize: '0.82rem', color: '#64748b', margin: '-4px 0 12px 0', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span>🛡️</span> Região aproximada para privacidade e segurança do imóvel. O endereço exato é fornecido no agendamento da visita.
              </p>
              <div className={styles.mapaImovelWrapper}>
                <MapaImovel
                  lat={imovel.latitude}
                  lng={imovel.longitude}
                  titulo={imovel.titulo}
                  publico={false}
                  pois={poisEntorno}
                  poiSelecionadoId={poiSelecionadoId}
                  onSelecionarPoi={(poi) => setPoiSelecionadoId(poi.id)}
                />
              </div>
            </div>

            {/* O Que Tem no Entorno Inteligente */}
            <div className={styles.secaoDetalhe}>
              <SecaoEntorno
                lat={imovel.latitude}
                lng={imovel.longitude}
                onPoisCarregados={setPoisEntorno}
                poiSelecionadoId={poiSelecionadoId}
                onSelecionarPoi={(poi) => setPoiSelecionadoId(poi.id)}
              />
            </div>

            {/* ═══════════════════════════════════════════════════════════════
                SEÇÃO: MAIS IMÓVEIS DESTA IMOBILIÁRIA
                ═══════════════════════════════════════════════════════════════ */}
            {outrosImoveis && outrosImoveis.length > 0 && (
              <div className={styles.secaoDetalhe}>
                <div className={styles.cabecalhoOutrosImoveis}>
                  <div>
                    <h2 className={styles.secaoSubtitulo}>
                      🏢 Mais Imóveis {imovel.negociacao === 'venda' ? 'à Venda' : 'para Alugar'} de {nomeImobiliaria}
                    </h2>
                    <p className={styles.subtituloOutros}>
                      Conheça outras opções de {imovel.negociacao === 'venda' ? 'venda' : 'aluguel'} desta empresa
                    </p>
                  </div>
                  {imobiliariaId && (
                    <Link
                      href={`/explorar?imobiliaria=${imobiliariaId}&nome=${encodeURIComponent(nomeImobiliaria)}&negociacao=${imovel.negociacao}`}
                      className={styles.btnVerTodosMapaDesktop}
                    >
                      Ver no Mapa ({totalImoveisEmpresa}) ➔
                    </Link>
                  )}
                </div>

                <div className={styles.gridOutrosImoveis}>
                  {outrosImoveis.slice(0, 4).map((outro) => (
                    <CardImovel key={outro.id} imovel={outro} />
                  ))}
                </div>

                {imobiliariaId && (
                  <div className={styles.rodapeOutrosImoveisMobile}>
                    <Link
                      href={`/explorar?imobiliaria=${imobiliariaId}&nome=${encodeURIComponent(nomeImobiliaria)}&negociacao=${imovel.negociacao}`}
                      className="btn btn-outline btn-lg"
                      style={{ width: '100%', justifyContent: 'center' }}
                    >
                      🏢 Ver todos os {totalImoveisEmpresa} imóveis no mapa
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ═══════════════════════════════════════════════════════════════
              COLUNA LATERAL — CARD DE CONTATO & PROPOSTA (STICKY)
              ═══════════════════════════════════════════════════════════════ */}
          <div className={styles.colunaLateral}>
            <div className={styles.cardContatoSticky}>
              {/* Banner de Destaque da Imobiliária */}
              <div className={styles.bannerImobiliaria}>
                <div className={styles.bannerImobLogoWrapper}>
                  {anunciante?.foto_url ? (
                    <img src={anunciante.foto_url} alt={nomeImobiliaria} className={styles.bannerImobLogoImg} />
                  ) : (
                    <div className={styles.anuncianteAvatarPlaceholder} style={{ fontSize: '1.2rem', fontWeight: 800, color: '#1d4ed8' }}>
                      {nomeImobiliaria.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className={styles.bannerImobTextos}>
                  <span className={styles.bannerImobNome}>{nomeImobiliaria}</span>
                  {anunciante?.nome && anunciante.nome !== nomeImobiliaria && (
                    <span className={styles.bannerImobSubtitulo}>Corretor: {anunciante.nome}</span>
                  )}
                  <span className={styles.bannerImobSelo}>
                    <span>✓</span> Imobiliária Verificada
                  </span>
                </div>
                {anunciante?.creci && (
                  <span className={styles.bannerImobCreci}>CRECI {anunciante.creci}</span>
                )}
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
                    <span>📞</span> {anunciante?.tipo === 'imobiliaria' ? 'Ligar para a Imobiliária' : 'Ligar para o Corretor'}
                  </a>
                )}
              </div>

              {/* Atalho para Ver Outros Imóveis da Imobiliária */}
              {imobiliariaId && (
                <div className={styles.blocoOutrosImoveisCard}>
                  <Link
                    href={`/explorar?imobiliaria=${imobiliariaId}&nome=${encodeURIComponent(nomeImobiliaria)}&negociacao=${imovel.negociacao}`}
                    className={styles.btnVerTodosImoveisImob}
                  >
                    <span>🏢</span> Ver outros imóveis de {imovel.negociacao === 'venda' ? 'venda' : 'aluguel'} desta imobiliária ({totalImoveisEmpresa})
                  </Link>
                  <Link
                    href={`/imobiliaria/${imobiliariaId}`}
                    className={styles.linkPerfilImob}
                  >
                    Ver página oficial da imobiliária
                  </Link>
                </div>
              )}

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
                    {enviandoLead ? 'Enviando...' : '✉️ Obter Mais Informações'}
                  </button>
                </form>
              )}

              {/* Código do Imóvel & Segurança */}
              <div className={styles.rodapeSegurancaCard}>
                <div className={styles.codigoImovelPill}>
                  Código: <strong>{imovel.codigo || imovel.id.slice(0, 8).toUpperCase()}</strong>
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
