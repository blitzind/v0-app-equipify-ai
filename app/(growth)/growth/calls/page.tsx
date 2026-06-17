"use client"

import { GrowthWorkspaceHubPage } from "@/components/growth/hubs/growth-workspace-hub-page"
import { GROWTH_CALLS_HUB_MANIFEST } from "@/lib/growth/hubs/growth-calls-hub-manifest"

export default function GrowthCallsPage() {
  return <GrowthWorkspaceHubPage manifest={GROWTH_CALLS_HUB_MANIFEST} />
}
