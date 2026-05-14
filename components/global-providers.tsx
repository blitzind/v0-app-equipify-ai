"use client"

import { MarketingAnalyticsProvider } from "@/components/analytics/marketing-analytics-provider"
import { CertificateProvider } from "@/lib/certificate-store"
import { QuickAddProvider } from "@/lib/quick-add-context"
import { WorkspaceAppearanceProvider } from "@/lib/workspace-appearance-context"
import { AdminProvider } from "@/lib/admin-store"

export function GlobalProviders({ children }: { children: React.ReactNode }) {
  return (
    <MarketingAnalyticsProvider>
      <WorkspaceAppearanceProvider>
        <QuickAddProvider>
          <CertificateProvider>
            <AdminProvider>{children}</AdminProvider>
          </CertificateProvider>
        </QuickAddProvider>
      </WorkspaceAppearanceProvider>
    </MarketingAnalyticsProvider>
  )
}
