import Link from 'next/link'
import Header from '@/components/layout/Header'

export default function NotFound() {
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
            maxWidth: '520px',
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '1.5rem',
            padding: '3rem 2rem',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1rem',
          }}
        >
          <div style={{ fontSize: '3.5rem', lineHeight: 1 }}>🏡🔍</div>
          <h1
            style={{
              fontSize: '1.6rem',
              fontWeight: 800,
              color: '#0f172a',
              letterSpacing: '-0.02em',
              marginTop: '0.5rem',
            }}
          >
            Imóvel ou página não encontrada
          </h1>
          <p
            style={{
              fontSize: '0.95rem',
              color: '#64748b',
              lineHeight: 1.6,
              marginBottom: '1rem',
            }}
          >
            O imóvel que você procura pode ter sido desativado, vendido ou o endereço digitado não existe.
          </p>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
              width: '100%',
            }}
          >
            <Link
              href="/explorar"
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
              🗺️ Explorar Imóveis no Mapa
            </Link>
            <Link
              href="/"
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
              Voltar ao Início
            </Link>
          </div>
        </div>
      </main>
    </>
  )
}
