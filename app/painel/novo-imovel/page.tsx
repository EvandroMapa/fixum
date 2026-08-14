"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
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
  { valor: "apartamento", icone: "??", label: "Apartamento" },
  { valor: "casa", icone: "??", label: "Casa" },
  { valor: "terreno", icone: "??", label: "Terreno" },
  { valor: "comercial", icone: "??", label: "Comercial" },
  { valor: "rural", icone: "??", label: "Rural" },
  { valor: "cobertura", icone: "???", label: "Cobertura" },
]

export default function NovoImovelPage() {
  const router = useRouter()
  const supabase = createClient()

  const [buscandoCep, setBuscandoCep] = useState(false)

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
    if (!arquivos) return
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

  async function salvar() {
    setSalvando(true)
    setErro("")
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Não autenticado")

      // Inserir imóvel
      const { data: imovel, error: erroImovel } = await supabase
        .from("imoveis")
        .insert({
          anunciante_id: user.id,
          tipo: dados.tipo,
          negociacao: dados.negociacao,
          titulo: dados.titulo,
          descricao: dados.descricao,
          preco: parseFloat(dados.preco.replace(/\D/g, "")) || 0,
          area: parseFloat(dados.area) || null,
          quartos: parseInt(dados.quartos) || null,
          banheiros: parseInt(dados.banheiros) || null,
          vagas: parseInt(dados.vagas) || null,
          endereco: dados.endereco,
          cidade: dados.cidade,
          estado: dados.estado,
          cep: dados.cep,
          latitude: parseFloat(dados.latitude) || null,
          longitude: parseFloat(dados.longitude) || null,
          condominio: parseFloat(dados.condominio) || null,
          iptu: parseFloat(dados.iptu) || null,
          aceita_pets: dados.aceita_pets,
          mobiliado: dados.mobiliado,
          status: "publicado",
        })
        .select()
        .single()

      if (erroImovel) throw erroImovel

      // Upload das fotos
      if (fotos.length > 0) {
        for (let i = 0; i < fotos.length; i++) {
          const foto = fotos[i]
          const ext = foto.arquivo.name.split(".").pop()
          const caminho = `${user.id}/${imovel.id}/${Date.now()}-${i}.${ext}`

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
        }
      }

      router.push("/painel?novo=1")
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : "Erro ao salvar imóvel")
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
        <Link href="/painel" className={styles.btnVoltar}>
          ? Painel
        </Link>
        <h1 className={styles.headerTitulo}>Novo Imóvel</h1>
        <div />
      </header>

      {/* Progress */}
      <div className={styles.progresso}>
        {ETAPAS.map((e) => (
          <div key={e.numero} className={`${styles.etapaItem} ${etapa >= e.numero ? styles.etapaAtiva : ""} ${etapa > e.numero ? styles.etapaConcluida : ""}`}>
            <div className={styles.etapaBolha}>
              {etapa > e.numero ? "?" : e.numero}
            </div>
            <span className={styles.etapaLabel}>{e.label}</span>
          </div>
        ))}
      </div>

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
                    className={`${styles.tipoCard} ${dados.tipo === t.valor ? styles.tipoSelecionado : ""}`}
                    onClick={() => atualizar("tipo", t.valor)}
                  >
                    <span className={styles.tipoIcone}>{t.icone}</span>
                    <span className={styles.tipoLabel}>{t.label}</span>
                  </button>
                ))}
              </div>

              <div className={styles.grupo}>
                <label className={styles.label}>Negociação</label>
                <div className={styles.btnGroup}>
                  {["venda", "aluguel", "temporada"].map((neg) => (
                    <button
                      key={neg}
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
              <h2 className={styles.etapaTitulo}>Dados do imóvel</h2>
              <p className={styles.etapaSubtitulo}>Informações principais e localização</p>

              <div className={styles.grupo}>
                <label className={styles.label}>Título do anúncio *</label>
                <input
                  className={styles.input}
                  placeholder="Título do anúncio"
                  value={dados.titulo}
                  onChange={(e) => atualizar("titulo", e.target.value)}
                  maxLength={100}
                />
                <span className={styles.contador}>{dados.titulo.length}/100</span>
              </div>

              <div className={styles.grupo}>
                <label className={styles.label}>Preço *</label>
                <input
                  className={styles.input}
                  placeholder="Valor"
                  value={dados.preco}
                  onChange={(e) => atualizar("preco", formatarPreco(e.target.value))}
                />
              </div>

              {/* CEP com auto-preenchimento via ViaCEP */}
              <div className={styles.grupo}>
                <label className={styles.label}>CEP</label>
                <div style={{ position: "relative" }}>
                  <input
                    className={styles.input}
                    placeholder="00000-000"
                    value={dados.cep}
                    autoComplete="postal-code"
                    maxLength={9}
                    onChange={(e) => {
                      const v = e.target.value.replace(/\D/g, "").replace(/(\d{5})(\d)/, "$1-$2")
                      atualizar("cep", v)
                      buscarCep(v)
                    }}
                  />
                  {buscandoCep && (
                    <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: "#64748b" }}>
                      Buscando...
                    </span>
                  )}
                </div>
              </div>

              <div className={styles.grupo}>
                <label className={styles.label}>Logradouro</label>
                <input
                  className={styles.input}
                  placeholder="Rua, Avenida..."
                  value={dados.endereco}
                  autoComplete="street-address"
                  onChange={(e) => atualizar("endereco", e.target.value)}
                />
              </div>

              <div className={styles.linha2}>
                <div className={styles.grupo}>
                  <label className={styles.label}>Numero</label>
                  <input
                    className={styles.input}
                    placeholder="123"
                    value={dados.numero}
                    autoComplete="off"
                    onChange={(e) => atualizar("numero", e.target.value)}
                  />
                </div>
                <div className={styles.grupo}>
                  <label className={styles.label}>Complemento <span style={{fontWeight:400,color:"#94a3b8"}}>(opcional)</span></label>
                  <input
                    className={styles.input}
                    placeholder="Apto 42, Bloco B..."
                    value={dados.complemento}
                    autoComplete="off"
                    onChange={(e) => atualizar("complemento", e.target.value)}
                  />
                </div>
              </div>

              <div className={styles.linha2}>
                <div className={styles.grupo}>
                  <label className={styles.label}>Bairro</label>
                  <input
                    className={styles.input}
                    placeholder="Bairro"
                    value={dados.bairro}
                    autoComplete="off"
                    onChange={(e) => atualizar("bairro", e.target.value)}
                  />
                </div>
                <div className={styles.grupo}>
                  <label className={styles.label}>Cidade *</label>
                  <input
                    className={styles.input}
                    placeholder="Cidade"
                    value={dados.cidade}
                    autoComplete="address-level2"
                    onChange={(e) => atualizar("cidade", e.target.value)}
                  />
                </div>
              </div>

              <div className={styles.grupo}>
                <label className={styles.label}>Estado *</label>
                <select
                  className={styles.input}
                  value={dados.estado}
                  autoComplete="address-level1"
                  onChange={(e) => atualizar("estado", e.target.value)}
                >
                  <option value="">Selecione</option>
                  {["AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT","PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO"].map(uf => (
                    <option key={uf} value={uf}>{uf}</option>
                  ))}
                </select>
              </div>

              <div className={styles.grupo}>
                <label className={styles.label}>Descricao</label>
                <textarea
                  className={`${styles.input} ${styles.textarea}`}
                  placeholder="Descreva o imovel"
                  value={dados.descricao}
                  onChange={(e) => atualizar("descricao", e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          )}

          {/* -- Etapa 3: Detalhes -- */}
          {etapa === 3 && (
            <div className={styles.etapaConteudo}>
              <h2 className={styles.etapaTitulo}>Detalhes e características</h2>
              <p className={styles.etapaSubtitulo}>Quanto mais detalhes, mais fácil de encontrar</p>

              <div className={styles.linha3}>
                <div className={styles.grupo}>
                  <label className={styles.label}>Área (m²) *</label>
                  <input className={styles.input} type="number" placeholder="m²" value={dados.area} onChange={(e) => atualizar("area", e.target.value)} />
                </div>
                <div className={styles.grupo}>
                  <label className={styles.label}>Quartos</label>
                  <input className={styles.input} type="number" placeholder="Qtd" min="0" max="20" value={dados.quartos} onChange={(e) => atualizar("quartos", e.target.value)} />
                </div>
                <div className={styles.grupo}>
                  <label className={styles.label}>Banheiros</label>
                  <input className={styles.input} type="number" placeholder="Qtd" min="0" max="20" value={dados.banheiros} onChange={(e) => atualizar("banheiros", e.target.value)} />
                </div>
              </div>

              <div className={styles.linha3}>
                <div className={styles.grupo}>
                  <label className={styles.label}>Vagas</label>
                  <input className={styles.input} type="number" placeholder="Qtd" min="0" max="20" value={dados.vagas} onChange={(e) => atualizar("vagas", e.target.value)} />
                </div>
                <div className={styles.grupo}>
                  <label className={styles.label}>Condomínio (R$)</label>
                  <input className={styles.input} type="number" placeholder="R$" value={dados.condominio} onChange={(e) => atualizar("condominio", e.target.value)} />
                </div>
                <div className={styles.grupo}>
                  <label className={styles.label}>IPTU (R$/ano)</label>
                  <input className={styles.input} type="number" placeholder="R$/ano" value={dados.iptu} onChange={(e) => atualizar("iptu", e.target.value)} />
                </div>
              </div>

              <div className={styles.checkboxGrupo}>
                <label className={styles.checkboxItem}>
                  <input type="checkbox" checked={dados.aceita_pets} onChange={(e) => atualizar("aceita_pets", e.target.checked)} />
                  <span>?? Aceita pets</span>
                </label>
                <label className={styles.checkboxItem}>
                  <input type="checkbox" checked={dados.mobiliado} onChange={(e) => atualizar("mobiliado", e.target.checked)} />
                  <span>??? Mobiliado</span>
                </label>
              </div>
            </div>
          )}

          {/* Etapa 4: Fotos */}
          {etapa === 4 && (
            <div className={styles.etapaConteudo}>
              <h2 className={styles.etapaTitulo}>Fotos do imovel</h2>
              <p className={styles.etapaSubtitulo}>Clique em uma foto para defini-la como capa do anuncio</p>

              <div
                className={styles.dropzone}
                onClick={() => inputFotoRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault()
                  adicionarFotos(e.dataTransfer.files)
                }}
              >
                <span className={styles.dropzoneIcone}>??</span>
                <p>Clique ou arraste fotos aqui</p>
                <span className={styles.dropzoneHint}>JPG, PNG ou WEBP — Maximo 10MB cada</span>
                <input
                  ref={inputFotoRef}
                  type="file"
                  accept="image/*"
                  multiple
                  style={{ display: "none" }}
                  onChange={(e) => adicionarFotos(e.target.files)}
                />
              </div>

              {fotos.length > 0 && (
                <>
                  <p style={{ fontSize: 12, color: "#64748b", margin: "12px 0 8px" }}>
                    {fotos.length} foto{fotos.length !== 1 ? "s" : ""} adicionada{fotos.length !== 1 ? "s" : ""} — clique para definir a capa
                  </p>
                  <div className={styles.gridFotos}>
                    {fotos.map((foto, idx) => (
                      <div
                        key={idx}
                        className={`${styles.fotoItem} ${foto.principal ? styles.fotoPrincipal : ""}`}
                        onClick={() => definirPrincipal(idx)}
                        style={{ cursor: "pointer" }}
                        title={foto.principal ? "Foto de capa" : "Clique para definir como capa"}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={foto.preview} alt={`Foto ${idx + 1}`} className={styles.fotoPreview} />
                        {foto.principal && (
                          <span className={styles.fotoBadge}>? Capa</span>
                        )}
                        {!foto.principal && (
                          <div className={styles.fotoOverlay}>
                            <span>Definir capa</span>
                          </div>
                        )}
                        <button
                          className={styles.fotoBtnRemover}
                          onClick={(e) => { e.stopPropagation(); removerFoto(idx) }}
                          title="Remover"
                        >?</button>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Etapa 5: Revisao */}
          {etapa === 5 && (
            <div className={styles.etapaConteudo}>
              <h2 className={styles.etapaTitulo}>Revise e publique</h2>
              <p className={styles.etapaSubtitulo}>Confira os dados antes de publicar</p>

              {/* Preview das fotos */}
              {fotos.length > 0 && (
                <div className={styles.revisaoFotos}>
                  {fotos.map((foto, idx) => (
                    <div key={idx} className={`${styles.revisaoFotoItem} ${foto.principal ? styles.revisaoFotoCapa : ""}`}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={foto.preview} alt={`Foto ${idx + 1}`} />
                      {foto.principal && <span className={styles.revisaoFotoBadge}>Capa</span>}
                    </div>
                  ))}
                </div>
              )}

              <div className={styles.revisaoCard}>
                <div className={styles.revisaoLinha}>
                  <span>Tipo</span>
                  <strong>{dados.tipo} · {dados.negociacao}</strong>
                </div>
                <div className={styles.revisaoLinha}>
                  <span>Titulo</span>
                  <strong>{dados.titulo}</strong>
                </div>
                <div className={styles.revisaoLinha}>
                  <span>Preco</span>
                  <strong className={styles.revisaoPreco}>{dados.preco}</strong>
                </div>
                <div className={styles.revisaoLinha}>
                  <span>Localizacao</span>
                  <strong>{dados.cidade} - {dados.estado}</strong>
                </div>
                <div className={styles.revisaoLinha}>
                  <span>Area</span>
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

              {erro && <p className={styles.erro}>{erro}</p>}
            </div>
          )}


          {/* -- Navegação -- */}
          <div className={styles.navegacao}>
            {etapa > 1 ? (
              <button className={styles.btnVoltar2} onClick={voltar}>
                ? Voltar
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
                Avançar ?
              </button>
            ) : (
              <button
                className={`${styles.btnPublicar} ${salvando ? styles.btnCarregando : ""}`}
                onClick={salvar}
                disabled={salvando}
              >
                {salvando ? "Publicando..." : "?? Publicar imóvel"}
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

