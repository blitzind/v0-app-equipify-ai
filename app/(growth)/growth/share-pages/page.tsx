"use client"

import { GrowthWorkspaceHubPage } from "@/components/growth/hubs/growth-workspace-hub-page"
import { GROWTH_SHARE_PAGES_HUB_MANIFEST } from "@/lib/growth/hubs/growth-share-pages-hub-manifest"

export default function GrowthSharePagesPage() {
  return <GrowthWorkspaceHubPage manifest={GROWTH_SHARE_PAGES_HUB_MANIFEST} />
}
