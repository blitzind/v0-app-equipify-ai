"use client"

import { Video } from "lucide-react"
import { useParams } from "next/navigation"
import { GrowthVideoAssetDetailPanel } from "@/components/growth/videos/growth-video-asset-detail-panel"
import { GrowthWorkspacePageHeader } from "@/components/growth/shell/growth-workspace-page-header"
import { GrowthWorkspacePageContent } from "@/components/growth/shell/growth-workspace-page-content"

export default function GrowthVideosLibraryDetailPage() {
  const params = useParams<{ id: string }>()
  const assetId = params?.id ?? ""

  return (
    <GrowthWorkspacePageContent>
      <GrowthWorkspacePageHeader
        title="Videos"
        description="Video asset details and playback."
        icon={Video}
        iconClassName="bg-violet-50 text-violet-600"
      />
      <GrowthVideoAssetDetailPanel assetId={assetId} />
    </GrowthWorkspacePageContent>
  )
}
