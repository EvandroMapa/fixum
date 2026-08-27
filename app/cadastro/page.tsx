"use client"

import { useState, useEffect, Suspense } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import LogoGota from "@/components/ui/LogoGota"
import InputSenha from "@/components/ui/InputSenha"
import { obterIniciaisUsuario, obterGradienteUsuario } from "@/lib/utils"
import styles from "../login/page.module.css"

const TIPOS = [
  { valor: "comprador", label: "Comprador / Inquilino", icone: "🏠", desc: "Procuro imóvel para comprar ou alugar" },
  { valor: "proprietario", label: "Proprietário", icone: "🏡", desc: "Quero anunciar meu próprio imóvel" },
  { valor: "corretor", label: "Corretor Autônomo", icone: "💼", desc: "Sou corretor de imóveis credenciado" },
  { valor: "imobiliaria", label: "Imobiliária", icone: "🏢", desc: "Represento uma imobiliária" },
]

function traduzirErro(msg: string): string {
  if (msg.includes("For security purposes") || msg.includes("after")) {
    const segundos = msg.match(/\d+/)?.[0] ?? "alguns"
    return `Por segurança, aguarde ${segundos} segundos antes de tentar novamente.`
  }
  if (msg.includes("Database error saving new user")) return "Erro ao criar conta. Tente novamente."
  if (msg.includes("User already registered") || msg.includes("already been registered")) {
    return "Este e-mail já está cadastrado na Fixum. Por favor, faça login, recupere sua senha ou informe outro e-mail válido."
  }
  if (msg.includes("Password should be at least")) return "A senha deve ter pelo menos 6 caracteres."
  if (msg.includes("Invalid email")) return "E-mail inválido."
  if (msg.includes("Email rate limit") || msg.includes("email rate limit")) return "Muitas tentativas. Aguarde alguns minutos."
  return msg
}

