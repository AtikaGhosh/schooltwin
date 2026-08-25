import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import Script from 'next/script'
import { headers } from 'next/headers'
import { connection } from 'next/server'
import './globals.css'
import { SchoolTwinProvider } from '@/components/providers/schooltwin-provider'
import { ThemeProvider } from '@/components/providers/theme-provider'
import { THEME_BOOTSTRAP_SCRIPT } from '@/lib/schooltwin/theme'

const geistSans = Geist({ subsets: ['latin'], variable: '--font-geist-sans' })
const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
})

export const metadata: Metadata = {
  title: 'DrishtiShala — Today’s School Work',
  description:
    'A bilingual daily work assistant for school collection workflows.',
  generator: 'v0.app',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f6f8fa' },
    { media: '(prefers-color-scheme: dark)', color: '#101820' },
  ],
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  await connection()
  const nonce = (await headers()).get('x-nonce') ?? undefined
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`bg-background ${geistSans.variable} ${geistMono.variable}`}
    >
      <body className="font-sans antialiased">
        <ThemeProvider>
          <SchoolTwinProvider>{children}</SchoolTwinProvider>
        </ThemeProvider>
        {process.env.NODE_ENV === 'production' && <Analytics />}
        <Script
          id="schooltwin-theme"
          strategy="beforeInteractive"
          nonce={nonce}
          dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP_SCRIPT }}
        />
      </body>
    </html>
  )
}
