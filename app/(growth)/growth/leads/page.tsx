"use client"

import { ListOrdered } from "lucide-react"
import { GrowthLeadInboxDashboard } from "@/components/growth/lead-operator/growth-lead-inbox-dashboard"
import { GrowthWorkspacePageHeader } from "@/components/growth/shell/growth-workspace-page-header"
import { GROWTH_WORKSPACE_QUEUE_QA_MARKER } from "@/lib/growth/navigation/growth-navigation-destinations"

export default function GrowthLeadsPage() {
  return (
    <div
      className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 md:px-6 md:py-8"
      data-growth-workspace-queue-marker={GROWTH_WORKSPACE_QUEUE_QA_MARKER}
    >
      <GrowthWorkspacePageHeader
        title="Revenue Queue"
        description="Prioritized accounts requiring operator review, enrichment, approval, or pipeline action."
        icon={ListOrdered}
        iconClassName="bg-emerald-50 text-emerald-600"
      />

      <GrowthLeadInboxDashboard />
    </div>
  )
}
