"use client"

import { CertificateProvider } from "@/lib/certificate-store"
import { QuickAddProvider } from "@/lib/quick-add-context"

export function GlobalProviders({ children }: { children: React.ReactNode }) {
  return (
    <QuickAddProvider>
      <CertificateProvider>
        {children}
      </CertificateProvider>
    </QuickAddProvider>
  )
}
