"use client"

import { useState, Suspense } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import LogoGota from "@/components/ui/LogoGota"
import styles from "../login/page.module.css"

const TIPOS = [
  { valor: "comprador", label: "Comprador / Inquilino", icone: "🏠", desc: "Procuro imovel para comprar ou alugar" },
  { valor: "proprietario", label: "Proprietario", icone: "🏡", desc: "Quero anunciar meu proprio imovel" },
  { valor: "corretor", label: "Corretor", icone: "💼", desc: "Sou corretor de imoveis" },
  { valor: "imobiliaria", label: "Imobiliaria", icone: "🏢", desc: "Represento uma imobiliaria" },
]

function traduzirErro(msg: string): string {
  if (msg.includes("For security purposes") || msg.includes("after")) {
    const segundos = msg.match(/\d+/)?.[0] ?? "alguns"
    return `Por seguranca, aguarde ${segundos} segundos antes de tentar novamente.`
  }
  if (msg.includes("Database error saving new user")) return "Erro ao criar conta. Tente novamente."
  if (msg.includes("User already registered") || msg.includes("already been registered")) return "Este e-mail ja esta cadastrado. Faca login."
  if (msg.includes("Password should be at least")) return "A senha deve ter pelo menos 6 caracteres."
  if (msg.includes("Invalid email")) return "E-mail invalido."
  if (msg.includes("Email rate limit") || msg.includes("email rate limit")) return "Muitas tentativas. Use o login com Google ou aguarde alguns minutos."
  return msg
}

function CadastroConteudo() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [passo, setPasso] = useState(1)
  const [tipo, setTipo] = useState(searchParams.get("tipo") ?? "")
  const [nome, setNome] = useState("")
  const [email, setEmail] = useState("")
  const [senha, setSenha] = useState("")
  const [carregando, setCarregando] = useState(false)
  const [carregandoGoogle, setCarregandoGoogle] = useState(false)
  const [erro, setErro] = useState("")

  async function handleCadastrar(e: React.FormEvent) {
    e.preventDefault()
    setErro("")
    setCarregando(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signUp({
        email,
        password: senha,
        options: { data: { nome, tipo: tipo || "comprador" } },
      })
      if (error) throw error
      router.push("/painel")
    } catch (err: unknown) {
      setErro(traduzirErro(err instanceof Error ? err.message : "Erro ao criar conta"))
    } finally {
      setCarregando(false)
    }
  }

  async function handleGoogle() {
    setCarregandoGoogle(true)
    setErro("")
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/painel` },
      })
      if (error) throw error
    } catch {
      setErro("Erro ao conectar com Google. Tente novamente.")
      setCarregandoGoogle(false)
    }
  }

  return (
    <div className={styles.pagina}>
      <div className={styles.lado}>
        <div className={styles.ladoConteudo}>
          <Link href="/" className={styles.logo}>
            <LogoGota size={30} />
            <span>FIXUM</span>
          </Link>
          <h1>Criar conta gratis</h1>
          <p>Junte-se a pessoas encontrando o imovel ideal</p>

          {/* Botao Google — sempre visivel */}
          <button
            type="button"
            onClick={handleGoogle}
            disabled={carregandoGoogle}
            className={styles.btnGoogle}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
              <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853"/>
              <path d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71s.102-1.17.282-1.71V4.958H.957C.347 6.173 0 7.548 0 9s.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
            </svg>
            {carregandoGoogle ? "Conectando..." : "Continuar com Google"}
          </button>

          <div className={styles.divisor}><span>ou crie com e-mail</span></div>

          {passo === 1 && (
            <div className={styles.form}>
              <p style={{ fontWeight: 600, marginBottom: "8px", color: "var(--cor-texto)" }}>
                Como voce vai usar a plataforma?
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {TIPOS.map((t) => (
                  <button
                    key={t.valor}
                    type="button"
                    onClick={() => { setTipo(t.valor); setPasso(2) }}
                    style={{
                      display: "flex", alignItems: "center", gap: "12px",
                      padding: "14px 16px",
                      border: tipo === t.valor ? "2px solid var(--cor-primaria)" : "1.5px solid var(--cor-borda)",
                      borderRadius: "var(--raio-md)",
                      background: tipo === t.valor ? "var(--cor-primaria-claro)" : "white",
                      cursor: "pointer", textAlign: "left", transition: "all 0.2s",
                    }}
                  >
                    <span style={{ fontSize: "1.5rem" }}>{t.icone}</span>
                    <div>
                      <div style={{ fontWeight: 700, color: "var(--cor-texto)", fontSize: "0.875rem" }}>{t.label}</div>
                      <div style={{ fontSize: "0.75rem", color: "var(--cor-texto-terciario)" }}>{t.desc}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {passo === 2 && (
            <form onSubmit={handleCadastrar} className={styles.form}>
              <div className={styles.campo}>
                <label>Nome completo</label>
                <input type="text" className="campo" placeholder="Seu nome" value={nome} onChange={(e) => setNome(e.target.value)} required />
              </div>
              <div className={styles.campo}>
                <label>E-mail</label>
                <input type="email" className="campo" placeholder="seu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className={styles.campo}>
                <label>Senha</label>
                <input type="password" className="campo" placeholder="Minimo 6 caracteres" value={senha} onChange={(e) => setSenha(e.target.value)} minLength={6} required />
              </div>

              {erro && <div className={styles.erro}>{erro}</div>}

              <div style={{ display: "flex", gap: "10px" }}>
                <button type="button" className="btn btn-outline btn-lg" onClick={() => setPasso(1)} style={{ flex: 1 }}>
                  Voltar
                </button>
                <button type="submit" className="btn btn-primario btn-lg" disabled={carregando} style={{ flex: 2 }}>
                  {carregando ? "Criando conta..." : "Criar conta"}
                </button>
              </div>
            </form>
          )}

          <div className={styles.rodape}>
            <span>Ja tem conta?</span>
            <Link href="/login">Entrar</Link>
          </div>
        </div>
      </div>

      <div className={styles.ladoVisual}>
        <div className={styles.ladoVisualConteudo}>
          <h2>Anuncie ou encontre o imovel ideal</h2>
          <p>Proprietarios, corretores e imobiliarias cadastram imoveis gratuitamente.</p>
        </div>
      </div>
    </div>
  )
}

export default function CadastroPage() {
  return <Suspense><CadastroConteudo /></Suspense>
}