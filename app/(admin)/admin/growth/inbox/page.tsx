"use client"

import { Mail } from "lucide-react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useAdmin } from "@/lib/admin-store"
import { GrowthSectionLayout } from "@/components/growth/growth-section-layout"
import { GrowthUnifiedInboxDashboardPanel } from "@/components/growth/growth-unified-inbox-dashboard"
import { GrowthInboxWorkspaceProvider } from "@/components/growth/inbox/growth-inbox-workspace-provider"
import { GrowthInboxWorkspaceV2Panel } from "@/components/growth/inbox/growth-inbox-workspace-v2-panel"
import {
  PlatformAdminPageShell,
  PlatformAdminTabNav,
  usePlatformAdminHeaderIdentity,
} from "@/components/admin/platform-admin-shell"
import { PAGE_STANDARD_PAGE_TITLE } from "@/lib/page-hero-tokens"
import { Button } from "@/components/ui/button"
import {
  GROWTH_INBOX_DIAGNOSTICS_HREF,
  GROWTH_INBOX_WORKSPACE_V2_QA_MARKER,
  resolveGrowthInboxWorkspaceV2FromSearchParams,
} from "@/lib/growth/inbox/inbox-workspace-types"

function InboxWorkspaceContent() {
  const searchParams = useSearchParams()
  const workspaceV2 = resolveGrowthInboxWorkspaceV2FromSearchParams(searchParams)

  return workspaceV2 ? <GrowthInboxWorkspaceV2Panel /> : <GrowthUnifiedInboxDashboardPanel />
}

export default function AdminGrowthUnifiedInboxPage() {
  const { sessionIdentity } = useAdmin()
  const searchParams = useSearchParams()
  const workspaceV2 = resolveGrowthInboxWorkspaceV2FromSearchParams(searchParams)
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
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="flex size-9 items-center justify-center rounded-full bg-sky-50 text-sky-700">
                <Mail size={17} />
              </span>
              <div>
                <h1 className={PAGE_STANDARD_PAGE_TITLE}>Inbox</h1>
                <p className="text-sm text-muted-foreground">
                  {workspaceV2
                    ? "Three-column inbox — thread queue, conversation, and action center foundation."
                    : "Unified inbox ownership and reply intelligence — orchestration only, no mailbox sync or auto replies."}
                </p>
                {workspaceV2 ? (
                  <p className="mt-1 text-xs text-muted-foreground" data-equipify-qa-marker={GROWTH_INBOX_WORKSPACE_V2_QA_MARKER}>
                    {GROWTH_INBOX_WORKSPACE_V2_QA_MARKER} enabled
                  </p>
                ) : null}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" asChild>
                <Link href={GROWTH_INBOX_DIAGNOSTICS_HREF}>Inbox Diagnostics</Link>
              </Button>
              <Button type="button" variant="outline" size="sm" asChild>
                <Link href="/admin/growth/queue">Revenue Queue</Link>
              </Button>
            </div>
          </div>
        </section>

        <GrowthSectionLayout>
          <GrowthInboxWorkspaceProvider>
            <InboxWorkspaceContent />
          </GrowthInboxWorkspaceProvider>
        </GrowthSectionLayout>
      </div>
    </PlatformAdminPageShell>
  )
}
