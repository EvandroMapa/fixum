import type { Metadata, Viewport } from 'next'
import { Bricolage_Grotesque, Inter, Instrument_Serif, JetBrains_Mono } from 'next/font/google'
import './globals.css'
import { ModalLoginProvider } from '@/contexts/ModalLoginContext'
import { ModalConfirmacaoProvider } from '@/contexts/ModalConfirmacaoContext'

// Tipografia da marca (brand/brandbook-fixum.html, seção 05)
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' })
const bricolage = Bricolage_Grotesque({
  subsets: ['latin'],
  variable: '--font-bricolage',
  weight: ['500', '600', '700', '800'],
  display: 'swap',
})
const instrument = Instrument_Serif({
  subsets: ['latin'],
  variable: '--font-instrument',
  weight: '400',
  style: ['normal', 'italic'],
  display: 'swap',
})
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono', weight: ['400', '500'], display: 'swap' })

const TITULO = 'Fixum — Explore onde você quer viver.'
const DESCRICAO =
  'A plataforma imobiliária que começa pelo mapa. Explore bairros, compare imóveis no território e encontre o lugar onde você quer viver.'

export const metadata: Metadata = {
  title: TITULO,
  description: DESCRICAO,
  keywords: 'imóveis, venda, aluguel, mapa, casas, apartamentos, imobiliária, corretores, bairros',
  metadataBase: new URL('https://www.fixum.com.br'),
  openGraph: {
    title: TITULO,
    description: DESCRICAO,
    type: 'website',
    url: 'https://www.fixum.com.br',
    siteName: 'Fixum',
    locale: 'pt_BR',
    images: [
      {
        url: 'https://www.fixum.com.br/og-fixum.jpg',
        width: 1200,
        height: 630,
        type: 'image/jpeg',
        alt: TITULO,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: TITULO,
    description: DESCRICAO,
    images: ['https://www.fixum.com.br/og-fixum.jpg'],
  },
}

export const viewport: Viewport = {
  themeColor: '#16201C',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="pt-BR"
      className={`${inter.variable} ${bricolage.variable} ${instrument.variable} ${mono.variable}`}
    >
      <body>
        <ModalLoginProvider>
          <ModalConfirmacaoProvider>
            {children}
          </ModalConfirmacaoProvider>
        </ModalLoginProvider>
      </body>
    </html>
  )
}
