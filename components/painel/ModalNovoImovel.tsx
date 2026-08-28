"use client"

import { useState, useRef, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Plano, Assinatura, UsoPlano, MetodoPagamento } from "@/lib/types"
import { calcularUsoPlano, obterProximoPlano } from "@/lib/planos"
import { useConfirm } from "@/contexts/ModalConfirmacaoContext"
import ModalLimiteAtingido from "@/components/painel/ModalLimiteAtingido"
import ModalUpgradePlano from "@/components/painel/ModalUpgradePlano"
import { gerarPrefixoSugerido } from "@/components/painel/ModalConfiguracoes"
import styles from "./ModalNovoImovel.module.css"

// -- Tipos ------------------------------------------------------------------
type Etapa = 1 | 2 | 3 | 4 | 5

interface DadosImovel {
  tipo: string
  negociacao: string
  titulo: string
  descricao: string
  preco: string
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
  arquivo: File
  preview: string
  principal: boolean
}

const ETAPAS = [
  { numero: 1, label: "Tipo" },
  { numero: 2, label: "Dados" },
  { numero: 3, label: "Detalhes" },
  { numero: 4, label: "Fotos" },
  { numero: 5, label: "Revisão" },
]

const TIPOS = [
  // Residencial
  { valor: 'apartamento',      icone: '🏢', label: 'Apartamento' },
  { valor: 'casa',             icone: '🏠', label: 'Casa' },
  { valor: 'sobrado',          icone: '🏡', label: 'Sobrado' },
  { valor: 'casa_condominio',  icone: '🏘️', label: 'Casa em Condomínio' },
  { valor: 'cobertura',        icone: '🌇', label: 'Cobertura' },
  { valor: 'kitnet',           icone: '🛏️', label: 'Kitnet / Studio' },
  { valor: 'flat',             icone: '🏨', label: 'Flat' },
  { valor: 'lote',             icone: '📐', label: 'Lote' },
  // Comercial
  { valor: 'sala_comercial',   icone: '🗂️', label: 'Sala Comercial' },
  { valor: 'loja',             icone: '🏪', label: 'Loja / Ponto Comercial' },
  { valor: 'galpao',           icone: '🏭', label: 'Galpão' },
  { valor: 'predio',           icone: '🏬', label: 'Prédio Comercial' },
  { valor: 'garagem',          icone: '🚗', label: 'Garagem' },
  { valor: 'terreno_comercial',icone: '🏗️', label: 'Terreno / Lote' },
  // Rural
  { valor: 'sitio',            icone: '🌿', label: 'Sítio' },
  { valor: 'chacara',          icone: '🌳', label: 'Chácara' },
  { valor: 'fazenda',          icone: '🌾', label: 'Fazenda' },
  { valor: 'rancho',           icone: '🐄', label: 'Rancho' },
  // Geral
  { valor: 'outro',            icone: '🏷️', label: 'Outro' },
]

function normalizarTipoParaBanco(tipo: string): string {
  const t = (tipo || '').toLowerCase().trim()
  if (['apartamento', 'flat', 'kitnet', 'studio'].includes(t)) return 'apartamento'
  if (['casa', 'sobrado', 'casa_condominio'].includes(t)) return 'casa'
  if (['cobertura'].includes(t)) return 'cobertura'
  if (['terreno', 'lote', 'terreno_comercial'].includes(t)) return 'terreno'
  if (['comercial', 'sala_comercial', 'loja', 'galpao', 'predio', 'predio_comercial', 'garagem', 'ponto_comercial'].includes(t)) return 'comercial'
  if (['rural', 'sitio', 'chacara', 'fazenda', 'rancho'].includes(t)) return 'rural'
  return 'outro'
}

interface ModalNovoImovelProps {
  isOpen: boolean
  onClose: () => void
  onImovelCriado: () => Promise<void> | void
}

