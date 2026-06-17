"use client"

import { GitBranch } from "lucide-react"
import { useAdmin } from "@/lib/admin-store"
import { GrowthReplyWorkflowDashboardBody } from "@/components/growth/replies/growth-reply-workflow-dashboard-body"
import { GrowthSectionLayout } from "@/components/growth/growth-section-layout"
import {
  PlatformAdminPageShell,
  PlatformAdminTabNav,
  usePlatformAdminHeaderIdentity,
} from "@/components/admin/platform-admin-shell"
import { PAGE_STANDARD_PAGE_TITLE } from "@/lib/page-hero-tokens"

export default function AdminGrowthReplyWorkflowPage() {
  const { sessionIdentity } = useAdmin()
  const header = usePlatformAdminHeaderIdentity({
    displayName: sessionIdentity?.displayName,
    email: sessionIdentity?.email,
    platformRoleLabel: sessionIdentity?.platformRoleLabel,
  })

  return (
    <PlatformAdminPageShell header={header}>
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6">
        <PlatformAdminTabNav activeKey="growth_leads" />

        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
              <GitBranch size={17} />
            </span>
            <div>
              <h1 className={PAGE_STANDARD_PAGE_TITLE}>Sales Workflow Actions</h1>
              <p className="text-sm text-muted-foreground">
                Reply-generated recommendations — mark interested, create call tasks, review opportunities, and resolve
                sequence exits. All actions require operator confirmation.
              </p>
            </div>
          </div>
        </section>

        <GrowthSectionLayout>
          <GrowthReplyWorkflowDashboardBody />
        </GrowthSectionLayout>
      </div>
    </PlatformAdminPageShell>
  )
}
