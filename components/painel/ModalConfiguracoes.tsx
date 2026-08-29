'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useConfirm } from '@/contexts/ModalConfirmacaoContext'
import styles from './ModalConfiguracoes.module.css'

interface ModalConfiguracoesProps {
  aberto: boolean
  onFechar: () => void
  usuarioId: string
  usuarioNome: string
  tipoAnuncianteAtual?: 'proprietario' | 'corretor' | 'imobiliaria'
  creciAtual?: string
  isImobiliaria: boolean
  isCorretor: boolean
  imobiliariaDona: { id: string; nome: string } | null
  onConfiguracoesSalvas?: (configs: {
    prefixo: string
    modoCodigo: 'automatico' | 'proprio'
    tipoAnunciante?: string
    creci?: string
    modoExibicaoPreco?: 'visivel' | 'sob_consulta' | 'por_anuncio'
  }) => void
  onRecarregarPerfil?: () => void
}

type AbaConfig = 'perfil' | 'marca' | 'distribuicao'

export function gerarPrefixoSugerido(nome: string): string {
  if (!nome) return 'FX'
  const partes = nome
    .replace(/^(imobiliaria|corretor|corretora|imoveis|consultoria)\s+/i, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  if (partes.length >= 2) {
    return (partes[0][0] + partes[1][0]).toUpperCase()
  }
  if (partes.length === 1 && partes[0].length >= 2) {
    return partes[0].slice(0, 2).toUpperCase()
  }
  return 'FX'
}

async function processarImagemLogo(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const CANVAS_SIZE = 400
        const PADDING = 40

        const canvas = document.createElement('canvas')
        canvas.width = CANVAS_SIZE
        canvas.height = CANVAS_SIZE
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('Falha ao obter contexto 2D do canvas.'))
          return
        }

        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)

        const maxDim = CANVAS_SIZE - PADDING * 2
        let drawWidth = img.width
        let drawHeight = img.height

        if (drawWidth > maxDim || drawHeight > maxDim) {
          const ratio = Math.min(maxDim / drawWidth, maxDim / drawHeight)
          drawWidth = drawWidth * ratio
          drawHeight = drawHeight * ratio
        }

        const x = (CANVAS_SIZE - drawWidth) / 2
        const y = (CANVAS_SIZE - drawHeight) / 2

        ctx.drawImage(img, x, y, drawWidth, drawHeight)

        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob)
            } else {
              reject(new Error('Erro ao gerar Blob da imagem.'))
            }
          },
          'image/jpeg',
          0.9
        )
      }
      img.onerror = () => reject(new Error('Erro ao carregar arquivo de imagem.'))
      img.src = e.target?.result as string
    }
    reader.onerror = () => reject(new Error('Erro ao ler arquivo de imagem.'))
    reader.readAsDataURL(file)
  })
}

