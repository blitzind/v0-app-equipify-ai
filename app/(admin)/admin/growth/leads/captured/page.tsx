"use client"

import { Inbox } from "lucide-react"
import { useAdmin } from "@/lib/admin-store"
import { GrowthCapturedLeadsDashboard } from "@/components/growth/growth-captured-leads-dashboard"
import { GrowthSectionLayout } from "@/components/growth/growth-section-layout"
import {
  PlatformAdminPageShell,
  PlatformAdminTabNav,
  usePlatformAdminHeaderIdentity,
} from "@/components/admin/platform-admin-shell"
import { PAGE_STANDARD_PAGE_TITLE } from "@/lib/page-hero-tokens"

export default function AdminGrowthCapturedLeadsPage() {
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
              <Inbox size={17} />
            </span>
            <div>
              <h1 className={PAGE_STANDARD_PAGE_TITLE}>Recently Captured</h1>
              <p className="text-sm text-muted-foreground">
                Follow up on manual entries and Chrome extension captures. Review, verify, queue discovery, or
                prepare call/sequence work — no outreach sends automatically.
              </p>
            </div>
          </div>
        </section>

        <GrowthSectionLayout>
          <GrowthCapturedLeadsDashboard />
        </GrowthSectionLayout>
      </div>
    </PlatformAdminPageShell>
  )
}
