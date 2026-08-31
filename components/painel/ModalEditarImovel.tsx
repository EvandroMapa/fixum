'use client'

import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useConfirm } from '@/contexts/ModalConfirmacaoContext'
import LinhaTempoRevisao from '@/components/painel/LinhaTempoRevisao'
import styles from './ModalNovoImovel.module.css'

type Etapa = 1 | 2 | 3 | 4 | 5

interface DadosImovel {
  tipo: string
  negociacao: string
  titulo: string
  descricao: string
  preco: string
  modo_exibicao_preco?: 'visivel' | 'sob_consulta'
  area: string
  quartos: string
  banheiros: string
  vagas: string
  endereco: string
  numero: string
  complemento: string
  bairro: string
  cidade: string
  estado: string
  cep: string
  latitude: string
  longitude: string
  condominio: string
  iptu: string
  aceita_pets: boolean
  mobiliado: boolean
  codigo?: string
}

interface FotoPreview {
  arquivo?: File
  preview: string
  principal: boolean
  url?: string
  id?: string
}

const ETAPAS = [
  { numero: 1, label: 'Tipo' },
  { numero: 2, label: 'Dados' },
  { numero: 3, label: 'Detalhes' },
  { numero: 4, label: 'Fotos' },
  { numero: 5, label: 'Revisão' },
]

const TIPOS = [
  // Residencial
  { valor: 'apartamento', icone: '🏢', label: 'Apartamento' },
  { valor: 'casa', icone: '🏠', label: 'Casa' },
  { valor: 'sobrado', icone: '🏡', label: 'Sobrado' },
  { valor: 'casa_condominio', icone: '🏘️', label: 'Casa em Condomínio' },
  { valor: 'cobertura', icone: '🌇', label: 'Cobertura' },
  { valor: 'kitnet', icone: '🛏️', label: 'Kitnet / Studio' },
  { valor: 'flat', icone: '🏨', label: 'Flat' },
  { valor: 'lote', icone: '📐', label: 'Lote' },
  // Comercial
  { valor: 'sala_comercial', icone: '🗂️', label: 'Sala Comercial' },
  { valor: 'loja', icone: '🏪', label: 'Loja / Ponto Comercial' },
  { valor: 'galpao', icone: '🏭', label: 'Galpão' },
  { valor: 'predio', icone: '🏬', label: 'Prédio Comercial' },
  { valor: 'garagem', icone: '🚗', label: 'Garagem' },
  { valor: 'terreno_comercial', icone: '🏗️', label: 'Terreno / Lote' },
  // Rural
  { valor: 'sitio', icone: '🌿', label: 'Sítio' },
  { valor: 'chacara', icone: '🌳', label: 'Chácara' },
  { valor: 'fazenda', icone: '🌾', label: 'Fazenda' },
  { valor: 'rancho', icone: '🐄', label: 'Rancho' },
  // Geral
  { valor: 'outro', icone: '🏷️', label: 'Outro' },
]

function normalizarTipoParaBanco(tipo: string): string {
  const map: Record<string, string> = {
    apartamento: 'apartamento',
    casa: 'casa',
    sobrado: 'casa',
    casa_condominio: 'casa',
    cobertura: 'cobertura',
    kitnet: 'apartamento',
    flat: 'apartamento',
    lote: 'terreno',
    terreno: 'terreno',
    terreno_comercial: 'terreno',
    sala_comercial: 'comercial',
    loja: 'comercial',
    galpao: 'comercial',
    predio: 'comercial',
    garagem: 'comercial',
    sitio: 'rural',
    chacara: 'rural',
    fazenda: 'rural',
    rancho: 'rural',
  }
  return map[tipo] || 'apartamento'
}

interface ModalEditarImovelProps {
  isOpen: boolean
  imovelId: string | null
  onClose: () => void
  onImovelSalvo: () => Promise<void> | void
}

