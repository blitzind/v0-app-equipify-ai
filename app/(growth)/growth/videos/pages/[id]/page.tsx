"use client"

import { Video } from "lucide-react"
import { useParams } from "next/navigation"
import { GrowthVideoPageDetailPanel } from "@/components/growth/videos/growth-video-page-detail-panel"
import { GrowthWorkspacePageHeader } from "@/components/growth/shell/growth-workspace-page-header"
import { GrowthWorkspacePageContent } from "@/components/growth/shell/growth-workspace-page-content"

export default function GrowthVideosPagesDetailPage() {
  const params = useParams<{ id: string }>()
  const pageId = params?.id ?? ""

  return (
    <GrowthWorkspacePageContent>
      <GrowthWorkspacePageHeader
        title="Videos"
        description="Edit and publish a video page."
        icon={Video}
        iconClassName="bg-violet-50 text-violet-600"
      />
      <GrowthVideoPageDetailPanel pageId={pageId} />
    </GrowthWorkspacePageContent>
  )
}