export default function ModalConfiguracoes({
  aberto,
  onFechar,
  usuarioId,
  usuarioNome,
  tipoAnuncianteAtual,
  creciAtual,
  isImobiliaria,
  isCorretor,
  imobiliariaDona,
  onConfiguracoesSalvas,
  onRecarregarPerfil,
}: ModalConfiguracoesProps) {
  const nomeBase = imobiliariaDona?.nome || usuarioNome || ''
  const prefixoPadrao = gerarPrefixoSugerido(nomeBase)

  const { confirmar } = useConfirm()

  const [abaAtiva, setAbaAtiva] = useState<AbaConfig>('perfil')
  const [tipoAnunciante, setTipoAnunciante] = useState<'proprietario' | 'corretor' | 'imobiliaria'>(
    tipoAnuncianteAtual || (isImobiliaria ? 'imobiliaria' : isCorretor ? 'corretor' : 'proprietario')
  )
  const [creci, setCreci] = useState<string>(creciAtual || '')
  const [prefixo, setPrefixo] = useState<string>(prefixoPadrao)
  const [modoCodigo, setModoCodigo] = useState<'automatico' | 'proprio'>('automatico')
  const [modoExibicaoPreco, setModoExibicaoPreco] = useState<'visivel' | 'sob_consulta' | 'por_anuncio'>('visivel')
  const [regraDistribuicao, setRegraDistribuicao] = useState<'captador' | 'roleta' | 'gestor'>('captador')
  const [whatsappDestino, setWhatsappDestino] = useState<'corretor' | 'imobiliaria'>('corretor')
  const [logoUrl, setLogoUrl] = useState<string>('')
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [mensagemSucesso, setMensagemSucesso] = useState(false)

  // Guardar snapshot dos valores salvos originais para restaurar no Cancelar
  const [snapshotOriginal, setSnapshotOriginal] = useState<{
    tipoAnunciante: 'proprietario' | 'corretor' | 'imobiliaria'
    creci: string
    prefixo: string
    modoCodigo: 'automatico' | 'proprio'
    modoExibicaoPreco: 'visivel' | 'sob_consulta' | 'por_anuncio'
    regraDistribuicao: 'captador' | 'roleta' | 'gestor'
    whatsappDestino: 'corretor' | 'imobiliaria'
    logoUrl: string
  } | null>(null)

  // Carregar preferências salvas da API e do banco ao abrir
  useEffect(() => {
    if (!aberto || !usuarioId) return

    async function carregarConfigs() {
      try {
        let tipoFinal = tipoAnuncianteAtual || (isImobiliaria ? 'imobiliaria' : isCorretor ? 'corretor' : 'proprietario')
        let creciFinal = creciAtual || ''
        let prefixoFinal = prefixoPadrao
        let modoFinal: 'automatico' | 'proprio' = 'automatico'
        let modoPrecoFinal: 'visivel' | 'sob_consulta' | 'por_anuncio' = 'visivel'
        let regraFinal: 'captador' | 'roleta' | 'gestor' = 'captador'
        let zapFinal: 'corretor' | 'imobiliaria' = 'corretor'
        let logoFinal = ''

        // Tentar via API de configurações
        try {
          const res = await fetch(`/api/painel/configuracoes?usuario_id=${usuarioId}`)
          if (res.ok) {
            const dataApi = await res.json()
            if (dataApi.configs) {
              const c = dataApi.configs
              if (c.tipo) tipoFinal = c.tipo
              if (c.creci) creciFinal = c.creci
              if (c.prefixo_codigo) prefixoFinal = c.prefixo_codigo
              if (c.tipo_codigo_imovel) modoFinal = c.tipo_codigo_imovel
              if (c.modo_exibicao_preco) modoPrecoFinal = c.modo_exibicao_preco
              if (c.regra_distribuicao_leads) regraFinal = c.regra_distribuicao_leads
              if (c.whatsapp_destino) zapFinal = c.whatsapp_destino
              if (c.foto_url) logoFinal = c.foto_url
            }
          }
        } catch (errApi) {
          console.warn('Fallback para banco direto:', errApi)
          const sb = createClient()
          const { data } = await sb
            .from('perfis')
            .select('*')
            .eq('id', usuarioId)
            .maybeSingle()

          if (data?.tipo && ['proprietario', 'corretor', 'imobiliaria'].includes(data.tipo)) {
            tipoFinal = data.tipo as any
          }
          if (data?.creci) creciFinal = data.creci
          if (data?.foto_url) logoFinal = data.foto_url
        }

        // Se for corretor vinculado, herdar o prefixo, modo e exibição de preço da imobiliária
        if (imobiliariaDona?.id && !isImobiliaria) {
          try {
            const resImob = await fetch(`/api/painel/configuracoes?usuario_id=${imobiliariaDona.id}`)
            if (resImob.ok) {
              const dataImob = await resImob.json()
              if (dataImob.configs) {
                if (dataImob.configs.prefixo_codigo) prefixoFinal = dataImob.configs.prefixo_codigo
                if (dataImob.configs.tipo_codigo_imovel) modoFinal = dataImob.configs.tipo_codigo_imovel
                if (dataImob.configs.modo_exibicao_preco) modoPrecoFinal = dataImob.configs.modo_exibicao_preco
              }
            }
          } catch {}
        }

        setTipoAnunciante(tipoFinal)
        setCreci(creciFinal)
        setPrefixo(prefixoFinal)
        setModoCodigo(modoFinal)
        setModoExibicaoPreco(modoPrecoFinal)
        setRegraDistribuicao(regraFinal)
        setWhatsappDestino(zapFinal)
        setLogoUrl(logoFinal)

        // Snapshot original
        setSnapshotOriginal({
          tipoAnunciante: tipoFinal,
          creci: creciFinal,
          prefixo: prefixoFinal,
          modoCodigo: modoFinal,
          modoExibicaoPreco: modoPrecoFinal,
          regraDistribuicao: regraFinal,
          whatsappDestino: zapFinal,
          logoUrl: logoFinal,
        })
      } catch (errGeral) {
        console.error('Erro ao carregar configurações:', errGeral)
      }
    }

    carregarConfigs()
  }, [aberto, usuarioId])

  // Cancelar e descartar alterações com confirmação inteligente
  async function handleCancelar() {
    if (snapshotOriginal) {
      const prefixoAtualLimpo = (prefixo.trim() || prefixoPadrao).toUpperCase().replace(/[^A-Z0-9]/g, '')
      const prefixoOriginalLimpo = (snapshotOriginal.prefixo.trim() || prefixoPadrao).toUpperCase().replace(/[^A-Z0-9]/g, '')

      const houveAlteracao =
        tipoAnunciante !== snapshotOriginal.tipoAnunciante ||
        creci.trim() !== snapshotOriginal.creci.trim() ||
        prefixoAtualLimpo !== prefixoOriginalLimpo ||
        modoCodigo !== snapshotOriginal.modoCodigo ||
        modoExibicaoPreco !== snapshotOriginal.modoExibicaoPreco ||
        regraDistribuicao !== snapshotOriginal.regraDistribuicao ||
        whatsappDestino !== snapshotOriginal.whatsappDestino ||
        logoUrl !== snapshotOriginal.logoUrl

      if (houveAlteracao) {
        const confirmou = await confirmar({
          titulo: 'Descartar alterações?',
          mensagem: 'Você tem modificações não salvas nas configurações. Deseja realmente sair sem salvar?',
          icone: '⚠️',
          tipo: 'aviso',
          textoBotaoConfirmar: 'Sim, Descartar',
        })

        if (!confirmou) return
      }

      setTipoAnunciante(snapshotOriginal.tipoAnunciante)
      setCreci(snapshotOriginal.creci)
      setPrefixo(snapshotOriginal.prefixo)
      setModoCodigo(snapshotOriginal.modoCodigo)
      setModoExibicaoPreco(snapshotOriginal.modoExibicaoPreco)
      setRegraDistribuicao(snapshotOriginal.regraDistribuicao)
      setWhatsappDestino(snapshotOriginal.whatsappDestino)
      setLogoUrl(snapshotOriginal.logoUrl)
    }
    onFechar()
  }

  // Fechar com ESC
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && aberto) {
        handleCancelar()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [aberto])

  if (!aberto) return null

  // Upload do Logotipo / Foto
  async function handleSelecionarLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      alert('Por favor, selecione um arquivo de imagem válido (PNG, JPG, WebP).')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('A imagem deve ter no máximo 5MB.')
      return
    }

    try {
      setUploadingLogo(true)
      const blob = await processarImagemLogo(file)
      const sb = createClient()
      const nomeArquivo = `logo_${usuarioId}_${Date.now()}.jpg`
      const caminho = `${usuarioId}/${nomeArquivo}`

      const { error: uploadError } = await sb.storage
        .from('fotos-imoveis')
        .upload(caminho, blob, {
          contentType: 'image/jpeg',
          upsert: true,
        })

      if (uploadError) throw uploadError

      const { data: urlData } = sb.storage.from('fotos-imoveis').getPublicUrl(caminho)
      const urlPublica = urlData.publicUrl

      setLogoUrl(urlPublica)
    } catch (err) {
      console.error('Erro ao enviar foto/logo:', err)
      alert('Não foi possível enviar a imagem. Tente novamente.')
    } finally {
      setUploadingLogo(false)
      e.target.value = ''
    }
  }

  // Remover foto/logo
  function handleRemoverLogo() {
    setLogoUrl('')
  }

  async function handleSalvar() {
    setSalvando(true)
    const prefixoLimpo = (prefixo.trim() || prefixoPadrao).toUpperCase().replace(/[^A-Z0-9]/g, '')
    const configs = {
      prefixo: prefixoLimpo,
      modoCodigo,
      tipoAnunciante,
      creci: creci.trim(),
      modoExibicaoPreco,
    }

    const ehCorretorVinculado = !!(imobiliariaDona && !isImobiliaria)

    if (typeof window !== 'undefined' && !ehCorretorVinculado) {
      localStorage.setItem(`config_imoveis_${usuarioId}`, JSON.stringify(configs))
    }

    try {
      // 1. Salvar via API segura do Painel
      await fetch('/api/painel/configuracoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usuario_id: usuarioId,
          tipo: tipoAnunciante,
          creci: tipoAnunciante === 'corretor' ? creci.trim() : null,
          foto_url: logoUrl || null,
          modo_exibicao_preco: modoExibicaoPreco,
          prefixo_codigo: prefixoLimpo,
          tipo_codigo_imovel: modoCodigo,
          regra_distribuicao_leads: tipoAnunciante === 'imobiliaria' ? regraDistribuicao : 'captador',
          whatsapp_destino: tipoAnunciante === 'imobiliaria' ? whatsappDestino : 'corretor',
        }),
      })

      // 2. Atualizar Auth Client Metadata local
      const sb = createClient()
      await sb.auth.updateUser({
        data: {
          tipo: tipoAnunciante,
          tipo_anunciante: tipoAnunciante,
          creci: tipoAnunciante === 'corretor' ? creci.trim() : null,
          foto_url: logoUrl || null,
          avatar_url: logoUrl || null,
          modo_exibicao_preco: modoExibicaoPreco,
          prefixo_codigo: prefixoLimpo,
          tipo_codigo_imovel: modoCodigo,
        },
      })
    } catch (err) {
      console.error('Erro ao salvar perfil:', err)
    }

    if (onConfiguracoesSalvas) {
      onConfiguracoesSalvas(configs)
    }

    if (onRecarregarPerfil) {
      onRecarregarPerfil()
    }

    setSalvando(false)
    setMensagemSucesso(true)
    setTimeout(() => {
      setMensagemSucesso(false)
      onFechar()
    }, 1200)
  }

  const ehImobiliaria = tipoAnunciante === 'imobiliaria'

  const labelPoliticaPrecoImob =
    modoExibicaoPreco === 'sob_consulta'
      ? '💬 Preço Sempre Sob Consulta'
      : modoExibicaoPreco === 'por_anuncio'
      ? '🎛️ Opcional por Anúncio'
      : '💰 Preço Sempre Visível'

  return (
    <div className={styles.backdrop} onClick={handleCancelar}>
      <div className={styles.modalBox} onClick={(e) => e.stopPropagation()}>
        {/* Cabeçalho Fixo */}
        <div className={styles.headerModal}>
          <div className={styles.tituloArea}>
            <div className={styles.iconeTopo}>⚙️</div>
            <div>
              <h2 className={styles.titulo}>Configurações da Conta</h2>
              <p className={styles.subtitulo}>
                Personalize seu perfil, identidade de anúncios e regras de operação
              </p>
            </div>
          </div>
          <button type="button" className={styles.btnFechar} onClick={handleCancelar} title="Fechar (ESC)">
            ✕
          </button>
        </div>

        {/* Layout com Sidebar e Área de Conteúdo */}
        <div className={styles.corpoLayout}>
          {/* Sidebar Lateral */}
          <div className={styles.sidebarAbas}>
            <button
              type="button"
              className={`${styles.btnAba} ${abaAtiva === 'perfil' ? styles.btnAbaAtiva : ''}`}
              onClick={() => setAbaAtiva('perfil')}
            >
              <span className={styles.iconeAba}>👤</span>
              <div className={styles.textosAba}>
                <span className={styles.tituloAba}>Perfil & Atuação</span>
                <span className={styles.descAba}>Tipo de conta e CRECI</span>
              </div>
            </button>

            <button
              type="button"
              className={`${styles.btnAba} ${abaAtiva === 'marca' ? styles.btnAbaAtiva : ''}`}
              onClick={() => setAbaAtiva('marca')}
            >
              <span className={styles.iconeAba}>🎨</span>
              <div className={styles.textosAba}>
                <span className={styles.tituloAba}>Marca & Anúncios</span>
                <span className={styles.descAba}>Logotipo, preços e códigos</span>
              </div>
            </button>

            {ehImobiliaria && (
              <button
                type="button"
                className={`${styles.btnAba} ${abaAtiva === 'distribuicao' ? styles.btnAbaAtiva : ''}`}
                onClick={() => setAbaAtiva('distribuicao')}
              >
                <span className={styles.iconeAba}>⚡</span>
                <div className={styles.textosAba}>
                  <span className={styles.tituloAba}>Leads & Equipe</span>
                  <span className={styles.descAba}>Distribuição e WhatsApp</span>
                </div>
              </button>
            )}
          </div>

          {/* Área de Conteúdo da Aba */}
          <div className={styles.areaConteudo}>
            {/* ── ABA 1: PERFIL & ATUAÇÃO ── */}
            {abaAtiva === 'perfil' && (
              <div>
                <div className={styles.secaoTituloArea}>
                  <span className={styles.secaoTitulo}>Tipo de Atuação no Fixum</span>
                  <span className={styles.secaoSubtitulo}>Define os recursos, cota e identificação da sua conta</span>
                </div>

                {imobiliariaDona ? (
                  <div className={styles.avisoVinculoEquipe}>
                    <span>🏢 Conta vinculada à equipe de <strong>{imobiliariaDona.nome}</strong>. Seu papel é gerenciado pela imobiliária.</span>
                  </div>
                ) : (
                  <div className={styles.gridTiposConta}>
                    <div
                      className={`${styles.cardTipoConta} ${tipoAnunciante === 'proprietario' ? styles.cardTipoContaSelecionado : ''}`}
                      onClick={() => setTipoAnunciante('proprietario')}
                    >
                      <div className={styles.tipoContaIcone}>👤</div>
                      <div className={styles.tipoContaInfo}>
                        <strong>Proprietário Direto</strong>
                        <span>Particular • Anuncie 1 imóvel grátis no mapa</span>
                      </div>
                    </div>

                    <div
                      className={`${styles.cardTipoConta} ${tipoAnunciante === 'corretor' ? styles.cardTipoContaSelecionado : ''}`}
                      onClick={() => setTipoAnunciante('corretor')}
                    >
                      <div className={styles.tipoContaIcone}>👔</div>
                      <div className={styles.tipoContaInfo}>
                        <strong>Corretor Autônomo</strong>
                        <span>Profissional independente • CRECI e faturas próprias</span>
                      </div>
                    </div>

                    <div
                      className={`${styles.cardTipoConta} ${tipoAnunciante === 'imobiliaria' ? styles.cardTipoContaSelecionado : ''}`}
                      onClick={() => setTipoAnunciante('imobiliaria')}
                    >
                      <div className={styles.tipoContaIcone}>🏢</div>
                      <div className={styles.tipoContaInfo}>
                        <strong>Imobiliária</strong>
                        <span>Gestão de equipe, múltiplos corretores e cota corporativa</span>
                      </div>
                    </div>
                  </div>
                )}

                {tipoAnunciante === 'corretor' && (
                  <div className={styles.linhaCreci}>
                    <label className={styles.labelCampo}>
                      <span>Número do CRECI (com UF)</span>
                      <span className={styles.opcionalPill}>Exibido nos anúncios</span>
                    </label>
                    <input
                      type="text"
                      className={styles.inputCreci}
                      value={creci}
                      onChange={(e) => setCreci(e.target.value.toUpperCase())}
                      placeholder="Ex: 12345-F/SP"
                      maxLength={20}
                    />
                  </div>
                )}
              </div>
            )}

            {/* ── ABA 2: MARCA & ANÚNCIOS ── */}
            {abaAtiva === 'marca' && (
              <div>
                <div className={styles.secaoTituloArea}>
                  <span className={styles.secaoTitulo}>Identidade Visual & Anúncios</span>
                  <span className={styles.secaoSubtitulo}>Foto/logotipo, visibilidade de preços e formato do código</span>
                </div>

                {/* Topo Compacto: Logotipo + Prefixo na mesma linha */}
                <div className={styles.linhaMarcaTopo}>
                  {/* Lado Esquerdo: Foto/Logotipo */}
                  <div className={styles.marcaTopoEsquerda}>
                    <div className={styles.logoPreviewWrapperCompacto}>
                      {logoUrl ? (
                        <img src={logoUrl} alt="Logotipo" className={styles.logoImgPreview} />
                      ) : (
                        <div className={styles.logoPlaceholderCompacto}>
                          {prefixo || prefixoPadrao}
                        </div>
                      )}
                    </div>
                    <div className={styles.logoTextosCompacto}>
                      <span className={styles.logoTituloCompacto}>
                        {ehImobiliaria ? 'Logotipo da Imobiliária' : 'Foto de Perfil / Marca'}
                      </span>
                      <div className={styles.logoBotoesCompacto}>
                        <label className={styles.btnUploadLogoCompacto}>
                          <input
                            type="file"
                            accept="image/png, image/jpeg, image/webp"
                            onChange={handleSelecionarLogo}
                            style={{ display: 'none' }}
                            disabled={uploadingLogo}
                          />
                          {uploadingLogo ? 'Enviando...' : logoUrl ? '📁 Trocar' : '📷 Enviar Foto'}
                        </label>
                        {logoUrl && (
                          <button
                            type="button"
                            className={styles.btnRemoverLogoCompacto}
                            onClick={handleRemoverLogo}
                            title="Remover logotipo"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Lado Direito: Iniciais / Prefixo */}
                  {(!imobiliariaDona || isImobiliaria) && (
                    <div className={styles.marcaTopoDireita}>
                      <div className={styles.prefixoWrapperCompacto}>
                        <label className={styles.labelPrefixoCompacto}>Prefixo:</label>
                        <input
                          type="text"
                          className={styles.inputPrefixoCompacto}
                          maxLength={6}
                          value={prefixo}
                          onChange={(e) => setPrefixo(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                          placeholder={prefixoPadrao}
                        />
                      </div>
                      <span className={styles.pillExemploCodigoCompacto} title="Exemplo de código gerado">
                        Ref: <strong>{prefixo || prefixoPadrao}-0001</strong>
                      </span>
                    </div>
                  )}
                </div>

                {/* Regra de Exibição de Preço nos Anúncios */}
                {imobiliariaDona && !isImobiliaria ? (
                  <div className={styles.avisoVinculoEquipe} style={{ marginTop: '0.65rem' }}>
                    <span>🏢 <strong>Política da Imobiliária:</strong> A exibição de valores nos anúncios ({labelPoliticaPrecoImob}) e os códigos ({modoCodigo === 'proprio' ? 'Código Interno/CRM' : `Sequencial: ${prefixo || prefixoPadrao}-0001`}) são definidos pela <strong>{imobiliariaDona.nome}</strong>.</span>
                  </div>
                ) : (
                  <>
                    {/* Seção 1: Exibição de Preço */}
                    <div className={styles.secaoBloco}>
                      <label className={styles.labelCampo} style={{ marginBottom: '3px' }}>
                        <span>Exibição de Preço nos Anúncios (Mapa e Lista)</span>
                      </label>
                      <div className={styles.gridModos}>
                        {/* Opção 1: Sempre Visível (Sim) */}
                        <div
                          className={`${styles.cardModo} ${modoExibicaoPreco === 'visivel' ? styles.cardModoSelecionado : ''}`}
                          onClick={() => setModoExibicaoPreco('visivel')}
                        >
                          <div className={styles.cardModoTopo}>
                            <span className={styles.cardModoTitulo}>💰 Sempre Visível</span>
                            <span className={styles.badgeRecomendado}>Padrão</span>
                          </div>
                          <p className={styles.cardModoTexto}>
                            Exibe o valor numérico em todos os anúncios da conta.
                          </p>
                          <div className={styles.cardModoExemplo}>
                            Ex: R$ 750.000
                          </div>
                        </div>

                        {/* Opção 2: Sempre Sob Consulta (Não) */}
                        <div
                          className={`${styles.cardModo} ${modoExibicaoPreco === 'sob_consulta' ? styles.cardModoSelecionado : ''}`}
                          onClick={() => setModoExibicaoPreco('sob_consulta')}
                        >
                          <div className={styles.cardModoTopo}>
                            <span className={styles.cardModoTitulo}>💬 Sob Consulta</span>
                            <span className={styles.badgeEstrategico}>Leads</span>
                          </div>
                          <p className={styles.cardModoTexto}>
                            Oculta o valor em todos os anúncios para gerar contato direto.
                          </p>
                          <div className={styles.cardModoExemplo} style={{ color: '#0284c7', background: 'rgba(2, 132, 199, 0.08)' }}>
                            Preço sob consulta
                          </div>
                        </div>

                        {/* Opção 3: Opcional por Anúncio */}
                        <div
                          className={`${styles.cardModo} ${modoExibicaoPreco === 'por_anuncio' ? styles.cardModoSelecionado : ''}`}
                          onClick={() => setModoExibicaoPreco('por_anuncio')}
                        >
                          <div className={styles.cardModoTopo}>
                            <span className={styles.cardModoTitulo}>🎛️ Por Anúncio</span>
                            <span className={styles.badgeRecomendado} style={{ background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a' }}>Flexível</span>
                          </div>
                          <p className={styles.cardModoTexto}>
                            Escolha individualmente em cada imóvel no cadastro/edição.
                          </p>
                          <div className={styles.cardModoExemplo} style={{ color: '#8b5cf6', background: 'rgba(139, 92, 246, 0.08)' }}>
                            Configuração individual
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Seção 2: Modo de Código */}
                    <div className={styles.secaoBloco}>
                      <label className={styles.labelCampo} style={{ marginBottom: '3px' }}>
                        <span>Modo de Criação do Código</span>
                      </label>
                      <div className={styles.gridModos}>
                        <div
                          className={`${styles.cardModo} ${modoCodigo === 'automatico' ? styles.cardModoSelecionado : ''}`}
                          onClick={() => setModoCodigo('automatico')}
                        >
                          <div className={styles.cardModoTopo}>
                            <span className={styles.cardModoTitulo}>⚡ Automático</span>
                            <span className={styles.badgeRecomendado}>Padrão</span>
                          </div>
                          <p className={styles.cardModoTexto}>
                            Gera códigos sequenciais a cada novo imóvel.
                          </p>
                          <div className={styles.cardModoExemplo}>
                            {prefixo || prefixoPadrao}-0001
                          </div>
                        </div>

                        <div
                          className={`${styles.cardModo} ${modoCodigo === 'proprio' ? styles.cardModoSelecionado : ''}`}
                          onClick={() => setModoCodigo('proprio')}
                        >
                          <div className={styles.cardModoTopo}>
                            <span className={styles.cardModoTitulo}>🏷️ Próprio / CRM</span>
                          </div>
                          <p className={styles.cardModoTexto}>
                            Habilita campo para digitar códigos manuais.
                          </p>
                          <div className={styles.cardModoExemplo}>
                            Ex: AP-104
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ── ABA 3: DISTRIBUIÇÃO DE LEADS (IMOBILIÁRIA) ── */}
            {abaAtiva === 'distribuicao' && ehImobiliaria && (
              <div>
                <div className={styles.secaoTituloArea}>
                  <span className={styles.secaoTitulo}>Distribuição de Leads da Equipe</span>
                  <span className={styles.secaoSubtitulo}>Como contatos e mensagens recebidos no portal serão encaminhados</span>
                </div>

                <div className={styles.gridRegrasDistribuicao}>
                  {/* Opção 1: Direto ao Captador */}
                  <div
                    className={`${styles.cardRegraItem} ${regraDistribuicao === 'captador' ? styles.cardRegraItemAtivo : ''}`}
                    onClick={() => setRegraDistribuicao('captador')}
                  >
                    <div className={styles.regraItemHeader}>
                      <span className={styles.regraItemTitulo}>📌 Direto ao Captador</span>
                      {regraDistribuicao === 'captador' && (
                        <span className={styles.regraBadgeAtivo}>Ativo</span>
                      )}
                    </div>
                    <span className={styles.regraItemDesc}>
                      O corretor que cadastrou o imóvel recebe diretamente os contatos desse anúncio.
                    </span>
                  </div>

                  {/* Opção 2: Roleta de Plantão */}
                  <div
                    className={`${styles.cardRegraItem} ${regraDistribuicao === 'roleta' ? styles.cardRegraItemAtivo : ''}`}
                    onClick={() => setRegraDistribuicao('roleta')}
                  >
                    <div className={styles.regraItemHeader}>
                      <span className={styles.regraItemTitulo}>🎲 Roleta de Plantão</span>
                      {regraDistribuicao === 'roleta' && (
                        <span className={styles.regraBadgeAtivo}>Ativo</span>
                      )}
                    </div>
                    <span className={styles.regraItemDesc}>
                      Distribuição circular (round-robin) igualitária entre todos os corretores ativos.
                    </span>
                  </div>

                  {/* Opção 3: Triagem na Gestão */}
                  <div
                    className={`${styles.cardRegraItem} ${regraDistribuicao === 'gestor' ? styles.cardRegraItemAtivo : ''}`}
                    onClick={() => setRegraDistribuicao('gestor')}
                  >
                    <div className={styles.regraItemHeader}>
                      <span className={styles.regraItemTitulo}>🎯 Triagem na Gestão</span>
                      {regraDistribuicao === 'gestor' && (
                        <span className={styles.regraBadgeAtivo}>Ativo</span>
                      )}
                    </div>
                    <span className={styles.regraItemDesc}>
                      Todos os novos leads entram na Caixa de Entrada do Gestor para triagem manual.
                    </span>
                  </div>
                </div>

                <div className={styles.linhaDestinoWhatsapp}>
                  <label className={styles.labelCampo} style={{ margin: 0 }}>
                    <span>Destino do botão WhatsApp nos anúncios:</span>
                  </label>
                  <div className={styles.opcoesRadioWhatsapp}>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="whatsapp_destino_modal"
                        value="corretor"
                        checked={whatsappDestino === 'corretor'}
                        onChange={() => setWhatsappDestino('corretor')}
                      />
                      <span>Corretor do Imóvel</span>
                    </label>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="whatsapp_destino_modal"
                        value="imobiliaria"
                        checked={whatsappDestino === 'imobiliaria'}
                        onChange={() => setWhatsappDestino('imobiliaria')}
                      />
                      <span>WhatsApp Central</span>
                    </label>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Rodapé Fixo */}
        <div className={styles.rodapeModal}>
          <button type="button" className={styles.btnCancelar} onClick={handleCancelar} disabled={salvando}>
            Cancelar
          </button>
          <button type="button" className={styles.btnSalvar} onClick={handleSalvar} disabled={salvando}>
            {salvando ? 'Salvando...' : mensagemSucesso ? '✓ Salvo!' : 'Salvar Alterações'}
          </button>
        </div>
      </div>
    </div>
  )
}