export default function ModalNovoImovel({ isOpen, onClose, onImovelCriado }: ModalNovoImovelProps) {
  const supabase = createClient()

  const [buscandoCep, setBuscandoCep] = useState(false)
  const [usuarioId, setUsuarioId] = useState("")
  const [isCorretor, setIsCorretor] = useState(false)
  const [isImobiliaria, setIsImobiliaria] = useState(false)
  const [imobiliariaNome, setImobiliariaNome] = useState("")
  const [prefixoImovel, setPrefixoImovel] = useState("FX")
  const [modoCodigo, setModoCodigo] = useState<'automatico' | 'proprio'>('automatico')
  const [assinatura, setAssinatura] = useState<Assinatura | null>(null)
  const [imoveisAtivosCount, setImoveisAtivosCount] = useState(0)

  // Modais de Limite / Upgrade
  const [modalLimiteAberto, setModalLimiteAberto] = useState(false)
  const [modalUpgradeAberto, setModalUpgradeAberto] = useState(false)
  const { alertar } = useConfirm()

  const [etapa, setEtapa] = useState<Etapa>(1)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState("")
  const [arrastando, setArrastando] = useState(false)
  const inputFotoRef = useRef<HTMLInputElement>(null)

  const [dados, setDados] = useState<DadosImovel>({
    tipo: "apartamento",
    negociacao: "venda",
    titulo: "",
    codigo: "",
    descricao: "",
    preco: "",
    area: "",
    quartos: "",
    banheiros: "",
    vagas: "",
    endereco: "",
    numero: "",
    complemento: "",
    bairro: "",
    cidade: "",
    estado: "",
    cep: "",
    latitude: "",
    longitude: "",
    condominio: "",
    iptu: "",
    aceita_pets: false,
    mobiliado: false,
  })

  const [fotos, setFotos] = useState<FotoPreview[]>([])

  useEffect(() => {
    if (!isOpen) return

    async function carregarPlanoUsuario() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      setUsuarioId(user.id)
      const meta = user.user_metadata || {}
      const tipoAnunciante = meta.tipo || meta.tipo_anunciante || 'particular'
      const imobId = meta.imobiliaria_id || null
      const imobNome = meta.imobiliaria_nome || meta.nome_imobiliaria || ''
      const ehCorretorVinculado = !!imobId
      const ehImobiliaria = tipoAnunciante === 'imobiliaria'

      setIsCorretor(ehCorretorVinculado || tipoAnunciante === 'corretor')
      setIsImobiliaria(ehImobiliaria)
      setImobiliariaNome(imobNome)

      let prefixoFinal = gerarPrefixoSugerido(imobNome || meta.nome || meta.full_name || '')
      let modoFinal: 'automatico' | 'proprio' = 'automatico'

      // Se for corretor vinculado à imobiliária, a regra de prefixo e modo de código VEM DA IMOBILIÁRIA
      if (ehCorretorVinculado && imobId) {
        try {
          const { data: imobPerfil } = await supabase
            .from('perfis')
            .select('prefixo_codigo, tipo_codigo_imovel, nome')
            .eq('id', imobId)
            .maybeSingle()

          if (imobPerfil) {
            if (imobPerfil.prefixo_codigo) prefixoFinal = imobPerfil.prefixo_codigo
            if (imobPerfil.tipo_codigo_imovel) modoFinal = imobPerfil.tipo_codigo_imovel as any
            if (imobPerfil.nome) setImobiliariaNome(imobPerfil.nome)
          }
        } catch (e) {
          console.error('Erro ao buscar perfil da imobiliária para código:', e)
        }
      } else {
        // Se for imobiliária ou corretor independente, buscar do perfil do usuário / localStorage
        try {
          const { data: userPerfil } = await supabase
            .from('perfis')
            .select('prefixo_codigo, tipo_codigo_imovel')
            .eq('id', user.id)
            .maybeSingle()

          if (userPerfil) {
            if (userPerfil.prefixo_codigo) prefixoFinal = userPerfil.prefixo_codigo
            if (userPerfil.tipo_codigo_imovel) modoFinal = userPerfil.tipo_codigo_imovel as any
          } else if (typeof window !== 'undefined') {
            const salvo = localStorage.getItem(`config_imoveis_${user.id}`)
            if (salvo) {
              const parsed = JSON.parse(salvo)
              if (parsed.prefixo) prefixoFinal = parsed.prefixo
              if (parsed.modoCodigo) modoFinal = parsed.modoCodigo
            }
          }
        } catch (e) {
          console.error('Erro ao buscar perfil de código do usuário:', e)
        }
      }

      setPrefixoImovel(prefixoFinal)
      setModoCodigo(modoFinal)

      try {
        const res = await fetch('/api/painel/cota')
        if (res.ok) {
          const dadosCota = await res.json()
          if (dadosCota.assinatura) {
            setAssinatura(dadosCota.assinatura)
          }
          if (dadosCota.isCorretor) {
            setIsCorretor(true)
            if (dadosCota.imobiliariaNome) setImobiliariaNome(dadosCota.imobiliariaNome)
          }
          setImoveisAtivosCount(dadosCota.imoveisAtivosCount || 0)
        }
      } catch (err) {
        console.error('Erro ao carregar cota:', err)
      }
    }

    carregarPlanoUsuario()
  }, [isOpen, supabase])

  if (!isOpen) return null

  const planoIdAtual = assinatura?.plano_id || 'gratis'
  const usoPlano: UsoPlano = calcularUsoPlano(planoIdAtual, imoveisAtivosCount)
  const proximoPlano: Plano | null = obterProximoPlano(planoIdAtual)

  function atualizar(campo: keyof DadosImovel, valor: string | boolean) {
    setDados((prev) => ({ ...prev, [campo]: valor }))
  }

  async function buscarCep(cepLimpo: string) {
    const cep = cepLimpo.replace(/\D/g, "")
    if (cep.length !== 8) return

    setBuscandoCep(true)
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`)
      const data = await res.json()
      if (!data.erro) {
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
          endereco: data.logradouro || prev.endereco,
          bairro: data.bairro || prev.bairro,
          cidade: data.localidade || prev.cidade,
          estado: data.uf || prev.estado,
          latitude: latEncontrada || prev.latitude,
          longitude: lngEncontrada || prev.longitude,
        }))
      }
    } catch {
      // Falha silenciosa
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
      if (file.type.startsWith("image/")) {
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

  function extrairNumero(str: string): number | null {
    const limpo = str.replace(/\D/g, "")
    return limpo ? parseInt(limpo, 10) : null
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

  async function salvar(statusDesejado: 'publicado' | 'pausado' | 'rascunho' | 'ativo' | 'em_analise' = 'publicado') {
    setSalvando(true)
    setErro("")

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Você precisa estar logado.")

      const precoNumerico = Number(String(dados.preco).replace(/\D/g, "")) || 0
      const areaNumerica = Number(String(dados.area).replace(/\D/g, "")) || 0
      let latNumerica = dados.latitude ? parseFloat(String(dados.latitude)) : null
      let lngNumerica = dados.longitude ? parseFloat(String(dados.longitude)) : null

      // Geocodificação de resgate se não tiver coordenadas
      if (!latNumerica || !lngNumerica || (latNumerica === 0 && lngNumerica === 0)) {
        try {
          const termo = [dados.endereco, dados.bairro, dados.cidade, dados.estado, 'Brasil'].filter(Boolean).join(', ')
          const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
          if (token) {
            const res = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(termo)}.json?access_token=${token}&country=BR&limit=1`)
            const json = await res.json()
            if (json.features?.length > 0) {
              const [lng, lat] = json.features[0].center
              latNumerica = lat
              lngNumerica = lng
            }
          }
        } catch {}
      }

      const { data: perfilExistente } = await supabase
        .from('perfis')
        .select('id')
        .eq('id', user.id)
        .maybeSingle()

      if (!perfilExistente) {
        const meta = user.user_metadata || {}
        await supabase.from('perfis').upsert({
          id: user.id,
          nome: meta.nome || meta.full_name || user.email?.split('@')[0] || 'Anunciante',
          email: user.email!,
          tipo: meta.tipo || 'corretor',
          telefone: meta.telefone || null,
          creci: meta.creci || null,
        })
      }

      const meta = user.user_metadata || {}
      const imobId = meta.imobiliaria_id

      let statusFinal: 'ativo' | 'pausado' | 'rascunho' = 'ativo'
      if (isCorretor || statusDesejado === 'em_analise' || statusDesejado === 'rascunho') {
        statusFinal = 'rascunho'
      } else if (statusDesejado === 'pausado' || usoPlano.atingiuLimite) {
        statusFinal = 'pausado'
      } else {
        statusFinal = 'ativo'
      }

      // Gerar ou formatar código de referência do imóvel
      let codigoFinal = dados.codigo?.trim().toUpperCase() || ''
      if (!codigoFinal) {
        if (modoCodigo === 'proprio') {
          throw new Error("Sua imobiliária/conta está configurada para utilizar código próprio/CRM. Por favor, informe o Código do Anúncio.")
        }
        const prefixoValido = prefixoImovel?.trim().toUpperCase() || 'FIX'
        codigoFinal = `${prefixoValido}-${Math.floor(1000 + Math.random() * 9000)}`
      }

      const { data: imovel, error: erroImovel } = await supabase
        .from("imoveis")
        .insert({
          anunciante_id: user.id,
          tipo: normalizarTipoParaBanco(dados.tipo),
          negociacao: dados.negociacao,
          titulo: dados.titulo,
          codigo: codigoFinal,
          descricao: dados.descricao || null,
          preco: precoNumerico,
          area: areaNumerica,
          quartos: extrairNumero(dados.quartos),
          banheiros: extrairNumero(dados.banheiros),
          vagas: extrairNumero(dados.vagas),
          endereco: dados.endereco || "",
          bairro: dados.bairro || null,
          cidade: dados.cidade,
          estado: dados.estado || null,
          cep: dados.cep || null,
          latitude: latNumerica,
          longitude: lngNumerica,
          condominio: extrairNumero(dados.condominio),
          iptu: extrairNumero(dados.iptu),
          aceita_pets: !!dados.aceita_pets,
          mobiliado: !!dados.mobiliado,
          status: statusFinal,
          destaque: false,
        })
        .select()
        .single()

      if (erroImovel) {
        console.error("Erro Supabase imoveis:", erroImovel)
        throw new Error(erroImovel.message || "Não foi possível cadastrar o imóvel no banco de dados.")
      }

      // Upload das fotos
      if (fotos.length > 0 && imovel?.id) {
        for (let i = 0; i < fotos.length; i++) {
          const foto = fotos[i]
          const ext = foto.arquivo.name.split(".").pop() || 'jpg'
          const caminho = `${user.id}/${imovel.id}/${Date.now()}-${i}.${ext}`

          try {
            const { error: erroUpload } = await supabase.storage
              .from("fotos-imoveis")
              .upload(caminho, foto.arquivo, { upsert: true })

            if (!erroUpload) {
              const { data: urlData } = supabase.storage
                .from("fotos-imoveis")
                .getPublicUrl(caminho)

              await supabase.from("fotos_imovel").insert({
                imovel_id: imovel.id,
                url: urlData.publicUrl,
                principal: foto.principal,
                ordem: i,
              })
            }
          } catch (errFoto) {
            console.error("Erro upload foto:", errFoto)
          }
        }
      }

      // Se for corretor, notificar os gestores da imobiliária
      if (isCorretor && imobId && imovel?.id) {
        try {
          await fetch('/api/painel/notificacoes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              usuario_id: imobId,
              titulo: '⏳ Novo Anúncio para Revisão',
              mensagem: `O corretor ${user.user_metadata?.nome || user.email?.split('@')[0] || 'da equipe'} submeteu "${dados.titulo}" para revisão e publicação.`,
              tipo: 'revisao_pendente',
              imovel_id: imovel.id,
            }),
          })
        } catch {}
      }

      // 1. Atualiza a lista do workspace primeiro
      await onImovelCriado()

      // 2. Feedback se for corretor
      if (isCorretor) {
        await alertar({
          titulo: 'Anúncio Submetido com Sucesso!',
          mensagem: `Seu imóvel "${dados.titulo}" foi enviado para revisão da gestão da ${imobiliariaNome || 'sua imobiliária'}. Assim que for aprovado, ele será publicado no mapa.`,
          icone: '🎉',
          tipo: 'sucesso',
        })
      }

      // 3. Pequeno intervalo para renderização da lista ao fundo
      await new Promise((resolve) => setTimeout(resolve, 200))

      // 4. Fecha a janela suavemente
      onClose()
    } catch (e: unknown) {
      console.error("Erro ao salvar imóvel:", e)
      setErro(e instanceof Error ? e.message : "Erro ao salvar imóvel. Verifique os dados.")
    } finally {
      setSalvando(false)
    }
  }

  function formatarPreco(valor: string) {
    const num = valor.replace(/\D/g, "")
    if (!num) return ""
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 0,
    }).format(parseInt(num))
  }

  return (
    <>
      <div className={styles.overlay} onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}>
        <div className={styles.modalCard}>
          {/* Header */}
          <div className={styles.modalHeader}>
            <div className={styles.modalHeaderTitulo}>
              <span>🏡</span> Cadastrar Novo Imóvel
            </div>
            <button type="button" className={styles.btnFechar} onClick={onClose} title="Fechar">
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
                  <div className={`${styles.etapaItem} ${ativa ? styles.etapaAtiva : ""} ${concluida ? styles.etapaConcluida : ""}`}>
                    <div className={styles.etapaBolha}>
                      {concluida ? "✓" : etp.numero}
                    </div>
                    <span className={styles.etapaLabel}>{etp.label}</span>
                  </div>
                  {idx < ETAPAS.length - 1 && (
                    <div className={`${styles.etapaLinha} ${etapa > etp.numero ? styles.etapaLinhaAtiva : ""}`} />
                  )}
                </div>
              )
            })}
          </div>

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
                    className={`${styles.tipoCard} ${dados.tipo === t.valor ? styles.tipoSelecionado : ""}`}
                    onClick={() => atualizar("tipo", t.valor)}
                  >
                    <span className={styles.tipoIcone}>{t.icone}</span>
                    <span className={styles.tipoLabel}>{t.label}</span>
                  </button>
                ))}
              </div>

              <div className={styles.grupo} style={{ marginTop: '0.4rem' }}>
                <label className={styles.label}>Modalidade de Negociação</label>
                <div className={styles.btnGroup}>
                  {["venda", "aluguel", "temporada"].map((neg) => (
                    <button
                      key={neg}
                      type="button"
                      className={`${styles.btnOpcao} ${dados.negociacao === neg ? styles.btnOpcaoAtivo : ""}`}
                      onClick={() => atualizar("negociacao", neg)}
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
                    onChange={(e) => atualizar("titulo", e.target.value)}
                    maxLength={100}
                    name="imovel_d_titulo"
                    autoComplete="one-time-code"
                  />
                </div>

                <div className={styles.grupo}>
                  <label className={styles.label}>Preço (R$) *</label>
                  <input
                    className={styles.input}
                    value={formatarPreco(dados.preco)}
                    onChange={(e) => atualizar("preco", e.target.value)}
                    name="imovel_d_preco"
                    autoComplete="one-time-code"
                  />
                </div>
              </div>

              {/* Campo Código de Referência do Anúncio */}
              <div className={styles.grupo} style={{ marginBottom: '10px' }}>
                <label className={styles.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>Código do Anúncio / Referência {modoCodigo === 'proprio' ? '*' : '(Ref)'}</span>
                  <span style={{ fontSize: '0.725rem', color: modoCodigo === 'proprio' ? '#c2410c' : '#64748b', fontWeight: 'normal' }}>
                    {modoCodigo === 'proprio'
                      ? (dados.codigo ? '✓ Código Próprio/CRM' : '⚠️ Obrigatório (Modo Próprio/CRM)')
                      : (dados.codigo ? 'Personalizado' : `Automático (${prefixoImovel || 'FIX'}-XXXX)`)}
                  </span>
                </label>
                <input
                  className={styles.input}
                  value={dados.codigo || ''}
                  onChange={(e) => atualizar("codigo", e.target.value.toUpperCase().replace(/\s+/g, ''))}
                  placeholder={modoCodigo === 'proprio' ? 'Ex: AP-104, CAS-002 (Informe o código do seu sistema)' : `Ex: ${prefixoImovel || 'FIX'}-0142 (Deixe vazio para gerar auto)`}
                  maxLength={20}
                  style={modoCodigo === 'proprio' && !dados.codigo ? { borderColor: '#fb923c' } : undefined}
                />
              </div>

              <div className={styles.grid3}>
                <div className={styles.grupo}>
                  <label className={styles.label}>CEP</label>
                  <div style={{ display: "flex", gap: "0.4rem" }}>
                    <input
                      className={styles.input}
                      value={dados.cep}
                      onChange={(e) => {
                        atualizar("cep", e.target.value)
                        if (e.target.value.replace(/\D/g, "").length === 8) {
                          buscarCep(e.target.value)
                        }
                      }}
                      maxLength={9}
                      name="imovel_d_cep"
                      autoComplete="one-time-code"
                      data-lpignore="true"
                      data-form-type="other"
                    />
                    {buscandoCep && <span style={{ alignSelf: "center", fontSize: "0.75rem", color: "#64748b" }}>...</span>}
                  </div>
                </div>

                <div className={styles.grupo}>
                  <label className={styles.label}>Cidade *</label>
                  <input
                    className={styles.input}
                    value={dados.cidade}
                    onChange={(e) => atualizar("cidade", e.target.value)}
                    name="imovel_d_cidade"
                    autoComplete="one-time-code"
                    data-lpignore="true"
                    data-form-type="other"
                  />
                </div>

                <div className={styles.grupo}>
                  <label className={styles.label}>Estado (UF) *</label>
                  <input
                    className={styles.input}
                    value={dados.estado}
                    onChange={(e) => atualizar("estado", e.target.value.toUpperCase())}
                    maxLength={2}
                    name="imovel_d_uf"
                    autoComplete="one-time-code"
                    data-lpignore="true"
                    data-form-type="other"
                  />
                </div>
              </div>

              <div className={styles.gridEnderecoBairro}>
                <div className={styles.grupo}>
                  <label className={styles.label}>Endereço (Rua, Av)</label>
                  <input
                    className={styles.input}
                    value={dados.endereco}
                    onChange={(e) => atualizar("endereco", e.target.value)}
                    name="imovel_d_logradouro"
                    autoComplete="one-time-code"
                    data-lpignore="true"
                    data-form-type="other"
                  />
                </div>

                <div className={styles.grupo}>
                  <label className={styles.label}>Bairro</label>
                  <input
                    className={styles.input}
                    value={dados.bairro}
                    onChange={(e) => atualizar("bairro", e.target.value)}
                    name="imovel_d_bairro"
                    autoComplete="one-time-code"
                    data-lpignore="true"
                    data-form-type="other"
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
                    onChange={(e) => atualizar("area", e.target.value)}
                  />
                </div>
                <div className={styles.grupo}>
                  <label className={styles.label}>Quartos</label>
                  <input
                    type="number"
                    className={styles.input}
                    value={dados.quartos}
                    onChange={(e) => atualizar("quartos", e.target.value)}
                  />
                </div>
                <div className={styles.grupo}>
                  <label className={styles.label}>Banheiros</label>
                  <input
                    type="number"
                    className={styles.input}
                    value={dados.banheiros}
                    onChange={(e) => atualizar("banheiros", e.target.value)}
                  />
                </div>
                <div className={styles.grupo}>
                  <label className={styles.label}>Vagas</label>
                  <input
                    type="number"
                    className={styles.input}
                    value={dados.vagas}
                    onChange={(e) => atualizar("vagas", e.target.value)}
                  />
                </div>
              </div>

              <div className={styles.grid2} style={{ marginBottom: '8px' }}>
                <div className={styles.grupo}>
                  <label className={styles.label}>Condomínio (R$)</label>
                  <input
                    className={styles.input}
                    value={formatarPreco(dados.condominio)}
                    onChange={(e) => atualizar("condominio", e.target.value)}
                  />
                </div>
                <div className={styles.grupo}>
                  <label className={styles.label}>IPTU (R$)</label>
                  <input
                    className={styles.input}
                    value={formatarPreco(dados.iptu)}
                    onChange={(e) => atualizar("iptu", e.target.value)}
                  />
                </div>
              </div>

              <div className={styles.grupo}>
                <label className={styles.label}>Descrição completa</label>
                <textarea
                  className={styles.textarea}
                  rows={2}
                  value={dados.descricao}
                  onChange={(e) => atualizar("descricao", e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', gap: '1.5rem', marginTop: '6px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', fontWeight: 600, color: '#334155', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={dados.aceita_pets}
                    onChange={(e) => atualizar("aceita_pets", e.target.checked)}
                  />
                  🐾 Aceita Pets
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', fontWeight: 600, color: '#334155', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={dados.mobiliado}
                    onChange={(e) => atualizar("mobiliado", e.target.checked)}
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
                style={{ display: "none" }}
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
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                    <circle cx="8.5" cy="8.5" r="1.5"/>
                    <polyline points="21 15 16 10 5 21"/>
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

          {/* Etapa 5: Revisão */}
          {etapa === 5 && (
            <div className={styles.etapaConteudo}>
              <h2 className={styles.etapaTitulo}>Revise e publique</h2>
              <p className={styles.etapaSubtitulo}>Confira os dados antes de publicar</p>

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
                  <strong>{fotos.length} foto{fotos.length !== 1 ? "s" : ""}</strong>
                </div>
              </div>

              {isCorretor && (
                <div style={{
                  background: '#eff6ff',
                  border: '1.5px solid #bfdbfe',
                  borderRadius: '0.75rem',
                  padding: '0.85rem 1rem',
                  fontSize: '0.825rem',
                  color: '#1e40af',
                  lineHeight: '1.4',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}>
                  <span style={{ fontSize: '1.2rem' }}>👔</span>
                  <span>
                    <strong>Moderação da Equipe:</strong> Como corretor oficial, seu anúncio será enviado para revisão e aprovação da gestão da {imobiliariaNome || 'sua imobiliária'} antes de ser publicado no mapa.
                  </span>
                </div>
              )}

              {usoPlano.atingiuLimite && (
                <div style={{
                  background: '#fef2f2',
                  border: '1.5px solid #fecaca',
                  borderRadius: '0.75rem',
                  padding: '0.85rem 1rem',
                  fontSize: '0.825rem',
                  color: '#991b1b',
                  lineHeight: '1.4',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}>
                  <span style={{ fontSize: '1.2rem' }}>⚠️</span>
                  <span>
                    <strong>Limite de Cota Atingido:</strong> Você atingiu o limite de {usoPlano.limiteMaximo} anúncio(s) ativo(s) do plano {usoPlano.plano.nome}. Este anúncio só poderá ser salvo como <strong>Pausado / Rascunho</strong> ou será necessário fazer <strong>Upgrade do Plano</strong> para publicá-lo diretamente no mapa.
                  </span>
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
              <button className={styles.btnVoltar2} onClick={onClose}>
                Cancelar
              </button>
            )}

            {etapa < 5 ? (
              <button
                className={`${styles.btnAvancar} ${!podeAvancar() ? styles.btnDesabilitado : ""}`}
                onClick={avancar}
                disabled={!podeAvancar()}
              >
                Avançar →
              </button>
            ) : (
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                {isCorretor ? (
                  <>
                    <button
                      type="button"
                      className={styles.btnVoltar2}
                      onClick={() => salvar('pausado')}
                      disabled={salvando}
                      title="Salvar como pausado sem enviar para aprovação"
                    >
                      Salvar Pausado
                    </button>

                    <button
                      type="button"
                      className={`${styles.btnPublicar} ${salvando ? styles.btnCarregando : ""}`}
                      onClick={() => salvar('rascunho')}
                      disabled={salvando}
                      style={{ background: '#d97706' }}
                    >
                      {salvando ? "Enviando..." : "📤 Enviar para Revisão do Gestor"}
                    </button>
                  </>
                ) : usoPlano.atingiuLimite ? (
                  <>
                    <button
                      type="button"
                      className={styles.btnVoltar2}
                      onClick={() => salvar('pausado')}
                      disabled={salvando}
                      title="Salvar imóvel como pausado aguardando vagas de cota"
                    >
                      Salvar como Pausado
                    </button>

                    {proximoPlano && (
                      <button
                        type="button"
                        className="btn btn-primario btn-md"
                        onClick={() => setModalLimiteAberto(true)}
                        style={{ fontWeight: 700 }}
                      >
                        ⚡ Upgrade p/ Publicar
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      className={styles.btnVoltar2}
                      onClick={() => salvar('pausado')}
                      disabled={salvando}
                      title="Salvar como rascunho pausado"
                    >
                      Salvar Pausado
                    </button>

                    <button
                      type="button"
                      className={styles.btnVoltar2}
                      onClick={() => salvar('rascunho')}
                      disabled={salvando}
                      style={{ borderColor: '#f59e0b', color: '#b45309', background: '#fffbeb', fontWeight: 700 }}
                      title="Salvar e colocar na fila de revisão interna"
                    >
                      ⏳ Enviar p/ Revisão Interna
                    </button>

                    <button
                      type="button"
                      className={`${styles.btnPublicar} ${salvando ? styles.btnCarregando : ""}`}
                      onClick={() => salvar('ativo')}
                      disabled={salvando}
                    >
                      {salvando ? "Publicando..." : "🏡 Publicar Direto no Mapa"}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modais de Limite e Upgrade caso necessário */}
      <ModalLimiteAtingido
        aberto={modalLimiteAberto}
        onFechar={() => setModalLimiteAberto(false)}
        planoAtual={usoPlano.plano}
        proximoPlano={proximoPlano}
        imoveisAtivos={usoPlano.imoveisAtivos}
        onFazerUpgrade={() => {
          setModalLimiteAberto(false)
          setModalUpgradeAberto(true)
        }}
        acaoTentada="novo_imovel"
      />

      <ModalUpgradePlano
        aberto={modalUpgradeAberto}
        onFechar={() => setModalUpgradeAberto(false)}
        planoAtual={usoPlano.plano}
        planoSugerido={proximoPlano}
        imoveisAtivos={usoPlano.imoveisAtivos}
        onConfirmarPlano={async (novoPlano: Plano, metodo: MetodoPagamento) => {
          setModalUpgradeAberto(false)
          if (assinatura) {
            setAssinatura({
              ...assinatura,
              plano_id: novoPlano.id,
              metodo_pagamento: metodo,
            })
          }
        }}
      />
    </>
  )
}
