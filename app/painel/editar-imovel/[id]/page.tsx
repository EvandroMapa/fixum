"use client"

import { useState, useRef, useEffect, use } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import styles from "./page.module.css"

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
  arquivo?: File
  preview: string
  principal: boolean
  url?: string
  id?: string
}

const TIPOS = [
  { valor: "apartamento", icone: "\uD83C\uDFE2", label: "Apartamento" },
  { valor: "casa", icone: "\uD83C\uDFE0", label: "Casa" },
  { valor: "terreno", icone: "\uD83C\uDF33", label: "Terreno" },
  { valor: "comercial", icone: "\uD83C\uDFEA", label: "Comercial" },
  { valor: "rural", icone: "\uD83C\uDF3E", label: "Rural" },
  { valor: "cobertura", icone: "\uD83C\uDFD9\uFE0F", label: "Cobertura" },
]

export default function EditarImovelPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const supabase = createClient()

  const [carregando, setCarregando] = useState(true)
  const [buscandoCep, setBuscandoCep] = useState(false)
  const inputFotoRef = useRef<HTMLInputElement>(null)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState("")
  const [sucesso, setSucesso] = useState(false)
  const [fotos, setFotos] = useState<FotoPreview[]>([])
  const [fotosRemovidas, setFotosRemovidas] = useState<string[]>([])
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

  async function buscarCep(cepRaw: string) {
    const cep = cepRaw.replace(/\D/g, "")
    if (cep.length !== 8) return
    setBuscandoCep(true)
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`)
      const data = await res.json()
      if (!data.erro) {
        setDados((prev) => ({
          ...prev,
          endereco: data.logradouro || prev.endereco,
          bairro: data.bairro || prev.bairro,
          cidade: data.localidade || prev.cidade,
          estado: data.uf || prev.estado,
        }))
        const query = encodeURIComponent(`${data.bairro || ""}, ${data.localidade}, ${data.uf}, Brasil`)
        const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
        const geo = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${query}.json?access_token=${token}&language=pt&limit=1&country=BR`
        )
        const geoData = await geo.json()
        if (geoData.features?.length > 0) {
          const [lng, lat] = geoData.features[0].center
          setDados((prev) => ({ ...prev, latitude: String(lat), longitude: String(lng) }))
        }
      }
    } catch {
      /* ignora erro de rede no cep */
    } finally {
      setBuscandoCep(false)
    }
  }

  useEffect(() => {
    async function carregar() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        router.push("/login")
        return
      }

      const { data: imovel, error } = await supabase
        .from("imoveis")
        .select("*, fotos_imovel(id, url, principal, ordem)")
        .eq("id", id)
        .single()

      if (!imovel || error) {
        router.push("/painel")
        return
      }

      setDados({
        tipo: imovel.tipo || "",
        negociacao: imovel.negociacao || "venda",
        titulo: imovel.titulo || "",
        descricao: imovel.descricao || "",
        preco: imovel.preco ? String(imovel.preco) : "",
        area: imovel.area ? String(imovel.area) : "",
        quartos: imovel.quartos ? String(imovel.quartos) : "",
        banheiros: imovel.banheiros ? String(imovel.banheiros) : "",
        vagas: imovel.vagas ? String(imovel.vagas) : "",
        endereco: imovel.endereco || "",
        bairro: imovel.bairro || "",
        numero: imovel.numero || "",
        complemento: imovel.complemento || "",
        cidade: imovel.cidade || "",
        estado: imovel.estado || "",
        cep: imovel.cep || "",
        latitude: imovel.latitude ? String(imovel.latitude) : "",
        longitude: imovel.longitude ? String(imovel.longitude) : "",
        condominio: imovel.condominio ? String(imovel.condominio) : "",
        iptu: imovel.iptu ? String(imovel.iptu) : "",
        aceita_pets: imovel.aceita_pets || false,
        mobiliado: imovel.mobiliado || false,
      })

      const fotosExistentes: FotoPreview[] = (imovel.fotos_imovel || [])
        .sort((a: { ordem: number }, b: { ordem: number }) => a.ordem - b.ordem)
        .map((f: { id: string; url: string; principal: boolean }) => ({
          preview: f.url,
          principal: f.principal,
          url: f.url,
          id: f.id,
        }))

      setFotos(fotosExistentes)
      setCarregando(false)
    }

    carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  function atualizar(campo: keyof DadosImovel, valor: string | boolean) {
    setDados((prev) => ({ ...prev, [campo]: valor }))
    setSucesso(false)
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
      const removida = prev[idx]
      if (removida.id) setFotosRemovidas((old) => [...old, removida.id!])
      const nova = prev.filter((_, i) => i !== idx)
      if (nova.length > 0 && !nova.some((f) => f.principal)) nova[0].principal = true
      return nova
    })
  }

  function definirPrincipal(idx: number) {
    setFotos((prev) => prev.map((f, i) => ({ ...f, principal: i === idx })))
  }

  async function salvar() {
    setSalvando(true)
    setErro("")
    setSucesso(false)

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error("Não autenticado")

      const { error: erroImovel } = await supabase
        .from("imoveis")
        .update({
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
          bairro: dados.bairro,
          cidade: dados.cidade,
          estado: dados.estado,
          cep: dados.cep,
          latitude: parseFloat(dados.latitude) || null,
          longitude: parseFloat(dados.longitude) || null,
          condominio: parseFloat(dados.condominio) || null,
          iptu: parseFloat(dados.iptu) || null,
          aceita_pets: dados.aceita_pets,
          mobiliado: dados.mobiliado,
        })
        .eq("id", id)

      if (erroImovel) throw erroImovel

      if (fotosRemovidas.length > 0) {
        await supabase.from("fotos_imovel").delete().in("id", fotosRemovidas)
      }

      for (const foto of fotos) {
        if (foto.id) {
          await supabase.from("fotos_imovel").update({ principal: foto.principal }).eq("id", foto.id)
        }
      }

      const fotosNovas = fotos.filter((f) => f.arquivo)
      for (let i = 0; i < fotosNovas.length; i++) {
        const foto = fotosNovas[i]
        const ext = foto.arquivo!.name.split(".").pop()
        const caminho = `${user.id}/${id}/${Date.now()}-${i}.${ext}`
        const { error: erroUpload } = await supabase.storage
          .from("fotos-imoveis")
          .upload(caminho, foto.arquivo!, { upsert: true })

        if (!erroUpload) {
          const { data: urlData } = supabase.storage.from("fotos-imoveis").getPublicUrl(caminho)
          await supabase.from("fotos_imovel").insert({
            imovel_id: id,
            url: urlData.publicUrl,
            principal: foto.principal,
            ordem: fotos.indexOf(foto),
          })
        }
      }

      setSucesso(true)
      setFotosRemovidas([])
      router.push("/painel")
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : "Erro ao salvar imóvel")
    } finally {
      setSalvando(false)
    }
  }

  if (carregando) {
    return (
      <div className={styles.pagina}>
        <div className={styles.container}>
          <p style={{ textAlign: "center", padding: "60px 0", color: "#64748b" }}>Carregando dados do imóvel...</p>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.pagina}>
      <header className={styles.header}>
        <Link href="/painel" className={styles.voltar}>
          {"\u2190"} Voltar
        </Link>
        <h1 className={styles.headerTitulo}>Editar Imóvel</h1>
        <div style={{ width: 60 }} />
      </header>

      <main className={styles.container}>
        {sucesso && (
          <div className={styles.alertaSucesso}>
            {"\u2705"} Imóvel atualizado com sucesso!
          </div>
        )}
        {erro && (
          <div className={styles.alertaErro}>
            {"\u274C"} {erro}
          </div>
        )}

        {/* SEÇÃO 1: Tipo e Negociação */}
        <section className={styles.secaoCard}>
          <h2 className={styles.secaoTitulo}>Tipo e Negociação</h2>
          <p className={styles.secaoSub}>Categoria e modalidade do imóvel</p>
          <div className={styles.gridTipos}>
            {TIPOS.map((t) => (
              <button
                key={t.valor}
                type="button"
                className={`${styles.tipoBtn} ${dados.tipo === t.valor ? styles.tipoBtnAtivo : ""}`}
                onClick={() => atualizar("tipo", t.valor)}
              >
                <span className={styles.tipoIcone}>{t.icone}</span>
                <span className={styles.tipoLabel}>{t.label}</span>
              </button>
            ))}
          </div>
          <div className={styles.negociacao}>
            <button
              type="button"
              className={`${styles.negBtn} ${dados.negociacao === "venda" ? styles.negBtnAtivo : ""}`}
              onClick={() => atualizar("negociacao", "venda")}
            >
              Venda
            </button>
            <button
              type="button"
              className={`${styles.negBtn} ${dados.negociacao === "aluguel" ? styles.negBtnAtivo : ""}`}
              onClick={() => atualizar("negociacao", "aluguel")}
            >
              Aluguel
            </button>
          </div>
        </section>

        {/* SEÇÃO 2: Informações Principais */}
        <section className={styles.secaoCard}>
          <h2 className={styles.secaoTitulo}>Informações do Anúncio</h2>
          <p className={styles.secaoSub}>Título, descrição e valores principais</p>
          <div className={styles.grupo}>
            <label className={styles.label}>Título do Anúncio</label>
            <input
              className={styles.input}
              value={dados.titulo}
              onChange={(e) => atualizar("titulo", e.target.value)}
              placeholder="Ex: Apartamento 3 quartos no Centro"
            />
          </div>
          <div className={styles.grupo}>
            <label className={styles.label}>Descrição</label>
            <textarea
              className={styles.textarea}
              value={dados.descricao}
              rows={4}
              onChange={(e) => atualizar("descricao", e.target.value)}
              placeholder="Descreva detalhes, acabamento, pontos de interesse..."
            />
          </div>
          <div className={styles.linha2}>
            <div className={styles.grupo}>
              <label className={styles.label}>Preço (R$)</label>
              <input
                className={styles.input}
                value={dados.preco}
                onChange={(e) => atualizar("preco", e.target.value)}
                placeholder="450000"
              />
            </div>
            <div className={styles.grupo}>
              <label className={styles.label}>Área (m²)</label>
              <input
                className={styles.input}
                type="number"
                value={dados.area}
                onChange={(e) => atualizar("area", e.target.value)}
                placeholder="120"
              />
            </div>
          </div>
        </section>

        {/* SEÇÃO 3: Localização */}
        <section className={styles.secaoCard}>
          <h2 className={styles.secaoTitulo}>Localização</h2>
          <p className={styles.secaoSub}>Endereço e dados geográficos</p>
          <div className={styles.grupo}>
            <label className={styles.label}>CEP</label>
            <input
              className={`${styles.input} ${buscandoCep ? styles.inputCarregando : ""}`}
              value={dados.cep}
              onChange={(e) => {
                atualizar("cep", e.target.value)
                if (e.target.value.replace(/\D/g, "").length === 8) buscarCep(e.target.value)
              }}
              placeholder="36300-000"
              maxLength={9}
            />
          </div>
          <div className={styles.linha2}>
            <div className={styles.grupo}>
              <label className={styles.label}>Cidade</label>
              <input
                className={styles.input}
                value={dados.cidade}
                onChange={(e) => atualizar("cidade", e.target.value)}
              />
            </div>
            <div className={styles.grupo}>
              <label className={styles.label}>Estado (UF)</label>
              <input
                className={styles.input}
                value={dados.estado}
                onChange={(e) => atualizar("estado", e.target.value)}
                maxLength={2}
              />
            </div>
          </div>
          <div className={styles.grupo}>
            <label className={styles.label}>Bairro</label>
            <input
              className={styles.input}
              value={dados.bairro}
              onChange={(e) => atualizar("bairro", e.target.value)}
            />
          </div>
          <div className={styles.linha2}>
            <div className={styles.grupo}>
              <label className={styles.label}>Endereço</label>
              <input
                className={styles.input}
                value={dados.endereco}
                onChange={(e) => atualizar("endereco", e.target.value)}
              />
            </div>
            <div className={styles.grupo}>
              <label className={styles.label}>Número</label>
              <input
                className={styles.input}
                value={dados.numero}
                onChange={(e) => atualizar("numero", e.target.value)}
              />
            </div>
          </div>
        </section>

        {/* SEÇÃO 4: Características e Custos */}
        <section className={styles.secaoCard}>
          <h2 className={styles.secaoTitulo}>Características & Detalhes</h2>
          <p className={styles.secaoSub}>Quartos, banheiros, vagas e custos adicionais</p>
          <div className={styles.linha3}>
            <div className={styles.grupo}>
              <label className={styles.label}>Quartos</label>
              <input
                className={styles.input}
                type="number"
                min="0"
                value={dados.quartos}
                onChange={(e) => atualizar("quartos", e.target.value)}
              />
            </div>
            <div className={styles.grupo}>
              <label className={styles.label}>Banheiros</label>
              <input
                className={styles.input}
                type="number"
                min="0"
                value={dados.banheiros}
                onChange={(e) => atualizar("banheiros", e.target.value)}
              />
            </div>
            <div className={styles.grupo}>
              <label className={styles.label}>Vagas</label>
              <input
                className={styles.input}
                type="number"
                min="0"
                value={dados.vagas}
                onChange={(e) => atualizar("vagas", e.target.value)}
              />
            </div>
          </div>
          <div className={styles.linha2}>
            <div className={styles.grupo}>
              <label className={styles.label}>Condomínio (R$)</label>
              <input
                className={styles.input}
                type="number"
                value={dados.condominio}
                onChange={(e) => atualizar("condominio", e.target.value)}
              />
            </div>
            <div className={styles.grupo}>
              <label className={styles.label}>IPTU (R$/ano)</label>
              <input
                className={styles.input}
                type="number"
                value={dados.iptu}
                onChange={(e) => atualizar("iptu", e.target.value)}
              />
            </div>
          </div>
          <div className={styles.checkboxGrupo}>
            <label className={styles.checkboxItem}>
              <input
                type="checkbox"
                checked={dados.aceita_pets}
                onChange={(e) => atualizar("aceita_pets", e.target.checked)}
              />
              <span>{"\uD83D\uDC3E"} Aceita pets</span>
            </label>
            <label className={styles.checkboxItem}>
              <input
                type="checkbox"
                checked={dados.mobiliado}
                onChange={(e) => atualizar("mobiliado", e.target.checked)}
              />
              <span>{"\uD83D\uDECB\uFE0F"} Mobiliado</span>
            </label>
          </div>
        </section>

        {/* SEÇÃO 5: Fotos */}
        <section className={styles.secaoCard}>
          <h2 className={styles.secaoTitulo}>Galeria de Fotos</h2>
          <p className={styles.secaoSub}>Adicione fotos e clique em uma para definir como Capa</p>
          <div
            className={styles.dropzone}
            onClick={() => inputFotoRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault()
              adicionarFotos(e.dataTransfer.files)
            }}
          >
            <span className={styles.dropzoneIcone}>{"\uD83D\uDCF7"}</span>
            <p>Clique ou arraste fotos aqui</p>
            <span className={styles.dropzoneHint}>JPG, PNG ou WEBP — Máximo 10MB cada</span>
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
            <div className={styles.gridFotos}>
              {fotos.map((foto, idx) => (
                <div
                  key={idx}
                  className={`${styles.fotoItem} ${foto.principal ? styles.fotoPrincipal : ""}`}
                  onClick={() => definirPrincipal(idx)}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={foto.preview} alt={`Foto ${idx + 1}`} className={styles.fotoPreview} />
                  {foto.principal && <span className={styles.fotoBadge}>{"\u2B50"} Capa</span>}
                  {!foto.principal && (
                    <div className={styles.fotoOverlay}>
                      <span>Definir capa</span>
                    </div>
                  )}
                  <button
                    type="button"
                    className={styles.fotoBtnRemover}
                    onClick={(e) => {
                      e.stopPropagation()
                      removerFoto(idx)
                    }}
                    title="Remover"
                  >
                    {"\u2715"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Barra Fixa Inferior */}
      <footer className={styles.barraInferior}>
        <div className={styles.barraConteudo}>
          <Link href="/painel" className={styles.btnCancelar}>
            Cancelar
          </Link>
          <button
            type="button"
            className={styles.btnSalvar}
            onClick={salvar}
            disabled={salvando}
          >
            {salvando ? "Salvando..." : "\u2705 Salvar Alterações"}
          </button>
        </div>
      </footer>
    </div>
  )
}