function CadastroConteudo() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const imobiliariaId = searchParams.get("imobiliaria") ?? ""
  const planoId = searchParams.get("plano") ?? ""
  const [empresaNome, setEmpresaNome] = useState(searchParams.get("empresa") ?? "Imobiliária")
  const [imobiliariaInfo, setImobiliariaInfo] = useState<{
    nome: string
    foto_url?: string
    cidade?: string
    estado?: string
    creci?: string
  } | null>(null)

  const tipoParam = imobiliariaId ? "corretor" : (searchParams.get("tipo") ?? "")
  const [tipo, setTipo] = useState(tipoParam)
  const [passo, setPasso] = useState((tipoParam || imobiliariaId) ? 2 : 1)
  const [nome, setNome] = useState("")
  const [email, setEmail] = useState("")
  const [telefone, setTelefone] = useState("")
  const [creci, setCreci] = useState("")
  const [senha, setSenha] = useState("")
  const [codigoOtp, setCodigoOtp] = useState("")
  const [timerReenvio, setTimerReenvio] = useState(0)
  const [carregando, setCarregando] = useState(false)
  const [carregandoGoogle, setCarregandoGoogle] = useState(false)
  const [erro, setErro] = useState("")
  const [sucesso, setSucesso] = useState("")

  // Timer regressivo para reenvio de OTP
  useEffect(() => {
    if (timerReenvio <= 0) return
    const interval = setInterval(() => {
      setTimerReenvio((prev) => prev - 1)
    }, 1000)
    return () => clearInterval(interval)
  }, [timerReenvio])

  // Buscar dados completos da imobiliária anfitriã se houver convite
  useEffect(() => {
    if (!imobiliariaId) return
    async function carregarImobiliaria() {
      const supabase = createClient()
      const { data } = await supabase
        .from('perfis')
        .select('nome, foto_url, cidade, estado, creci')
        .eq('id', imobiliariaId)
        .single()

      if (data?.nome) {
        setEmpresaNome(data.nome)
        setImobiliariaInfo(data)
      }
    }
    carregarImobiliaria()
  }, [imobiliariaId])

  const isImobiliaria = tipo === "imobiliaria"
  const isCorretor = tipo === "corretor"

  // ── VALIDAÇÃO DE CAMPOS OBRIGATÓRIOS ──
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  const emailValido = emailRegex.test(email.trim())
  const nomeValido = nome.trim().length >= 3
  const senhaValida = senha.length >= 8
  const telefoneDigitos = telefone.replace(/\D/g, "")
  const telefoneValido = (isImobiliaria || isCorretor) ? telefoneDigitos.length >= 10 : true

  const podeAvancar = nomeValido && emailValido && senhaValida && telefoneValido && !carregando

  // ── ETAPA 1: VALIDAR DADOS E DISPARAR CÓDIGO OTP POR E-MAIL ──
  async function handleAvancarParaOtp(e: React.FormEvent) {
    e.preventDefault()
    setErro("")
    setSucesso("")

    if (!nome.trim() || !email.trim() || !senha) {
      setErro("Preencha todos os campos obrigatórios.")
      return
    }

    if (senha.length < 8) {
      setErro("A senha deve ter no mínimo 8 caracteres.")
      return
    }

    setCarregando(true)
    try {
      const emailLimpo = email.trim().toLowerCase()

      // 1. Disparar código OTP via Resend
      const resOtp = await fetch('/api/auth/otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          acao: 'enviar',
          email: emailLimpo,
          motivo: 'cadastro',
        }),
      })

      const jsonOtp = await resOtp.json()
      if (!resOtp.ok || jsonOtp.error) {
        throw new Error(jsonOtp.error || 'Erro ao enviar código de verificação.')
      }

      setPasso(3)
      setTimerReenvio(60)
      setSucesso(`Código de segurança enviado para ${emailLimpo}.`)
    } catch (err: unknown) {
      setErro(traduzirErro(err instanceof Error ? err.message : "Erro ao enviar código"))
    } finally {
      setCarregando(false)
    }
  }

  // ── ETAPA 2: VALIDAR OTP E EFETIVAR O CADASTRO ──
  async function handleConfirmarCadastro(e: React.FormEvent) {
    e.preventDefault()
    setErro("")
    setCarregando(true)

    try {
      const emailLimpo = email.trim().toLowerCase()
      const codigoLimpo = codigoOtp.replace(/\D/g, "")

      if (codigoLimpo.length < 6) {
        setErro("Digite o código de 6 dígitos recebido por e-mail.")
        setCarregando(false)
        return
      }

      // 1. Validar Código OTP
      const resVal = await fetch('/api/auth/otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          acao: 'validar',
          email: emailLimpo,
          codigo: codigoLimpo,
          motivo: 'cadastro',
        }),
      })

      const jsonVal = await resVal.json()
      if (!resVal.ok || jsonVal.error) {
        throw new Error(jsonVal.error || 'Código incorreto ou expirado.')
      }

      // 2. Criar a conta com segurança no Supabase
      const tipoFinal = tipo || (imobiliariaId ? "corretor" : "imobiliaria")
      const resCad = await fetch('/api/auth/cadastrar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: emailLimpo,
          password: senha,
          nome: nome.trim(),
          tipo: tipoFinal,
          telefone: telefone || null,
          imobiliaria_id: imobiliariaId || null,
          creci: creci || null,
        }),
      })

      const jsonCad = await resCad.json()
      if (!resCad.ok) {
        throw new Error(jsonCad.error || 'Erro ao processar cadastro')
      }

      // 3. Autenticar a sessão
      const supabase = createClient()
      const { error: loginError } = await supabase.auth.signInWithPassword({
        email: emailLimpo,
        password: senha,
      })

      if (loginError) {
        throw loginError
      }

      router.push("/painel")
    } catch (err: unknown) {
      setErro(traduzirErro(err instanceof Error ? err.message : "Erro ao concluir cadastro"))
    } finally {
      setCarregando(false)
    }
  }

  // Reenviar OTP
  async function handleReenviarOtp() {
    if (timerReenvio > 0) return
    setErro("")
    setCarregando(true)

    try {
      const emailLimpo = email.trim().toLowerCase()
      const res = await fetch('/api/auth/otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          acao: 'enviar',
          email: emailLimpo,
          motivo: 'cadastro',
        }),
      })

      const json = await res.json()
      if (!res.ok || json.error) {
        throw new Error(json.error || 'Falha ao reenviar código.')
      }

      setTimerReenvio(60)
      setSucesso(`Novo código de segurança enviado para ${emailLimpo}.`)
    } catch (err: unknown) {
      setErro(err instanceof Error ? err.message : "Falha ao reenviar código.")
    } finally {
      setCarregando(false)
    }
  }

  async function handleGoogle() {
    setCarregandoGoogle(true)
    setErro("")
    try {
      const supabase = createClient()
      const redirectUrl = tipo
        ? `${window.location.origin}/painel?tipo=${tipo}`
        : `${window.location.origin}/painel`
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: redirectUrl },
      })
      if (error) throw error
    } catch {
      setErro("Erro ao conectar com Google. Tente novamente.")
      setCarregandoGoogle(false)
    }
  }

  return (
    <div className={styles.pagina} style={{ minHeight: '100vh', height: '100vh', overflow: 'hidden' }}>
      {/* ═══════════════════════════════════════════════════════════════
          LADO ESQUERDO: FORMULÁRIO COMPACTO E SEM ROLAGEM VERTICAL
          ═══════════════════════════════════════════════════════════════ */}
      <div className={styles.lado} style={{ padding: '1.25rem 2rem', overflowY: 'auto' }}>
        <div className={styles.ladoConteudo} style={{ maxWidth: '420px' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <Link href="/" className={styles.logo}>
              <LogoGota size={26} />
              <span style={{ fontSize: '1.2rem' }}>FIXUM</span>
            </Link>
            <Link href="/" className={styles.linkVoltarHome} style={{ padding: '4px 10px', fontSize: '0.78rem' }}>
              ✕ Fechar
            </Link>
          </div>

          <div style={{ marginBottom: '0.85rem' }}>
            <h1 style={{ fontSize: '1.45rem', fontWeight: 800, color: '#0f172a', margin: '0 0 4px 0', letterSpacing: '-0.02em' }}>
              {passo === 3
                ? "Verificação de Segurança"
                : imobiliariaId
                ? "Convite de Equipe"
                : isImobiliaria
                ? "Cadastro da Imobiliária"
                : isCorretor
                ? "Cadastro de Corretor"
                : "Criar sua conta"}
            </h1>
            <p style={{ color: '#64748b', fontSize: '0.84rem', margin: 0, lineHeight: 1.4 }}>
              {passo === 3
                ? `Informe o código enviado para ${email}`
                : imobiliariaId
                ? `Junte-se à equipe ${empresaNome} no mapa Fixum`
                : isImobiliaria
                ? "Crie a conta corporativa da sua imobiliária"
                : isCorretor
                ? "Publique imóveis e receba leads no WhatsApp"
                : "Cadastre-se na plataforma de imóveis"}
            </p>
          </div>

          {imobiliariaId && passo !== 3 && (
            <div style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "5px 12px",
              background: "#f0fdf4",
              border: "1px solid #86efac",
              color: "#15803d",
              borderRadius: "6px",
              fontSize: "0.78rem",
              fontWeight: 700,
              marginBottom: "0.85rem",
            }}>
              🤝 Convite Oficial: {empresaNome}
            </div>
          )}

          {planoId && !imobiliariaId && passo !== 3 && (
            <div style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "5px 12px",
              background: "#eff6ff",
              border: "1px solid #bfdbfe",
              color: "#1d4ed8",
              borderRadius: "6px",
              fontSize: "0.78rem",
              fontWeight: 700,
              marginBottom: "0.85rem",
            }}>
              ✨ Plano Pré-Selecionado: {planoId.toUpperCase().replace('_', ' ')}
            </div>
          )}

          {/* Botão Google — apenas para compradores e usuários comuns */}
          {!isImobiliaria && !isCorretor && !imobiliariaId && passo !== 3 && (
            <>
              <button
                type="button"
                onClick={handleGoogle}
                disabled={carregandoGoogle}
                className={styles.btnGoogle}
                style={{ padding: '9px 14px', fontSize: '0.85rem', marginBottom: '0.5rem' }}
              >
                <svg width="16" height="16" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
                  <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
                  <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853"/>
                  <path d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71s.102-1.17.282-1.71V4.958H.957C.347 6.173 0 7.548 0 9s.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                  <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
                </svg>
                <span>{carregandoGoogle ? "Conectando..." : "Continuar com Google"}</span>
              </button>

              <div className={styles.divisor} style={{ margin: '0.5rem 0' }}>
                <span style={{ fontSize: '0.72rem' }}>ou preencha os dados</span>
              </div>
            </>
          )}

          {/* ── PASSO 1: ESCOLHA DO TIPO DE PERFIL ── */}
          {passo === 1 && (
            <div className={styles.form}>
              <p style={{ fontWeight: 600, marginBottom: "8px", color: "var(--cor-texto)", fontSize: "0.82rem" }}>
                Como você vai usar a plataforma?
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {TIPOS.map((t) => (
                  <button
                    key={t.valor}
                    type="button"
                    onClick={() => { setTipo(t.valor); setPasso(2) }}
                    style={{
                      display: "flex", alignItems: "center", gap: "10px",
                      padding: "10px 14px",
                      border: tipo === t.valor ? "2px solid var(--cor-primaria)" : "1.5px solid var(--cor-borda)",
                      borderRadius: "10px",
                      background: tipo === t.valor ? "var(--cor-primaria-claro)" : "white",
                      cursor: "pointer", textAlign: "left", transition: "all 0.2s",
                    }}
                  >
                    <span style={{ fontSize: "1.3rem" }}>{t.icone}</span>
                    <div>
                      <div style={{ fontWeight: 700, color: "var(--cor-texto)", fontSize: "0.84rem" }}>{t.label}</div>
                      <div style={{ fontSize: "0.72rem", color: "var(--cor-texto-terciario)" }}>{t.desc}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── PASSO 2: FORMULÁRIO DE DADOS COMPACTO ── */}
          {passo === 2 && (
            <form onSubmit={handleAvancarParaOtp} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#334155' }}>
                  {isImobiliaria ? "Nome da Imobiliária / Razão Social" : "Nome completo"}
                </label>
                <input
                  type="text"
                  className="campo"
                  style={{ padding: '8px 12px', fontSize: '0.85rem' }}
                  placeholder={isImobiliaria ? "Ex: Imobiliária Primária" : "Seu nome completo"}
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#334155' }}>
                  {isImobiliaria ? "E-mail Corporativo" : "E-mail"}
                </label>
                <input
                  type="email"
                  className="campo"
                  style={{ padding: '8px 12px', fontSize: '0.85rem' }}
                  placeholder={isImobiliaria ? "contato@suaimobiliaria.com.br" : "seu@email.com"}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              {(isImobiliaria || isCorretor) && (
                <div style={{ display: 'grid', gridTemplateColumns: isCorretor ? '1.2fr 0.8fr' : '1fr', gap: '8px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#334155' }}>WhatsApp / Telefone</label>
                    <input
                      type="tel"
                      className="campo"
                      style={{ padding: '8px 12px', fontSize: '0.85rem' }}
                      placeholder="(31) 99999-9999"
                      value={telefone}
                      onChange={(e) => setTelefone(e.target.value)}
                    />
                  </div>

                  {isCorretor && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#334155' }}>CRECI (Opcional)</label>
                      <input
                        type="text"
                        className="campo"
                        style={{ padding: '8px 12px', fontSize: '0.85rem' }}
                        placeholder="MG-12345"
                        value={creci}
                        onChange={(e) => setCreci(e.target.value)}
                      />
                    </div>
                  )}
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#334155' }}>Criar Senha</label>
                <InputSenha
                  placeholder="Mínimo 8 caracteres"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  minLength={8}
                  required
                />
              </div>

              {senha.length > 0 && (
                <div style={{ margin: '2px 0 4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', marginBottom: '2px' }}>
                    <span style={{ color: "#64748b" }}>Força:</span>
                    <strong style={{
                      color: senha.length < 8 ? "#ef4444" : (/[A-Z]/.test(senha) && /[0-9]/.test(senha)) ? "#10b981" : "#f59e0b"
                    }}>
                      {senha.length < 8 ? "Muito curta (min. 8)" : (/[A-Z]/.test(senha) && /[0-9]/.test(senha)) ? "Forte" : "Média"}
                    </strong>
                  </div>
                  <div style={{ display: "flex", gap: "3px", height: "3px" }}>
                    <div style={{ flex: 1, borderRadius: "2px", background: senha.length >= 8 ? (/[A-Z]/.test(senha) && /[0-9]/.test(senha) ? "#10b981" : "#f59e0b") : "#ef4444" }} />
                    <div style={{ flex: 1, borderRadius: "2px", background: senha.length >= 8 ? (/[A-Z]/.test(senha) && /[0-9]/.test(senha) ? "#10b981" : "#f59e0b") : "#e2e8f0" }} />
                    <div style={{ flex: 1, borderRadius: "2px", background: (senha.length >= 8 && /[A-Z]/.test(senha) && /[0-9]/.test(senha)) ? "#10b981" : "#e2e8f0" }} />
                  </div>
                </div>
              )}

              {erro && (
                <div style={{
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: '8px',
                  padding: '8px 12px',
                  color: '#991b1b',
                  fontSize: '0.78rem',
                  lineHeight: 1.4,
                }}>
                  {erro}
                </div>
              )}

              <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
                {!tipoParam && (
                  <button type="button" className="btn btn-outline" onClick={() => setPasso(1)} style={{ flex: 0.8, padding: '9px 12px', fontSize: '0.85rem' }}>
                    Voltar
                  </button>
                )}
                <button
                  type="submit"
                  className="btn btn-primario"
                  disabled={!podeAvancar}
                  style={{
                    flex: 1.2,
                    padding: '9px 14px',
                    fontSize: '0.88rem',
                    fontWeight: 700,
                    opacity: podeAvancar ? 1 : 0.45,
                    cursor: podeAvancar ? 'pointer' : 'not-allowed',
                    transition: 'all 0.2s',
                  }}
                >
                  {carregando ? "Enviando código..." : "Criar Conta ➔"}
                </button>
              </div>
            </form>
          )}

          {/* ── PASSO 3: DIGITAÇÃO DO CÓDIGO OTP (6 DÍGITOS) ── */}
          {passo === 3 && (
            <form onSubmit={handleConfirmarCadastro} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {sucesso && (
                <div style={{
                  background: "#f0fdf4",
                  border: "1px solid #86efac",
                  borderRadius: "8px",
                  padding: "10px 12px",
                  color: "#15803d",
                  fontSize: "0.82rem",
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}>
                  <span>✓</span>
                  <span>{sucesso}</span>
                </div>
              )}

              {erro && (
                <div style={{
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: '8px',
                  padding: '8px 12px',
                  color: '#991b1b',
                  fontSize: '0.78rem',
                }}>
                  {erro}
                </div>
              )}

              <div style={{ textAlign: "center", padding: '8px 0' }}>
                <label style={{ display: "block", marginBottom: "6px", fontSize: '0.82rem', color: '#475569', fontWeight: 600 }}>
                  Digite o código de 6 dígitos recebido por e-mail:
                </label>
                <input
                  type="text"
                  maxLength={6}
                  value={codigoOtp}
                  onChange={(e) => setCodigoOtp(e.target.value.replace(/\D/g, ""))}
                  placeholder="123456"
                  className="campo"
                  style={{
                    textAlign: "center",
                    fontSize: "1.6rem",
                    letterSpacing: "0.35em",
                    fontWeight: 800,
                    color: "var(--cor-primaria)",
                    padding: "10px",
                    width: "220px",
                    margin: "0 auto",
                  }}
                  autoFocus
                  required
                />
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <button
                  type="button"
                  onClick={() => setPasso(2)}
                  style={{ background: "none", border: "none", color: "#64748b", fontSize: "0.78rem", cursor: "pointer", fontWeight: 600 }}
                >
                  ← Corrigir dados
                </button>

                <button
                  type="button"
                  onClick={handleReenviarOtp}
                  disabled={carregando || timerReenvio > 0}
                  style={{
                    background: "none",
                    border: "none",
                    color: timerReenvio > 0 ? "#94a3b8" : "var(--cor-primaria)",
                    fontSize: "0.78rem",
                    cursor: timerReenvio > 0 ? "not-allowed" : "pointer",
                    fontWeight: 600,
                  }}
                >
                  {timerReenvio > 0 ? `Reenviar em ${timerReenvio}s` : "🔄 Reenviar código"}
                </button>
              </div>

              <button
                type="submit"
                className="btn btn-primario"
                disabled={carregando || codigoOtp.length < 6}
                style={{ width: "100%", padding: '10px', fontSize: '0.88rem', fontWeight: 700, marginTop: '4px' }}
              >
                {carregando ? "Validando e Ativando..." : "✓ Confirmar e Ativar Conta"}
              </button>
            </form>
          )}

          <div style={{ marginTop: '0.85rem', paddingTop: '0.75rem', borderTop: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '0.82rem', color: '#64748b' }}>
            <span>Já tem conta?</span>
            <Link href="/login" style={{ color: '#1565c0', fontWeight: 700, textDecoration: 'none' }}>
              Entrar
            </Link>
          </div>

        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          LADO DIREITO: BANNER VISUAL (CUSTOMIZADO PARA CONVITE DE EQUIPE)
          ═══════════════════════════════════════════════════════════════ */}
      <div className={styles.ladoVisual}>
        <div className={styles.glow1} />
        <div className={styles.glow2} />
        <div className={styles.gridBackground} />

        <div className={styles.ladoVisualConteudo}>
          {imobiliariaId ? (
            /* ── BANNER DEDICADO PARA CONVITE DE EQUIPE ── */
            <>
              <div className={styles.badgeDestaque} style={{ borderColor: 'rgba(56, 189, 248, 0.4)', color: '#38bdf8' }}>
                <span className={styles.pontoVerde} />
                <span>🤝 CONVITE OFICIAL DE EQUIPE</span>
              </div>

              <h2 style={{ fontSize: 'clamp(1.7rem, 2.8vw, 2.3rem)', marginBottom: '0.85rem' }}>
                Seja muito bem-vindo à equipe da <span style={{ color: '#38bdf8' }}>{empresaNome}</span>!
              </h2>

              <p style={{ fontSize: '0.95rem', lineHeight: 1.6, marginBottom: '1.5rem', color: '#cbd5e1' }}>
                Você foi convidado para compor o time oficial de corretores da imobiliária no Fixum. Conecte-se agora para acelerar suas vendas com inteligência de mapa.
              </p>

              {/* Card Flutuante de Perfil da Imobiliária e Benefícios */}
              <div className={styles.cardPreviewGlass} style={{ background: 'rgba(15, 23, 42, 0.65)', border: '1px solid rgba(56, 189, 248, 0.25)', padding: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingBottom: '12px', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
                  <div style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '12px',
                    background: obterGradienteUsuario(imobiliariaId || empresaNome),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ffffff',
                    fontWeight: 800,
                    fontSize: '1.1rem',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
                    overflow: 'hidden',
                  }}>
                    {imobiliariaInfo?.foto_url ? (
                      <img src={imobiliariaInfo.foto_url} alt={empresaNome} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      obterIniciaisUsuario(empresaNome, '')
                    )}
                  </div>

                  <div>
                    <h3 style={{ margin: 0, color: '#ffffff', fontSize: '1rem', fontWeight: 800 }}>
                      {empresaNome}
                    </h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px', fontSize: '0.75rem', color: '#38bdf8' }}>
                      <span>✓ Imobiliária Parceira Oficial</span>
                      {imobiliariaInfo?.cidade && <span>• {imobiliariaInfo.cidade}/{imobiliariaInfo.estado || 'MG'}</span>}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                    <span style={{ fontSize: '1.1rem' }}>⚡</span>
                    <div>
                      <strong style={{ color: '#ffffff', fontSize: '0.85rem' }}>Inventário Conectado</strong>
                      <div style={{ color: '#94a3b8', fontSize: '0.75rem' }}>Publique e gerencie seus anúncios no portfólio da imobiliária.</div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                    <span style={{ fontSize: '1.1rem' }}>📱</span>
                    <div>
                      <strong style={{ color: '#ffffff', fontSize: '0.85rem' }}>Leads Diretos no WhatsApp</strong>
                      <div style={{ color: '#94a3b8', fontSize: '0.75rem' }}>Interessados entram em contato direto com você em 1 toque.</div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                    <span style={{ fontSize: '1.1rem' }}>🗺️</span>
                    <div>
                      <strong style={{ color: '#ffffff', fontSize: '0.85rem' }}>Destaque Geolocalizado</strong>
                      <div style={{ color: '#94a3b8', fontSize: '0.75rem' }}>Máxima visibilidade nas buscas de compradores por bairro e mapa.</div>
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.78rem', color: '#94a3b8' }}>
                <span>🔒 Acesso 100% gratuito para corretores</span>
                <span>•</span>
                <span>⚡ Ativação imediata</span>
              </div>
            </>
          ) : (
            /* ── BANNER PADRÃO INSTITUCIONAL ── */
            <>
              <div className={styles.badgeDestaque}>
                <span className={styles.pontoVerde} />
                <span>MAPA DE IMÓVEIS EM TEMPO REAL</span>
              </div>

              <h2>
                Anuncie com precisão e <span style={{ color: '#38bdf8' }}>venda mais rápido</span>
              </h2>

              <p>
                Junte-se a corretores, imobiliárias e proprietários que anunciam seus imóveis diretamente no mapa geolocalizado da Fixum.
              </p>

              <div className={styles.cardPreviewGlass}>
                <div className={styles.cardPreviewTopo}>
                  <span className={styles.tagStatus}>✓ Lead em Tempo Real</span>
                  <span className={styles.horarioLead}>Agora mesmo</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '6px' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff', fontWeight: 800, fontSize: '0.85rem' }}>
                    F
                  </div>
                  <div>
                    <div style={{ color: '#ffffff', fontWeight: 700, fontSize: '0.85rem' }}>Novo interessado no seu imóvel</div>
                    <div style={{ color: '#94a3b8', fontSize: '0.75rem' }}>Bairro Funcionários • Belo Horizonte</div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default function CadastroPage() {
  return (
    <Suspense fallback={<div>Carregando...</div>}>
      <CadastroConteudo />
    </Suspense>
  )
}