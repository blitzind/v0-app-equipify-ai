"use client"

import { BarChart3 } from "lucide-react"
import { GrowthSendrAnalyticsDashboard } from "@/components/growth/sendr/growth-sendr-analytics-dashboard"
import { GROWTH_PERSONALIZED_VIDEOS_PRODUCT_LABEL } from "@/lib/growth/sendr/growth-sendr-branding"
import { GrowthWorkspacePageHeader } from "@/components/growth/shell/growth-workspace-page-header"
import { GrowthWorkspacePageContent } from "@/components/growth/shell/growth-workspace-page-content"

export default function GrowthSendrAnalyticsPage() {
  return (
    <GrowthWorkspacePageContent>
      <GrowthWorkspacePageHeader
        title={`${GROWTH_PERSONALIZED_VIDEOS_PRODUCT_LABEL} Analytics`}
        description="Performance dashboard and pipeline intelligence — read-only, operator-driven review."
        icon={BarChart3}
        iconClassName="bg-fuchsia-50 text-fuchsia-600"
      />
      <GrowthSendrAnalyticsDashboard />
    </GrowthWorkspacePageContent>
  )
}
