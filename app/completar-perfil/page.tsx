"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import styles from "./page.module.css"

const TIPOS = [
  { valor: "comprador",    label: "Comprador",    icone: "🏠", desc: "Quero comprar ou alugar" },
  { valor: "proprietario", label: "Proprietario", icone: "🏡", desc: "Anunciar meu imovel" },
  { valor: "corretor",     label: "Corretor",     icone: "💼", desc: "Corretor de imoveis" },
  { valor: "imobiliaria",  label: "Imobiliaria",  icone: "🏢", desc: "Represento imobiliaria" },
]

export default function CompletarPerfilPage() {
  const router = useRouter()
  const supabase = createClient()
  const [nome, setNome] = useState("")
  const [tipo, setTipo] = useState("")
  const [telefone, setTelefone] = useState("")
  const [salvando, setSalvando] = useState(false)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push("/login"); return }
      setNome(
        user.user_metadata?.full_name ||
        user.user_metadata?.name ||
        user.user_metadata?.nome ||
        user.email?.split("@")[0] || ""
      )
      setCarregando(false)
    }
    init()
  }, [router, supabase])

  async function salvar() {
    if (!tipo) return
    setSalvando(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      await supabase.from("perfis").upsert({
        id: user.id, nome, email: user.email!, tipo,
        telefone: telefone || null,
      })
      router.push("/painel")
    } finally {
      setSalvando(false)
    }
  }

  if (carregando) {
    return <div className={styles.pagina}><p style={{color:"white"}}>Carregando...</p></div>
  }

  return (
    <div className={styles.pagina}>
      <div className={styles.card}>

        <div className={styles.avatar}>{nome.charAt(0).toUpperCase() || "U"}</div>
        <h1 className={styles.titulo}>Bem-vindo, {nome.split(" ")[0]}!</h1>
        <p className={styles.subtitulo}>So mais um passo para comecar</p>

        <div className={styles.campo}>
          <label className={styles.label}>Seu nome</label>
          <input className={styles.input} value={nome}
            onChange={(e) => setNome(e.target.value)} placeholder="Nome completo" />
        </div>

        <div className={styles.campo}>
          <label className={styles.label}>Como voce vai usar o FIXUM?</label>
          <div className={styles.gridTipos}>
            {TIPOS.map((t) => (
              <button key={t.valor} type="button"
                className={`${styles.tipoBtn} ${tipo === t.valor ? styles.tipoBtnAtivo : ""}`}
                onClick={() => setTipo(t.valor)}>
                <span className={styles.tipoIcone}>{t.icone}</span>
                <span className={styles.tipoLabel}>{t.label}</span>
                <span className={styles.tipoDesc}>{t.desc}</span>
              </button>
            ))}
          </div>
        </div>

        <div className={styles.campo}>
          <label className={styles.label}>
            WhatsApp <span className={styles.opcional}>(opcional)</span>
          </label>
          <input className={styles.input} value={telefone} type="tel"
            onChange={(e) => setTelefone(e.target.value)} placeholder="(00) 00000-0000" />
        </div>

        <button
          className={`${styles.btnSalvar} ${!tipo ? styles.btnDesabilitado : ""}`}
          onClick={salvar} disabled={!tipo || salvando}>
          {salvando ? "Salvando..." : "Entrar no FIXUM →"}
        </button>

      </div>
    </div>
  )
}