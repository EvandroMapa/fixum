"use client"

import { useState, Suspense } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import LogoGota from "@/components/ui/LogoGota"
import InputSenha from "@/components/ui/InputSenha"
import styles from "./page.module.css"

function traduzirErro(msg: string): string {
  if (msg.includes("For security purposes") || msg.includes("after")) {
    const segundos = msg.match(/\d+/)?.[0] ?? "alguns"
    return `Por segurança, aguarde ${segundos} segundos.`
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
  const [codigoMfa, setCodigoMfa] = useState("")
  const [fatorMfaId, setFatorMfaId] = useState("")
  const [precisaMfa, setPrecisaMfa] = useState(false)
  const [carregando, setCarregando] = useState(false)
  const [carregandoGoogle, setCarregandoGoogle] = useState(false)
  const [erro, setErro] = useState("")

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setErro("")
    setCarregando(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha })
      if (error) throw error

      // Verificar se a conta possui 2FA ativo
      const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
      if (aalData && aalData.nextLevel === 'aal2' && aalData.currentLevel === 'aal1') {
        const { data: fatores } = await supabase.auth.mfa.listFactors()
        const fatorTotp = fatores?.totp?.[0]
        if (fatorTotp) {
          setFatorMfaId(fatorTotp.id)
          setPrecisaMfa(true)
          setCarregando(false)
          return
        }
      }

      // Verificar se o usuário autenticado é Administrador Master
      const { data: perfilData } = await supabase
        .from('perfis')
        .select('is_admin, tipo_anunciante')
        .eq('id', data.user.id)
        .maybeSingle()

      const ehAdmin = perfilData?.is_admin === true || perfilData?.tipo_anunciante === 'admin' || data.user.user_metadata?.tipo === 'admin' || data.user.email === 'admin@fixum.com.br'

      if (ehAdmin) {
        router.push('/admin')
        return
      }

      router.push(destino)
    } catch (err: unknown) {
      setErro(traduzirErro(err instanceof Error ? err.message : ""))
    } finally {
      setCarregando(false)
    }
  }

  async function handleVerificarMfa(e: React.FormEvent) {
    e.preventDefault()
    setErro("")
    setCarregando(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.mfa.challengeAndVerify({
        factorId: fatorMfaId,
        code: codigoMfa.trim(),
      })
      if (error) throw error

      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: perfilData } = await supabase
          .from('perfis')
          .select('is_admin, tipo_anunciante')
          .eq('id', user.id)
          .maybeSingle()

        const ehAdmin = perfilData?.is_admin === true || perfilData?.tipo_anunciante === 'admin' || user.user_metadata?.tipo === 'admin' || user.email === 'admin@fixum.com.br'
        if (ehAdmin) {
          router.push('/admin')
          return
        }
      }

      router.push(destino)
    } catch {
      setErro("Código incorreto ou expirado. Tente novamente.")
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
      {/* Lado Esquerdo: Formulário */}
      <div className={styles.lado}>
        <div className={styles.ladoConteudo}>
          {/* Topo com Logo e Voltar */}
          <div className={styles.topoForm}>
            <Link href="/" className={styles.logo}>
              <LogoGota size={32} />
              <span>FIXUM</span>
            </Link>
            <Link href="/" className={styles.linkVoltarHome}>
              <span>←</span> Voltar ao início
            </Link>
          </div>

          {precisaMfa ? (
            <div className={styles.cardMfa}>
              <div className={styles.iconeMfa}>🔐</div>
              <h1>Autenticação em 2 Fatores</h1>
              <p>Digite o código de 6 dígitos gerado no seu aplicativo autenticador (Google Authenticator ou similar).</p>

              <form onSubmit={handleVerificarMfa} className={styles.form}>
                <div className={styles.campo}>
                  <label>Código de Segurança (TOTP)</label>
                  <input
                    type="text"
                    className="campo"
                    placeholder="000000"
                    maxLength={6}
                    value={codigoMfa}
                    onChange={(e) => setCodigoMfa(e.target.value)}
                    required
                    autoFocus
                    style={{ fontSize: '1.5rem', letterSpacing: '0.3em', textAlign: 'center', fontWeight: 700 }}
                  />
                </div>

                {erro && <div className={styles.erro}>{erro}</div>}

                <button type="submit" className="btn btn-primario btn-lg" disabled={carregando || codigoMfa.length < 6}>
                  {carregando ? "Verificando..." : "Confirmar e Entrar"}
                </button>

                <div className={styles.rodape}>
                  <button
                    type="button"
                    onClick={() => { setPrecisaMfa(false); setCodigoMfa("") }}
                    className={styles.btnVoltarMfa}
                  >
                    ← Voltar para login com senha
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className={styles.cardForm}>
              <div className={styles.cabecalhoForm}>
                <h1>Bem-vindo de volta</h1>
                <p>Acesse sua conta para gerenciar seus imóveis e propostas</p>
              </div>

              {/* Botão Google */}
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
                <span>{carregandoGoogle ? "Conectando..." : "Entrar com Google"}</span>
              </button>

              <div className={styles.divisor}><span>ou entre com seu e-mail</span></div>

              <form onSubmit={handleLogin} className={styles.form}>
                <div className={styles.campo}>
                  <label htmlFor="campo-email">E-mail</label>
                  <input
                    id="campo-email"
                    type="email"
                    className="campo"
                    placeholder="ex: seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>

                <div className={styles.campo}>
                  <div className={styles.campoSenhaHeader}>
                    <label htmlFor="campo-senha">Senha</label>
                    <Link href="/recuperar-senha" className={styles.linkEsqueceu}>
                      Esqueceu a senha?
                    </Link>
                  </div>
                  <InputSenha
                    placeholder="Sua senha de acesso"
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    required
                  />
                </div>

                {erro && <div className={styles.erro}>{erro}</div>}

                <button type="submit" className={`btn btn-primario btn-lg ${styles.btnSubmit}`} disabled={carregando}>
                  {carregando ? (
                    <span className={styles.btnCarregando}>
                      <span className={styles.spinner} /> Entrando...
                    </span>
                  ) : (
                    "Acessar Conta"
                  )}
                </button>
              </form>

              <div className={styles.rodape}>
                <span>Ainda não tem uma conta?</span>
                <Link href="/cadastro" className={styles.linkCadastro}>Criar Conta Gratuita</Link>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Lado Direito: Painel Decorativo Visual (Estilo Pro) */}
      <div className={styles.ladoVisual}>
        <div className={styles.glow1} />
        <div className={styles.glow2} />
        <div className={styles.gridBackground} />

        <div className={styles.ladoVisualConteudo}>
          {/* Badge flutuante */}
          <div className={styles.badgeDestaque}>
            <span className={styles.pontoVerde} />
            <span>Plataforma Imobiliária Geolocalizada</span>
          </div>

          <h2>Encontre e anuncie imóveis com inteligência no mapa.</h2>
          <p>A ferramenta completa para imobiliárias, corretores autônomos e proprietários conectarem compradores em tempo real.</p>

          {/* Card Mockup Flutuante com Efeito Glassmorphism */}
          <div className={styles.cardPreviewGlass}>
            <div className={styles.cardPreviewTopo}>
              <div className={styles.tagStatus}>⚡ Novo Lead Recebido</div>
              <span className={styles.horarioLead}>Há 2 min</span>
            </div>
            <div className={styles.cardPreviewCorpo}>
              <div className={styles.avatarLead}>👤</div>
              <div>
                <div className={styles.nomeLead}>Rodrigo Silveira</div>
                <div className={styles.interesseLead}>Interesse em: Apartamento 3Q · Centro</div>
              </div>
            </div>
            <div className={styles.cardPreviewFooter}>
              <span className={styles.badgeConversao}>📍 Encontrado no Mapa</span>
              <span className={styles.valorPreco}>R$ 480.000</span>
            </div>
          </div>

          {/* Métricas de Confiança */}
          <div className={styles.metricasConfianca}>
            <div className={styles.metricaItem}>
              <strong>+5.000</strong>
              <span>Imóveis Mapeados</span>
            </div>
            <div className={styles.divisorMetrica} />
            <div className={styles.metricaItem}>
              <strong>100%</strong>
              <span>Precisão GPS</span>
            </div>
            <div className={styles.divisorMetrica} />
            <div className={styles.metricaItem}>
              <strong>24/7</strong>
              <span>Gestão de Leads</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "var(--cor-texto-secundario)",
        fontSize: "var(--texto-sm)",
      }}>
        Carregando...
      </div>
    }>
      <LoginConteudo />
    </Suspense>
  )
}