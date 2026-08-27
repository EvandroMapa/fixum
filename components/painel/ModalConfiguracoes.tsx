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
  onConfiguracoesSalvas?: (configs: { prefixo: string; modoCodigo: 'automatico' | 'proprio'; tipoAnunciante?: string; creci?: string }) => void
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
          reject(new Error('Falha ao processar canvas'))
          return
        }

        ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)
        const maxDrawWidth = CANVAS_SIZE - PADDING * 2
        const maxDrawHeight = CANVAS_SIZE - PADDING * 2

        const scale = Math.min(maxDrawWidth / img.width, maxDrawHeight / img.height, 1)
        const drawWidth = img.width * scale
        const drawHeight = img.height * scale

        const offsetX = (CANVAS_SIZE - drawWidth) / 2
        const offsetY = (CANVAS_SIZE - drawHeight) / 2

        ctx.imageSmoothingEnabled = true
        ctx.imageSmoothingQuality = 'high'
        ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight)

        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob)
            else reject(new Error('Falha ao converter canvas para blob'))
          },
          'image/webp',
          0.92
        )
      }
      img.onerror = () => reject(new Error('Falha ao carregar imagem'))
      img.src = e.target?.result as string
    }
    reader.onerror = () => reject(new Error('Falha ao ler arquivo'))
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
    regraDistribuicao: 'captador' | 'roleta' | 'gestor'
    whatsappDestino: 'corretor' | 'imobiliaria'
    logoUrl: string
  } | null>(null)

  // Carregar preferências salvas do banco ao abrir
  useEffect(() => {
    if (!aberto || !usuarioId) return

    const sb = createClient()
    async function carregarDoBanco() {
      try {
        const { data } = await sb
          .from('perfis')
          .select('prefixo_codigo, tipo_codigo_imovel, foto_url, tipo, creci, regra_distribuicao_leads, whatsapp_destino')
          .eq('id', usuarioId)
          .maybeSingle()

        let tipoFinal = (data?.tipo && ['proprietario', 'corretor', 'imobiliaria'].includes(data.tipo))
          ? (data.tipo as any)
          : (tipoAnuncianteAtual || (isImobiliaria ? 'imobiliaria' : isCorretor ? 'corretor' : 'proprietario'))
        let creciFinal = data?.creci || creciAtual || ''
        let prefixoFinal = data?.prefixo_codigo || prefixoPadrao
        let modoFinal = (data?.tipo_codigo_imovel as any) || 'automatico'
        const regraFinal = (data?.regra_distribuicao_leads as any) || 'captador'
        const zapFinal = (data?.whatsapp_destino as any) || 'corretor'
        const logoFinal = data?.foto_url || ''

        // Se for corretor vinculado, herdar o prefixo e modo de código da imobiliária
        if (imobiliariaDona?.id && !isImobiliaria) {
          const { data: imobData } = await sb
            .from('perfis')
            .select('prefixo_codigo, tipo_codigo_imovel')
            .eq('id', imobiliariaDona.id)
            .maybeSingle()

          if (imobData) {
            if (imobData.prefixo_codigo) prefixoFinal = imobData.prefixo_codigo
            if (imobData.tipo_codigo_imovel) modoFinal = imobData.tipo_codigo_imovel as any
          }
        }

        setTipoAnunciante(tipoFinal)
        setCreci(creciFinal)
        setPrefixo(prefixoFinal)
        setModoCodigo(modoFinal)
        setRegraDistribuicao(regraFinal)
        setWhatsappDestino(zapFinal)
        setLogoUrl(logoFinal)

        // Snapshot original
        setSnapshotOriginal({
          tipoAnunciante: tipoFinal,
          creci: creciFinal,
          prefixo: prefixoFinal,
          modoCodigo: modoFinal,
          regraDistribuicao: regraFinal,
          whatsappDestino: zapFinal,
          logoUrl: logoFinal,
        })
      } catch {}
    }
    carregarDoBanco()
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
        regraDistribuicao !== snapshotOriginal.regraDistribuicao ||
        whatsappDestino !== snapshotOriginal.whatsappDestino ||
        logoUrl !== snapshotOriginal.logoUrl

      if (houveAlteracao) {
        const confirmou = await confirmar({
          titulo: 'Descartar Alterações?',
          mensagem: 'Você fez alterações nas configurações que ainda não foram salvas. Deseja realmente sair e descartar as mudanças?',
          icone: '⚠️',
          textoBotaoConfirmar: 'Sim, Descartar',
          tipo: 'aviso',
        })

        if (!confirmou) return
      }

      setTipoAnunciante(snapshotOriginal.tipoAnunciante)
      setCreci(snapshotOriginal.creci)
      setPrefixo(snapshotOriginal.prefixo)
      setModoCodigo(snapshotOriginal.modoCodigo)
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

  async function handleSelecionarLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingLogo(true)
    try {
      const blobOtimizado = await processarImagemLogo(file)
      const nomeArquivo = `logo_${usuarioId}_${Date.now()}.webp`
      const caminho = `logos/${nomeArquivo}`

      const sb = createClient()

      const { error: errUpload } = await sb.storage
        .from('fotos-imoveis')
        .upload(caminho, blobOtimizado, {
          contentType: 'image/webp',
          upsert: true,
        })

      if (errUpload) throw errUpload

      const { data: { publicUrl } } = sb.storage
        .from('fotos-imoveis')
        .getPublicUrl(caminho)

      setLogoUrl(publicUrl)
    } catch (err) {
      console.error('Erro ao fazer upload da logo:', err)
    } finally {
      setUploadingLogo(false)
    }
  }

  function handleRemoverLogo() {
    setLogoUrl('')
  }

  async function handleSalvar() {
    setSalvando(true)
    const prefixoLimpo = (prefixo.trim() || prefixoPadrao).toUpperCase().replace(/[^A-Z0-9]/g, '')
    const configs = { prefixo: prefixoLimpo, modoCodigo, tipoAnunciante, creci: creci.trim() }

    const ehCorretorVinculado = !!(imobiliariaDona && !isImobiliaria)

    if (typeof window !== 'undefined' && !ehCorretorVinculado) {
      localStorage.setItem(`config_imoveis_${usuarioId}`, JSON.stringify(configs))
    }

    try {
      const sb = createClient()
      const dadosUpdate: any = {
        tipo: tipoAnunciante,
        creci: tipoAnunciante === 'corretor' ? creci.trim() : null,
        foto_url: logoUrl || null,
        regra_distribuicao_leads: tipoAnunciante === 'imobiliaria' ? regraDistribuicao : 'captador',
        whatsapp_destino: tipoAnunciante === 'imobiliaria' ? whatsappDestino : 'corretor',
      }

      // Apenas imobiliárias e corretores independentes configuram prefixo e modo de código próprios
      if (!ehCorretorVinculado) {
        dadosUpdate.prefixo_codigo = prefixoLimpo
        dadosUpdate.tipo_codigo_imovel = modoCodigo
      }

      await sb
        .from('perfis')
        .update(dadosUpdate)
        .eq('id', usuarioId)
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
                <span className={styles.tituloAba}>Marca & Códigos</span>
                <span className={styles.descAba}>Logotipo e prefixo</span>
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

            {/* ── ABA 2: MARCA & CÓDIGOS ── */}
            {abaAtiva === 'marca' && (
              <div>
                <div className={styles.secaoTituloArea}>
                  <span className={styles.secaoTitulo}>Identidade Visual & Padronização</span>
                  <span className={styles.secaoSubtitulo}>Sua foto ou logotipo e padrão de referência dos imóveis</span>
                </div>

                {/* Logotipo */}
                <div className={styles.linhaLogo}>
                  <div className={styles.logoInfoArea}>
                    <div className={styles.logoPreviewWrapper}>
                      {logoUrl ? (
                        <img src={logoUrl} alt="Logotipo" className={styles.logoImgPreview} />
                      ) : (
                        <div className={styles.logoPlaceholder}>
                          {prefixo || prefixoPadrao}
                        </div>
                      )}
                    </div>
                    <div className={styles.logoTextos}>
                      <span className={styles.logoTitulo}>
                        {ehImobiliaria ? 'Logotipo da Imobiliária' : 'Foto de Perfil / Marca'}
                      </span>
                      <span className={styles.logoSubtitulo}>
                        Exibido nos cards da busca e no mapa
                      </span>
                    </div>
                  </div>

                  <div className={styles.logoBotoes}>
                    <label className={styles.btnUploadLogo}>
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
                        className={styles.btnRemoverLogo}
                        onClick={handleRemoverLogo}
                        title="Remover logotipo"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>

                {/* Regra de Padronização de Códigos */}
                {imobiliariaDona && !isImobiliaria ? (
                  <div className={styles.avisoVinculoEquipe} style={{ marginTop: '1.25rem' }}>
                    <span>🏢 <strong>Padronização da Imobiliária:</strong> O prefixo e a regra de códigos dos anúncios são definidos centralmente pela gestão da <strong>{imobiliariaDona.nome}</strong>. Seus anúncios seguirão o padrão oficial da empresa ({modoCodigo === 'proprio' ? 'Código Interno/CRM' : `Código Sequencial: ${prefixo || prefixoPadrao}-0001`}).</span>
                  </div>
                ) : (
                  <>
                    {/* Iniciais / Prefixo */}
                    <div className={styles.linhaPrefixo}>
                      <div className={styles.prefixoEsquerda}>
                        <label className={styles.labelCampo} style={{ marginBottom: '4px' }}>
                          <span>Iniciais / Prefixo</span>
                        </label>
                        <input
                          type="text"
                          className={styles.inputPrefixo}
                          maxLength={6}
                          value={prefixo}
                          onChange={(e) => setPrefixo(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                          placeholder={prefixoPadrao}
                        />
                      </div>
                      <div className={styles.dicaPrefixoBox}>
                        💡 Exemplo de código: <strong>{prefixo || prefixoPadrao}-0001</strong>
                      </div>
                    </div>

                    {/* Modo de Código */}
                    <div>
                      <label className={styles.labelCampo} style={{ marginBottom: '6px' }}>
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
                            Habilita campo para você digitar seus códigos internos.
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
