'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import Header from '@/components/layout/Header'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Erro na aplicação:', error)
  }, [error])

  return (
    <>
      <Header />
      <main
        style={{
          minHeight: 'calc(100vh - 68px)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem 1.5rem',
          textAlign: 'center',
          background: '#f8fafc',
        }}
      >
        <div
          style={{
            maxWidth: '500px',
            background: '#ffffff',
            border: '1px solid #fee2e2',
            borderRadius: '1.5rem',
            padding: '3rem 2rem',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1rem',
          }}
        >
          <div style={{ fontSize: '3.5rem', lineHeight: 1 }}>⚠️</div>
          <h1
            style={{
              fontSize: '1.5rem',
              fontWeight: 800,
              color: '#0f172a',
              letterSpacing: '-0.02em',
              marginTop: '0.5rem',
            }}
          >
            Não foi possível carregar o imóvel
          </h1>
          <p
            style={{
              fontSize: '0.95rem',
              color: '#64748b',
              lineHeight: 1.6,
              marginBottom: '1rem',
            }}
          >
            Ocorreu uma instabilidade temporária ao carregar as informações. Tente recarregar ou volte para o mapa.
          </p>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
              width: '100%',
            }}
          >
            <button
              onClick={() => reset()}
              className="btn btn-primario btn-lg"
              style={{
                width: '100%',
                justifyContent: 'center',
                textAlign: 'center',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                height: '48px',
              }}
            >
              🔄 Tentar Novamente
            </button>
            <Link
              href="/explorar"
              className="btn btn-outline btn-lg"
              style={{
                width: '100%',
                justifyContent: 'center',
                textAlign: 'center',
                display: 'flex',
                alignItems: 'center',
                height: '48px',
              }}
            >
              🗺️ Explorar Outros Imóveis
            </Link>
          </div>
        </div>
      </main>
    </>
  )
}
