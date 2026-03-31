import type { Metadata } from 'next'
import './globals.css'

export const runtime = 'edge'

export const metadata: Metadata = {
  title: 'NOOON Caixa',
  description: 'Gestão financeira pessoal NOOON',
  manifest: '/manifest.json',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen bg-[#0d1410]">
        {children}
      </body>
    </html>
  )
}
