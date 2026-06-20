"use client"

import { Sparkles } from "lucide-react"
import { GrowthSendrPageCreateForm } from "@/components/growth/sendr/growth-sendr-page-create-form"
import { GROWTH_PERSONALIZED_VIDEOS_PAGE_LABEL } from "@/lib/growth/sendr/growth-sendr-branding"
import { GrowthWorkspacePageHeader } from "@/components/growth/shell/growth-workspace-page-header"
import { GrowthWorkspacePageContent } from "@/components/growth/shell/growth-workspace-page-content"

export default function GrowthSendrNewPage() {
  return (
    <GrowthWorkspacePageContent>
      <GrowthWorkspacePageHeader
        title={`Create ${GROWTH_PERSONALIZED_VIDEOS_PAGE_LABEL}`}
        description="Lead-aware page creation — operator-initiated, no automation."
        icon={Sparkles}
        iconClassName="bg-fuchsia-50 text-fuchsia-600"
      />
      <GrowthSendrPageCreateForm />
    </GrowthWorkspacePageContent>
  )
}
