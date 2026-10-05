'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { fatorPendente, confirmarCodigoTotp } from '@/lib/auth/mfa-cliente'
import InputSenha from '@/components/ui/InputSenha'
import styles from './FluxoEntrada.module.css'

/**
 * Fluxo único de entrada usado na página /login e no modal de login:
 *   Google  ·  e-mail → código de 6 dígitos (padrão)  ·  e-mail + senha (opcional)
 *   → app autenticador, se a conta tiver verificação em duas etapas.
 */

type Etapa = 'email' | 'codigo' | 'senha' | '2fa'

interface Props {
  /** Chamado quando a pessoa está totalmente autenticada (inclusive 2FA, se houver) */
  aoConcluir: () => void | Promise<void>
  /** Caminho para onde o login com Google deve voltar */
  destino?: string
  /** Começa direto na etapa do app autenticador (ex.: voltando do Google com 2FA) */
  etapaInicial?: Etapa
  /** Mensagem de erro inicial (ex.: falha no login com Google) */
  erroInicial?: string
}

const ESPERA_REENVIO_S = 60

function traduzirErro(mensagem: string): string {
  const msg = mensagem || ''
  const segundos = msg.match(/after (\d+) seconds?/)?.[1]
  if (segundos) return `Por segurança, aguarde ${segundos} segundos para pedir outro código.`
  if (msg.includes('Signups not allowed') || msg.includes('User not found')) return 'SEM_CONTA'
  if (msg.includes('Token has expired') || msg.includes('invalid') || msg.includes('Invalid OTP')) return 'Código incorreto ou expirado. Confira o e-mail ou peça um novo código.'
  if (msg.includes('Invalid login credentials')) return 'E-mail ou senha incorretos. Se não lembra a senha, entre com um código por e-mail.'
  if (msg.includes('Email not confirmed')) return 'Confirme seu e-mail entrando com um código.'
  if (msg.includes('rate limit') || msg.includes('Too many')) return 'Muitas tentativas seguidas. Aguarde alguns minutos e tente de novo.'
  return 'Não foi possível entrar agora. Tente novamente.'
}

