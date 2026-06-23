"use client"

import { Activity } from "lucide-react"
import { GeV15AutomationRuntimeApprovalInbox } from "@/components/growth/automation/ge-v1-5-automation-runtime-approval-inbox"
import { GrowthActivityWorkspace } from "@/components/growth/activity/growth-activity-workspace"
import { GrowthWorkspacePageHeader } from "@/components/growth/shell/growth-workspace-page-header"
import { GrowthWorkspacePageContent } from "@/components/growth/shell/growth-workspace-page-content"

export default function GrowthActivityPage() {
  return (
    <GrowthWorkspacePageContent>
      <GrowthWorkspacePageHeader
        title="Activity"
        description="Unified prospect activity timeline — communication, content, sales, AI, and intelligence signals."
        icon={Activity}
        iconClassName="bg-violet-50 text-violet-600"
      />
      <div className="space-y-6">
      <GeV15AutomationRuntimeApprovalInbox limit={10} />
      <GrowthActivityWorkspace />
      </div>
    </GrowthWorkspacePageContent>
  )
}
