"use client"

import { Database } from "lucide-react"
import { useAdmin } from "@/lib/admin-store"
import { GrowthDatamoonAudienceImportPanel } from "@/components/growth/lead-sources/growth-datamoon-audience-import-panel"
import { GrowthSectionLayout } from "@/components/growth/growth-section-layout"
import {
  PlatformAdminPageShell,
  PlatformAdminTabNav,
  usePlatformAdminHeaderIdentity,
} from "@/components/admin/platform-admin-shell"
import { PAGE_STANDARD_PAGE_TITLE } from "@/lib/page-hero-tokens"

export default function AdminGrowthLeadSourcesPage() {
  const { sessionIdentity } = useAdmin()
  const header = usePlatformAdminHeaderIdentity({
    displayName: sessionIdentity?.displayName,
    email: sessionIdentity?.email,
    platformRoleLabel: sessionIdentity?.platformRoleLabel,
  })

  return (
    <PlatformAdminPageShell header={header}>
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-8">
        <PlatformAdminTabNav activeKey="growth_leads" />

        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-full bg-sky-50 text-sky-600">
              <Database size={17} />
            </span>
            <div>
              <h1 className={PAGE_STANDARD_PAGE_TITLE}>Lead Sources</h1>
              <p className="text-sm text-muted-foreground">
                Provider-backed audience imports and intelligence-only lead ingestion. No outreach is sent from
                this surface.
              </p>
            </div>
          </div>
        </section>

        <GrowthSectionLayout>
          <GrowthDatamoonAudienceImportPanel />
        </GrowthSectionLayout>
      </div>
    </PlatformAdminPageShell>
  )
}
