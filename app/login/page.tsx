"use client"

import { useState, Suspense } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import LogoGota from "@/components/ui/LogoGota"
import styles from "./page.module.css"

function traduzirErro(msg: string): string {
  if (msg.includes("For security purposes") || msg.includes("after")) {
    const segundos = msg.match(/\d+/)?.[0] ?? "alguns"
    return `Por seguranca, aguarde ${segundos} segundos.`
  }
  if (msg.includes("Invalid login credentials")) return "E-mail ou senha incorretos."
  if (msg.includes("Email not confirmed")) return "Confirme seu e-mail antes de entrar."
  if (msg.includes("Database error")) return "Erro interno. Tente novamente."
  return "E-mail ou senha incorretos."
}

function LoginConteudo() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const destino = searchParams.get('next') || '/painel'
  const [email, setEmail] = useState("")
  const [senha, setSenha] = useState("")
  const [carregando, setCarregando] = useState(false)
  const [carregandoGoogle, setCarregandoGoogle] = useState(false)
  const [erro, setErro] = useState("")

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setErro("")
    setCarregando(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithPassword({ email, password: senha })
      if (error) throw error
      router.push(destino)
    } catch (err: unknown) {
      setErro(traduzirErro(err instanceof Error ? err.message : ""))
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
        options: {
          redirectTo: `${window.location.origin}${destino}`,
        },
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
          <h1>Bem-vindo de volta</h1>
          <p>Entre na sua conta para acessar seus imoveis e leads</p>

          {/* Botao Google */}
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

          <div className={styles.divisor}><span>ou</span></div>

          <form onSubmit={handleLogin} className={styles.form}>
            <div className={styles.campo}>
              <label>E-mail</label>
              <input
                type="email"
                className="campo"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className={styles.campo}>
              <label>Senha</label>
              <input
                type="password"
                className="campo"
                placeholder="Sua senha"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                required
              />
            </div>

            {erro && <div className={styles.erro}>{erro}</div>}

            <button type="submit" className="btn btn-primario btn-lg" disabled={carregando}>
              {carregando ? "Entrando..." : "Entrar"}
            </button>
          </form>

          <div className={styles.rodape}>
            <span>Nao tem conta?</span>
            <Link href="/cadastro">Criar conta gratis</Link>
          </div>
        </div>
      </div>

      <div className={styles.ladoVisual}>
        <div className={styles.ladoVisualConteudo}>
          <h2>Explore onde voce quer viver</h2>
          <p>A plataforma imobiliaria centrada no mapa. Descubra imoveis, explore bairros e encontre o lugar perfeito.</p>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginConteudo />
    </Suspense>
  )
}