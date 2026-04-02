import type { Metadata } from 'next'
import './globals.css'

export const runtime = 'edge'

export const metadata = {
  title: 'NOOON Caixa',
  description: 'NOOON, Gestão Financeira',
  icons: {
    icon: [
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
    shortcut: '/favicon.ico',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body style={{ background: '#0f1f12' }}>
        {children}
      </body>
    </html>
  )
}
