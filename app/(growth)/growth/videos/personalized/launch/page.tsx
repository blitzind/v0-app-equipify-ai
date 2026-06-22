"use client"

import { Rocket } from "lucide-react"
import { GrowthSendrLaunchWizard } from "@/components/growth/sendr/growth-sendr-launch-wizard"
import { GROWTH_PERSONALIZED_VIDEOS_PRODUCT_LABEL } from "@/lib/growth/sendr/growth-sendr-branding"
import { GrowthWorkspacePageHeader } from "@/components/growth/shell/growth-workspace-page-header"
import { GrowthWorkspacePageContent } from "@/components/growth/shell/growth-workspace-page-content"

export default function GrowthPersonalizedVideosLaunchPage() {
  return (
    <GrowthWorkspacePageContent>
      <GrowthWorkspacePageHeader
        title={`${GROWTH_PERSONALIZED_VIDEOS_PRODUCT_LABEL} Launch`}
        description="Guided operator workflow — audience, sequence, personalized video page, preview, confirm, enroll. No autonomous sends."
        icon={Rocket}
        iconClassName="bg-fuchsia-50 text-fuchsia-600"
      />
      <GrowthSendrLaunchWizard />
    </GrowthWorkspacePageContent>
  )
}
