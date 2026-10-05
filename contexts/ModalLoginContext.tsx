'use client'

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react'
import Icone from '@/components/ui/Icone'
import FluxoEntrada from '@/components/auth/FluxoEntrada'

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

function ModalLoginInterno({
  mensagem,
  onFechar,
}: {
  mensagem?: string
  onFechar: () => void
}) {
  // Login concluído: recarrega a página para refletir o estado logado
  function aoConcluir() {
    onFechar()
    window.location.reload()
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 10000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px',
        background: 'rgba(22, 32, 28, 0.5)',
        backdropFilter: 'blur(6px)',
        animation: 'fadeIn 0.2s ease',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onFechar() }}
    >
      <div style={{
        background: 'white',
        borderRadius: '20px',
        padding: '36px 28px 28px',
        width: '100%',
        maxWidth: '420px',
        maxHeight: 'calc(100dvh - 32px)',
        overflowY: 'auto',
        boxShadow: '0 30px 80px rgba(22, 32, 28, 0.28)',
        position: 'relative',
        animation: 'slideUp 0.25s ease',
      }}>
        {/* Fechar */}
        <button
          onClick={onFechar}
          style={{
            position: 'absolute', top: '16px', right: '16px',
            width: '40px', height: '40px', borderRadius: '50%',
            border: 'none', background: '#F3EEE4', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#3F3B34',
          }}
          aria-label="Fechar"
        ><Icone nome="fechar" tamanho={18} /></button>

        {/* Ícone de fixar */}
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <div style={{
            width: '56px', height: '56px', borderRadius: '50%',
            background: '#FBE6DF', color: '#D4401F',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 14px',
          }}><Icone nome="fixar" tamanho={26} /></div>
          <h2 style={{ fontSize: '22px', fontWeight: 700, letterSpacing: '-0.02em', color: '#16201C', margin: '0 0 6px' }}>
            {mensagem ?? 'Entre para fixar imóveis'}
          </h2>
          <p style={{ fontSize: '14px', color: '#7A7264', margin: 0 }}>
            Fixe imóveis para comparar depois e acesse de qualquer dispositivo.
          </p>
        </div>

        <FluxoEntrada
          aoConcluir={aoConcluir}
          destino={typeof window !== 'undefined' ? window.location.pathname : '/'}
        />

        {/* Cadastro */}
        <p style={{
          textAlign: 'center', marginTop: '20px',
          fontSize: '13px', color: '#7A7264',
        }}>
          Não tem conta?{' '}
          <a
            href="/cadastro"
            style={{ color: '#16201C', fontWeight: 600, textDecoration: 'underline', textUnderlineOffset: '3px' }}
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
