"use client"

import { CertificateProvider } from "@/lib/certificate-store"
import { QuickAddProvider } from "@/lib/quick-add-context"
import { WorkspaceAppearanceProvider } from "@/lib/workspace-appearance-context"

export function GlobalProviders({ children }: { children: React.ReactNode }) {
  return (
    <WorkspaceAppearanceProvider>
      <QuickAddProvider>
        <CertificateProvider>
          {children}
        </CertificateProvider>
      </QuickAddProvider>
    </WorkspaceAppearanceProvider>
  )
}
