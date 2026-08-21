'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import styles from './ModalConfiguracoes.module.css'

interface ModalConfiguracoesProps {
  aberto: boolean
  onFechar: () => void
  usuarioId: string
  usuarioNome: string
  isImobiliaria: boolean
  isCorretor: boolean
  imobiliariaDona: { id: string; nome: string } | null
  onConfiguracoesSalvas?: (configs: { prefixo: string; modoCodigo: 'automatico' | 'proprio' }) => void
}

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
        const PADDING = 40 // Margem de segurança de 10% para nunca encostar ou cortar na borda do círculo

        const canvas = document.createElement('canvas')
        canvas.width = CANVAS_SIZE
        canvas.height = CANVAS_SIZE
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('Falha ao processar canvas'))
          return
        }

        // Fundo limpo
        ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)

        // Área útil calculada com respiro
        const maxDrawWidth = CANVAS_SIZE - PADDING * 2
        const maxDrawHeight = CANVAS_SIZE - PADDING * 2

        const scale = Math.min(maxDrawWidth / img.width, maxDrawHeight / img.height, 1)
        const drawWidth = img.width * scale
        const drawHeight = img.height * scale

        // Centralização milimétrica
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
  isImobiliaria,
  isCorretor,
  imobiliariaDona,
  onConfiguracoesSalvas,
}: ModalConfiguracoesProps) {
  const nomeBase = imobiliariaDona?.nome || usuarioNome || ''
  const prefixoPadrao = gerarPrefixoSugerido(nomeBase)

  const [prefixo, setPrefixo] = useState<string>(prefixoPadrao)
  const [modoCodigo, setModoCodigo] = useState<'automatico' | 'proprio'>('automatico')
  const [logoUrl, setLogoUrl] = useState<string>('')
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [mensagemSucesso, setMensagemSucesso] = useState(false)

  // Carregar preferências salvas
  useEffect(() => {
    if (!aberto || !usuarioId) return

    // 1. Tentar ler do localStorage primeiro (resposta instantânea)
    const keyStorage = `config_imoveis_${usuarioId}`
    if (typeof window !== 'undefined') {
      const salvo = localStorage.getItem(keyStorage)
      if (salvo) {
        try {
          const parsed = JSON.parse(salvo)
          if (parsed.prefixo) setPrefixo(parsed.prefixo)
          if (parsed.modoCodigo) setModoCodigo(parsed.modoCodigo)
        } catch {}
      }
    }

    // 2. Buscar do Supabase perfil
    const sb = createClient()
    async function carregarDoBanco() {
      try {
        const { data } = await sb
          .from('perfis')
          .select('prefixo_codigo, tipo_codigo_imovel, foto_url')
          .eq('id', usuarioId)
          .maybeSingle()

        if (data) {
          if (data.prefixo_codigo) setPrefixo(data.prefixo_codigo)
          if (data.tipo_codigo_imovel) setModoCodigo(data.tipo_codigo_imovel as any)
          if (data.foto_url) setLogoUrl(data.foto_url)
        }
      } catch {}
    }
    carregarDoBanco()
  }, [aberto, usuarioId])

  // Fechar com ESC
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && aberto) {
        onFechar()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [aberto, onFechar])

  if (!aberto) return null

  async function handleSelecionarLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingLogo(true)
    try {
      // 1. Tratamento e compressão da imagem
      const blobOtimizado = await processarImagemLogo(file)
      const nomeArquivo = `logo_${usuarioId}_${Date.now()}.webp`
      const caminho = `logos/${nomeArquivo}`

      const sb = createClient()

      // 2. Upload para o bucket fotos-imoveis
      const { error: errUpload } = await sb.storage
        .from('fotos-imoveis')
        .upload(caminho, blobOtimizado, {
          contentType: 'image/webp',
          upsert: true,
        })

      if (errUpload) throw errUpload

      // 3. Obter URL pública
      const { data: { publicUrl } } = sb.storage
        .from('fotos-imoveis')
        .getPublicUrl(caminho)

      setLogoUrl(publicUrl)

      // 4. Gravar imediatamente no perfil e propagar para corretores da equipe
      await sb
        .from('perfis')
        .update({ foto_url: publicUrl })
        .eq('id', usuarioId)

      if (isImobiliaria) {
        fetch('/api/corretores', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            acao: 'sincronizar_logo',
            imobiliaria_id: usuarioId,
            foto_url: publicUrl,
          }),
        }).catch(() => {})
      }
    } catch (err) {
      console.error('Erro ao fazer upload da logo:', err)
    } finally {
      setUploadingLogo(false)
    }
  }

  async function handleRemoverLogo() {
    setLogoUrl('')
    try {
      const sb = createClient()
      await sb.from('perfis').update({ foto_url: null }).eq('id', usuarioId)

      if (isImobiliaria) {
        fetch('/api/corretores', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            acao: 'sincronizar_logo',
            imobiliaria_id: usuarioId,
            foto_url: null,
          }),
        }).catch(() => {})
      }
    } catch {}
  }

  async function handleSalvar() {
    setSalvando(true)
    const prefixoLimpo = (prefixo.trim() || prefixoPadrao).toUpperCase().replace(/[^A-Z0-9]/g, '')
    const configs = { prefixo: prefixoLimpo, modoCodigo }

    // 1. Gravar no localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem(`config_imoveis_${usuarioId}`, JSON.stringify(configs))
    }

    // 2. Tentar persistir no banco Supabase
    try {
      const sb = createClient()
      await sb
        .from('perfis')
        .update({
          prefixo_codigo: prefixoLimpo,
          tipo_codigo_imovel: modoCodigo,
          foto_url: logoUrl || null,
        })
        .eq('id', usuarioId)
    } catch {}

    if (onConfiguracoesSalvas) {
      onConfiguracoesSalvas(configs)
    }

    setSalvando(false)
    setMensagemSucesso(true)
    setTimeout(() => {
      setMensagemSucesso(false)
      onFechar()
    }, 700)
  }

  return (
    <div className={styles.backdrop} onClick={onFechar}>
      <div className={styles.modalBox} onClick={(e) => e.stopPropagation()}>
        {/* Cabeçalho Compacto */}
        <div className={styles.headerModal}>
          <div className={styles.tituloArea}>
            <div className={styles.iconeTopo}>⚙️</div>
            <div>
              <h2 className={styles.titulo}>Configurações da Conta</h2>
              <p className={styles.subtitulo}>
                Personalize preferências de código de anúncios e operação do workspace
              </p>
            </div>
          </div>
          <button type="button" className={styles.btnFechar} onClick={onFechar} title="Fechar (ESC)">
            ✕
          </button>
        </div>

        {/* Corpo com Configurações */}
        <div className={styles.corpoModal}>
          {(isImobiliaria || isCorretor) && (
            <div className={styles.secaoConfig}>
              {/* Linha 0: Identidade Visual / Logotipo da Imobiliária */}
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
                      {isImobiliaria ? 'Logotipo da Imobiliária' : 'Foto de Perfil / Marca'}
                    </span>
                    <span className={styles.logoSubtitulo}>
                      Exibido nos cards da busca, nos pins do mapa e na página do imóvel
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
                    {uploadingLogo ? 'Processando...' : logoUrl ? '📁 Trocar' : '📷 Enviar Logo'}
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

              {/* Linha 1: Iniciais / Prefixo + Dica integrada */}
              <div className={styles.linhaPrefixo}>
                <div className={styles.prefixoEsquerda}>
                  <label className={styles.labelCampo}>
                    <span>{isImobiliaria ? 'Iniciais da Imobiliária' : 'Iniciais do Corretor'}</span>
                    <span style={{ color: '#ef4444' }}>*</span>
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
                  💡 Códigos gerados: <strong>{prefixo || prefixoPadrao}-0001</strong>, <strong>{prefixo || prefixoPadrao}-0002</strong>...
                </div>
              </div>

              {/* Linha 2: Seletor de Modo de Código */}
              <div className={styles.seletorModosArea}>
                <label className={styles.labelCampo}>
                  <span>Modo de Criação do Código</span>
                </label>
                <div className={styles.gridModos}>
                  {/* Opção 1: Automático */}
                  <div
                    className={`${styles.cardModo} ${modoCodigo === 'automatico' ? styles.cardModoSelecionado : ''}`}
                    onClick={() => setModoCodigo('automatico')}
                  >
                    <div className={styles.cardModoTopo}>
                      <span className={styles.cardModoTitulo}>⚡ Automático Fixum</span>
                      <span className={styles.badgeRecomendado}>Recomendado</span>
                    </div>
                    <p className={styles.cardModoTexto}>
                      Gera códigos sequenciais padronizados a cada anúncio publicado.
                    </p>
                    <div className={styles.cardModoExemplo}>
                      Ex: {prefixo || prefixoPadrao}-0001
                    </div>
                  </div>

                  {/* Opção 2: Próprio / CRM */}
                  <div
                    className={`${styles.cardModo} ${modoCodigo === 'proprio' ? styles.cardModoSelecionado : ''}`}
                    onClick={() => setModoCodigo('proprio')}
                  >
                    <div className={styles.cardModoTopo}>
                      <span className={styles.cardModoTitulo}>🏷️ Próprio / CRM</span>
                    </div>
                    <p className={styles.cardModoTexto}>
                      Habilita o campo nos formulários para você inserir seus códigos internos.
                    </p>
                    <div className={styles.cardModoExemplo}>
                      Ex: AP-104, {prefixo || prefixoPadrao}-840
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Rodapé com Ações */}
        <div className={styles.rodapeModal}>
          <button type="button" className={styles.btnCancelar} onClick={onFechar} disabled={salvando}>
            Cancelar
          </button>
          <button type="button" className={styles.btnSalvar} onClick={handleSalvar} disabled={salvando}>
            {salvando ? 'Salvando...' : mensagemSucesso ? '✓ Salvo!' : 'Salvar Preferências'}
          </button>
        </div>
      </div>
    </div>
  )
}
