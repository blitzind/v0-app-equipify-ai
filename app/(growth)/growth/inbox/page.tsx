"use client"

import { useSearchParams } from "next/navigation"
import { GrowthUnifiedInboxDashboardPanel } from "@/components/growth/growth-unified-inbox-dashboard"
import { GrowthInboxWorkspaceV2Panel } from "@/components/growth/inbox/growth-inbox-workspace-v2-panel"
import { resolveGrowthInboxWorkspaceV2FromSearchParams } from "@/lib/growth/inbox/inbox-workspace-types"

export default function GrowthInboxPage() {
  const searchParams = useSearchParams()
  const workspaceV2 = resolveGrowthInboxWorkspaceV2FromSearchParams(searchParams)

  return workspaceV2 ? <GrowthInboxWorkspaceV2Panel /> : <GrowthUnifiedInboxDashboardPanel />
}
