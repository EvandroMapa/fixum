import type { Metadata } from 'next'
import './globals.css'
import { ModalLoginProvider } from '@/contexts/ModalLoginContext'

export const metadata: Metadata = {
  title: 'FIXUM — Encontre seu lugar.',
  description: 'FIXUM — Plataforma imobiliária centrada em mapas. Explore bairros, descubra imóveis e encontre o lugar onde você quer viver.',
  keywords: 'imóveis, venda, aluguel, mapa, casas, apartamentos',
  openGraph: {
    title: 'FIXUM — Encontre seu lugar.',
    description: 'Plataforma imobiliária centrada em mapas. Explore bairros e encontre o lugar onde você quer viver.',
    type: 'website',
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
