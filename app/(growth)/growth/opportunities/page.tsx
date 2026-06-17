"use client"

import { GrowthWorkspaceHubPage } from "@/components/growth/hubs/growth-workspace-hub-page"
import { GROWTH_OPPORTUNITIES_HUB_MANIFEST } from "@/lib/growth/hubs/growth-opportunities-hub-manifest"

export default function GrowthOpportunitiesPage() {
  return <GrowthWorkspaceHubPage manifest={GROWTH_OPPORTUNITIES_HUB_MANIFEST} embedded />
}
