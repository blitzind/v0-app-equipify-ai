"use client"

import { Activity } from "lucide-react"
import { GrowthSendrActivityDashboard } from "@/components/growth/sendr/growth-sendr-activity-dashboard"
import { GROWTH_PERSONALIZED_VIDEOS_PRODUCT_LABEL } from "@/lib/growth/sendr/growth-sendr-branding"
import { GrowthWorkspacePageHeader } from "@/components/growth/shell/growth-workspace-page-header"
import { GrowthWorkspacePageContent } from "@/components/growth/shell/growth-workspace-page-content"

export default function GrowthSendrActivityPage() {
  return (
    <GrowthWorkspacePageContent>
      <GrowthWorkspacePageHeader
        title={`${GROWTH_PERSONALIZED_VIDEOS_PRODUCT_LABEL} Activity`}
        description="Prospect activity timeline and follow-up workspace — read-only intelligence, operator-driven actions."
        icon={Activity}
        iconClassName="bg-fuchsia-50 text-fuchsia-600"
      />
      <GrowthSendrActivityDashboard />
    </GrowthWorkspacePageContent>
  )
}
