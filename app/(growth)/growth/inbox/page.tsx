"use client"

import { Mail } from "lucide-react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { GrowthUnifiedInboxDashboardPanel } from "@/components/growth/growth-unified-inbox-dashboard"
import { GrowthInboxWorkspaceProvider } from "@/components/growth/inbox/growth-inbox-workspace-provider"
import { GrowthInboxWorkspaceV2Panel } from "@/components/growth/inbox/growth-inbox-workspace-v2-panel"
import { GrowthWorkspacePageHeader } from "@/components/growth/shell/growth-workspace-page-header"
import { Button } from "@/components/ui/button"
import {
  GROWTH_INBOX_DIAGNOSTICS_HREF,
  GROWTH_INBOX_WORKSPACE_V2_QA_MARKER,
  resolveGrowthInboxWorkspaceV2FromSearchParams,
} from "@/lib/growth/inbox/inbox-workspace-types"

function GrowthInboxWorkspaceContent() {
  const searchParams = useSearchParams()
  const workspaceV2 = resolveGrowthInboxWorkspaceV2FromSearchParams(searchParams)

  return workspaceV2 ? <GrowthInboxWorkspaceV2Panel /> : <GrowthUnifiedInboxDashboardPanel />
}

export default function GrowthInboxPage() {
  const searchParams = useSearchParams()
  const workspaceV2 = resolveGrowthInboxWorkspaceV2FromSearchParams(searchParams)

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 md:px-6 md:py-8">
      <GrowthWorkspacePageHeader
        title="Inbox"
        description={
          workspaceV2
            ? "Three-column inbox — thread queue, conversation, and action center foundation."
            : "Unified inbox ownership and reply intelligence — orchestration only, no mailbox sync or auto replies."
        }
        icon={Mail}
        iconClassName="bg-sky-50 text-sky-700"
        actions={
          <>
            {workspaceV2 ? (
              <p className="text-xs text-muted-foreground" data-equipify-qa-marker={GROWTH_INBOX_WORKSPACE_V2_QA_MARKER}>
                {GROWTH_INBOX_WORKSPACE_V2_QA_MARKER} enabled
              </p>
            ) : null}
            <Button type="button" variant="outline" size="sm" asChild>
              <Link href={GROWTH_INBOX_DIAGNOSTICS_HREF}>Inbox Diagnostics</Link>
            </Button>
            <Button type="button" variant="outline" size="sm" asChild>
              <Link href="/admin/growth/queue">Revenue Queue</Link>
            </Button>
          </>
        }
      />

      <GrowthInboxWorkspaceProvider>
        <GrowthInboxWorkspaceContent />
      </GrowthInboxWorkspaceProvider>
    </div>
  )
}