export default function ModalEditarImovel({
  isOpen,
  imovelId,
  onClose,
  onImovelSalvo,
}: ModalEditarImovelProps) {
  const supabase = createClient()
  const { confirmar, alertar } = useConfirm()

  const [etapa, setEtapa] = useState<Etapa>(1)
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [reenviando, setReenviando] = useState(false)
  const [erro, setErro] = useState('')
  const [imovelCompleto, setImovelCompleto] = useState<any>(null)
  const [usuarioLogado, setUsuarioLogado] = useState<any>(null)
  const [isCorretor, setIsCorretor] = useState(false)
  const [modoExibicaoPrecoConta, setModoExibicaoPrecoConta] = useState<'visivel' | 'sob_consulta' | 'por_anuncio'>('visivel')
  const [recadoReenvio, setRecadoReenvio] = useState('')
  const [fotos, setFotos] = useState<FotoPreview[]>([])
  const [fotosRemovidas, setFotosRemovidas] = useState<string[]>([])
  const [buscandoCep, setBuscandoCep] = useState(false)
  const [erroCep, setErroCep] = useState('')
  const [sucessoCep, setSucessoCep] = useState('')
  const [arrastando, setArrastando] = useState(false)
  const inputFotoRef = useRef<HTMLInputElement>(null)
  const dadosOriginaisRef = useRef<string>('')

  const [dados, setDados] = useState<DadosImovel>({
    tipo: 'apartamento',
    negociacao: 'venda',
    titulo: '',
    descricao: '',
    preco: '',
    modo_exibicao_preco: 'visivel',
    area: '',
    quartos: '',
    banheiros: '',
    vagas: '',
    endereco: '',
    bairro: '',
    numero: '',
    complemento: '',
    cidade: '',
    estado: '',
    cep: '',
    latitude: '',
    longitude: '',
    condominio: '',
    iptu: '',
    aceita_pets: false,
    mobiliado: false,
  })

  useEffect(() => {
    if (!isOpen || !imovelId) return

    let ativo = true

    async function carregarImovel() {
      try {
        setCarregando(true)
        setErro('')
        setEtapa(1)
        setRecadoReenvio('')

        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (!ativo) return

        let imobIdConta: string | null = null
        if (user) {
          setUsuarioLogado(user)
          const meta = user.user_metadata || {}
          imobIdConta = meta.imobiliaria_id || null
          setIsCorretor(meta.tipo === 'corretor' || !!imobIdConta)

          // Buscar modo de exibição de preço da conta/imobiliária
          try {
            const resConfig = await fetch(`/api/painel/configuracoes?usuario_id=${imobIdConta || user.id}`)
            if (resConfig.ok) {
              const dataConfig = await resConfig.json()
              if (dataConfig.configs?.modo_exibicao_preco) {
                setModoExibicaoPrecoConta(dataConfig.configs.modo_exibicao_preco)
              }
            }
          } catch {}
        }

        const { data: imovel, error } = await supabase
          .from('imoveis')
          .select('*, fotos_imovel(id, url, principal, ordem)')
          .eq('id', imovelId)
          .maybeSingle()

        if (!ativo) return

        if (error || !imovel) {
          const { data: imovelSimples } = await supabase
            .from('imoveis')
            .select('*')
            .eq('id', imovelId)
            .maybeSingle()

          if (!imovelSimples) {
            setErro('Imóvel não encontrado.')
            setCarregando(false)
            return
          }

          const { data: fotosData } = await supabase
            .from('fotos_imovel')
            .select('id, url, principal, ordem')
            .eq('imovel_id', imovelId)
            .order('ordem', { ascending: true })

          imovelSimples.fotos_imovel = fotosData || []
          setImovelCompleto(imovelSimples)
          preencherDados(imovelSimples)
          return
        }

        setImovelCompleto(imovel)
        preencherDados(imovel)
      } catch (err: any) {
        if (ativo) setErro('Erro ao carregar dados do imóvel.')
      } finally {
        if (ativo) setCarregando(false)
      }
    }

    function preencherDados(imovel: any) {
      const dadosCarregados: DadosImovel = {
        tipo: imovel.tipo || 'apartamento',
        negociacao: imovel.negociacao || 'venda',
        titulo: imovel.titulo || '',
        descricao: imovel.descricao || '',
        preco: imovel.preco ? String(imovel.preco) : '',
        modo_exibicao_preco: imovel.modo_exibicao_preco || 'visivel',
        area: imovel.area ? String(imovel.area) : '',
        quartos: imovel.quartos ? String(imovel.quartos) : '',
        banheiros: imovel.banheiros ? String(imovel.banheiros) : '',
        vagas: imovel.vagas ? String(imovel.vagas) : '',
        endereco: imovel.endereco || '',
        bairro: imovel.bairro || '',
        numero: imovel.numero || '',
        complemento: imovel.complemento || '',
        cidade: imovel.cidade || '',
        estado: imovel.estado || '',
        cep: imovel.cep || '',
        latitude: imovel.latitude ? String(imovel.latitude) : '',
        longitude: imovel.longitude ? String(imovel.longitude) : '',
        condominio: imovel.condominio ? String(imovel.condominio) : '',
        iptu: imovel.iptu ? String(imovel.iptu) : '',
        aceita_pets: imovel.aceita_pets || false,
        mobiliado: imovel.mobiliado || false,
        codigo: imovel.codigo || '',
      }

      setDados(dadosCarregados)

      const fotosExistentes: FotoPreview[] = (imovel.fotos_imovel || [])
        .sort((a: { ordem: number }, b: { ordem: number }) => a.ordem - b.ordem)
        .map((f: { id: string; url: string; principal: boolean }) => ({
          preview: f.url,
          principal: f.principal,
          url: f.url,
          id: f.id,
        }))

      setFotos(fotosExistentes)
      setFotosRemovidas([])
      dadosOriginaisRef.current = JSON.stringify({
        dados: dadosCarregados,
        fotosIds: fotosExistentes.map((f) => `${f.id}_${f.principal}`),
      })
    }

    carregarImovel()

    return () => {
      ativo = false
    }
  }, [isOpen, imovelId, supabase])

  function verificarSeTemAlteracoesEdicao(): boolean {
    if (!dadosOriginaisRef.current) return false
    if (fotosRemovidas.length > 0) return true
    if (fotos.some((f) => !!f.arquivo)) return true

    const atual = JSON.stringify({
      dados,
      fotosIds: fotos.map((f) => `${f.id || f.preview}_${f.principal}`),
    })
    return atual !== dadosOriginaisRef.current
  }

  async function handleTentarFechar() {
    if (salvando || reenviando) return

    if (verificarSeTemAlteracoesEdicao()) {
      const confirmou = await confirmar({
        titulo: 'Descartar alterações?',
        mensagem: 'Você fez modificações neste imóvel que ainda não foram salvas. Tem certeza que deseja sair e perder as alterações?',
        icone: '⚠️',
        tipo: 'perigo',
        textoBotaoConfirmar: 'Sim, Descartar',
        textoBotaoCancelar: 'Continuar Editando',
      })

      if (!confirmou) return
    }

    setEtapa(1)
    setErro('')
    setFotosRemovidas([])
    onClose()
  }

  // Interceptar tecla Escape (ESC) para confirmar saída
  useEffect(() => {
    if (!isOpen) return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        handleTentarFechar()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, dados, fotos, fotosRemovidas, salvando, reenviando])

  if (!isOpen || !imovelId) return null

  function atualizar(campo: keyof DadosImovel, valor: string | boolean) {
    setDados((prev) => ({ ...prev, [campo]: valor }))
  }

  function formatarPreco(valor: string) {
    const num = valor.replace(/\D/g, '')
    if (!num) return ''
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
    }).format(parseInt(num))
  }

  async function buscarCep(cepLimpo: string) {
    const cep = cepLimpo.replace(/\D/g, '')
    if (cep.length !== 8) return

    setBuscandoCep(true)
    setErroCep('')
    setSucessoCep('')

    try {
      const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`)
      const data = await res.json()

      if (data.erro) {
        setErroCep('CEP não encontrado nos Correios. Preencha Cidade, Estado e Endereço manualmente.')
        setSucessoCep('')
        // Zera os campos preenchidos pelo CEP anterior para evitar dados inconsistentes
        setDados((prev) => ({
          ...prev,
          endereco: '',
          bairro: '',
          cidade: '',
          estado: '',
          latitude: '',
          longitude: '',
        }))
        return
      }

      setErroCep('')
      setSucessoCep(`Localizado: ${data.localidade}/${data.uf}`)

      let latEncontrada = ''
      let lngEncontrada = ''
      const query = encodeURIComponent(`${data.logradouro ? data.logradouro + ', ' : ''}${data.bairro || ''}, ${data.localidade}, ${data.uf}, Brasil`)
      const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
      if (token) {
        try {
          const geo = await fetch(
            `https://api.mapbox.com/geocoding/v5/mapbox.places/${query}.json?access_token=${token}&language=pt&limit=1&country=BR`
          )
          const geoData = await geo.json()
          if (geoData.features?.length > 0) {
            const [lng, lat] = geoData.features[0].center
            latEncontrada = String(lat)
            lngEncontrada = String(lng)
          }
        } catch {}
      }

      setDados((prev) => ({
        ...prev,
        endereco: data.logradouro || '',
        bairro: data.bairro || '',
        cidade: data.localidade || '',
        estado: data.uf || '',
        latitude: latEncontrada,
        longitude: lngEncontrada,
      }))
    } catch {
      setErroCep('Não foi possível consultar o CEP. Preencha os campos abaixo manualmente.')
    } finally {
      setBuscandoCep(false)
    }
  }

  function adicionarFotos(arquivos: FileList | null) {
    if (!arquivos) return
    const novasFotos: FotoPreview[] = []
    const limiteFotos = 20

    for (let i = 0; i < arquivos.length; i++) {
      if (fotos.length + novasFotos.length >= limiteFotos) break
      const file = arquivos[i]
      if (file.type.startsWith('image/')) {
        novasFotos.push({
          arquivo: file,
          preview: URL.createObjectURL(file),
          principal: fotos.length === 0 && novasFotos.length === 0,
        })
      }
    }

    setFotos((prev) => [...prev, ...novasFotos])
  }

  function removerFoto(index: number) {
    const foto = fotos[index]
    if (foto.id) {
      setFotosRemovidas((prev) => [...prev, foto.id!])
    }
    setFotos((prev) => {
      const nova = prev.filter((_, i) => i !== index)
      if (prev[index]?.principal && nova.length > 0) {
        nova[0].principal = true
      }
      return nova
    })
  }

  function definirPrincipal(index: number) {
    setFotos((prev) =>
      prev.map((f, i) => ({ ...f, principal: i === index }))
    )
  }

  function podeAvancar(): boolean {
    if (etapa === 1) return !!dados.tipo && !!dados.negociacao
    if (etapa === 2) return !!dados.titulo.trim() && !!dados.preco && !!dados.cidade.trim()
    if (etapa === 3) return !!dados.area
    if (etapa === 4) return true
    return true
  }

  function avancar() {
    if (etapa < 5 && podeAvancar()) setEtapa((prev) => (prev + 1) as Etapa)
  }

  function voltar() {
    if (etapa > 1) setEtapa((prev) => (prev - 1) as Etapa)
  }

  async function salvarEdicao() {
    setSalvando(true)
    setErro('')

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error('Não autenticado')

      const precoNum = parseFloat(dados.preco.replace(/\D/g, '')) || 0
      const areaNum = parseFloat(dados.area.replace(',', '.')) || null
      const condNum = parseFloat(dados.condominio.replace(/\D/g, '')) || null
      const iptuNum = parseFloat(dados.iptu.replace(/\D/g, '')) || null

      let latNum = parseFloat(dados.latitude) || null
      let lngNum = parseFloat(dados.longitude) || null

      if (!latNum || !lngNum || (latNum === 0 && lngNum === 0)) {
        try {
          const termo = [dados.endereco, dados.bairro, dados.cidade, dados.estado, 'Brasil'].filter(Boolean).join(', ')
          const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
          if (token && termo.trim() !== 'Brasil') {
            const res = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(termo)}.json?access_token=${token}&country=BR&limit=1`)
            const json = await res.json()
            if (json.features?.length > 0) {
              const [lng, lat] = json.features[0].center
              latNum = lat
              lngNum = lng
            }
          }
        } catch {}
      }

      if (!latNum || !lngNum || (latNum === 0 && lngNum === 0)) {
        await alertar({
          titulo: 'Localização Obrigatória no Mapa',
          mensagem: 'Não foi possível identificar a localização deste imóvel no mapa. Por favor, verifique se o CEP ou o nome da Cidade e Estado estão preenchidos corretamente.',
          icone: '📍',
          tipo: 'aviso',
        })
        setSalvando(false)
        return false
      }

      const payloadUpdate: Record<string, any> = {
        tipo: normalizarTipoParaBanco(dados.tipo),
        negociacao: dados.negociacao,
        titulo: dados.titulo,
        codigo: dados.codigo?.trim().toUpperCase() || null,
        descricao: dados.descricao || null,
        preco: precoNum,
        modo_exibicao_preco: dados.modo_exibicao_preco || 'visivel',
        area: areaNum,
        quartos: parseInt(dados.quartos) || null,
        banheiros: parseInt(dados.banheiros) || null,
        vagas: parseInt(dados.vagas) || null,
        endereco: dados.endereco || '',
        bairro: dados.bairro || null,
        cidade: dados.cidade,
        estado: dados.estado || null,
        cep: dados.cep || null,
        latitude: latNum,
        longitude: lngNum,
        condominio: condNum,
        iptu: iptuNum,
        aceita_pets: !!dados.aceita_pets,
        mobiliado: !!dados.mobiliado,
        status: 'rascunho',
      }

      let { error: erroImovel } = await supabase
        .from('imoveis')
        .update(payloadUpdate)
        .eq('id', imovelId)

      if (erroImovel && (erroImovel.message?.includes('modo_exibicao_preco') || erroImovel.message?.includes('column'))) {
        delete payloadUpdate.modo_exibicao_preco
        const retry = await supabase
          .from('imoveis')
          .update(payloadUpdate)
          .eq('id', imovelId)
        erroImovel = retry.error
      }

      if (erroImovel) throw erroImovel

      // 1. Deletar fotos removidas
      if (fotosRemovidas.length > 0) {
        await supabase.from('fotos_imovel').delete().in('id', fotosRemovidas)
      }

      // 2. Atualizar capa das fotos existentes
      for (const foto of fotos) {
        if (foto.id) {
          await supabase.from('fotos_imovel').update({ principal: foto.principal }).eq('id', foto.id)
        }
      }

      // 3. Upload das novas fotos
      const fotosNovas = fotos.filter((f) => f.arquivo)
      for (let i = 0; i < fotosNovas.length; i++) {
        const foto = fotosNovas[i]
        const ext = foto.arquivo!.name.split('.').pop() || 'jpg'
        const caminho = `${user.id}/${imovelId}/${Date.now()}-${i}.${ext}`
        const { error: erroUpload } = await supabase.storage
          .from('fotos-imoveis')
          .upload(caminho, foto.arquivo!, { upsert: true })

        if (!erroUpload) {
          const { data: urlData } = supabase.storage.from('fotos-imoveis').getPublicUrl(caminho)
          await supabase.from('fotos_imovel').insert({
            imovel_id: imovelId,
            url: urlData.publicUrl,
            principal: foto.principal,
            ordem: fotos.indexOf(foto),
          })
        }
      }

      return true
    } catch (e: any) {
      setErro(e.message || 'Erro ao salvar alterações.')
      return false
    } finally {
      setSalvando(false)
    }
  }

  async function handleSalvarSimples() {
    const salvou = await salvarEdicao()
    if (salvou) {
      await alertar({
        titulo: 'Alterações Salvas!',
        mensagem: 'O anúncio foi atualizado com sucesso.',
        icone: '💾',
        tipo: 'sucesso',
      })
      await onImovelSalvo()
      onClose()
    }
  }

  async function handleSalvarEReenviar() {
    setReenviando(true)
    try {
      const salvou = await salvarEdicao()
      if (!salvou) return

      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error('Não autenticado')

      const imobiliariaId = user.user_metadata?.imobiliaria_id || imovelCompleto?.anunciante_id

      // Grava evento de resposta no histórico de moderação e notifica gestor
      await fetch('/api/painel/imoveis/revisar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imovelId,
          autorId: user.id,
          autorNome: user.user_metadata?.nome || user.email,
          autorPapel: 'corretor',
          tipoEvento: 'resposta_corretor',
          mensagem: recadoReenvio.trim() || 'Ajustes concluídos pelo corretor.',
          imobiliariaId,
          corretorId: user.id,
          imovelTitulo: dados.titulo,
        }),
      })

      await alertar({
        titulo: 'Reenviado com Sucesso!',
        mensagem: 'O anúncio com seus ajustes foi reenviado para a moderação do gestor.',
        icone: '📤',
        tipo: 'sucesso',
      })
      await onImovelSalvo()
      onClose()
    } catch (e: any) {
      setErro(e.message || 'Erro ao reenviar para revisão.')
    } finally {
      setReenviando(false)
    }
  }

  const temAjustesPendentes = !!imovelCompleto?.descricao_motivo_rejeicao

  return (
    <div className={styles.overlay}>
      <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.modalHeader}>
          <div className={styles.modalHeaderTitulo}>
            <span>✏️</span> Editar Imóvel
          </div>
          <button type="button" className={styles.btnFechar} onClick={handleTentarFechar} title="Fechar">
            ✕
          </button>
        </div>

        {/* Stepper Moderno */}
        <div className={styles.progresso}>
          {ETAPAS.map((etp, idx) => {
            const ativa = etapa === etp.numero
            const concluida = etapa > etp.numero
            return (
              <div key={etp.numero} style={{ display: 'flex', alignItems: 'center' }}>
                <div
                  className={`${styles.etapaItem} ${ativa ? styles.etapaAtiva : ''} ${concluida ? styles.etapaConcluida : ''}`}
                  onClick={() => setEtapa(etp.numero as Etapa)}
                  style={{ cursor: 'pointer' }}
                  title={`Ir para etapa ${etp.numero}: ${etp.label}`}
                >
                  <div className={styles.etapaBolha}>
                    {concluida ? '✓' : etp.numero}
                  </div>
                  <span className={styles.etapaLabel}>{etp.label}</span>
                </div>
                {idx < ETAPAS.length - 1 && (
                  <div className={`${styles.etapaLinha} ${etapa > etp.numero ? styles.etapaLinhaAtiva : ''}`} />
                )}
              </div>
            )
          })}
        </div>

        {carregando ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: '#64748b' }}>
            Carregando dados do anúncio...
          </div>
        ) : (
          <>
            {/* ── BANNER DE MODERAÇÃO E AJUSTES SOLICITADOS PELO GESTOR ── */}
            {temAjustesPendentes && etapa === 1 && (
              <div style={{
                background: '#fffbeb',
                borderBottom: '1px solid #fde68a',
                padding: '10px 18px',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#92400e', fontWeight: 800, fontSize: '0.85rem' }}>
                  <span>⚠️</span>
                  <span>Ajustes Solicitados pela Gestão</span>
                </div>
                <LinhaTempoRevisao
                  imovelId={imovelId}
                  motivoRejeicaoAtual={imovelCompleto?.descricao_motivo_rejeicao}
                />
              </div>
            )}

            {/* Etapa 1: Tipo */}
            {etapa === 1 && (
              <div className={styles.etapaConteudo}>
                <h2 className={styles.etapaTitulo}>Que tipo de imóvel é?</h2>
                <p className={styles.etapaSubtitulo}>Selecione o tipo e a modalidade de negociação</p>

                <div className={styles.gridTipos}>
                  {TIPOS.map((t) => (
                    <button
                      key={t.valor}
                      type="button"
                      className={`${styles.tipoCard} ${dados.tipo === t.valor ? styles.tipoSelecionado : ''}`}
                      onClick={() => atualizar('tipo', t.valor)}
                    >
                      <span className={styles.tipoIcone}>{t.icone}</span>
                      <span className={styles.tipoLabel}>{t.label}</span>
                    </button>
                  ))}
                </div>

                <div className={styles.grupo} style={{ marginTop: '0.4rem' }}>
                  <label className={styles.label}>Modalidade de Negociação</label>
                  <div className={styles.btnGroup}>
                    {['venda', 'aluguel'].map((neg) => (
                      <button
                        key={neg}
                        type="button"
                        className={`${styles.btnOpcao} ${dados.negociacao === neg ? styles.btnOpcaoAtivo : ''}`}
                        onClick={() => atualizar('negociacao', neg)}
                      >
                        {neg.charAt(0).toUpperCase() + neg.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Etapa 2: Dados Básicos */}
            {etapa === 2 && (
              <form
                className={styles.etapaConteudo}
                onSubmit={(e) => e.preventDefault()}
                autoComplete="off"
                role="presentation"
              >
                <h2 className={styles.etapaTitulo}>Dados do Imóvel</h2>
                <p className={styles.etapaSubtitulo}>Preço, título e localização</p>

                <div className={styles.gridTituloPreco}>
                  <div className={styles.grupo}>
                    <label className={styles.label}>Título do anúncio *</label>
                    <input
                      className={styles.input}
                      value={dados.titulo}
                      onChange={(e) => atualizar('titulo', e.target.value)}
                      maxLength={100}
                    />
                  </div>

                  <div className={styles.grupo}>
                    <label className={styles.label}>Preço (R$) *</label>
                    <input
                      className={styles.input}
                      value={formatarPreco(dados.preco)}
                      onChange={(e) => atualizar('preco', e.target.value)}
                    />
                  </div>
                </div>

                {/* Seletor / Aviso de Exibição de Preço */}
                {modoExibicaoPrecoConta === 'por_anuncio' ? (
                  <div className={styles.blocoModoPreco}>
                    <label className={styles.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span>Exibição de Preço no Anúncio</span>
                      <span className={styles.pillOpcional}>Opção por Anúncio</span>
                    </label>
                    <div className={styles.gridBotoesModoPreco}>
                      <button
                        type="button"
                        className={`${styles.btnModoPreco} ${dados.modo_exibicao_preco !== 'sob_consulta' ? styles.btnModoPrecoAtivo : ''}`}
                        onClick={() => atualizar('modo_exibicao_preco', 'visivel')}
                      >
                        <span>💰 Preço Visível</span>
                        <small>Exibe o valor no portal e mapa</small>
                      </button>
                      <button
                        type="button"
                        className={`${styles.btnModoPreco} ${dados.modo_exibicao_preco === 'sob_consulta' ? styles.btnModoPrecoAtivoSobConsulta : ''}`}
                        onClick={() => atualizar('modo_exibicao_preco', 'sob_consulta')}
                      >
                        <span>💬 Sob Consulta</span>
                        <small>Oculta o valor no anúncio</small>
                      </button>
                    </div>
                  </div>
                ) : modoExibicaoPrecoConta === 'sob_consulta' ? (
                  <div className={styles.avisoPoliticaPreco} style={{ background: '#f0f9ff', borderColor: '#bae6fd', color: '#0369a1' }}>
                    <span>💬 <strong>Preço Sob Consulta:</strong> Este anúncio será exibido como sob consulta conforme a política da conta.</span>
                  </div>
                ) : (
                  <div className={styles.avisoPoliticaPreco}>
                    <span>💰 <strong>Preço Sempre Visível:</strong> O valor numérico será exibido no anúncio conforme a política da conta.</span>
                  </div>
                )}

                {/* Campo Código de Referência Interna */}
                {(isCorretor || !!dados.codigo) && (
                  <div className={styles.grupo} style={{ marginBottom: '10px' }}>
                    <label className={styles.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span>Código do Anúncio / Referência Interna</span>
                      <span style={{ fontSize: '0.725rem', color: '#64748b', fontWeight: 'normal' }}>Opcional (CRM)</span>
                    </label>
                    <input
                      className={styles.input}
                      value={dados.codigo || ''}
                      onChange={(e) => atualizar('codigo', e.target.value.toUpperCase())}
                      maxLength={20}
                    />
                  </div>
                )}

                <div className={styles.grid3}>
                  <div className={styles.grupo}>
                    <label className={styles.label}>CEP</label>
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      <input
                        className={styles.input}
                        value={dados.cep}
                        onChange={(e) => {
                          const val = e.target.value
                          atualizar('cep', val)
                          if (val.replace(/\D/g, '').length < 8) {
                            if (erroCep) setErroCep('')
                          } else if (val.replace(/\D/g, '').length === 8) {
                            buscarCep(val)
                          }
                        }}
                        maxLength={9}
                        style={erroCep ? { borderColor: '#f59e0b' } : undefined}
                      />
                      {buscandoCep && <span style={{ alignSelf: 'center', fontSize: '0.75rem', color: '#64748b' }}>...</span>}
                    </div>
                  </div>

                  <div className={styles.grupo}>
                    <label className={styles.label}>Cidade *</label>
                    <input
                      className={styles.input}
                      value={dados.cidade}
                      onChange={(e) => atualizar('cidade', e.target.value)}
                    />
                  </div>

                  <div className={styles.grupo}>
                    <label className={styles.label}>Estado (UF) *</label>
                    <input
                      className={styles.input}
                      value={dados.estado}
                      onChange={(e) => atualizar('estado', e.target.value.toUpperCase())}
                      maxLength={2}
                    />
                  </div>
                </div>

                {/* Feedback de CEP não encontrado */}
                {erroCep && (
                  <div style={{
                    background: '#fffbeb',
                    border: '1px solid #fde68a',
                    color: '#b45309',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    padding: '6px 10px',
                    borderRadius: '6px',
                    marginTop: '-4px',
                    marginBottom: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}>
                    <span>⚠️</span>
                    <span>{erroCep}</span>
                  </div>
                )}

                <div className={styles.gridEnderecoBairro}>
                  <div className={styles.grupo}>
                    <label className={styles.label}>Endereço (Rua, Av)</label>
                    <input
                      className={styles.input}
                      value={dados.endereco}
                      onChange={(e) => atualizar('endereco', e.target.value)}
                    />
                  </div>

                  <div className={styles.grupo}>
                    <label className={styles.label}>Bairro</label>
                    <input
                      className={styles.input}
                      value={dados.bairro}
                      onChange={(e) => atualizar('bairro', e.target.value)}
                    />
                  </div>
                </div>
              </form>
            )}

            {/* Etapa 3: Detalhes */}
            {etapa === 3 && (
              <div className={styles.etapaConteudo}>
                <h2 className={styles.etapaTitulo}>Detalhes e Medidas</h2>
                <p className={styles.etapaSubtitulo}>Informe dimensões, cômodos e adicionais</p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '8px' }}>
                  <div className={styles.grupo}>
                    <label className={styles.label}>Área (m²) *</label>
                    <input
                      type="number"
                      className={styles.input}
                      value={dados.area}
                      onChange={(e) => atualizar('area', e.target.value)}
                    />
                  </div>
                  <div className={styles.grupo}>
                    <label className={styles.label}>Quartos</label>
                    <input
                      type="number"
                      className={styles.input}
                      value={dados.quartos}
                      onChange={(e) => atualizar('quartos', e.target.value)}
                    />
                  </div>
                  <div className={styles.grupo}>
                    <label className={styles.label}>Banheiros</label>
                    <input
                      type="number"
                      className={styles.input}
                      value={dados.banheiros}
                      onChange={(e) => atualizar('banheiros', e.target.value)}
                    />
                  </div>
                  <div className={styles.grupo}>
                    <label className={styles.label}>Vagas</label>
                    <input
                      type="number"
                      className={styles.input}
                      value={dados.vagas}
                      onChange={(e) => atualizar('vagas', e.target.value)}
                    />
                  </div>
                </div>

                <div className={styles.grid2} style={{ marginBottom: '8px' }}>
                  <div className={styles.grupo}>
                    <label className={styles.label}>Condomínio (R$)</label>
                    <input
                      className={styles.input}
                      value={formatarPreco(dados.condominio)}
                      onChange={(e) => atualizar('condominio', e.target.value)}
                    />
                  </div>
                  <div className={styles.grupo}>
                    <label className={styles.label}>IPTU (R$)</label>
                    <input
                      className={styles.input}
                      value={formatarPreco(dados.iptu)}
                      onChange={(e) => atualizar('iptu', e.target.value)}
                    />
                  </div>
                </div>

                <div className={styles.grupo}>
                  <label className={styles.label}>Descrição completa</label>
                  <textarea
                    className={styles.textarea}
                    rows={2}
                    value={dados.descricao}
                    onChange={(e) => atualizar('descricao', e.target.value)}
                  />
                </div>

                <div style={{ display: 'flex', gap: '1.5rem', marginTop: '6px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', fontWeight: 600, color: '#334155', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={dados.aceita_pets}
                      onChange={(e) => atualizar('aceita_pets', e.target.checked)}
                    />
                    🐾 Aceita Pets
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', fontWeight: 600, color: '#334155', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={dados.mobiliado}
                      onChange={(e) => atualizar('mobiliado', e.target.checked)}
                    />
                    🛋️ Mobiliado
                  </label>
                </div>
              </div>
            )}

            {/* Etapa 4: Fotos */}
            {etapa === 4 && (
              <div className={styles.etapaConteudo}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <h2 className={styles.etapaTitulo}>Galeria de Fotos</h2>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#1d4ed8', background: '#eff6ff', padding: '3px 8px', borderRadius: '16px' }}>
                    {fotos.length} {fotos.length === 1 ? 'foto' : 'fotos'}
                  </span>
                </div>
                <p className={styles.etapaSubtitulo}>
                  Adicione fotos nítidas. A foto com selo dourado será a capa principal.
                </p>

                <input
                  ref={inputFotoRef}
                  type="file"
                  multiple
                  accept="image/png, image/jpeg, image/webp"
                  style={{ display: 'none' }}
                  onChange={(e) => adicionarFotos(e.target.files)}
                />

                <div
                  className={`${styles.dropzonePro} ${arrastando ? styles.dropzoneArrastando : ''}`}
                  onDragOver={(e) => { e.preventDefault(); setArrastando(true) }}
                  onDragLeave={() => setArrastando(false)}
                  onDrop={(e) => {
                    e.preventDefault()
                    setArrastando(false)
                    adicionarFotos(e.dataTransfer.files)
                  }}
                >
                  <div className={styles.dropzoneCirculo}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <polyline points="21 15 16 10 5 21" />
                    </svg>
                  </div>
                  <h3 className={styles.dropzoneTitulo}>
                    Arraste suas fotos aqui ou <span style={{ color: '#2563eb', textDecoration: 'underline' }}>escolha do dispositivo</span>
                  </h3>
                  <p className={styles.dropzoneSub}>PNG, JPG ou WEBP • Até 20 fotos</p>
                  <button
                    type="button"
                    className={styles.btnSelecionarFotos}
                    onClick={() => inputFotoRef.current?.click()}
                  >
                    📁 Selecionar Fotos
                  </button>
                </div>

                {fotos.length > 0 && (
                  <div className={styles.gridFotosPro}>
                    {fotos.map((foto, idx) => (
                      <div
                        key={idx}
                        className={`${styles.fotoCardPro} ${foto.principal ? styles.fotoCardCapa : ''}`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={foto.preview} alt={`Foto ${idx + 1}`} className={styles.fotoImgPro} />

                        {foto.principal ? (
                          <div className={styles.badgeCapa}>⭐ Capa</div>
                        ) : (
                          <button
                            type="button"
                            className={styles.btnTornarCapa}
                            onClick={() => definirPrincipal(idx)}
                          >
                            Capa
                          </button>
                        )}

                        <button
                          type="button"
                          className={styles.btnRemoverFoto}
                          onClick={() => removerFoto(idx)}
                        >
                          ✕
                        </button>

                        <div className={styles.numeroFotoPill}>#{idx + 1}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Etapa 5: Revisão & Salvar */}
            {etapa === 5 && (
              <div className={styles.etapaConteudo}>
                <h2 className={styles.etapaTitulo}>Revise e salve as alterações</h2>
                <p className={styles.etapaSubtitulo}>Confira os dados antes de atualizar o imóvel</p>

                <div className={styles.revisaoCard}>
                  <div className={styles.revisaoLinha}>
                    <span>Tipo</span>
                    <strong>{dados.tipo} · {dados.negociacao}</strong>
                  </div>
                  <div className={styles.revisaoLinha}>
                    <span>Título</span>
                    <strong>{dados.titulo}</strong>
                  </div>
                  <div className={styles.revisaoLinha}>
                    <span>Preço</span>
                    <strong className={styles.revisaoPreco}>{formatarPreco(dados.preco)}</strong>
                  </div>
                  <div className={styles.revisaoLinha}>
                    <span>Localização</span>
                    <strong>{dados.cidade} - {dados.estado}</strong>
                  </div>
                  <div className={styles.revisaoLinha}>
                    <span>Área</span>
                    <strong>{dados.area} m²</strong>
                  </div>
                  {dados.quartos && (
                    <div className={styles.revisaoLinha}>
                      <span>Quartos</span>
                      <strong>{dados.quartos}</strong>
                    </div>
                  )}
                  <div className={styles.revisaoLinha}>
                    <span>Fotos</span>
                    <strong>{fotos.length} foto{fotos.length !== 1 ? 's' : ''}</strong>
                  </div>
                </div>

                {/* Caixa de Recado para Reenvio se for Corretor */}
                {isCorretor && (
                  <div style={{
                    background: '#eff6ff',
                    border: '1.5px solid #bfdbfe',
                    borderRadius: '0.75rem',
                    padding: '0.85rem 1rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    marginTop: '8px'
                  }}>
                    <span style={{ fontSize: '0.825rem', fontWeight: 700, color: '#1e40af' }}>
                      💬 Mensagem para o Gestor (opcional ao reenviar):
                    </span>
                    <textarea
                      className={styles.textarea}
                      placeholder="Ex: Fotos adicionadas e condomínio preenchido conforme solicitado..."
                      value={recadoReenvio}
                      onChange={(e) => setRecadoReenvio(e.target.value)}
                      rows={2}
                    />
                  </div>
                )}

                {erro && <p className={styles.erro}>{erro}</p>}
              </div>
            )}

            {/* Navegação Inferior */}
            <div className={styles.navegacao}>
              {etapa > 1 ? (
                <button className={styles.btnVoltar2} onClick={voltar}>
                  ← Voltar
                </button>
              ) : (
                <button className={styles.btnVoltar2} onClick={handleTentarFechar}>
                  Cancelar
                </button>
              )}

              {etapa < 5 ? (
                <button
                  className={`${styles.btnAvancar} ${!podeAvancar() ? styles.btnDesabilitado : ''}`}
                  onClick={avancar}
                  disabled={!podeAvancar()}
                >
                  Avançar →
                </button>
              ) : (
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    className={styles.btnVoltar2}
                    onClick={handleSalvarSimples}
                    disabled={salvando || reenviando}
                    title="Salvar alterações sem reenviar para moderação"
                  >
                    {salvando ? 'Salvando...' : '💾 Salvar Alterações'}
                  </button>

                  {isCorretor && (
                    <button
                      type="button"
                      className={styles.btnAvancar}
                      style={{ background: '#059669', borderColor: '#059669' }}
                      onClick={handleSalvarEReenviar}
                      disabled={salvando || reenviando}
                    >
                      {reenviando ? 'Reenviando...' : '📤 Salvar & Reenviar ao Gestor'}
                    </button>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
