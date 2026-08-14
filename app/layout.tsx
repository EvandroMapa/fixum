import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'FIXUM — Explore onde você quer viver',
  description: 'FIXUM — Plataforma imobiliária centrada em mapas. Explore bairros, descubra imóveis e encontre o lugar onde você quer viver.',
  keywords: 'imóveis, venda, aluguel, mapa, casas, apartamentos',
  openGraph: {
    title: 'FIXUM',
    description: 'Explore onde você quer viver',
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
      <body>{children}</body>
    </html>
  )
}
