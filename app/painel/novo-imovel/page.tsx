"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Plano, Assinatura, UsoPlano, MetodoPagamento } from "@/lib/types"
import { calcularUsoPlano, obterProximoPlano } from "@/lib/planos"
import ModalLimiteAtingido from "@/components/painel/ModalLimiteAtingido"
import ModalUpgradePlano from "@/components/painel/ModalUpgradePlano"
import styles from "./page.module.css"

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

export default function NovoImovelPage() {
  const router = useRouter()
  const supabase = createClient()

  const [buscandoCep, setBuscandoCep] = useState(false)
  const [usuarioId, setUsuarioId] = useState("")
  const [isCorretor, setIsCorretor] = useState(false)
  const [imobiliariaNome, setImobiliariaNome] = useState("")
  const [assinatura, setAssinatura] = useState<Assinatura | null>(null)
  const [imoveisAtivosCount, setImoveisAtivosCount] = useState(0)

  // Modais de Limite / Upgrade
  const [modalLimiteAberto, setModalLimiteAberto] = useState(false)
  const [modalUpgradeAberto, setModalUpgradeAberto] = useState(false)

  useEffect(() => {
    async function carregarPlanoUsuario() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUsuarioId(user.id)

      try {
        const resCota = await fetch(`/api/painel/cota?usuario_id=${user.id}`)
        const jsonCota = await resCota.json()

        if (jsonCota) {
          setIsCorretor(!!jsonCota.isCorretor)
          if (jsonCota.imobiliariaNome) setImobiliariaNome(jsonCota.imobiliariaNome)
          if (jsonCota.assinatura) setAssinatura(jsonCota.assinatura)
          setImoveisAtivosCount(jsonCota.totalAtivos || 0)
        }
      } catch (err) {
        console.error("Erro ao carregar cota do usuário:", err)
      }
    }

    carregarPlanoUsuario()
  }, [supabase])

  const usoPlano = calcularUsoPlano(
    assinatura?.plano_id || 'gratis',
    imoveisAtivosCount,
    0,
    assinatura || undefined
  )

  const proximoPlano = obterProximoPlano(usoPlano.plano.id)

  async function handleAtualizarAssinatura(novoPlano: Plano, metodo: MetodoPagamento) {
    if (!usuarioId) return
    try {
      const { data: assData } = await supabase
        .from('assinaturas')
        .upsert(
          {
            usuario_id: usuarioId,
            plano_id: novoPlano.id,
            status: 'ativo',
            metodo_pagamento: metodo,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'usuario_id' }
        )
        .select()
        .single()

      if (assData) {
        setAssinatura(assData as Assinatura)
      } else {
        setAssinatura({
          id: 'local_' + novoPlano.id,
          usuario_id: usuarioId,
          plano_id: novoPlano.id,
          status: 'ativo',
          data_inicio: new Date().toISOString(),
          metodo_pagamento: metodo,
          created_at: new Date().toISOString(),
        })
      }
    } catch (e) {
      console.error(e)
    }
  }

  async function buscarCep(cepRaw: string) {
    const cep = cepRaw.replace(/\D/g, "")
    if (cep.length !== 8) return
    setBuscandoCep(true)
    try {
      // 1. ViaCEP -> endereço
      const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`)
      const data = await res.json()
      if (!data.erro) {
        const cidade = data.localidade || ""
        const estado = data.uf || ""
        const endereco = data.logradouro || ""
        const bairro = data.bairro || ""

        setDados(prev => ({
          ...prev,
          endereco: endereco || prev.endereco,
          bairro: bairro || prev.bairro,
          cidade: cidade || prev.cidade,
          estado: estado || prev.estado,
        }))

        // 2. Mapbox Geocoding -> lat/lng
        const query = encodeURIComponent(`${bairro ? bairro + ", " : ""}${cidade}, ${estado}, Brasil`)
        const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
        const geo = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${query}.json?access_token=${token}&language=pt&limit=1&country=BR`)
        const geoData = await geo.json()
        if (geoData.features?.length > 0) {
          const [lng, lat] = geoData.features[0].center
          setDados(prev => ({ ...prev, latitude: String(lat), longitude: String(lng) }))
        }
      }
    } catch { /* ignora erro */ } finally {
      setBuscandoCep(false)
    }
  }

  const [arrastando, setArrastando] = useState(false)
  const inputFotoRef = useRef<HTMLInputElement>(null)

  const [etapa, setEtapa] = useState<Etapa>(1)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState("")
  const [fotos, setFotos] = useState<FotoPreview[]>([])

  const [dados, setDados] = useState<DadosImovel>({
    tipo: "",
    negociacao: "venda",
    titulo: "",
    descricao: "",
    preco: "",
    area: "",
    quartos: "",
    banheiros: "",
    vagas: "",
    endereco: "",
    bairro: "",
    numero: "",
    complemento: "",
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

  function atualizar(campo: keyof DadosImovel, valor: string | boolean) {
    setDados((prev) => ({ ...prev, [campo]: valor }))
  }

  function podeAvancar(): boolean {
    if (etapa === 1) return !!dados.tipo && !!dados.negociacao
    if (etapa === 2) return !!dados.titulo && !!dados.preco && !!dados.cidade && !!dados.estado
    if (etapa === 3) return !!dados.area
    if (etapa === 4) return true
    return true
  }

  function avancar() {
    if (podeAvancar() && etapa < 5) setEtapa((e) => (e + 1) as Etapa)
  }

  function voltar() {
    if (etapa > 1) setEtapa((e) => (e - 1) as Etapa)
  }

  function adicionarFotos(arquivos: FileList | null) {
    if (!arquivos || arquivos.length === 0) return
    const novas: FotoPreview[] = Array.from(arquivos).map((arquivo, i) => ({
      arquivo,
      preview: URL.createObjectURL(arquivo),
      principal: fotos.length === 0 && i === 0,
    }))
    setFotos((prev) => [...prev, ...novas])
  }

  function removerFoto(idx: number) {
    setFotos((prev) => {
      const nova = prev.filter((_, i) => i !== idx)
      if (nova.length > 0 && !nova.some((f) => f.principal)) {
        nova[0].principal = true
      }
      return nova
    })
  }

  function definirPrincipal(idx: number) {
    setFotos((prev) =>
      prev.map((f, i) => ({ ...f, principal: i === idx }))
    )
  }

  function extrairNumero(str: string): number | null {
    if (!str) return null
    const num = parseFloat(str.replace(/\D/g, ""))
    return isNaN(num) ? null : num
  }

  async function salvar(statusDesejado: 'publicado' | 'pausado' = 'publicado') {
    if (statusDesejado === 'publicado' && usoPlano.atingiuLimite) {
      setModalLimiteAberto(true)
      return
    }

    setSalvando(true)
    setErro("")
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Usuário não autenticado. Faça login novamente.")

      // 1. Garantir que o perfil do usuário exista na tabela perfis (evita violação de FK)
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

      // 2. Inserir imóvel no Supabase
      const precoNumerico = extrairNumero(dados.preco) || 0
      const areaNumerica = parseFloat(dados.area.replace(',', '.')) || null
      const latNumerica = parseFloat(dados.latitude) || 0
      const lngNumerica = parseFloat(dados.longitude) || 0

      const { data: imovel, error: erroImovel } = await supabase
        .from("imoveis")
        .insert({
          anunciante_id: user.id,
          tipo: normalizarTipoParaBanco(dados.tipo),
          negociacao: dados.negociacao,
          titulo: dados.titulo,
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
          status: statusDesejado === 'publicado' ? 'ativo' : 'pausado',
          destaque: false,
        })
        .select()
        .single()

      if (erroImovel) {
        console.error("Erro Supabase imoveis:", erroImovel)
        throw new Error(erroImovel.message || "Não foi possível cadastrar o imóvel no banco de dados.")
      }

      // 3. Upload das fotos para o bucket fotos-imoveis
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
            } else {
              console.warn("Aviso upload foto:", erroUpload.message)
            }
          } catch (errFoto) {
            console.warn("Erro ao enviar foto:", errFoto)
          }
        }
      }

      router.push("/painel?novo=1")
    } catch (e: unknown) {
      console.error("Erro ao salvar imóvel:", e)
      setErro(e instanceof Error ? e.message : "Erro ao salvar imóvel. Verifique os dados e tente novamente.")
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
    <div className={styles.pagina}>
      {/* Header */}
      <header className={styles.header}>
        <Link href="/painel?aba=imoveis" className={styles.btnVoltar}>
          {"\u2190"} Painel
        </Link>
        <h1 className={styles.headerTitulo}>Novo Imóvel</h1>
        <div />
      </header>

      {/* Progress / Stepper Moderno */}
      <div className={styles.progresso}>
        {ETAPAS.map((e, idx) => (
          <div key={e.numero} style={{ display: 'flex', alignItems: 'center' }}>
            <div className={`${styles.etapaItem} ${etapa === e.numero ? styles.etapaAtiva : ""} ${etapa > e.numero ? styles.etapaConcluida : ""}`}>
              <div className={styles.etapaBolha}>
                {etapa > e.numero ? "✓" : e.numero}
              </div>
              <span className={styles.etapaLabel}>{e.label}</span>
            </div>
            {idx < ETAPAS.length - 1 && (
              <div className={`${styles.etapaLinha} ${etapa > e.numero ? styles.etapaLinhaAtiva : ""}`} />
            )}
          </div>
        ))}
      </div>

      {/* Alerta de Limite do Plano */}
      {usoPlano.atingiuLimite && !isCorretor && (
        <div style={{
          maxWidth: '660px',
          margin: '0 auto 0.75rem',
          padding: '0.6rem 1rem',
          background: '#fffbeb',
          border: '1px solid #fef3c7',
          borderRadius: '0.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.75rem',
          flexWrap: 'wrap'
        }}>
          <span style={{ fontSize: '0.8rem', color: '#b45309' }}>
            ⚡ <strong>Plano {usoPlano.plano.nome}:</strong> Limite de {usoPlano.limiteMaximo} anúncio(s) ativo(s) atingido.
          </span>
          {proximoPlano && (
            <button
              type="button"
              className="btn btn-primario btn-sm"
              onClick={() => setModalUpgradeAberto(true)}
              style={{ fontSize: '0.75rem', padding: '3px 8px' }}
            >
              Upgrade para {proximoPlano.nome}
            </button>
          )}
        </div>
      )}

      {/* Conteúdo */}
      <main className={styles.main}>
        <div className={styles.card}>

          {/* -- Etapa 1: Tipo e Negociação -- */}
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

              <div className={styles.grupo} style={{ marginTop: '0.5rem' }}>
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

          {/* -- Etapa 2: Dados Básicos -- */}
          {etapa === 2 && (
            <div className={styles.etapaConteudo}>
              <h2 className={styles.etapaTitulo}>Dados do Imóvel</h2>
              <p className={styles.etapaSubtitulo}>Preço, título e localização</p>

              <div className={styles.grupo}>
                <label className={styles.label}>Título do anúncio *</label>
                <input
                  className={styles.input}
                  value={dados.titulo}
                  onChange={(e) => atualizar("titulo", e.target.value)}
                  maxLength={100}
                />
              </div>

              <div className={styles.grupo}>
                <label className={styles.label}>Preço (R$) *</label>
                <input
                  className={styles.input}
                  value={formatarPreco(dados.preco)}
                  onChange={(e) => atualizar("preco", e.target.value)}
                />
              </div>

              <div className={styles.grupo}>
                <label className={styles.label}>CEP</label>
                <div style={{ display: "flex", gap: "0.5rem" }}>
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
                  />
                  {buscandoCep && <span style={{ alignSelf: "center", fontSize: "0.8rem", color: "#64748b" }}>Buscando...</span>}
                </div>
              </div>

              <div className={styles.grid2}>
                <div className={styles.grupo}>
                  <label className={styles.label}>Cidade *</label>
                  <input
                    className={styles.input}
                    value={dados.cidade}
                    onChange={(e) => atualizar("cidade", e.target.value)}
                  />
                </div>
                <div className={styles.grupo}>
                  <label className={styles.label}>Estado (UF) *</label>
                  <input
                    className={styles.input}
                    value={dados.estado}
                    onChange={(e) => atualizar("estado", e.target.value.toUpperCase())}
                    maxLength={2}
                  />
                </div>
              </div>

              <div className={styles.grid2}>
                <div className={styles.grupo}>
                  <label className={styles.label}>Bairro</label>
                  <input
                    className={styles.input}
                    value={dados.bairro}
                    onChange={(e) => atualizar("bairro", e.target.value)}
                  />
                </div>
                <div className={styles.grupo}>
                  <label className={styles.label}>Endereço (Rua, Av)</label>
                  <input
                    className={styles.input}
                    value={dados.endereco}
                    onChange={(e) => atualizar("endereco", e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          {/* -- Etapa 3: Detalhes -- */}
          {etapa === 3 && (
            <div className={styles.etapaConteudo}>
              <h2 className={styles.etapaTitulo}>Detalhes e Medidas</h2>
              <p className={styles.etapaSubtitulo}>Informe dimensões e cômodos</p>

              <div className={styles.grid2}>
                <div className={styles.grupo}>
                  <label className={styles.label}>Área total (m²) *</label>
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
              </div>

              <div className={styles.grid2}>
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
                  <label className={styles.label}>Vagas na garagem</label>
                  <input
                    type="number"
                    className={styles.input}
                    value={dados.vagas}
                    onChange={(e) => atualizar("vagas", e.target.value)}
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
                Adicione fotos nítidas. A foto com selo dourado será a capa principal do anúncio.
              </p>

              <input
                ref={inputFotoRef}
                type="file"
                multiple
                accept="image/png, image/jpeg, image/webp"
                style={{ display: "none" }}
                onChange={(e) => adicionarFotos(e.target.files)}
              />

              {/* Dropzone Ultra Premium Compacta */}
              <div
                className={`${styles.dropzonePro} ${arrastando ? styles.dropzoneArrastando : ''}`}
                onClick={() => inputFotoRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setArrastando(true) }}
                onDragLeave={() => setArrastando(false)}
                onDrop={(e) => {
                  e.preventDefault()
                  setArrastando(false)
                  adicionarFotos(e.dataTransfer.files)
                }}
              >
                <div className={styles.dropzoneCirculo}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                    <circle cx="8.5" cy="8.5" r="1.5"/>
                    <polyline points="21 15 16 10 5 21"/>
                  </svg>
                </div>
                <h3 className={styles.dropzoneTitulo}>
                  Arraste suas fotos aqui ou <span style={{ color: '#2563eb', textDecoration: 'underline' }}>escolha do dispositivo</span>
                </h3>
                <p className={styles.dropzoneSub}>
                  PNG, JPG ou WEBP • Até 20 fotos
                </p>
                <button
                  type="button"
                  className={styles.btnSelecionarFotos}
                  onClick={(e) => {
                    e.stopPropagation()
                    inputFotoRef.current?.click()
                  }}
                >
                  📁 Selecionar Fotos
                </button>
              </div>

              {/* Grid de Fotos Selecionadas */}
              {fotos.length > 0 && (
                <div style={{ marginTop: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a' }}>
                      Fotos Carregadas ({fotos.length})
                    </span>
                    <button
                      type="button"
                      onClick={() => inputFotoRef.current?.click()}
                      style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
                    >
                      + Adicionar mais fotos
                    </button>
                  </div>

                  <div className={styles.gridFotosPro}>
                    {fotos.map((foto, idx) => (
                      <div
                        key={idx}
                        className={`${styles.fotoCardPro} ${foto.principal ? styles.fotoCardCapa : ''}`}
                      >
                        {/* Imagem */}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={foto.preview} alt={`Foto ${idx + 1}`} className={styles.fotoImgPro} />

                        {/* Badge de Posição / Capa */}
                        {foto.principal ? (
                          <div className={styles.badgeCapa}>
                            ⭐ Capa
                          </div>
                        ) : (
                          <button
                            type="button"
                            className={styles.btnTornarCapa}
                            onClick={() => definirPrincipal(idx)}
                            title="Definir como capa"
                          >
                            Tornar Capa
                          </button>
                        )}

                        {/* Botão de Remover */}
                        <button
                          type="button"
                          className={styles.btnRemoverFoto}
                          onClick={(e) => {
                            e.stopPropagation()
                            removerFoto(idx)
                          }}
                          title="Remover foto"
                        >
                          ✕
                        </button>

                        <div className={styles.numeroFotoPill}>
                          #{idx + 1}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Etapa 5: Revisao */}
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

              {usoPlano.atingiuLimite && (
                <div style={{
                  background: '#fef2f2',
                  border: '1px solid #fee2e2',
                  borderRadius: '0.5rem',
                  padding: '0.75rem 1rem',
                  marginTop: '0.75rem',
                  fontSize: '0.825rem',
                  color: '#991b1b',
                  lineHeight: '1.4'
                }}>
                  {isCorretor ? (
                    <span>
                      ⚠️ <strong>Cota Corporativa Atingida:</strong> A imobiliária {imobiliariaNome || 'vinculada'} atingiu o limite de {usoPlano.limiteMaximo} anúncio(s) ativo(s). Entre em contato com a administração da imobiliária para solicitar a liberação de mais vagas. Você pode <strong>salvar como Pausado</strong> para gravá-lo no painel.
                    </span>
                  ) : (
                    <span>
                      ⚠️ <strong>Limite do Plano Atingido:</strong> Seu plano {usoPlano.plano.nome} já atingiu o limite de {usoPlano.limiteMaximo} anúncio(s) ativo(s). Você pode <strong>fazer o upgrade</strong> para publicar agora ou <strong>salvar como pausado</strong> e ativar posteriormente.
                    </span>
                  )}
                </div>
              )}

              {erro && <p className={styles.erro}>{erro}</p>}
            </div>
          )}


          {/* -- Navegação -- */}
          <div className={styles.navegacao}>
            {etapa > 1 ? (
              <button className={styles.btnVoltar2} onClick={voltar}>
                ← Voltar
              </button>
            ) : (
              <div />
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
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                {usoPlano.atingiuLimite ? (
                  <>
                    <button
                      type="button"
                      className="btn btn-outline"
                      onClick={() => salvar('pausado')}
                      disabled={salvando}
                      style={{ height: '38px', fontSize: '0.825rem', fontWeight: 600 }}
                    >
                      {salvando ? "Salvando..." : "⏸️ Salvar como Pausado"}
                    </button>
                    {!isCorretor && (
                      <button
                        type="button"
                        className="btn btn-primario"
                        onClick={() => setModalLimiteAberto(true)}
                        disabled={salvando}
                        style={{ height: '38px', fontSize: '0.825rem', fontWeight: 700 }}
                      >
                        🚀 Fazer Upgrade para Publicar
                      </button>
                    )}
                  </>
                ) : (
                  <button
                    type="button"
                    className={`${styles.btnPublicar} ${salvando ? styles.btnCarregando : ""}`}
                    onClick={() => salvar('publicado')}
                    disabled={salvando}
                    style={{ height: '38px', fontSize: '0.85rem' }}
                  >
                    {salvando ? "Publicando..." : "🏡 Publicar imóvel"}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Modal Limite Atingido */}
      <ModalLimiteAtingido
        aberto={modalLimiteAberto}
        onFechar={() => setModalLimiteAberto(false)}
        planoAtual={usoPlano.plano}
        proximoPlano={proximoPlano}
        imoveisAtivos={usoPlano.imoveisAtivos}
        onFazerUpgrade={() => setModalUpgradeAberto(true)}
        acaoTentada="novo_imovel"
      />

      {/* Modal Upgrade */}
      <ModalUpgradePlano
        aberto={modalUpgradeAberto}
        onFechar={() => setModalUpgradeAberto(false)}
        planoAtual={usoPlano.plano}
        planoSugerido={proximoPlano}
        imoveisAtivos={usoPlano.imoveisAtivos}
        onConfirmarPlano={handleAtualizarAssinatura}
      />
    </div>
  )
}

