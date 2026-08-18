"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import LogoGota from "@/components/ui/LogoGota"
import InputSenha from "@/components/ui/InputSenha"
import styles from "../login/page.module.css"

export default function RedefinirSenhaPage() {
  const router = useRouter()
  const [novaSenha, setNovaSenha] = useState("")
  const [confirmarSenha, setConfirmarSenha] = useState("")
  const [carregando, setCarregando] = useState(false)
  const [sucesso, setSucesso] = useState(false)
  const [erro, setErro] = useState("")

  // Avaliação de força de senha
  function calcularForcaSenha(senha: string): { nivel: number; texto: string; cor: string } {
    if (!senha) return { nivel: 0, texto: "", cor: "#e2e8f0" }
    let pontos = 0
    if (senha.length >= 8) pontos++
    if (/[A-Z]/.test(senha)) pontos++
    if (/[0-9]/.test(senha)) pontos++
    if (/[^A-Za-z0-9]/.test(senha)) pontos++

    if (pontos <= 1) return { nivel: 1, texto: "Fraca", cor: "#ef4444" }
    if (pontos === 2 || pontos === 3) return { nivel: 2, texto: "Média", cor: "#f59e0b" }
    return { nivel: 3, texto: "Forte e Segura", cor: "#10b981" }
  }

  const forca = calcularForcaSenha(novaSenha)

  async function handleRedefinir(e: React.FormEvent) {
    e.preventDefault()
    setErro("")

    if (novaSenha.length < 8) {
      setErro("A senha deve ter pelo menos 8 caracteres para sua segurança.")
      return
    }

    if (novaSenha !== confirmarSenha) {
      setErro("As senhas digitadas não coincidem.")
      return
    }

    setCarregando(true)

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.updateUser({
        password: novaSenha,
      })

      if (error) throw error

      setSucesso(true)
      setTimeout(() => {
        router.push("/painel")
      }, 2000)
    } catch (err: unknown) {
      setErro(err instanceof Error ? err.message : "Erro ao redefinir senha. O link pode ter expirado.")
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

          <h1>Criar nova senha</h1>
          <p>Defina uma senha segura para proteger sua conta e seus anúncios</p>

          {sucesso ? (
            <div style={{
              background: '#f0fdf4',
              border: '1px solid #bbf7d0',
              borderRadius: '1rem',
              padding: '1.75rem',
              textAlign: 'center',
              marginTop: '1.5rem'
            }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>✅</div>
              <h3 style={{ color: '#15803d', fontSize: '1.2rem', marginBottom: '0.5rem' }}>Senha alterada com sucesso!</h3>
              <p style={{ color: '#475569', fontSize: '0.9rem', marginBottom: '1rem' }}>
                Redirecionando para seu painel de controle...
              </p>
            </div>
          ) : (
            <form onSubmit={handleRedefinir} className={styles.form} style={{ marginTop: '1.5rem' }}>
              <div className={styles.campo}>
                <label>Nova Senha</label>
                <InputSenha
                  placeholder="Mínimo 8 caracteres"
                  value={novaSenha}
                  onChange={(e) => setNovaSenha(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              {/* Indicador de Força da Senha */}
              {novaSenha.length > 0 && (
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '4px' }}>
                    <span style={{ color: '#64748b' }}>Força da senha:</span>
                    <strong style={{ color: forca.cor }}>{forca.texto}</strong>
                  </div>
                  <div style={{ display: 'flex', gap: '4px', height: '4px' }}>
                    <div style={{ flex: 1, borderRadius: '2px', background: forca.nivel >= 1 ? forca.cor : '#e2e8f0' }} />
                    <div style={{ flex: 1, borderRadius: '2px', background: forca.nivel >= 2 ? forca.cor : '#e2e8f0' }} />
                    <div style={{ flex: 1, borderRadius: '2px', background: forca.nivel >= 3 ? forca.cor : '#e2e8f0' }} />
                  </div>
                </div>
              )}

              <div className={styles.campo}>
                <label>Confirmar Nova Senha</label>
                <InputSenha
                  placeholder="Repita a nova senha"
                  value={confirmarSenha}
                  onChange={(e) => setConfirmarSenha(e.target.value)}
                  required
                />
              </div>

              {erro && <div className={styles.erro}>{erro}</div>}

              <button
                type="submit"
                disabled={carregando || !novaSenha || !confirmarSenha}
                className={`btn btn-primario ${styles.btnEntrar}`}
              >
                {carregando ? "Salvando..." : "Salvar nova senha"}
              </button>

              <div className={styles.rodape}>
                <Link href="/login">Voltar ao Login</Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
