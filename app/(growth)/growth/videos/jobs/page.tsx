"use client"

import { Video } from "lucide-react"
import { GrowthMediaGenerationJobsShell } from "@/components/growth/media/growth-media-generation-jobs-shell"
import { GrowthWorkspacePageHeader } from "@/components/growth/shell/growth-workspace-page-header"
import { GrowthWorkspacePageContent } from "@/components/growth/shell/growth-workspace-page-content"

export default function GrowthVideosJobsPage() {
  return (
    <GrowthWorkspacePageContent>
      <GrowthWorkspacePageHeader
        title="Videos"
        description="Video Recording Studio — library, capture, templates, analytics, jobs, and settings."
        icon={Video}
        iconClassName="bg-violet-50 text-violet-600"
      />
      <GrowthMediaGenerationJobsShell />
    </GrowthWorkspacePageContent>
  )
}
