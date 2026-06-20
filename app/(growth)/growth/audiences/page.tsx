"use client"

import { Users } from "lucide-react"
import { GrowthAudienceLibrary } from "@/components/growth/audiences/growth-audience-library"
import { GrowthWorkspacePageHeader } from "@/components/growth/shell/growth-workspace-page-header"
import { GrowthWorkspacePageContent } from "@/components/growth/shell/growth-workspace-page-content"

export default function GrowthAudiencesPage() {
  return (
    <GrowthWorkspacePageContent>
      <GrowthWorkspacePageHeader
        title="Audiences"
        description="Saved search → snapshot → manual refresh → manual enrollment. No automatic sync."
        icon={Users}
        iconClassName="bg-violet-50 text-violet-600"
      />
      <GrowthAudienceLibrary />
    </GrowthWorkspacePageContent>
  )
}
