"use client"

import { Suspense } from "react"
import { PlayCircle } from "lucide-react"
import { GeV15AutomationRuntimeApprovalInbox } from "@/components/growth/automation/ge-v1-5-automation-runtime-approval-inbox"
import { GrowthSequenceExecutionPanels } from "@/components/growth/sequences/growth-sequence-execution-panels"
import { GrowthWorkspacePageHeader } from "@/components/growth/shell/growth-workspace-page-header"
import { GrowthWorkspacePageContent } from "@/components/growth/shell/growth-workspace-page-content"

function SequenceExecutionFallback() {
  return <p className="text-sm text-muted-foreground">Loading sequence execution…</p>
}

export default function GrowthCampaignsSequenceExecutionPage() {
  return (
    <GrowthWorkspacePageContent data-growth-workspace-sequence-execution="v1">
      <GrowthWorkspacePageHeader
        title="Sequence Execution"
        description="Guided enrollments with human approval at every step — no autonomous send."
        icon={PlayCircle}
        iconClassName="bg-emerald-50 text-emerald-600"
      />

      <div className="space-y-6">
      <GeV15AutomationRuntimeApprovalInbox limit={10} />

      <Suspense fallback={<SequenceExecutionFallback />}>
        <GrowthSequenceExecutionPanels />
      </Suspense>
      </div>
    </GrowthWorkspacePageContent>
  )
}
