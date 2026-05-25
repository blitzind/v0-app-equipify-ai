"use client"

import { LayoutDashboard } from "lucide-react"
import { useAdmin } from "@/lib/admin-store"
import { GrowthCommandCenterDashboard } from "@/components/growth/growth-command-center-dashboard"
import { GrowthAttentionCenter } from "@/components/growth/growth-attention-center"
import { GrowthExecutiveRevenueSummary } from "@/components/growth/growth-executive-revenue-summary"
import { GrowthMeetingCommandSummary } from "@/components/growth/growth-meeting-command-summary"
import { GrowthPipelineCommandSummary } from "@/components/growth/growth-pipeline-command-summary"
import { GrowthSectionLayout } from "@/components/growth/growth-section-layout"
import {
  PlatformAdminPageShell,
  PlatformAdminTabNav,
  usePlatformAdminHeaderIdentity,
} from "@/components/admin/platform-admin-shell"
import { PAGE_STANDARD_PAGE_TITLE } from "@/lib/page-hero-tokens"

export default function AdminGrowthCommandPage() {
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
              <LayoutDashboard size={17} />
            </span>
            <div>
              <h1 className={PAGE_STANDARD_PAGE_TITLE}>Growth Command Center</h1>
              <p className="text-sm text-muted-foreground">
                Daily operating console — prioritized actions, pipeline health, and focus sprints. Navigation only; no auto-send.
              </p>
            </div>
          </div>
        </section>

        <GrowthSectionLayout>
          <GrowthAttentionCenter />
          <GrowthExecutiveRevenueSummary />
          <GrowthMeetingCommandSummary />
          <GrowthPipelineCommandSummary />
          <GrowthCommandCenterDashboard />
        </GrowthSectionLayout>
      </div>
    </PlatformAdminPageShell>
  )
}
