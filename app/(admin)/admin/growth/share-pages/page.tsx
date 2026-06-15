"use client"

import { FileText } from "lucide-react"
import { useAdmin } from "@/lib/admin-store"
import { GrowthSharePagesDashboard } from "@/components/growth/share-pages/growth-share-pages-admin-panel"
import { GrowthSectionLayout } from "@/components/growth/growth-section-layout"
import {
  PlatformAdminPageShell,
  PlatformAdminTabNav,
  usePlatformAdminHeaderIdentity,
} from "@/components/admin/platform-admin-shell"
import { PAGE_STANDARD_PAGE_TITLE } from "@/lib/page-hero-tokens"

export default function AdminGrowthSharePagesPage() {
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
            <span className="flex size-9 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <FileText size={17} />
            </span>
            <div>
              <h1 className={PAGE_STANDARD_PAGE_TITLE}>Share Pages</h1>
              <p className="text-sm text-muted-foreground">
                Internal admin for personalized share pages — manual create, preview, human approval, and analytics.
                Passive delivery only; no sends or enrollments.
              </p>
            </div>
          </div>
        </section>

        <GrowthSectionLayout>
          <GrowthSharePagesDashboard />
        </GrowthSectionLayout>
      </div>
    </PlatformAdminPageShell>
  )
}
