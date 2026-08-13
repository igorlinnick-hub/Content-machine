import type { Metadata } from 'next'
import { Inter, Playfair_Display } from 'next/font/google'
import './globals.css'
import { GradientBg } from './components/GradientBg'
import { VersionWatcher } from './components/VersionWatcher'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

// HWC's display face — the clinic's landings pair it with Inter. Self-hosted
// by next/font, so it renders crisp with no flash of a fallback serif.
const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
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
    <html lang="en" className={`${inter.variable} ${playfair.variable}`}>
      <body className="font-sans antialiased">
        <GradientBg />
        <VersionWatcher />
        {children}
      </body>
    </html>
  )
}
