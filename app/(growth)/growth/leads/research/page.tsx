"use client"

import { ListOrdered } from "lucide-react"
import { GrowthRevenueQueueDashboard } from "@/components/growth/lead-operator/growth-lead-inbox-dashboard"
import { GrowthWorkspacePageHeader } from "@/components/growth/shell/growth-workspace-page-header"
import { GROWTH_WORKSPACE_QUEUE_QA_MARKER } from "@/lib/growth/navigation/growth-navigation-destinations"
import { GrowthWorkspacePageContent } from "@/components/growth/shell/growth-workspace-page-content"

export default function GrowthLeadsResearchPage() {
  return (
    <GrowthWorkspacePageContent
      data-growth-workspace-queue-marker={GROWTH_WORKSPACE_QUEUE_QA_MARKER}
    >
      <GrowthWorkspacePageHeader
        title="Revenue Queue"
        description="Prioritized accounts requiring operator review, enrichment, approval, or pipeline action."
        icon={ListOrdered}
        iconClassName="bg-emerald-50 text-emerald-600"
      />

      <GrowthRevenueQueueDashboard />
    </GrowthWorkspacePageContent>
  )
}