export default function FluxoEntrada({ aoConcluir, destino = '/painel', etapaInicial = 'email', erroInicial = '' }: Props) {
  const [etapa, setEtapa] = useState<Etapa>(etapaInicial)
  const [email, setEmail] = useState('')
  const [codigo, setCodigo] = useState('')
  const [senha, setSenha] = useState('')
  const [fatorId, setFatorId] = useState('')
  const [erro, setErro] = useState(erroInicial)
  const [semConta, setSemConta] = useState(false)
  const [carregando, setCarregando] = useState(false)
  const [carregandoGoogle, setCarregandoGoogle] = useState(false)
  const [esperaReenvio, setEsperaReenvio] = useState(0)

  // Contagem regressiva para reenviar o código
  useEffect(() => {
    if (esperaReenvio <= 0) return
    const t = setTimeout(() => setEsperaReenvio((s) => s - 1), 1000)
    return () => clearTimeout(t)
  }, [esperaReenvio])

  // Voltando do Google com 2FA ativo: localizar o fator a confirmar
  useEffect(() => {
    if (etapaInicial !== '2fa') return
    fatorPendente(createClient()).then((id) => {
      if (id) setFatorId(id)
      else void aoConcluir()
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function mostrarErro(err: unknown) {
    const texto = traduzirErro(err instanceof Error ? err.message : String(err ?? ''))
    setSemConta(texto === 'SEM_CONTA')
    setErro(texto === 'SEM_CONTA' ? 'Não encontramos uma conta com este e-mail.' : texto)
  }

  // Depois de entrar (código ou senha): pede o app autenticador se a conta tiver 2FA
  async function finalizarEntrada() {
    const pendente = await fatorPendente(createClient())
    if (pendente) {
      setFatorId(pendente)
      setCodigo('')
      setEtapa('2fa')
      setCarregando(false)
      return
    }
    await aoConcluir()
  }

  async function enviarCodigo(e?: React.FormEvent) {
    e?.preventDefault()
    setErro('')
    setSemConta(false)
    setCarregando(true)
    try {
      const { error } = await createClient().auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: { shouldCreateUser: false },
      })
      if (error) throw error
      setCodigo('')
      setEtapa('codigo')
      setEsperaReenvio(ESPERA_REENVIO_S)
    } catch (err) {
      mostrarErro(err)
    } finally {
      setCarregando(false)
    }
  }

  async function confirmarCodigo(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    setCarregando(true)
    try {
      const { error } = await createClient().auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token: codigo,
        type: 'email',
      })
      if (error) throw error
      await finalizarEntrada()
    } catch (err) {
      mostrarErro(err)
      setCarregando(false)
    }
  }

  async function entrarComSenha(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    setSemConta(false)
    setCarregando(true)
    try {
      const { error } = await createClient().auth.signInWithPassword({ email: email.trim().toLowerCase(), password: senha })
      if (error) throw error
      await finalizarEntrada()
    } catch (err) {
      mostrarErro(err)
      setCarregando(false)
    }
  }

  async function confirmar2fa(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    setCarregando(true)
    try {
      await confirmarCodigoTotp(createClient(), fatorId, codigo)
      await aoConcluir()
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Código incorreto.')
      setCarregando(false)
    }
  }

  async function cancelar2fa() {
    await createClient().auth.signOut()
    setCodigo('')
    setEtapa('email')
  }

  async function entrarComGoogle() {
    setErro('')
    setCarregandoGoogle(true)
    const { error } = await createClient().auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(destino)}` },
    })
    if (error) {
      setErro('Erro ao conectar com o Google. Tente novamente.')
      setCarregandoGoogle(false)
    }
  }

  const blocoErro = erro && (
    <div className={styles.erro} role="alert">
      {erro}
      {semConta && <> <Link href="/cadastro">Criar uma conta gratuita</Link></>}
    </div>
  )

  if (etapa === '2fa') {
    return (
      <form onSubmit={confirmar2fa} className={styles.form}>
        <p className={styles.aviso}>
          Sua conta tem verificação em duas etapas. Digite o código de 6 dígitos do seu app autenticador.
        </p>
        <div className={styles.campo}>
          <label htmlFor="codigo-2fa">Código do app autenticador</label>
          <input
            id="codigo-2fa"
            className={`campo ${styles.campoCodigo}`}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="000000"
            maxLength={6}
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))}
            autoFocus
            required
          />
        </div>
        {blocoErro}
        <button type="submit" className={`btn btn-primario ${styles.btnPrincipal}`} disabled={carregando || !fatorId || codigo.length < 6}>
          {carregando ? 'Verificando…' : 'Confirmar e entrar'}
        </button>
        <div className={styles.acoesSecundarias}>
          <button type="button" className={styles.link} onClick={cancelar2fa}>Sair e usar outra conta</button>
        </div>
      </form>
    )
  }

  if (etapa === 'codigo') {
    return (
      <form onSubmit={confirmarCodigo} className={styles.form}>
        <p className={styles.aviso}>
          Enviamos um código para <strong>{email}</strong>. Ele vale por alguns minutos — confira também a caixa de spam.
        </p>
        <div className={styles.campo}>
          <label htmlFor="codigo-email">Código recebido por e-mail</label>
          <input
            id="codigo-email"
            className={`campo ${styles.campoCodigo}`}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="000000"
            maxLength={8}
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))}
            autoFocus
            required
          />
        </div>
        {blocoErro}
        <button type="submit" className={`btn btn-primario ${styles.btnPrincipal}`} disabled={carregando || codigo.length < 6}>
          {carregando ? 'Entrando…' : 'Entrar'}
        </button>
        <div className={styles.acoesSecundarias}>
          <button type="button" className={styles.link} onClick={() => enviarCodigo()} disabled={esperaReenvio > 0 || carregando}>
            {esperaReenvio > 0 ? `Reenviar código em ${esperaReenvio}s` : 'Reenviar código'}
          </button>
          <button type="button" className={styles.link} onClick={() => { setEtapa('email'); setErro('') }}>Usar outro e-mail</button>
        </div>
      </form>
    )
  }

  return (
    <div className={styles.fluxo}>
      <button type="button" onClick={entrarComGoogle} disabled={carregandoGoogle} className={styles.btnGoogle}>
        <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
          <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853"/>
          <path d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71s.102-1.17.282-1.71V4.958H.957C.347 6.173 0 7.548 0 9s.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
          <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
        </svg>
        <span>{carregandoGoogle ? 'Conectando…' : 'Continuar com Google'}</span>
      </button>

      <div className={styles.divisor}><span>ou com seu e-mail</span></div>

      {etapa === 'senha' ? (
        <form onSubmit={entrarComSenha} className={styles.form}>
          <div className={styles.campo}>
            <label htmlFor="entrada-email-senha">E-mail</label>
            <input
              id="entrada-email-senha"
              type="email"
              className="campo"
              autoComplete="email"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className={styles.campo}>
            <div className={styles.cabecalhoCampo}>
              <label htmlFor="entrada-senha">Senha</label>
              <button type="button" className={styles.link} onClick={() => (email ? enviarCodigo() : setEtapa('email'))}>
                Esqueceu? Entrar com código
              </button>
            </div>
            <InputSenha
              id="entrada-senha"
              autoComplete="current-password"
              placeholder="Sua senha"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              required
            />
          </div>
          {blocoErro}
          <button type="submit" className={`btn btn-primario ${styles.btnPrincipal}`} disabled={carregando}>
            {carregando ? 'Entrando…' : 'Entrar'}
          </button>
          <div className={styles.acoesSecundarias}>
            <button type="button" className={styles.link} onClick={() => { setEtapa('email'); setErro('') }}>
              Entrar sem senha, com código por e-mail
            </button>
          </div>
        </form>
      ) : (
        <form onSubmit={enviarCodigo} className={styles.form}>
          <div className={styles.campo}>
            <label htmlFor="entrada-email">E-mail</label>
            <input
              id="entrada-email"
              type="email"
              className="campo"
              autoComplete="email"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          {blocoErro}
          <button type="submit" className={`btn btn-primario ${styles.btnPrincipal}`} disabled={carregando}>
            {carregando ? 'Enviando código…' : 'Receber código por e-mail'}
          </button>
          <div className={styles.acoesSecundarias}>
            <button type="button" className={styles.link} onClick={() => { setEtapa('senha'); setErro('') }}>
              Prefiro entrar com senha
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
