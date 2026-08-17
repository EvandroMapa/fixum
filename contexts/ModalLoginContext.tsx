'use client'

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react'

interface ModalLoginContextType {
  abrirModalLogin: (mensagem?: string) => void
  fecharModalLogin: () => void
}

const ModalLoginContext = createContext<ModalLoginContextType>({
  abrirModalLogin: () => {},
  fecharModalLogin: () => {},
})

export function useModalLogin() {
  return useContext(ModalLoginContext)
}

export function ModalLoginProvider({ children }: { children: ReactNode }) {
  const [aberto, setAberto] = useState(false)
  const [mensagem, setMensagem] = useState<string | undefined>()

  const abrirModalLogin = useCallback((msg?: string) => {
    setMensagem(msg)
    setAberto(true)
  }, [])

  const fecharModalLogin = useCallback(() => {
    setAberto(false)
    setMensagem(undefined)
  }, [])

  // Permite que código fora do React (ex: popup do mapa) abra o modal via evento global
  useEffect(() => {
    function onEvento(e: Event) {
      const detail = (e as CustomEvent).detail
      abrirModalLogin(detail?.mensagem)
    }
    window.addEventListener('fixum:abrirModalLogin', onEvento)
    return () => window.removeEventListener('fixum:abrirModalLogin', onEvento)
  }, [abrirModalLogin])
  return (
    <ModalLoginContext.Provider value={{ abrirModalLogin, fecharModalLogin }}>
      {children}
      {aberto && (
        <ModalLoginInterno
          mensagem={mensagem}
          onFechar={fecharModalLogin}
        />
      )}
    </ModalLoginContext.Provider>
  )
}

// ─── Modal interno ────────────────────────────────────────────────────────────

function traduzirErro(msg: string): string {
  if (msg.includes('For security purposes') || msg.includes('after')) {
    const segundos = msg.match(/\d+/)?.[0] ?? 'alguns'
    return `Por segurança, aguarde ${segundos} segundos.`
  }
  if (msg.includes('Invalid login credentials')) return 'E-mail ou senha incorretos.'
  if (msg.includes('Email not confirmed')) return 'Confirme seu e-mail antes de entrar.'
  return 'E-mail ou senha incorretos.'
}

function ModalLoginInterno({
  mensagem,
  onFechar,
}: {
  mensagem?: string
  onFechar: () => void
}) {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [carregandoGoogle, setCarregandoGoogle] = useState(false)
  const [erro, setErro] = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    setCarregando(true)
    try {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithPassword({ email, password: senha })
      if (error) throw error
      onFechar()
      // Recarrega a página para refletir o estado logado
      window.location.reload()
    } catch (err: unknown) {
      setErro(traduzirErro(err instanceof Error ? err.message : ''))
    } finally {
      setCarregando(false)
    }
  }

  async function handleGoogle() {
    setCarregandoGoogle(true)
    setErro('')
    try {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}${window.location.pathname}` },
      })
      if (error) throw error
    } catch {
      setErro('Erro ao conectar com Google. Tente novamente.')
      setCarregandoGoogle(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 10000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px',
        background: 'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(4px)',
        animation: 'fadeIn 0.2s ease',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onFechar() }}
    >
      <div style={{
        background: 'white',
        borderRadius: '24px',
        padding: '40px 36px',
        width: '100%',
        maxWidth: '420px',
        boxShadow: '0 24px 80px rgba(0,0,0,0.18)',
        position: 'relative',
        animation: 'slideUp 0.25s ease',
      }}>
        {/* Fechar */}
        <button
          onClick={onFechar}
          style={{
            position: 'absolute', top: '16px', right: '16px',
            width: '32px', height: '32px', borderRadius: '50%',
            border: 'none', background: '#f1f5f9', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '18px', color: '#64748b',
          }}
        >×</button>

        {/* Ícone de coração */}
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <div style={{
            width: '56px', height: '56px', borderRadius: '50%',
            background: 'linear-gradient(135deg, #ff6b6b, #ee5a24)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 12px', fontSize: '26px',
            boxShadow: '0 8px 24px rgba(238,90,36,0.35)',
          }}>❤️</div>
          <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a', margin: '0 0 6px' }}>
            {mensagem ?? 'Entre para salvar imóveis'}
          </h2>
          <p style={{ fontSize: '14px', color: '#64748b', margin: 0 }}>
            Salve seus imóveis favoritos e acesse de qualquer dispositivo.
          </p>
        </div>

        {/* Google */}
        <button
          type="button"
          onClick={handleGoogle}
          disabled={carregandoGoogle}
          style={{
            width: '100%', padding: '12px', borderRadius: '12px',
            border: '1.5px solid #e2e8f0', background: 'white',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: '10px', fontSize: '14px', fontWeight: 600, cursor: 'pointer',
            color: '#0f172a', marginBottom: '16px',
            transition: 'all 0.15s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = '#f8fafc')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'white')}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
            <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
            <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853"/>
            <path d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71s.102-1.17.282-1.71V4.958H.957C.347 6.173 0 7.548 0 9s.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
            <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
          </svg>
          {carregandoGoogle ? 'Conectando...' : 'Continuar com Google'}
        </button>

        {/* Divisor */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '12px',
          marginBottom: '16px', color: '#94a3b8', fontSize: '13px',
        }}>
          <div style={{ flex: 1, height: '1px', background: '#e2e8f0' }} />
          ou
          <div style={{ flex: 1, height: '1px', background: '#e2e8f0' }} />
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <input
            type="email"
            placeholder="E-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{
              padding: '12px 14px', borderRadius: '12px',
              border: '1.5px solid #e2e8f0', fontSize: '14px',
              outline: 'none', transition: 'border 0.15s',
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = '#3b82f6')}
            onBlur={(e) => (e.currentTarget.style.borderColor = '#e2e8f0')}
          />
          <input
            type="password"
            placeholder="Senha"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            required
            style={{
              padding: '12px 14px', borderRadius: '12px',
              border: '1.5px solid #e2e8f0', fontSize: '14px',
              outline: 'none', transition: 'border 0.15s',
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = '#3b82f6')}
            onBlur={(e) => (e.currentTarget.style.borderColor = '#e2e8f0')}
          />

          {erro && (
            <div style={{
              background: '#fef2f2', border: '1px solid #fecaca',
              color: '#dc2626', padding: '10px 12px', borderRadius: '10px',
              fontSize: '13px',
            }}>{erro}</div>
          )}

          <button
            type="submit"
            disabled={carregando}
            style={{
              padding: '13px', borderRadius: '12px', border: 'none',
              background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
              color: 'white', fontSize: '15px', fontWeight: 700,
              cursor: carregando ? 'not-allowed' : 'pointer',
              opacity: carregando ? 0.7 : 1, transition: 'all 0.15s',
              boxShadow: '0 4px 14px rgba(59,130,246,0.4)',
            }}
          >
            {carregando ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        {/* Cadastro */}
        <p style={{
          textAlign: 'center', marginTop: '20px',
          fontSize: '13px', color: '#64748b',
        }}>
          Não tem conta?{' '}
          <a
            href="/cadastro"
            style={{ color: '#3b82f6', fontWeight: 600, textDecoration: 'none' }}
          >
            Criar conta grátis
          </a>
        </p>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(24px) } to { opacity: 1; transform: translateY(0) } }
      `}</style>
    </div>
  )
}
