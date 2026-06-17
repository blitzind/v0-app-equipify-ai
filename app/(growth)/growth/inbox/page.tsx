"use client"

import { useSearchParams } from "next/navigation"
import { GrowthUnifiedInboxDashboardPanel } from "@/components/growth/growth-unified-inbox-dashboard"
import { GrowthInboxWorkspaceProvider } from "@/components/growth/inbox/growth-inbox-workspace-provider"
import { GrowthInboxWorkspaceV2Panel } from "@/components/growth/inbox/growth-inbox-workspace-v2-panel"
import { resolveGrowthInboxWorkspaceV2FromSearchParams } from "@/lib/growth/inbox/inbox-workspace-types"

function GrowthInboxWorkspaceContent() {
  const searchParams = useSearchParams()
  const workspaceV2 = resolveGrowthInboxWorkspaceV2FromSearchParams(searchParams)

  return workspaceV2 ? <GrowthInboxWorkspaceV2Panel /> : <GrowthUnifiedInboxDashboardPanel />
}

export default function GrowthInboxPage() {
  return (
    <GrowthInboxWorkspaceProvider>
      <GrowthInboxWorkspaceContent />
    </GrowthInboxWorkspaceProvider>
  )
}
