import type { Metadata, Viewport } from 'next'
import './globals.css'
import { ProfileProvider } from '@/context/ProfileContext'
import { Header, ProfileBar } from '@/components/Header'

export const metadata: Metadata = {
  title: 'AnalisePro — Painel de Inteligência de Mercado',
  description:
    'Relatórios de inteligência de mercado gerados por IA 3 vezes ao dia, com análise macroeconômica, calendário de volatilidade e tabela de oportunidades táticas.',
  keywords: 'mercado financeiro, análise técnica, inteligência de mercado, IA, B3, Forex, Cripto',
  robots: 'noindex, nofollow', // private app
  manifest: '/manifest.json',
}

export const viewport: Viewport = {
  themeColor: '#0a0b0f',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR">
      <body>
        <ProfileProvider>
          <div className="app-shell">
            <Header />
            <ProfileBar />
            <main className="main-content">
              {children}
            </main>
          </div>
        </ProfileProvider>
      </body>
    </html>
  )
}
