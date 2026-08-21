"use client"

import { useState, useRef, useEffect, use } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import LinhaTempoRevisao from "@/components/painel/LinhaTempoRevisao"
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
  { valor: "apartamento", icone: "🏢", label: "Apartamento" },
  { valor: "casa", icone: "🏠", label: "Casa" },
  { valor: "sobrado", icone: "🏡", label: "Sobrado" },
  { valor: "casa_condominio", icone: "🏘️", label: "Casa em Condomínio" },
  { valor: "cobertura", icone: "🌇", label: "Cobertura" },
  { valor: "kitnet", icone: "🛏️", label: "Kitnet / Studio" },
  { valor: "flat", icone: "🏨", label: "Flat" },
  { valor: "lote", icone: "📐", label: "Lote" },
  { valor: "comercial", icone: "📁", label: "Sala Comercial" },
  { valor: "loja", icone: "🏪", label: "Loja / Ponto" },
  { valor: "galpao", icone: "🏭", label: "Galpão" },
  { valor: "predio_comercial", icone: "🏬", label: "Prédio Comercial" },
  { valor: "garagem", icone: "🚗", label: "Garagem" },
  { valor: "terreno_comercial", icone: "🏗️", label: "Terreno" },
  { valor: "sitio", icone: "🌿", label: "Sítio" },
  { valor: "chacara", icone: "🌳", label: "Chácara" },
  { valor: "fazenda", icone: "🌾", label: "Fazenda" },
  { valor: "rancho", icone: "🐄", label: "Rancho" },
  { valor: "outro", icone: "🏷️", label: "Outro" },
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

