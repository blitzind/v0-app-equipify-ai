import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import {
  EQUIPIFY_MARKETING_GA4_MEASUREMENT_ID,
  EQUIPIFY_MARKETING_GOOGLE_ADS_ID,
  readMarketingPublicEnvForServerScript,
} from '@/lib/analytics/marketing-analytics-config'
import { GlobalProviders } from '@/components/global-providers'
import './globals.css'

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

/** Temporary deploy verification marker — safe in HTML, no secrets. */
export const EQUIPIFY_APP_BUILD_MARKER = 'google-tags-debug-v2' as const

const GOOGLE_TAGS_DEBUG_ATTR = `${EQUIPIFY_MARKETING_GA4_MEASUREMENT_ID}-${EQUIPIFY_MARKETING_GOOGLE_ADS_ID}`

function buildEquipifyGoogleTagBootstrap(): string {
  const useEquipifyCookieDomain =
    process.env.VERCEL_ENV === 'production' ||
    (process.env.NODE_ENV === 'production' && process.env.VERCEL_ENV !== 'preview')

  const configPayload: Record<string, unknown> = {
    send_page_view: false,
    linker: { domains: ['www.equipify.ai', 'app.equipify.ai', 'equipify.ai'] },
  }
  if (useEquipifyCookieDomain) {
    configPayload.cookie_domain = '.equipify.ai'
    configPayload.cookie_flags = 'SameSite=None;Secure'
  }
  const configJson = JSON.stringify(configPayload)
  const ga4Id = EQUIPIFY_MARKETING_GA4_MEASUREMENT_ID
  const adsId = EQUIPIFY_MARKETING_GOOGLE_ADS_ID
  const marketingEnv = readMarketingPublicEnvForServerScript()
  const analyticsDebug = process.env.NEXT_PUBLIC_ANALYTICS_DEBUG === '1' ? '1' : null

  const lines = [
    'window.dataLayer=window.dataLayer||[]',
    'function gtag(){dataLayer.push(arguments);}',
    'window.gtag=gtag',
    "gtag('js', new Date())",
    `gtag('config', '${ga4Id}', ${configJson})`,
    `gtag('config', '${adsId}', ${configJson})`,
    'window.__EQUIPIFY_MARKETING_GTAG_CONFIGURED__=true',
    `window.__EQUIPIFY_MARKETING_ENV__=${JSON.stringify({
      ga4Id,
      googleAdsId: adsId,
      signupSendTo: marketingEnv.signupSendTo,
      analyticsDebug,
      cookieDomainOverride: marketingEnv.cookieDomainOverride,
      linkerDomainsRaw: marketingEnv.linkerDomainsRaw,
    })}`,
  ]

  if (analyticsDebug === '1') {
    lines.push(
      `console.info('[equipify-analytics]','${EQUIPIFY_APP_BUILD_MARKER}',{ga4Id:'${ga4Id}',googleAdsId:'${adsId}'})`,
    )
  }

  return lines.join(';')
}

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
  const gtagLoaderSrc = `https://www.googletagmanager.com/gtag/js?id=${EQUIPIFY_MARKETING_GA4_MEASUREMENT_ID}`

  return (
    <html lang="en" className="bg-background h-full">
      <head>
        <script async src={gtagLoaderSrc} />
        <script
          id="equipify-google-gtag-config"
          dangerouslySetInnerHTML={{ __html: buildEquipifyGoogleTagBootstrap() }}
        />
      </head>
      <body
        className="font-sans antialiased h-full"
        data-equipify-app-build-marker={EQUIPIFY_APP_BUILD_MARKER}
      >
        <div hidden data-google-tags-debug={GOOGLE_TAGS_DEBUG_ATTR} />
        <GlobalProviders>
          {children}
        </GlobalProviders>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
