"use client"

import { GrowthWorkspaceHubPage } from "@/components/growth/hubs/growth-workspace-hub-page"
import { GROWTH_LEADS_HUB_MANIFEST } from "@/lib/growth/hubs/growth-leads-hub-manifest"

export default function GrowthLeadsPage() {
  return <GrowthWorkspaceHubPage manifest={GROWTH_LEADS_HUB_MANIFEST} />
}
