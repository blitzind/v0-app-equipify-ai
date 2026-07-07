"use client"

import { use } from "react"
import { useSearchParams } from "next/navigation"
import { FlaskConical } from "lucide-react"
import { GrowthAiOsLeadResearchPilotPanel } from "@/components/growth/ai-os/growth-ai-os-lead-research-pilot-panel"
import { GrowthWorkspacePageContent } from "@/components/growth/shell/growth-workspace-page-content"
import { GrowthWorkspacePageHeader } from "@/components/growth/shell/growth-workspace-page-header"

type PageProps = {
  params: Promise<{ leadId: string }>
}

export default function GrowthAiOsLeadResearchPilotPage({ params }: PageProps) {
  const { leadId } = use(params)
  const searchParams = useSearchParams()
  const packageId = searchParams.get("packageId")

  return (
    <GrowthWorkspacePageContent>
      <GrowthWorkspacePageHeader
        title="Lead Research Pilot"
        description="Observe the GE-AIOS-4A autonomous Lead Research Pipeline across the full AI OS stack."
        icon={FlaskConical}
        iconClassName="bg-emerald-50 text-emerald-600"
      />
      <GrowthAiOsLeadResearchPilotPanel leadId={leadId} packageId={packageId} />
    </GrowthWorkspacePageContent>
  )
}
