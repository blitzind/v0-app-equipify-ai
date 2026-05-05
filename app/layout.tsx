import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { GlobalProviders } from '@/components/global-providers'
import './globals.css'

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: 'Equipify.ai — Equipment & Field Service Management',
  description: 'Modern SaaS platform for managing equipment, work orders, service schedules, and field technicians.',
  generator: 'v0.app',
  icons: {
    icon: [{ url: "/brand/favicon.png", type: "image/png", sizes: "any" }],
    apple: "/brand/favicon.png",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="bg-background h-full">
      <body className="font-sans antialiased h-full">
        <GlobalProviders>
          {children}
        </GlobalProviders>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
