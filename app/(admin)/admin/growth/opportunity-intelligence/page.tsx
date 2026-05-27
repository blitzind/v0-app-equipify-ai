"use client"

import { Lightbulb } from "lucide-react"
import { useAdmin } from "@/lib/admin-store"
import { GrowthOpportunityIntelligenceDashboardView } from "@/components/growth/growth-opportunity-intelligence-dashboard"
import { GrowthSectionLayout } from "@/components/growth/growth-section-layout"
import {
  PlatformAdminPageShell,
  PlatformAdminTabNav,
  usePlatformAdminHeaderIdentity,
} from "@/components/admin/platform-admin-shell"
import { PAGE_STANDARD_PAGE_TITLE } from "@/lib/page-hero-tokens"

export default function AdminGrowthOpportunityIntelligencePage() {
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
            <span className="flex size-9 items-center justify-center rounded-full bg-indigo-50 text-indigo-700">
              <Lightbulb size={17} />
            </span>
            <div>
              <h1 className={PAGE_STANDARD_PAGE_TITLE}>Opportunity Intelligence</h1>
              <p className="text-sm text-muted-foreground">
                Evidence-backed opportunity signals, CRM suggestions, and sequence pause recommendations — human approval required.
              </p>
            </div>
          </div>
        </section>

        <GrowthSectionLayout>
          <GrowthOpportunityIntelligenceDashboardView />
        </GrowthSectionLayout>
      </div>
    </PlatformAdminPageShell>
  )
}
