"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import styles from "./page.module.css"

interface Foto { id: string; url: string; principal: boolean; ordem: number }
interface Perfil { nome: string; telefone: string | null; email: string }
interface Imovel {
  id: string
  titulo: string
  descricao: string | null
  tipo: string
  negociacao: string
  preco: number
  area: number | null
  quartos: number | null
  banheiros: number | null
  vagas: number | null
  condominio: number | null
  iptu: number | null
  endereco: string | null
  bairro: string | null
  cidade: string
  estado: string
  cep: string | null
  aceita_pets: boolean
  mobiliado: boolean
  status: string
  anunciante_id: string
  fotos_imovel: Foto[]
  perfis: Perfil | null
}

function formatarPreco(valor: number, negociacao: string) {
  const fmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 }).format(valor)
  return negociacao === "aluguel" ? `${fmt}/mes` : fmt
}

const ICONES: Record<string, string> = {
  casa: "🏠", apartamento: "🏢", terreno: "🌱", comercial: "🏪", rural: "🌾", cobertura: "👑"
}

export default function ImovelPage() {
  const params = useParams()
  const router = useRouter()
  const id = params?.id as string

  const [imovel, setImovel] = useState<Imovel | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [fotoAtiva, setFotoAtiva] = useState(0)
  const [galeria, setGaleria] = useState(false)

  // Lead form
  const [nome, setNome] = useState("")
  const [email, setEmail] = useState("")
  const [telefone, setTelefone] = useState("")
  const [mensagem, setMensagem] = useState("Olá, tenho interesse neste imóvel. Poderia me dar mais informações?")
  const [enviando, setEnviando] = useState(false)
  const [leadEnviado, setLeadEnviado] = useState(false)
  const [leadErro, setLeadErro] = useState("")

  const supabase = createClient()

  useEffect(() => {
    async function carregar() {
      const { data } = await supabase
        .from("imoveis")
        .select("*, fotos_imovel(id, url, principal, ordem), perfis(nome, telefone, email)")
        .eq("id", id)
        .in("status", ["publicado", "ativo"])
        .single()

      if (!data) { router.push("/explorar"); return }
      const fotos = [...(data.fotos_imovel || [])].sort((a: Foto, b: Foto) => {
        if (a.principal) return -1
        if (b.principal) return 1
        return a.ordem - b.ordem
      })
      setImovel({ ...data, fotos_imovel: fotos })
      setCarregando(false)
    }
    if (id) carregar()
  }, [id, router, supabase])

  async function enviarLead(e: React.FormEvent) {
    e.preventDefault()
    if (!imovel) return
    setLeadErro("")
    setEnviando(true)
    try {
      const { error } = await supabase.from("leads").insert({
        imovel_id: imovel.id,
        nome,
        email,
        telefone: telefone || null,
        mensagem,
      })
      if (error) throw error
      setLeadEnviado(true)
    } catch {
      setLeadErro("Erro ao enviar. Tente novamente.")
    } finally {
      setEnviando(false)
    }
  }

  if (carregando) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner} />
        <p>Carregando imovel...</p>
      </div>
    )
  }

  if (!imovel) return null

  const fotos = imovel.fotos_imovel
  const fotoAtual = fotos[fotoAtiva]

  return (
    <div className={styles.pagina}>

      {/* Navbar */}
      <nav className={styles.nav}>
        <Link href="/" className={styles.logo}>🏠 FIXUM</Link>
        <div className={styles.navAcoes}>
          <Link href="/explorar" className={styles.btnVoltar}>← Voltar</Link>
        </div>
      </nav>

      {/* Galeria de fotos */}
      {fotos.length > 0 ? (
        <div className={styles.galeria}>
          <div className={styles.fotoMain} onClick={() => setGaleria(true)}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={fotoAtual?.url} alt={imovel.titulo} className={styles.fotoMainImg} />
            <div className={styles.fotoMainOverlay}>
              <span>🔍 Ver todas as fotos ({fotos.length})</span>
            </div>
          </div>
          {fotos.length > 1 && (
            <div className={styles.fotoThumbs}>
              {fotos.slice(0, 5).map((f, idx) => (
                <div
                  key={f.id}
                  className={`${styles.thumb} ${fotoAtiva === idx ? styles.thumbAtiva : ""}`}
                  onClick={() => setFotoAtiva(idx)}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={f.url} alt={`Foto ${idx + 1}`} />
                  {idx === 4 && fotos.length > 5 && (
                    <div className={styles.thumbMais} onClick={() => setGaleria(true)}>
                      +{fotos.length - 5}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className={styles.semFoto}>
          <span>🏠</span>
          <p>Sem fotos disponíveis</p>
        </div>
      )}

      {/* Modal galeria */}
      {galeria && (
        <div className={styles.modalGaleria} onClick={() => setGaleria(false)}>
          <button className={styles.modalFechar} onClick={() => setGaleria(false)}>✕</button>
          <button className={styles.modalPrev} onClick={(e) => { e.stopPropagation(); setFotoAtiva(p => Math.max(0, p-1)) }}>‹</button>
          <div className={styles.modalFoto} onClick={e => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={fotoAtual?.url} alt={imovel.titulo} />
            <p className={styles.modalContador}>{fotoAtiva + 1} / {fotos.length}</p>
          </div>
          <button className={styles.modalNext} onClick={(e) => { e.stopPropagation(); setFotoAtiva(p => Math.min(fotos.length-1, p+1)) }}>›</button>
        </div>
      )}

      {/* Conteudo principal */}
      <div className={styles.conteudo}>

        {/* Coluna esquerda: detalhes */}
        <div className={styles.detalhes}>

          {/* Header */}
          <div className={styles.header}>
            <div className={styles.badges}>
              <span className={styles.badge}>{ICONES[imovel.tipo] || "🏠"} {imovel.tipo}</span>
              <span className={`${styles.badge} ${styles.badgeNeg}`}>{imovel.negociacao}</span>
            </div>
            <h1 className={styles.titulo}>{imovel.titulo}</h1>
            <p className={styles.localizacao}>
              📍 {[imovel.bairro, imovel.cidade, imovel.estado].filter(Boolean).join(", ")}
            </p>
            <div className={styles.preco}>{formatarPreco(imovel.preco, imovel.negociacao)}</div>
          </div>

          {/* Caracteristicas */}
          <div className={styles.caractGrid}>
            {imovel.area && (
              <div className={styles.caract}><span className={styles.caractIcone}>📐</span><strong>{imovel.area}m²</strong><span>Area</span></div>
            )}
            {imovel.quartos !== null && imovel.quartos > 0 && (
              <div className={styles.caract}><span className={styles.caractIcone}>🛏️</span><strong>{imovel.quartos}</strong><span>Quarto{imovel.quartos !== 1 ? "s" : ""}</span></div>
            )}
            {imovel.banheiros !== null && imovel.banheiros > 0 && (
              <div className={styles.caract}><span className={styles.caractIcone}>🚿</span><strong>{imovel.banheiros}</strong><span>Banheiro{imovel.banheiros !== 1 ? "s" : ""}</span></div>
            )}
            {imovel.vagas !== null && imovel.vagas > 0 && (
              <div className={styles.caract}><span className={styles.caractIcone}>🚗</span><strong>{imovel.vagas}</strong><span>Vaga{imovel.vagas !== 1 ? "s" : ""}</span></div>
            )}
          </div>

          {/* Tags */}
          <div className={styles.tags}>
            {imovel.aceita_pets && <span className={styles.tag}>🐾 Aceita pets</span>}
            {imovel.mobiliado && <span className={styles.tag}>🛋️ Mobiliado</span>}
            {imovel.condominio && <span className={styles.tag}>Cond. R$ {imovel.condominio.toLocaleString("pt-BR")}/mes</span>}
            {imovel.iptu && <span className={styles.tag}>IPTU R$ {imovel.iptu.toLocaleString("pt-BR")}/ano</span>}
          </div>

          {/* Descricao */}
          {imovel.descricao && (
            <div className={styles.descricao}>
              <h2>Descricao</h2>
              <p>{imovel.descricao}</p>
            </div>
          )}

          {/* Endereco */}
          {imovel.endereco && (
            <div className={styles.enderecoSection}>
              <h2>Localizacao</h2>
              <p>📍 {imovel.endereco}{imovel.cep ? ` — CEP ${imovel.cep}` : ""}</p>
            </div>
          )}
        </div>

        {/* Coluna direita: anunciante + lead */}
        <div className={styles.sidebar}>

          {/* Card anunciante */}
          {imovel.perfis && (
            <div className={styles.anuncianteCard}>
              <div className={styles.anuncianteAvatar}>
                {imovel.perfis.nome.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className={styles.anuncianteNome}>{imovel.perfis.nome}</p>
                <p className={styles.anuncianteTipo}>Anunciante</p>
              </div>
            </div>
          )}

          {/* Formulario de lead */}
          <div className={styles.leadCard}>
            {leadEnviado ? (
              <div className={styles.leadSucesso}>
                <span>✅</span>
                <h3>Mensagem enviada!</h3>
                <p>O anunciante entrar em contato em breve.</p>
              </div>
            ) : (
              <>
                <h3 className={styles.leadTitulo}>Tenho interesse</h3>
                <form onSubmit={enviarLead} className={styles.leadForm}>
                  <input
                    className={styles.leadInput}
                    placeholder="Seu nome"
                    value={nome}
                    onChange={e => setNome(e.target.value)}
                    required
                  />
                  <input
                    className={styles.leadInput}
                    type="email"
                    placeholder="Seu e-mail"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                  />
                  <input
                    className={styles.leadInput}
                    type="tel"
                    placeholder="WhatsApp (opcional)"
                    value={telefone}
                    onChange={e => setTelefone(e.target.value)}
                  />
                  <textarea
                    className={styles.leadTextarea}
                    value={mensagem}
                    onChange={e => setMensagem(e.target.value)}
                    rows={3}
                  />
                  {leadErro && <p className={styles.leadErro}>{leadErro}</p>}
                  <button type="submit" className={styles.leadBtn} disabled={enviando}>
                    {enviando ? "Enviando..." : "📩 Entrar em contato"}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}