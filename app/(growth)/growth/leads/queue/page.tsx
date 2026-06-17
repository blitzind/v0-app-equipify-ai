"use client"

import { PhoneCall } from "lucide-react"
import { GrowthCallQueueWorkspace } from "@/components/growth/growth-call-queue-workspace"
import { GrowthWorkspacePageHeader } from "@/components/growth/shell/growth-workspace-page-header"

export default function GrowthLeadsCallQueuePage() {
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 md:px-6 md:py-8">
      <GrowthWorkspacePageHeader
        title="Call Queue"
        description="Ranked Growth Leads worth calling next, based on research fit and workflow signals."
        icon={PhoneCall}
        iconClassName="bg-emerald-50 text-emerald-600"
      />

      <GrowthCallQueueWorkspace showPageHeader={false} />
    </div>
  )
}