export default function EditarImovelPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const supabase = createClient()

  const [carregando, setCarregando] = useState(true)
  const [buscandoCep, setBuscandoCep] = useState(false)
  const inputFotoRef = useRef<HTMLInputElement>(null)
  const [salvando, setSalvando] = useState(false)
  const [reenviando, setReenviando] = useState(false)
  const [erro, setErro] = useState("")
  const [sucesso, setSucesso] = useState(false)
  const [imovelCompleto, setImovelCompleto] = useState<any>(null)
  const [usuarioLogado, setUsuarioLogado] = useState<any>(null)
  const [modalReenvioAberto, setModalReenvioAberto] = useState(false)
  const [recadoReenvio, setRecadoReenvio] = useState("")
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

      try {
        setUsuarioLogado(user)

        const { data: imovel, error } = await supabase
          .from("imoveis")
          .select("*, fotos_imovel(id, url, principal, ordem)")
          .eq("id", id)
          .maybeSingle()

        if (error || !imovel) {
          // Fallback buscando dados e fotos separadamente
          const { data: imovelSimples } = await supabase
            .from("imoveis")
            .select("*")
            .eq("id", id)
            .maybeSingle()

          if (!imovelSimples) {
            setErro("Imóvel não encontrado ou você não tem permissão para editá-lo.")
            setCarregando(false)
            return
          }

          const { data: fotosData } = await supabase
            .from("fotos_imovel")
            .select("id, url, principal, ordem")
            .eq("imovel_id", id)
            .order("ordem", { ascending: true })

          imovelSimples.fotos_imovel = fotosData || []
          setImovelCompleto(imovelSimples)
          preencherDados(imovelSimples)
          return
        }

        setImovelCompleto(imovel)
        preencherDados(imovel)
      } catch (err: any) {
        console.error("Erro ao carregar imóvel:", err)
        setErro("Não foi possível carregar os dados do imóvel.")
      } finally {
        setCarregando(false)
      }
    }

    function preencherDados(imovel: any) {
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
  }, [id, router, supabase])

  function atualizar(campo: keyof DadosImovel, valor: string | boolean) {
    setDados((prev) => ({ ...prev, [campo]: valor }))
    setSucesso(false)
  }

  function adicionarFotos(arquivos: FileList | null) {
    if (!arquivos || arquivos.length === 0) return
    const novas: FotoPreview[] = Array.from(arquivos).map((arquivo, i) => ({
      arquivo,
      preview: URL.createObjectURL(arquivo),
      principal: fotos.length === 0 && i === 0,
    }))
    setFotos((prev) => [...prev, ...novas])
    setSucesso(false)
  }

  function removerFoto(idx: number) {
    setFotos((prev) => {
      const removida = prev[idx]
      if (removida.id) setFotosRemovidas((old) => [...old, removida.id!])
      const nova = prev.filter((_, i) => i !== idx)
      if (nova.length > 0 && !nova.some((f) => f.principal)) nova[0].principal = true
      return nova
    })
    setSucesso(false)
  }

  function definirPrincipal(idx: number) {
    setFotos((prev) => prev.map((f, i) => ({ ...f, principal: i === idx })))
    setSucesso(false)
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

  async function salvar() {
    setSalvando(true)
    setErro("")
    setSucesso(false)

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error("Não autenticado")

      const precoNum = parseFloat(dados.preco.replace(/\D/g, "")) || 0
      const areaNum = parseFloat(dados.area.replace(",", ".")) || null

      const { error: erroImovel } = await supabase
        .from("imoveis")
        .update({
          tipo: normalizarTipoParaBanco(dados.tipo),
          negociacao: dados.negociacao,
          titulo: dados.titulo,
          descricao: dados.descricao || null,
          preco: precoNum,
          area: areaNum,
          quartos: parseInt(dados.quartos) || null,
          banheiros: parseInt(dados.banheiros) || null,
          vagas: parseInt(dados.vagas) || null,
          endereco: dados.endereco || "",
          bairro: dados.bairro || null,
          cidade: dados.cidade,
          estado: dados.estado || null,
          cep: dados.cep || null,
          latitude: parseFloat(dados.latitude) || 0,
          longitude: parseFloat(dados.longitude) || 0,
          condominio: parseFloat(dados.condominio) || null,
          iptu: parseFloat(dados.iptu) || null,
          aceita_pets: !!dados.aceita_pets,
          mobiliado: !!dados.mobiliado,
        })
        .eq("id", id)

      if (erroImovel) throw erroImovel

      // 1. Deletar fotos removidas
      if (fotosRemovidas.length > 0) {
        await supabase.from("fotos_imovel").delete().in("id", fotosRemovidas)
      }

      // 2. Atualizar capa das fotos existentes
      for (const foto of fotos) {
        if (foto.id) {
          await supabase.from("fotos_imovel").update({ principal: foto.principal }).eq("id", foto.id)
        }
      }

      // 3. Upload das novas fotos
      const fotosNovas = fotos.filter((f) => f.arquivo)
      for (let i = 0; i < fotosNovas.length; i++) {
        const foto = fotosNovas[i]
        const ext = foto.arquivo!.name.split(".").pop() || "jpg"
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
    } catch (e: unknown) {
      console.error("Erro ao salvar edição:", e)
      setErro(e instanceof Error ? e.message : "Erro ao salvar alterações do imóvel.")
    } finally {
      setSalvando(false)
    }
  }

  async function handleSalvarEReenviar() {
    setReenviando(true)
    setErro("")
    setSucesso(false)

    try {
      // 1. Salva os dados normais
      await salvar()

      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error("Não autenticado")

      const imobiliariaId = user.user_metadata?.imobiliaria_id || imovelCompleto?.anunciante_id

      // 2. Grava evento de resposta no histórico de moderação e notifica gestor
      await fetch('/api/painel/imoveis/revisar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imovelId: id,
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

      setSucesso(true)
      setModalReenvioAberto(false)
      setTimeout(() => {
        router.push("/painel?aba=imoveis")
      }, 1500)
    } catch (e: unknown) {
      console.error("Erro ao reenviar para revisão:", e)
      setErro(e instanceof Error ? e.message : "Erro ao reenviar para revisão.")
    } finally {
      setReenviando(false)
    }
  }

  if (carregando) {
    return (
      <div className={styles.pagina}>
        <div style={{ textAlign: "center", padding: "4rem", color: "#64748b" }}>
          <p>Carregando dados do imóvel...</p>
        </div>
      </div>
    )
  }

  const temAjustesPendentes = !!imovelCompleto?.descricao_motivo_rejeicao

  return (
    <div className={styles.pagina}>
      <header className={styles.header}>
        <Link href="/painel?aba=imoveis" className={styles.btnVoltar}>
          ← Painel
        </Link>
        <h1 className={styles.headerTitulo}>Editar Imóvel</h1>
        <div />
      </header>

      <main className={styles.main}>
        <div className={styles.card}>
          <div className={styles.etapaConteudo}>
            {/* ── BANNER DE MODERAÇÃO E AJUSTES SOLICITADOS PELO GESTOR ── */}
            {temAjustesPendentes && (
              <div style={{
                background: '#fffbeb',
                border: '1.5px solid #fde68a',
                borderRadius: '0.75rem',
                padding: '1.25rem',
                marginBottom: '1.5rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.85rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#92400e', fontWeight: 800, fontSize: '0.95rem' }}>
                  <span>⚠️</span>
                  <span>Ajustes Solicitados pela Gestão da Imobiliária</span>
                </div>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#78350f', lineHeight: 1.5 }}>
                  O gestor solicitou correções neste anúncio. Faça as alterações necessárias no formulário abaixo e, ao terminar, clique em <strong>"Reenviar para Revisão"</strong>.
                </p>
                <LinhaTempoRevisao
                  imovelId={id}
                  motivoRejeicaoAtual={imovelCompleto?.descricao_motivo_rejeicao}
                />
              </div>
            )}

            {sucesso && (
              <div style={{
                background: "#ecfdf5",
                border: "1px solid #a7f3d0",
                color: "#065f46",
                padding: "0.75rem 1rem",
                borderRadius: "0.5rem",
                marginBottom: "1rem",
                fontSize: "0.85rem",
                fontWeight: 600,
              }}>
                ✅ {reenviando || modalReenvioAberto ? "Imóvel reenviado para a revisão do gestor com sucesso!" : "Imóvel atualizado com sucesso!"}
              </div>
            )}

            {erro && (
              <div style={{
                background: "#fef2f2",
                border: "1px solid #fee2e2",
                color: "#991b1b",
                padding: "0.75rem 1rem",
                borderRadius: "0.5rem",
                marginBottom: "1rem",
                fontSize: "0.85rem",
              }}>
                ⚠️ {erro}
              </div>
            )}

            {/* Tipo */}
            <div className={styles.grupo}>
              <label className={styles.label}>Tipo de Imóvel</label>
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
            </div>

            {/* Negociação */}
            <div className={styles.grupo} style={{ marginTop: "0.5rem" }}>
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

            {/* Título */}
            <div className={styles.grupo} style={{ marginTop: "0.75rem" }}>
              <label className={styles.label}>Título do anúncio *</label>
              <input
                className={styles.input}
                value={dados.titulo}
                onChange={(e) => atualizar("titulo", e.target.value)}
              />
            </div>

            {/* Preço */}
            <div className={styles.grupo}>
              <label className={styles.label}>Preço (R$) *</label>
              <input
                className={styles.input}
                value={formatarPreco(dados.preco)}
                onChange={(e) => atualizar("preco", e.target.value)}
              />
            </div>

            {/* CEP */}
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
                  name="imovel_d_cep"
                  autoComplete="one-time-code"
                  data-lpignore="true"
                  data-form-type="other"
                />
                {buscandoCep && <span style={{ alignSelf: "center", fontSize: "0.8rem", color: "#64748b" }}>Buscando...</span>}
              </div>
            </div>

            {/* Cidade e Estado */}
            <div className={styles.grid2}>
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

            {/* Bairro e Endereço */}
            <div className={styles.grid2}>
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
            </div>

            {/* Área, Quartos, Banheiros, Vagas */}
            <div className={styles.grid2}>
              <div className={styles.grupo}>
                <label className={styles.label}>Área total (m²)</label>
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
                <label className={styles.label}>Vagas</label>
                <input
                  type="number"
                  className={styles.input}
                  value={dados.vagas}
                  onChange={(e) => atualizar("vagas", e.target.value)}
                />
              </div>
            </div>

            {/* Descrição */}
            <div className={styles.grupo}>
              <label className={styles.label}>Descrição</label>
              <textarea
                className={styles.textarea}
                rows={3}
                value={dados.descricao}
                onChange={(e) => atualizar("descricao", e.target.value)}
              />
            </div>

            {/* Galeria de Fotos */}
            <div style={{ marginTop: "1rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                <label className={styles.label}>Galeria de Fotos ({fotos.length})</label>
                <button
                  type="button"
                  onClick={() => inputFotoRef.current?.click()}
                  style={{ background: "none", border: "none", color: "#2563eb", fontSize: "0.8rem", fontWeight: 600, cursor: "pointer" }}
                >
                  + Adicionar fotos
                </button>
              </div>

              <input
                ref={inputFotoRef}
                type="file"
                multiple
                accept="image/png, image/jpeg, image/webp"
                style={{ display: "none" }}
                onChange={(e) => adicionarFotos(e.target.files)}
              />

              {fotos.length > 0 && (
                <div className={styles.gridFotosPro}>
                  {fotos.map((foto, idx) => (
                    <div
                      key={idx}
                      className={`${styles.fotoCardPro} ${foto.principal ? styles.fotoCardCapa : ""}`}
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
                          Tornar Capa
                        </button>
                      )}

                      <button
                        type="button"
                        className={styles.btnRemoverFoto}
                        onClick={(e) => {
                          e.stopPropagation()
                          removerFoto(idx)
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Botões Salvar / Reenviar */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginTop: "1.5rem", paddingTop: "1rem", borderTop: "1px solid #e2e8f0" }}>
              {modalReenvioAberto && (
                <div style={{
                  background: '#f8fafc',
                  border: '1.5px solid #cbd5e1',
                  borderRadius: '0.75rem',
                  padding: '1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                  animation: 'fadeIn 0.2s ease'
                }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1e293b' }}>
                    💬 Descreva brevemente as correções feitas (opcional):
                  </span>
                  <textarea
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.75rem',
                      borderRadius: '0.5rem',
                      border: '1px solid #cbd5e1',
                      fontSize: '0.85rem',
                      fontFamily: 'inherit',
                      resize: 'vertical',
                      minHeight: '65px'
                    }}
                    placeholder="Ex: Fotos da fachada adicionadas e valor do condomínio corrigido..."
                    value={recadoReenvio}
                    onChange={(e) => setRecadoReenvio(e.target.value)}
                    autoFocus
                  />
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", flexWrap: "wrap" }}>
                <Link href="/painel?aba=imoveis" className="btn btn-outline" style={{ height: "38px", fontSize: "0.85rem" }}>
                  Voltar
                </Link>

                <button
                  type="button"
                  className={`btn btn-outline ${salvando ? styles.btnCarregando : ""}`}
                  onClick={salvar}
                  disabled={salvando || reenviando}
                  style={{ height: "38px", fontSize: "0.85rem", fontWeight: 600 }}
                >
                  {salvando ? "Salvando..." : "💾 Salvar Rascunho"}
                </button>

                {!modalReenvioAberto ? (
                  <button
                    type="button"
                    className="btn btn-primario"
                    onClick={() => setModalReenvioAberto(true)}
                    disabled={salvando || reenviando}
                    style={{ height: "38px", fontSize: "0.85rem", fontWeight: 700, background: '#059669', borderColor: '#059669' }}
                  >
                    📤 Reenviar para Revisão do Gestor
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn-primario"
                    onClick={handleSalvarEReenviar}
                    disabled={salvando || reenviando}
                    style={{ height: "38px", fontSize: "0.85rem", fontWeight: 700, background: '#059669', borderColor: '#059669' }}
                  >
                    {reenviando ? "Reenviando..." : "✅ Confirmar e Notificar Gestor"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
