"use client"

import { useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import LogoGota from "@/components/ui/LogoGota"
import styles from "../login/page.module.css"

export default function RecuperarSenhaPage() {
  const [email, setEmail] = useState("")
  const [carregando, setCarregando] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [erro, setErro] = useState("")

  async function handleRecuperar(e: React.FormEvent) {
    e.preventDefault()
    setErro("")
    setCarregando(true)

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/redefinir-senha`,
      })

      if (error) throw error
      setEnviado(true)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : ""
      if (msg.includes("rate limit") || msg.includes("security purposes")) {
        setErro("Muitas tentativas em pouco tempo. Aguarde alguns minutos antes de tentar novamente.")
      } else {
        setErro("Não foi possível enviar o e-mail de recuperação. Verifique o endereço digitado.")
      }
    } finally {
      setCarregando(false)
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

          <h1>Recuperar senha</h1>
          <p>Digite seu e-mail cadastrado para receber as instruções de recuperação</p>

          {enviado ? (
            <div style={{
              background: '#f0fdf4',
              border: '1px solid #bbf7d0',
              borderRadius: '1rem',
              padding: '1.75rem',
              textAlign: 'center',
              marginTop: '1.5rem'
            }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📬</div>
              <h3 style={{ color: '#15803d', fontSize: '1.2rem', marginBottom: '0.5rem' }}>E-mail enviado!</h3>
              <p style={{ color: '#475569', fontSize: '0.9rem', lineHeight: '1.5', marginBottom: '1.25rem' }}>
                Enviamos um link de recuperação para <strong>{email}</strong>. Verifique sua caixa de entrada e spam.
              </p>
              <Link href="/login" className="btn btn-primario" style={{ width: '100%', minHeight: '44px' }}>
                Voltar para o Login
              </Link>
            </div>
          ) : (
            <form onSubmit={handleRecuperar} className={styles.form} style={{ marginTop: '1.5rem' }}>
              <div className={styles.campo}>
                <label>E-mail cadastrado</label>
                <input
                  type="email"
                  className="campo"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              {erro && <div className={styles.erro}>{erro}</div>}

              <button
                type="submit"
                disabled={carregando || !email}
                className={`btn btn-primario ${styles.btnEntrar}`}
              >
                {carregando ? "Enviando..." : "Enviar link de recuperação"}
              </button>

              <div className={styles.rodape}>
                Lembrou sua senha?{" "}
                <Link href="/login">Fazer login</Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
