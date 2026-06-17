"use client"

import { Activity } from "lucide-react"
import { GrowthEngagementCommandCenter } from "@/components/growth/engagement/growth-engagement-command-center"
import { GrowthEngagementDashboardPanel } from "@/components/growth/engagement/growth-engagement-dashboard"
import { GrowthEngagementDashboard as GrowthLeadEngagementDashboard } from "@/components/growth/growth-engagement-dashboard"
import { GrowthWorkspacePageHeader } from "@/components/growth/shell/growth-workspace-page-header"

export default function GrowthEngagementPage() {
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 md:px-6 md:py-8">
      <GrowthWorkspacePageHeader
        title="Engagement Dashboard"
        description="Share page, media, CTA, Q&A, conversational, and booking handoff engagement — read-only rollup, no outreach execution."
        icon={Activity}
        iconClassName="bg-emerald-50 text-emerald-600"
      />

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
    </div>
  )
}
