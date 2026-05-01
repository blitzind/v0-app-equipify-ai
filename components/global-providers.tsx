"use client"

import { CertificateProvider } from "@/lib/certificate-store"

export function GlobalProviders({ children }: { children: React.ReactNode }) {
  return (
    <CertificateProvider>
      {children}
    </CertificateProvider>
  )
}
