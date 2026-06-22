"use client"

import { Sparkles } from "lucide-react"
import { GrowthSendrWorkspaceHome } from "@/components/growth/sendr/growth-sendr-workspace-home"
import { GROWTH_PERSONALIZED_VIDEOS_PRODUCT_LABEL } from "@/lib/growth/sendr/growth-sendr-branding"
import { GrowthWorkspacePageHeader } from "@/components/growth/shell/growth-workspace-page-header"
import { GrowthWorkspacePageContent } from "@/components/growth/shell/growth-workspace-page-content"

export default function GrowthPersonalizedVideosWorkspacePage() {
  return (
    <GrowthWorkspacePageContent>
      <GrowthWorkspacePageHeader
        title={GROWTH_PERSONALIZED_VIDEOS_PRODUCT_LABEL}
        description="Personalized video pages — create, attach media and booking, preview variables, publish manually."
        icon={Sparkles}
        iconClassName="bg-fuchsia-50 text-fuchsia-600"
      />
      <GrowthSendrWorkspaceHome />
    </GrowthWorkspacePageContent>
  )
}
