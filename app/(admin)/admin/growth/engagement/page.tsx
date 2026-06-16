"use client"

import { Activity } from "lucide-react"
import { useAdmin } from "@/lib/admin-store"
import { GrowthEngagementCommandCenter } from "@/components/growth/engagement/growth-engagement-command-center"
import { GrowthEngagementDashboardPanel } from "@/components/growth/engagement/growth-engagement-dashboard"
import { GrowthEngagementDashboard as GrowthLeadEngagementDashboard } from "@/components/growth/growth-engagement-dashboard"
import { GrowthSectionLayout } from "@/components/growth/growth-section-layout"
import {
  PlatformAdminPageShell,
  PlatformAdminTabNav,
  usePlatformAdminHeaderIdentity,
} from "@/components/admin/platform-admin-shell"
import { PAGE_STANDARD_PAGE_TITLE } from "@/lib/page-hero-tokens"

export default function AdminGrowthEngagementPage() {
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
              <Activity size={17} />
            </span>
            <div>
              <h1 className={PAGE_STANDARD_PAGE_TITLE}>Engagement Dashboard</h1>
              <p className="text-sm text-muted-foreground">
                Share page, media, CTA, Q&A, conversational, and booking handoff engagement — read-only rollup, no
                outreach execution.
              </p>
            </div>
          </div>
        </section>

        <GrowthSectionLayout>
          <div className="space-y-8">
            <GrowthEngagementCommandCenter />

            <section className="space-y-3 border-t border-border pt-8">
              <div>
                <h2 className="text-lg font-semibold">Engagement dashboard panels</h2>
                <p className="text-sm text-muted-foreground">
                  S4-A through S4-D detailed panels preserved alongside the unified command center workspace.
                </p>
              </div>
              <GrowthEngagementDashboardPanel />
            </section>

            <section className="space-y-3 border-t border-border pt-8">
              <div>
                <h2 className="text-lg font-semibold">Lead engagement intelligence</h2>
                <p className="text-sm text-muted-foreground">
                  Cross-channel lead scoring and queue prioritization (Slice 5.4A) — preserved alongside S4-A rollups.
                </p>
              </div>
              <GrowthLeadEngagementDashboard />
            </section>
          </div>
        </GrowthSectionLayout>
      </div>
    </PlatformAdminPageShell>
  )
}
