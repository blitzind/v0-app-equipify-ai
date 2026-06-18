"use client"

import { GrowthWorkspaceHubPage } from "@/components/growth/hubs/growth-workspace-hub-page"
import { GROWTH_VIDEOS_HUB_MANIFEST } from "@/lib/growth/hubs/growth-videos-hub-manifest"

export default function GrowthVideosPage() {
  return <GrowthWorkspaceHubPage manifest={GROWTH_VIDEOS_HUB_MANIFEST} />
}
