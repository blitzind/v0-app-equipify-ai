"use client"

import { PhoneCall } from "lucide-react"
import { GrowthCallQueueWorkspace } from "@/components/growth/growth-call-queue-workspace"
import { GrowthWorkspacePageHeader } from "@/components/growth/shell/growth-workspace-page-header"
import { GrowthWorkspacePageContent } from "@/components/growth/shell/growth-workspace-page-content"

export default function GrowthLeadsCallQueuePage() {
  return (
    <GrowthWorkspacePageContent>
      <GrowthWorkspacePageHeader
        title="Call Queue"
        description="Ranked Growth Leads worth calling next, based on research fit and workflow signals."
        icon={PhoneCall}
        iconClassName="bg-emerald-50 text-emerald-600"
      />

      <GrowthCallQueueWorkspace showPageHeader={false} />
    </GrowthWorkspacePageContent>
  )
}
