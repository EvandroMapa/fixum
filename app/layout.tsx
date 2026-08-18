import type { Metadata } from 'next'
import './globals.css'
import { ModalLoginProvider } from '@/contexts/ModalLoginContext'

export const metadata: Metadata = {
  title: 'FIXUM — Encontre seu lugar.',
  description: 'FIXUM — Plataforma imobiliária centrada em mapas. Explore bairros, descubra imóveis e encontre o lugar onde você quer viver.',
  keywords: 'imóveis, venda, aluguel, mapa, casas, apartamentos, imobiliária, corretores',
  metadataBase: new URL('https://www.fixum.com.br'),
  openGraph: {
    title: 'FIXUM — Encontre seu lugar.',
    description: 'Plataforma imobiliária centrada em mapas. Explore bairros, descubra imóveis e anuncie com tecnologia de ponta.',
    type: 'website',
    url: 'https://www.fixum.com.br',
    siteName: 'FIXUM',
    images: [
      {
        url: 'https://www.fixum.com.br/og-fixum.jpg',
        width: 1200,
        height: 630,
        type: 'image/jpeg',
        alt: 'FIXUM — Encontre seu lugar.',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'FIXUM — Encontre seu lugar.',
    description: 'Plataforma imobiliária centrada em mapas.',
    images: ['https://www.fixum.com.br/og-fixum.jpg'],
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR">
      <body>
        <ModalLoginProvider>
          {children}
        </ModalLoginProvider>
      </body>
    </html>
  )
}
