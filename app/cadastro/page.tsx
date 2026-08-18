"use client"

import { useState, useEffect, Suspense } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import LogoGota from "@/components/ui/LogoGota"
import InputSenha from "@/components/ui/InputSenha"
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
  const imobiliariaId = searchParams.get("imobiliaria") ?? ""
  const [empresaNome, setEmpresaNome] = useState(searchParams.get("empresa") ?? "Imobiliária")
  const tipoParam = imobiliariaId ? "corretor" : (searchParams.get("tipo") ?? "")
  const [tipo, setTipo] = useState(tipoParam)
  const [passo, setPasso] = useState((tipoParam || imobiliariaId) ? 2 : 1)
  const [nome, setNome] = useState("")
  const [email, setEmail] = useState("")
  const [telefone, setTelefone] = useState("")
  const [creci, setCreci] = useState("")
  const [senha, setSenha] = useState("")
  const [carregando, setCarregando] = useState(false)
  const [carregandoGoogle, setCarregandoGoogle] = useState(false)
  const [erro, setErro] = useState("")

  // Buscar nome da imobiliária no banco de dados se tiver ID
  useEffect(() => {
    if (!imobiliariaId) return
    async function carregarImobiliaria() {
      const supabase = createClient()
      const { data } = await supabase
        .from('perfis')
        .select('nome')
        .eq('id', imobiliariaId)
        .single()

      if (data?.nome) {
        setEmpresaNome(data.nome)
      }
    }
    carregarImobiliaria()
  }, [imobiliariaId])

  const isImobiliaria = tipo === "imobiliaria"
  const isCorretor = tipo === "corretor"

  async function handleCadastrar(e: React.FormEvent) {
    e.preventDefault()
    setErro("")
    setCarregando(true)
    try {
      const tipoFinal = tipo || (imobiliariaId ? "corretor" : "imobiliaria")

      // 1. Criar usuário com auto-confirmação para evitar o limite de envio de e-mails do Supabase
      const res = await fetch('/api/auth/cadastrar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          password: senha,
          nome,
          tipo: tipoFinal,
          telefone: telefone || null,
          imobiliaria_id: imobiliariaId || null,
          creci: creci || null,
        }),
      })

      const json = await res.json()
      if (!res.ok) {
        throw new Error(json.error || 'Erro ao processar cadastro')
      }

      // 2. Fazer login automático na sessão do cliente
      const supabase = createClient()
      const { error: loginError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: senha,
      })

      if (loginError) {
        throw loginError
      }

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
    <div className={styles.pagina}>
      <div className={styles.lado}>
        <div className={styles.ladoConteudo}>
          <Link href="/" className={styles.logo}>
            <LogoGota size={30} />
            <span>FIXUM</span>
          </Link>

          <h1>
            {imobiliariaId
              ? "Convite de Equipe"
              : isImobiliaria
              ? "Cadastrar Imobiliária"
              : isCorretor
              ? "Cadastro de Corretor"
              : "Criar sua conta"}
          </h1>
          <p>
            {imobiliariaId
              ? `Cadastre-se como corretor parceiro vinculado à ${empresaNome}`
              : isImobiliaria
              ? "Crie a conta corporativa da sua imobiliária no FIXUM"
              : isCorretor
              ? "Publique seus imóveis e receba contatos diretos no WhatsApp"
              : "Junte-se a pessoas encontrando e anunciando imóveis"}
          </p>

          {imobiliariaId && (
            <div style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "6px 14px",
              background: "#f0fdf4",
              border: "1.5px solid #86efac",
              color: "#15803d",
              borderRadius: "8px",
              fontSize: "0.85rem",
              fontWeight: 700,
              marginBottom: "16px",
            }}>
              🤝 Equipe Oficial: {empresaNome}
            </div>
          )}

          {isImobiliaria && !imobiliariaId && (
            <div style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "6px 12px",
              background: "#eff6ff",
              border: "1px solid #bfdbfe",
              color: "#1d4ed8",
              borderRadius: "8px",
              fontSize: "0.8rem",
              fontWeight: 700,
              marginBottom: "16px",
            }}>
              🏢 Perfil Imobiliária Selecionado
            </div>
          )}

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
            {carregandoGoogle
              ? "Conectando..."
              : isImobiliaria
              ? "Cadastrar com Google Corporativo"
              : "Continuar com Google"}
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
                <label>{isImobiliaria ? "Nome da Imobiliária / Razão Social" : "Nome completo"}</label>
                <input
                  type="text"
                  className="campo"
                  placeholder={isImobiliaria ? "Ex: Imobiliária Primária" : "Seu nome"}
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  required
                />
              </div>

              <div className={styles.campo}>
                <label>{isImobiliaria ? "E-mail Corporativo" : "E-mail"}</label>
                <input
                  type="email"
                  className="campo"
                  placeholder={isImobiliaria ? "contato@suaimobiliaria.com.br" : "seu@email.com"}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              {(isImobiliaria || isCorretor) && (
                <div className={styles.campo}>
                  <label>WhatsApp / Telefone de Contato</label>
                  <input
                    type="tel"
                    className="campo"
                    placeholder="(31) 99999-9999"
                    value={telefone}
                    onChange={(e) => setTelefone(e.target.value)}
                  />
                </div>
              )}

              {isCorretor && (
                <div className={styles.campo}>
                  <label>CRECI (Opcional)</label>
                  <input
                    type="text"
                    className="campo"
                    placeholder="Ex: MG-12345"
                    value={creci}
                    onChange={(e) => setCreci(e.target.value)}
                  />
                </div>
              )}

              <div className={styles.campo}>
                <label>Senha</label>
                <InputSenha
                  placeholder="Mínimo 8 caracteres"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  minLength={8}
                  required
                />
              </div>

              {senha.length > 0 && (
                <div style={{ marginBottom: "1rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", marginBottom: "4px" }}>
                    <span style={{ color: "#64748b" }}>Força da senha:</span>
                    <strong style={{
                      color: senha.length < 8 ? "#ef4444" : (/[A-Z]/.test(senha) && /[0-9]/.test(senha)) ? "#10b981" : "#f59e0b"
                    }}>
                      {senha.length < 8 ? "Muito curta" : (/[A-Z]/.test(senha) && /[0-9]/.test(senha)) ? "Forte" : "Média"}
                    </strong>
                  </div>
                  <div style={{ display: "flex", gap: "4px", height: "4px" }}>
                    <div style={{ flex: 1, borderRadius: "2px", background: senha.length >= 8 ? (/[A-Z]/.test(senha) && /[0-9]/.test(senha) ? "#10b981" : "#f59e0b") : "#ef4444" }} />
                    <div style={{ flex: 1, borderRadius: "2px", background: senha.length >= 8 ? (/[A-Z]/.test(senha) && /[0-9]/.test(senha) ? "#10b981" : "#f59e0b") : "#e2e8f0" }} />
                    <div style={{ flex: 1, borderRadius: "2px", background: (senha.length >= 8 && /[A-Z]/.test(senha) && /[0-9]/.test(senha)) ? "#10b981" : "#e2e8f0" }} />
                  </div>
                </div>
              )}

              {erro && <div className={styles.erro}>{erro}</div>}

              <div style={{ display: "flex", gap: "10px" }}>
                {!tipoParam && (
                  <button type="button" className="btn btn-outline btn-lg" onClick={() => setPasso(1)} style={{ flex: 1 }}>
                    Voltar
                  </button>
                )}
                <button
                  type="submit"
                  className="btn btn-primario btn-lg"
                  disabled={carregando || senha.length < 8}
                  style={{ flex: 1 }}
                >
                  {carregando
                    ? "Criando conta..."
                    : isImobiliaria
                    ? "Criar Conta Imobiliária"
                    : isCorretor
                    ? "Criar Conta de Corretor"
                    : "Criar Conta"}
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