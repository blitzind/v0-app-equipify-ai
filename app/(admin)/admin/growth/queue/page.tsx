"use client"

import { ListOrdered } from "lucide-react"
import { useAdmin } from "@/lib/admin-store"
import { GrowthRevenueQueueDashboard } from "@/components/growth/lead-operator/growth-lead-inbox-dashboard"
import { GrowthSectionLayout } from "@/components/growth/growth-section-layout"
import {
  PlatformAdminPageShell,
  PlatformAdminTabNav,
  usePlatformAdminHeaderIdentity,
} from "@/components/admin/platform-admin-shell"
import { PAGE_STANDARD_PAGE_TITLE } from "@/lib/page-hero-tokens"
import { GROWTH_WORKSPACE_QUEUE_QA_MARKER } from "@/lib/growth/navigation/growth-navigation-destinations"

export default function AdminGrowthRevenueQueuePage() {
  const { sessionIdentity } = useAdmin()
  const header = usePlatformAdminHeaderIdentity({
    displayName: sessionIdentity?.displayName,
    email: sessionIdentity?.email,
    platformRoleLabel: sessionIdentity?.platformRoleLabel,
  })

  return (
    <PlatformAdminPageShell header={header}>
      <div
        className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-8"
        data-growth-workspace-queue-marker={GROWTH_WORKSPACE_QUEUE_QA_MARKER}
      >
        <PlatformAdminTabNav activeKey="growth_leads" />

        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <ListOrdered size={17} />
            </span>
            <div>
              <h1 className={PAGE_STANDARD_PAGE_TITLE}>Revenue Queue</h1>
              <p className="text-sm text-muted-foreground">
                Prioritized accounts requiring operator review, enrichment, approval, or pipeline action.
              </p>
            </div>
          </div>
        </section>

        <GrowthSectionLayout>
          <GrowthRevenueQueueDashboard />
        </GrowthSectionLayout>
      </div>
    </PlatformAdminPageShell>
  )
}
