"use client"

import { useSearchParams } from "next/navigation"
import { Send } from "lucide-react"
import { useAdmin } from "@/lib/admin-store"
import { GrowthSectionLayout } from "@/components/growth/growth-section-layout"
import { GrowthOutreachApprovalDashboard } from "@/components/growth/growth-outreach-approval-dashboard"
import { OutboundLaunchContextBanner } from "@/components/growth/outbound-launch/outbound-launch-context-banner"
import {
  PlatformAdminPageShell,
  PlatformAdminTabNav,
  usePlatformAdminHeaderIdentity,
} from "@/components/admin/platform-admin-shell"
import { PAGE_STANDARD_PAGE_TITLE } from "@/lib/page-hero-tokens"

export default function AdminGrowthOutreachApprovalPage() {
  const searchParams = useSearchParams()
  const highlightQueueId = searchParams.get("highlight")
  const filterLeadId = searchParams.get("leadId")
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
              <Send size={17} />
            </span>
            <div>
              <h1 className={PAGE_STANDARD_PAGE_TITLE}>Outreach Approval</h1>
              <p className="text-sm text-muted-foreground">
                Controlled execution queue — human approval required. No auto-send.
              </p>
            </div>
          </div>
        </section>

        <GrowthSectionLayout>
          <OutboundLaunchContextBanner className="mb-4" />
          <GrowthOutreachApprovalDashboard highlightQueueId={highlightQueueId} filterLeadId={filterLeadId} />
        </GrowthSectionLayout>
      </div>
    </PlatformAdminPageShell>
  )
}
