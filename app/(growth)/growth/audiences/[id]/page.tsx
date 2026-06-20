"use client"

import { use } from "react"
import { Users } from "lucide-react"
import { GrowthAudienceDetail } from "@/components/growth/audiences/growth-audience-detail"
import { GrowthWorkspacePageHeader } from "@/components/growth/shell/growth-workspace-page-header"
import { GrowthWorkspacePageContent } from "@/components/growth/shell/growth-workspace-page-content"

type PageProps = {
  params: Promise<{ id: string }>
}

export default function GrowthAudienceDetailPage({ params }: PageProps) {
  const { id } = use(params)

  return (
    <GrowthWorkspacePageContent>
      <GrowthWorkspacePageHeader
        title="Audience"
        description="Review snapshot members, refresh manually, and enroll into sequences."
        icon={Users}
        iconClassName="bg-violet-50 text-violet-600"
      />
      <GrowthAudienceDetail audienceId={id} />
    </GrowthWorkspacePageContent>
  )
}
