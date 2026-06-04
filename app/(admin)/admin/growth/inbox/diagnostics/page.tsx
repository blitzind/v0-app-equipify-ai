"use client"

import { Activity } from "lucide-react"
import Link from "next/link"
import { useAdmin } from "@/lib/admin-store"
import { GrowthInboxDiagnosticsPanel } from "@/components/growth/inbox/growth-inbox-diagnostics-panel"
import { GrowthSectionLayout } from "@/components/growth/growth-section-layout"
import {
  PlatformAdminPageShell,
  PlatformAdminTabNav,
  usePlatformAdminHeaderIdentity,
} from "@/components/admin/platform-admin-shell"
import { PAGE_STANDARD_PAGE_TITLE } from "@/lib/page-hero-tokens"
import { Button } from "@/components/ui/button"
import {
  GROWTH_INBOX_DIAGNOSTICS_HREF,
  GROWTH_INBOX_WORKSPACE_HREF,
  GROWTH_INBOX_WORKSPACE_V2_QA_MARKER,
} from "@/lib/growth/inbox/inbox-workspace-types"

export default function AdminGrowthInboxDiagnosticsPage() {
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

        <section
          className="rounded-2xl border border-border bg-card p-5 shadow-sm"
          data-equipify-qa-marker={GROWTH_INBOX_WORKSPACE_V2_QA_MARKER}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="flex size-9 items-center justify-center rounded-full bg-amber-50 text-amber-800">
                <Activity size={17} />
              </span>
              <div>
                <h1 className={PAGE_STANDARD_PAGE_TITLE}>Inbox Diagnostics</h1>
                <p className="text-sm text-muted-foreground">
                  Operational monitoring for inbox health, sync metrics, provider controls — read-only diagnostics.
                </p>
              </div>
            </div>
            <Button type="button" variant="outline" size="sm" asChild>
              <Link href={GROWTH_INBOX_WORKSPACE_HREF}>Inbox Workspace</Link>
            </Button>
          </div>
        </section>

        <GrowthSectionLayout>
          <GrowthInboxDiagnosticsPanel />
        </GrowthSectionLayout>
      </div>
    </PlatformAdminPageShell>
  )
}
