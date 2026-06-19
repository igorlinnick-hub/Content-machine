import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { GradientBg } from './components/GradientBg'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Content Machine',
  description: 'AI content platform for regenerative-medicine clinics',
  manifest: '/manifest.webmanifest',
  themeColor: '#0ea5e9',
  appleWebApp: {
    capable: true,
    title: 'Content Machine',
    statusBarStyle: 'default',
  },
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans antialiased">
        <GradientBg />
        {children}
      </body>
    </html>
  )
}
