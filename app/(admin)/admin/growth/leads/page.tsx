"use client"

import { Inbox } from "lucide-react"
import { useAdmin } from "@/lib/admin-store"
import { GrowthLeadInboxDashboard } from "@/components/growth/lead-operator/growth-lead-inbox-dashboard"
import { GrowthSectionLayout } from "@/components/growth/growth-section-layout"
import {
  PlatformAdminPageShell,
  PlatformAdminTabNav,
  usePlatformAdminHeaderIdentity,
} from "@/components/admin/platform-admin-shell"
import { PAGE_STANDARD_PAGE_TITLE } from "@/lib/page-hero-tokens"
import { GROWTH_LEAD_OPERATOR_WORKSPACE_QA_MARKER } from "@/lib/growth/lead-operator-workspace/lead-operator-workspace-types"

export default function AdminGrowthLeadInboxPage() {
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
              <Inbox size={17} />
            </span>
            <div>
              <h1 className={PAGE_STANDARD_PAGE_TITLE}>Lead Inbox</h1>
              <p className="text-sm text-muted-foreground">
                Operational sales workspace — prioritize evidence, review intent, and route operators. No autonomous outreach.
              </p>
              <p className="mt-1 font-mono text-xs text-muted-foreground">
                {GROWTH_LEAD_OPERATOR_WORKSPACE_QA_MARKER}
              </p>
            </div>
          </div>
        </section>

        <GrowthSectionLayout>
          <GrowthLeadInboxDashboard />
        </GrowthSectionLayout>
      </div>
    </PlatformAdminPageShell>
  )
}
